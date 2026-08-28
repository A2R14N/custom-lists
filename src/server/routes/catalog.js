import { isCatalogId } from '../../../shared/lists.js';
import { redisFromUserId, decodeStored } from '../../services/user-store.js';

export async function handleCatalog(req, res) {
  const { configuration, id, extra } = req.params;
  if (!configuration || !isCatalogId(id)) return res.json({ metas: [] });
  try {
    const redis = redisFromUserId(configuration);
    // No config/API-key dependency: even old Trakt caches with expired keys still work.
    const cached = decodeStored(await redis.get(id));
    if (!Array.isArray(cached)) return res.json({ metas: [] });
    if (extra) {
      const value = new URLSearchParams(extra).get('skip');
      if (value !== null) {
        const skip = Number(value);
        if (!Number.isSafeInteger(skip) || skip < 0) return res.status(400).json({ metas: [] });
        return res.json({ metas: cached.slice(skip, skip + 100) });
      }
    }
    // Preserve full-list responses for existing installations.
    return res.json({ metas: cached });
  } catch { return res.status(502).json({ metas: [], error: 'Could not read this saved catalog.' }); }
}
