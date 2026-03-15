import { redisFromUserId, decodeUserId } from './userconfig.js';

/**
 * Build configured manifest route handler.
 * userId = base64url(upstashUrl + "|" + upstashToken)
 * Reads stremio:config from the user's own Upstash Redis to build the manifest.
 */
export async function handleConfiguredManifest(req, res, mixpanel) {
  res.setHeader('Cache-Control', 'max-age=3600,stale-while-revalidate=3600,stale-if-error=86400,public');
  res.setHeader('content-type', 'application/json');

  const userId = req.params.configuration;
  if (!userId) {
    return res.status(400).json({ error: 'Missing userId in URL.' });
  }

  let config = { lists: [] };
  try {
    const redis = redisFromUserId(userId);
    const raw = await redis.get('stremio:config');
    if (raw) {
      config = typeof raw === 'string' ? JSON.parse(raw) : raw;
    }
  } catch (e) {
    console.error('[Manifest] Failed to load config from user Redis:', e.message);
  }

  const catalogs = (config.lists || []).map((list) => {
    const sortSuffix = list.sort ? `:${list.sort}` : '';
    return {
      id: `trakt:${list.username}:${list.listId}${sortSuffix}`,
      type: list.categoryName,
      name: `${list.username} / ${list.listId}`,
    };
  });

  const layoutTypes = ['movie', 'series'];
  catalogs.forEach((cat) => {
    if (!layoutTypes.includes(cat.type)) layoutTypes.push(cat.type);
  });

  res.send({
    id: 'community.trakt.custom-lists',
    logo: 'https://raw.githubusercontent.com/A2R14N/stremio-custom-lists/main/icon.png',
    version: process.env.npm_package_version || '1.1.0',
    name: 'Stremio Custom Lists',
    description: 'Import personal Trakt.tv watchlists into Stremio. Serverless, zero tracking, and fully cached on your own Upstash Redis.',
    catalogs,
    resources: ['catalog'],
    types: layoutTypes,
    idPrefixes: ['tt'],
    behaviorHints: { configurable: true },
  });
}

/**
 * Default fallback manifest handler (no userId in URL).
 */
export function handleDefaultManifest(req, res, mixpanel) {
  res.setHeader('Cache-Control', 'max-age=86400,stale-while-revalidate=86400,stale-if-error=86400,public');
  res.setHeader('content-type', 'application/json');

  res.send({
    id: 'community.trakt.custom-lists',
    logo: 'https://raw.githubusercontent.com/A2R14N/stremio-custom-lists/main/icon.png',
    version: process.env.npm_package_version || '1.1.0',
    name: 'Stremio Custom Lists',
    description: 'Import personal Trakt.tv watchlists into Stremio. Serverless, zero tracking, and fully cached on your own Upstash Redis.',
    catalogs: [],
    resources: ['catalog'],
    types: [],
    idPrefixes: ['tt'],
    behaviorHints: { configurable: true },
  });
}
