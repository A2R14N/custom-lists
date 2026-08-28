import { createUserRedis, validateCredentials, encodeUserId, decodeUserId, redisFromUserId,
  readConfig, mergeConfig, configForUi, CONFIG_KEY } from '../../services/user-store.js';
import { startImport, advanceImport } from '../../services/imports.js';
import { providerError } from '../../services/providers.js';

// Keep these exports for code which used the original module.
export { encodeUserId, decodeUserId, redisFromUserId } from '../../services/user-store.js';

export async function handleConnect(req, res) {
  let creds;
  try { creds = validateCredentials(req.body?.upstashUrl, req.body?.upstashToken); }
  catch (error) { return res.status(400).json({ error: error.message }); }
  try {
    const redis = createUserRedis(creds.upstashUrl, creds.upstashToken);
    await redis.ping();
    // Connection verification is strictly read-only. Never clear an existing config.
    return res.json(await configForUi(redis, creds, encodeUserId(creds.upstashUrl, creds.upstashToken)));
  } catch { return res.status(422).json({ error: 'Could not read this Upstash database. Check its URL, token and saved configuration.' }); }
}

export async function handleSaveConfig(req, res) {
  let creds;
  try { creds = validateCredentials(req.body?.upstashUrl, req.body?.upstashToken); }
  catch (error) { return res.status(400).json({ error: error.message }); }
  try {
    const redis = createUserRedis(creds.upstashUrl, creds.upstashToken);
    const previous = await readConfig(redis);
    let config;
    try { config = mergeConfig(previous, req.body); }
    catch (error) { return res.status(400).json({ error: error.message }); }
    await redis.set(CONFIG_KEY, JSON.stringify(config));
    return res.json({ userId: encodeUserId(creds.upstashUrl, creds.upstashToken) });
  } catch { return res.status(502).json({ error: 'Could not save configuration to your Redis. Existing catalog snapshots were not changed.' }); }
}

export async function handleGetConfig(req, res) {
  let creds;
  try { creds = decodeUserId(req.params.userId); }
  catch { return res.status(400).json({ error: 'Invalid install identifier.' }); }
  try {
    const redis = createUserRedis(creds.upstashUrl, creds.upstashToken);
    return res.json(await configForUi(redis, creds, req.params.userId));
  } catch { return res.status(502).json({ error: 'Could not read the saved configuration from your Redis.' }); }
}

export async function handleCacheList(req, res) {
  try {
    const redis = redisFromUserId(req.params.userId);
    return res.json(await startImport(redis, req.body?.list || req.body));
  } catch (error) { return res.status(400).json({ error: providerError(error) }); }
}

export async function handleCacheStep(req, res) {
  try {
    const redis = redisFromUserId(req.params.userId);
    return res.json(await advanceImport(redis, req.params.jobId, req.body?.step));
  } catch (error) { return res.status(400).json({ error: providerError(error) }); }
}
