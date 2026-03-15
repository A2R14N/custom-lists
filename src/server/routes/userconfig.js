import { Redis } from '@upstash/redis';
import axios from 'axios';
import { fetchCinemetaMeta, getBasicMeta } from '../../services/cinemeta.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Encode Upstash credentials into a URL-safe identifier.
 * userId = base64url(upstashUrl + "|" + upstashToken)
 */
export function encodeUserId(upstashUrl, upstashToken) {
  const raw = `${upstashUrl}|${upstashToken}`;
  return Buffer.from(raw).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decode a userId back into { upstashUrl, upstashToken }.
 */
export function decodeUserId(userId) {
  let b64 = userId.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  const raw = Buffer.from(b64, 'base64').toString('utf8');
  const sep = raw.indexOf('|');
  if (sep === -1) throw new Error('Invalid userId format');
  return {
    upstashUrl: raw.slice(0, sep),
    upstashToken: raw.slice(sep + 1),
  };
}

/**
 * Create a Redis client from a userId.
 */
export function redisFromUserId(userId) {
  const { upstashUrl, upstashToken } = decodeUserId(userId);
  return new Redis({ url: upstashUrl, token: upstashToken });
}

// ─── Route Handlers ───────────────────────────────────────────────────────────

/**
 * POST /api/config
 * Body: { upstashUrl, upstashToken, traktClientId, lists[] }
 * Validates Upstash connection, saves stremio:config to user's Redis, returns { userId }.
 */
export async function handleSaveConfig(req, res) {
  const { upstashUrl, upstashToken, traktClientId, lists } = req.body;

  if (!upstashUrl || !upstashToken) {
    return res.status(400).json({ error: 'upstashUrl and upstashToken are required.' });
  }

  let redis;
  try {
    redis = new Redis({ url: upstashUrl, token: upstashToken });
    // Validate connection with a ping
    await redis.ping();
  } catch (e) {
    console.error('[UserConfig] Redis connection failed:', e.message);
    return res.status(422).json({ error: 'Could not connect to Upstash Redis. Check your URL and token.' });
  }

  const config = {
    traktClientId: traktClientId || '',
    lists: Array.isArray(lists) ? lists : [],
    updatedAt: new Date().toISOString(),
  };

  try {
    await redis.set('stremio:config', JSON.stringify(config));
  } catch (e) {
    console.error('[UserConfig] Failed to save config to Redis:', e.message);
    return res.status(500).json({ error: 'Failed to save config to Redis.' });
  }

  const userId = encodeUserId(upstashUrl, upstashToken);
  return res.json({ userId });
}

/**
 * GET /api/config/:userId
 * Returns the saved stremio:config from the user's Redis.
 * Also returns the decoded credentials so the UI can pre-fill all fields.
 */
export async function handleGetConfig(req, res) {
  const { userId } = req.params;

  let redis, creds;
  try {
    creds = decodeUserId(userId);
    redis = new Redis({ url: creds.upstashUrl, token: creds.upstashToken });
  } catch (e) {
    return res.status(400).json({ error: 'Invalid userId.' });
  }

  let config;
  try {
    const raw = await redis.get('stremio:config');
    config = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : { traktClientId: '', lists: [] };
  } catch (e) {
    console.error('[UserConfig] Failed to read config from Redis:', e.message);
    return res.status(500).json({ error: 'Failed to read config from Redis.' });
  }

  return res.json({
    upstashUrl: creds.upstashUrl,
    upstashToken: creds.upstashToken,
    traktClientId: config.traktClientId || '',
    lists: config.lists || [],
  });
}

/**
 * POST /api/cache/:userId
 * Body: { username, listId, sort }
 * Fetches the full Trakt list, resolves Cinemeta metas, caches in Redis.
 * Streams SSE progress: { done, total, status: 'progress'|'done'|'error' }
 */
export async function handleCacheList(req, res) {
  const { userId } = req.params;
  const { username, listId, sort, traktClientId } = req.body;

  if (!username || !listId || !traktClientId) {
    return res.status(400).json({ error: 'username, listId, and traktClientId are required.' });
  }

  let redis;
  try {
    redis = redisFromUserId(userId);
  } catch (e) {
    return res.status(400).json({ error: 'Invalid userId.' });
  }

  // SSE setup
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    // 1. Fetch all pages from Trakt
    let items = [];
    let page = 1;
    const limit = 1000;
    let totalPages = 1;

    do {
      const queryParams = [`page=${page}`, `limit=${limit}`];
      if (sort) queryParams.push(`sort=${sort}`);
      const resTrakt = await axios.get(
        `https://api.trakt.tv/users/${username}/lists/${listId}/items?${queryParams.join('&')}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'trakt-api-version': '2',
            'trakt-api-key': traktClientId,
          },
          timeout: 15000,
        }
      );
      items = items.concat(resTrakt.data || []);
      const pageCountHeader = resTrakt.headers['x-pagination-page-count'];
      totalPages = pageCountHeader ? parseInt(pageCountHeader, 10) || 1 : 1;
      page++;
    } while (page <= totalPages);

    // Filter to valid movie/show items with imdb IDs
    const validItems = items.filter((item) => {
      const type = item.type;
      if (type !== 'movie' && type !== 'show') return false;
      return item[type]?.ids?.imdb;
    });

    const total = validItems.length;
    sendEvent({ status: 'progress', done: 0, total });

    // 2. Resolve metas in chunks
    const resultItems = [];
    const chunkSize = 20;

    for (let i = 0; i < validItems.length; i += chunkSize) {
      const chunk = validItems.slice(i, i + chunkSize);
      const metas = await Promise.all(
        chunk.map(async (item) => {
          const type = item.type;
          const media = item[type];
          const imdbId = media.ids.imdb;
          const title = media.title;
          const year = media.year;
          const stremioType = type === 'show' ? 'series' : 'movie';

          let meta = await fetchCinemetaMeta(imdbId, stremioType, title);
          if (!meta) {
            meta = getBasicMeta(imdbId, title, stremioType);
            meta.releaseInfo = year ? year.toString() : undefined;
          }
          return meta;
        })
      );

      for (const meta of metas) {
        if (meta) resultItems.push(meta);
      }

      sendEvent({ status: 'progress', done: Math.min(i + chunkSize, total), total });
    }

    // 3. Store in Redis under a well-known cache key
    const redisKey = `trakt:${username}:${listId}${sort ? `:${sort}` : ''}`;
    await redis.set(redisKey, JSON.stringify(resultItems));

    sendEvent({ status: 'done', done: resultItems.length, total: resultItems.length });
    res.end();
  } catch (e) {
    console.error('[Cache] Error caching list:', e.message);
    sendEvent({ status: 'error', message: e.message });
    res.end();
  }
}
