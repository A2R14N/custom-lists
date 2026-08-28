import { Redis } from '@upstash/redis';
import { normalizeList, catalogId } from '../../shared/lists.js';
import { selectCoverPosters } from './artwork.js';

export const CONFIG_KEY = 'stremio:config';

export function validateCredentials(upstashUrl, upstashToken) {
  if (typeof upstashUrl !== 'string' || typeof upstashToken !== 'string') throw new Error('Upstash URL and REST token are required.');
  const url = new URL(upstashUrl.trim());
  // Never turn a public endpoint into an arbitrary server-side HTTP proxy.
  if (url.protocol !== 'https:' || !/^[a-z0-9-]+\.upstash\.io$/i.test(url.hostname) ||
      url.port || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('Use your HTTPS Upstash REST endpoint (https://…upstash.io).');
  }
  const token = upstashToken.trim();
  if (!token || token.length > 4096 || /\s/.test(token)) throw new Error('Invalid Upstash REST token.');
  return { upstashUrl: url.origin, upstashToken: token };
}

export function encodeUserId(url, token) {
  const creds = validateCredentials(url, token);
  return Buffer.from(`${creds.upstashUrl}|${creds.upstashToken}`).toString('base64url');
}

export function decodeUserId(userId) {
  // The optional suffix changes the install path, never the database or cache keys.
  const encoded = String(userId || '').split('~')[0];
  if (!/^[a-zA-Z0-9_-]{1,8192}$/.test(encoded)) throw new Error('Invalid install identifier.');
  const raw = Buffer.from(encoded, 'base64url').toString('utf8');
  const separator = raw.indexOf('|');
  if (separator < 1) throw new Error('Invalid install identifier.');
  return validateCredentials(raw.slice(0, separator), raw.slice(separator + 1));
}

export function createUserRedis(url, token) {
  const creds = validateCredentials(url, token);
  return new Redis({ url: creds.upstashUrl, token: creds.upstashToken, retry: { retries: 0 } });
}

export function redisFromUserId(userId) {
  const creds = decodeUserId(userId);
  return createUserRedis(creds.upstashUrl, creds.upstashToken);
}

export function decodeStored(value) {
  return typeof value === 'string' ? JSON.parse(value) : value;
}

export async function readConfig(redis) {
  const raw = decodeStored(await redis.get(CONFIG_KEY));
  if (raw != null && (typeof raw !== 'object' || Array.isArray(raw))) throw new Error('Invalid saved configuration.');
  return raw || { lists: [] };
}

export function mergeConfig(previous, body) {
  const next = { ...previous, schemaVersion: 2, updatedAt: new Date().toISOString() };
  for (const field of ['mdblistApiKey', 'tmdbAccessToken', 'traktClientId', 'cacheBuster']) {
    if (Object.hasOwn(body, field)) {
      if (typeof body[field] !== 'string' || body[field].length > 4096) throw new Error(`Invalid ${field}.`);
      next[field] = body[field].trim();
    }
  }
  if (Object.hasOwn(body, 'lists')) {
    if (!Array.isArray(body.lists) || body.lists.length > 200) throw new Error('Use at most 200 lists per configuration.');
    next.lists = body.lists.map(normalizeList);
    const ids = next.lists.map(list => `${catalogId(list)}|${list.categoryName}`);
    if (new Set(ids).size !== ids.length) throw new Error('This list is already in that category.');
  }
  return next;
}

export async function configForUi(redis, creds, userId) {
  const config = await readConfig(redis);
  const lists = await Promise.all((config.lists || []).map(async input => {
    const list = normalizeList(input);
    const metas = decodeStored(await redis.get(catalogId(list)));
    return { ...list, cached: Array.isArray(metas), itemCount: Array.isArray(metas) ? metas.length : 0,
      coverPosters: selectCoverPosters(metas) };
  }));
  return { ...creds, userId, lists, mdblistApiKey: config.mdblistApiKey || '',
    tmdbAccessToken: config.tmdbAccessToken || '', traktClientId: config.traktClientId || '', cacheBuster: config.cacheBuster || '' };
}
