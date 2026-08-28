import { randomUUID } from 'node:crypto';
import { catalogId } from '../../shared/lists.js';
import { decodeStored, readConfig } from './user-store.js';
import { requireProviderKey, fetchProviderPage, resolvePage, MAX_ITEMS } from './providers.js';
import { selectCoverPosters } from './artwork.js';

const JOB_TTL = 3600;
const jobKey = id => `stremio:import:${id}`;
const progress = job => ({ jobId: job.id, step: job.step, status: job.status,
  done: job.metas.length, processed: job.processed, skipped: job.skipped, total: job.total,
  ...(job.status === 'done' ? { coverPosters: selectCoverPosters(job.metas) } : {}) });

export async function startImport(redis, input) {
  const key = catalogId(input);
  const config = await readConfig(redis);
  const list = (config.lists || []).find(item => catalogId(item) === key);
  if (!list) throw new Error('Save this list to your configuration before importing.');
  requireProviderKey(list.provider || 'trakt', config);
  const job = { id: randomUUID(), list, key, step: 0, status: 'progress', position: {},
    metas: [], processed: 0, skipped: 0, total: null };
  await redis.set(jobKey(job.id), JSON.stringify(job), { ex: JOB_TTL });
  return progress(job);
}

export async function advanceImport(redis, id, expectedStep) {
  if (!/^[0-9a-f-]{36}$/i.test(id) || !Number.isInteger(expectedStep) || expectedStep < 0) throw new Error('Invalid import request.');
  const key = jobKey(id);
  const locked = await redis.set(`${key}:lock`, 'busy', { nx: true, ex: 90 });
  if (!locked) throw new Error('This import is already processing. Please retry.');
  try {
    const job = decodeStored(await redis.get(key));
    if (!job) throw new Error('Import expired. Start it again; the saved snapshot is unchanged.');
    // A response lost in transit can be retried without appending the page twice.
    if (expectedStep < job.step || job.status === 'done') return progress(job);
    if (expectedStep !== job.step) throw new Error('Import progress is out of sync. Please retry.');
    const config = await readConfig(redis);
    if (!(config.lists || []).some(list => catalogId(list) === job.key)) throw new Error('The list was removed from this configuration.');
    const page = await fetchProviderPage(job.list, config, job.position);
    if (page.items.length > 1000 || job.processed + page.items.length > MAX_ITEMS || job.step >= 1000) {
      throw new Error(`This importer supports up to ${MAX_ITEMS} items. The previous snapshot is unchanged.`);
    }
    const metas = await resolvePage(job.list, config, page.items);
    const known = new Set(job.metas.map(meta => `${meta.type}:${meta.id}`));
    for (const meta of metas) {
      const identity = `${meta.type}:${meta.id}`;
      if (!known.has(identity)) { job.metas.push(meta); known.add(identity); }
    }
    job.processed += page.items.length;
    job.skipped += page.items.length - metas.length;
    job.total = Number.isFinite(page.total) ? page.total : null;
    job.position = page.next;
    job.step++;
    if (!page.next) {
      const existing = decodeStored(await redis.get(job.key));
      if (!job.metas.length && (job.processed > 0 || (Array.isArray(existing) && existing.length))) {
        throw new Error('No usable titles were returned. The previous snapshot has been kept.');
      }
      // One SET publishes the completed snapshot. Never expire or delete it.
      await redis.set(job.key, JSON.stringify(job.metas));
      job.status = 'done';
    }
    try { await redis.set(key, JSON.stringify(job), { ex: JOB_TTL }); }
    catch (error) {
      // Publishing succeeded: a progress-record failure must not report the
      // completed snapshot as a failed import. In-flight pages still fail safely.
      if (job.status !== 'done') throw error;
    }
    return progress(job);
  } finally {
    try { await redis.del(`${key}:lock`); } catch { /* The lock expires automatically. */ }
  }
}
