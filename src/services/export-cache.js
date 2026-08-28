import { createHash } from 'node:crypto';
import { prepareExportList } from '../../shared/export-core.js';
import { normalizeList, catalogId } from '../../shared/lists.js';
import { redisFromUserId, readConfig, mergeConfig, CONFIG_KEY } from './user-store.js';
import { selectCoverPosters } from './artwork.js';

export async function cacheListExport(redis, body) {
  const provider = body?.provider ?? 'wetrakr';
  if (!['wetrakr', 'imdb'].includes(provider)) throw new Error('Invalid list export provider.');
  const label = provider === 'imdb' ? 'IMDb' : 'WeTrakr';
  const prepared = prepareExportList(body?.sourceName, body?.items, label);
  if (!prepared.metas.length) throw new Error(`${label} export: no supported IMDb titles were found. Your previous cache is unchanged.`);
  // The export has no list IDs. Its exact, normalized source name gives repeat
  // uploads a stable identity, separate from every legacy/provider cache key.
  const list = normalizeList({ provider, sourceName: provider === 'imdb' ? prepared.sourceName : undefined,
    listId: createHash('sha256').update(prepared.sourceName).digest('hex'),
    name: prepared.sourceName.slice(0, 120), categoryName: body.categoryName });
  const key = catalogId(list), config = await readConfig(redis);
  const existing = (config.lists || []).find(item => catalogId(item) === key);
  const next = mergeConfig(config, { lists: existing ? config.lists : [...(config.lists || []), list] });
  const snapshot = JSON.stringify(prepared.metas);
  if (Buffer.byteLength(snapshot) > 4 * 1024 * 1024) throw new Error(`${label} export: this list is too large to cache in one request.`);
  // Publish the complete list and its configuration together. No partial list
  // becomes visible if validation or the Redis transaction fails.
  await redis.multi().set(key, snapshot).set(CONFIG_KEY, JSON.stringify(next)).exec();
  return { list: { ...(existing ? normalizeList(existing) : list), cached: true,
    itemCount: prepared.metas.length, coverPosters: selectCoverPosters(prepared.metas) },
    total: prepared.total, skipped: prepared.skipped, missingIds: prepared.missingIds,
    unsupported: prepared.unsupported, duplicates: prepared.duplicates };
}

// Retained for callers using the original WeTrakr helper.
export const cacheWeTrakrExport = (redis, body) => cacheListExport(redis, { ...body, provider: 'wetrakr' });

export async function handleListExport(req, res) {
  try { return res.json(await cacheListExport(redisFromUserId(req.params.userId), req.body)); }
  catch (error) {
    const message = error.message || '';
    return res.status(400).json({ error: /^(WeTrakr export:|IMDb export:|Use at most 200|Use letters|Invalid list)/.test(message)
      ? message : 'Could not cache this export. Check your Upstash connection and retry; no incomplete snapshot was published.' });
  }
}
