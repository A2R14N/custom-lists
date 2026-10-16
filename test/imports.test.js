import { test } from "node:test";
import assert from "node:assert/strict";
import axios from "axios";
import { catalogId } from "../shared/lists.js";
import { CONFIG_KEY } from "../src/services/user-store.js";
import { providerError } from "../src/services/providers.js";
import { startImport, advanceImport } from "../src/services/imports.js";
import { MemoryRedis, mdb, entry, database, request } from "./helpers/addon.js";

test("public import API advances a job in the requesting user database", async () => {
  const db = database();
  await db.redis.set(CONFIG_KEY, { lists: [mdb], mdblistApiKey: "key" });
  axios.get = async () => ({ data: { items: [entry(42)] }, headers: {} });
  const start = await request(`/api/cache/${db.userId}`, { list: mdb });
  assert.equal(start.status, 200);
  const step = await request(`/api/cache/${db.userId}/${start.data.jobId}`, { step: 0 });
  assert.equal(step.status, 200);
  assert.equal(step.data.status, "done");
  const catalog = await request(`/${db.userId}/catalog/movie/${catalogId(mdb)}.json`);
  assert.equal(catalog.data.metas[0].id, "tt42");
});

test("import jobs cannot be read through another user database", async () => {
  const alpha = database();
  const beta = database("beta.upstash.io");
  await alpha.redis.set(CONFIG_KEY, { lists: [mdb], mdblistApiKey: "key" });
  const start = await request(`/api/cache/${alpha.userId}`, { list: mdb });
  const wrong = await request(`/api/cache/${beta.userId}/${start.data.jobId}`, {
    step: 0,
  });
  assert.equal(wrong.status, 400);
  assert.match(wrong.data.error, /Import expired/);
  assert.equal(await beta.redis.get(catalogId(mdb)), null);
});

test("missing provider keys, expired jobs and removed lists cannot replace snapshots", async () => {
  const redis = new MemoryRedis();
  await redis.set(CONFIG_KEY, { lists: [mdb] });
  await assert.rejects(startImport(redis, mdb), /MDBList API key/);
  await redis.set(CONFIG_KEY, { lists: [mdb], mdblistApiKey: "key" });
  const job = await startImport(redis, mdb);
  await redis.set(CONFIG_KEY, { lists: [], mdblistApiKey: "key" });
  await assert.rejects(advanceImport(redis, job.jobId, 0), /removed/);
  await redis.del(`stremio:import:${job.jobId}`);
  await assert.rejects(advanceImport(redis, job.jobId, 0), /expired/);
});

test("provider and Redis errors cannot reflect secrets to callers", () => {
  const secret = "https://secret.upstash.io?token=hidden";
  assert.ok(!providerError(new Error(secret)).includes(secret));
  assert.ok(
    !providerError(
      Object.assign(new Error(secret), { isAxiosError: true, response: { status: 401 } }),
    ).includes(secret),
  );
});
