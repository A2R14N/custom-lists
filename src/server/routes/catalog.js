import axios from 'axios';
import { fetchCinemetaMeta, getBasicMeta } from '../../services/cinemeta.js';
import { redisFromUserId } from './userconfig.js';

/**
 * Catalog route handler.
 * userId = base64url(upstashUrl + "|" + upstashToken)
 * Reads stremio:config from user's Redis for traktClientId.
 * Checks Redis cache first; on miss fetches from Trakt and caches result.
 */
export async function handleCatalog(req, res, mixpanel) {
  res.setHeader('Cache-Control', 'max-age=86400,stale-while-revalidate=86400,stale-if-error=86400,public');
  res.setHeader('content-type', 'application/json');

  const userId = req.params.configuration;
  if (!userId) {
    return res.send({ metas: [] });
  }

  // Connect to user's Redis
  let redis;
  try {
    redis = redisFromUserId(userId);
  } catch (e) {
    console.error('[Catalog] Invalid userId:', e.message);
    return res.send({ metas: [] });
  }

  // Load user config to get traktClientId
  let traktClientId;
  try {
    const raw = await redis.get('stremio:config');
    const config = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : {};
    traktClientId = config.traktClientId;
  } catch (e) {
    console.error('[Catalog] Failed to load config from Redis:', e.message);
    return res.send({ metas: [] });
  }

  if (!traktClientId) {
    console.warn('[Catalog] No traktClientId found in user config.');
    return res.send({ metas: [] });
  }

  const { id } = req.params;

  // Stremio requests a Trakt Custom List (id = 'trakt:username:listId[:sort]')
  if (!id.startsWith('trakt:')) {
    return res.send({ metas: [] });
  }

  const parts = id.split(':');
  const username = parts[1];
  const listId = parts[2];
  const sort = parts.length > 3 ? parts.slice(3).join(':') : null;
  const redisKey = `trakt:${username}:${listId}${sort ? `:${sort}` : ''}`;

  // 1. Check Redis cache
  try {
    const cached = await redis.get(redisKey);
    if (cached) {
      console.log(`[Cache Hit] Serving ${listId} from user's Upstash.`);
      const metas = typeof cached === 'string' ? JSON.parse(cached) : cached;
      return res.send({ metas });
    }
  } catch (err) {
    console.error('[Redis] Cache get error:', err.message);
  }

  // 2. Cache miss — fetch live from Trakt
  try {
    console.log(`[Trakt Live Fetch] Fetching "${listId}" from "${username}"...`);

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
          timeout: 10000,
        }
      );

      items = items.concat(resTrakt.data || []);
      const pageCountHeader = resTrakt.headers['x-pagination-page-count'];
      totalPages = pageCountHeader ? parseInt(pageCountHeader, 10) || 1 : 1;
      page++;
    } while (page <= totalPages);

    // 3. Resolve metas in chunks
    const resultItems = [];
    const chunkSize = 20;

    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);
      const metas = await Promise.all(
        chunk.map(async (item) => {
          const type = item.type;
          if (type !== 'movie' && type !== 'show') return null;
          const media = item[type];
          if (!media) return null;
          const imdbId = media.ids?.imdb;
          if (!imdbId) return null;

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
    }

    // 4. Cache result in user's Redis
    try {
      await redis.set(redisKey, JSON.stringify(resultItems));
      console.log(`[Cache Save] Stored ${resultItems.length} items for ${listId} in user's Upstash.`);
    } catch (err) {
      console.error('[Redis] Cache save error:', err.message);
    }

    return res.send({ metas: resultItems });
  } catch (e) {
    console.error(`[Trakt API Error] Live fetch failed: ${e.message}`);
    return res.send({ metas: [] });
  }
}