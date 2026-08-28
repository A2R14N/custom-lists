import { redisFromUserId, readConfig } from '../../services/user-store.js';
import { normalizeList, catalogId, listLabel } from '../../../shared/lists.js';

function logoUrl(req) {
  // Use the current deployment origin, never the private configuration path.
  // Vercel terminates TLS in front of Express. Local Node remains HTTP by default.
  const forwardedProtocol = req.get('x-forwarded-proto')?.split(',')[0].trim();
  const protocol = process.env.VERCEL || forwardedProtocol === 'https' ? 'https' : req.protocol;
  return new URL('/brand/custom-lists-icon-v1.png', `${protocol}://${req.get('host')}`).href;
}

function manifest(req, lists = []) {
  const catalogs = lists.map(input => {
    const list = normalizeList(input);
    return { id: catalogId(list), type: list.categoryName, name: listLabel(list) };
  });
  return {
    // Stable identity and legacy IDs keep existing installations working.
    id: 'community.trakt.custom-lists',
    logo: logoUrl(req),
    version: '1.3.0', name: 'Custom Lists',
    description: 'MDBList, TMDB, IMDb and WeTrakr export catalogs, plus preserved Trakt snapshots. Your configuration and cached titles live in your own Upstash Redis.',
    catalogs, resources: ['catalog'], types: [...new Set(['movie', 'series', ...catalogs.map(item => item.type)])],
    idPrefixes: ['tt'], behaviorHints: { configurable: true },
  };
}

export async function handleConfiguredManifest(req, res) {
  try {
    const redis = redisFromUserId(req.params.configuration);
    const config = await readConfig(redis);
    return res.json(manifest(req, config.lists || []));
  } catch { return res.status(502).json({ error: 'Could not read the addon configuration from your Redis.' }); }
}

export function handleDefaultManifest(req, res) { return res.json(manifest(req)); }
