import { test } from "node:test";
import assert from "node:assert/strict";
import axios from "axios";
import { normalizeList, parseListUrl, catalogId, isCatalogId } from "../shared/lists.js";
import { CONFIG_KEY } from "../src/services/user-store.js";
import { startImport, advanceImport } from "../src/services/imports.js";
import { MemoryRedis, cached, legacy, database, request } from "./helpers/addon.js";
import { frontend } from "./helpers/frontend.js";

const list = normalizeList({ provider: "wetrakr-api", listId: "17599" });
const exported = normalizeList({ provider: "wetrakr", listId: "a".repeat(64) });
const title = (id, type = "movie") => ({
  type,
  title: `Title ${id}`,
  ids: { imdb: `tt${id}`, tmdb: id },
  poster_path: "/poster.jpg",
  release_date: "2026-01-02T00:00:00.000Z",
});
function page(data, current = 1, total = data.length, limit = 100) {
  return {
    data,
    headers: {
      "x-pagination-page": String(current),
      "x-pagination-limit": String(limit),
      "x-pagination-page-count": String(Math.ceil(total / limit)),
      "x-pagination-item-count": String(total),
    },
  };
}

test("WeTrakr public links have an API identity distinct from existing exports", () => {
  assert.equal(
    catalogId(parseListUrl("https://www.wetrakr.com/lists/17599/")),
    "wetrakr-api:17599",
  );
  assert.equal(catalogId(exported), `wetrakr:${"a".repeat(64)}`);
  assert.ok(isCatalogId(catalogId(list)));
  for (const id of [
    "wetrakr:17599",
    "wetrakr-api:0",
    "wetrakr-api:17599:extra",
    "wetrakr-api:abc",
  ])
    assert.equal(isCatalogId(id), false);
  for (const url of [
    "https://wetrakr.com.evil.test/lists/17599",
    "https://wetrakr.com/lists/0",
    "https://user:pass@wetrakr.com/lists/17599",
    "https://wetrakr.com/profile/lists",
  ])
    assert.throws(() => parseListUrl(url));
});

test("WeTrakr paginates with each user's key, preserves order and only publishes the finished snapshot", async () => {
  const redis = new MemoryRedis();
  await redis.set(CONFIG_KEY, {
    lists: [list, exported, legacy],
    wetrakrApiKey: "test-app-key",
  });
  for (const definition of [list, exported, legacy])
    await redis.set(catalogId(definition), JSON.stringify(cached));
  const calls = [];
  axios.get = async (url, options) => {
    assert.equal(url, "https://api.wetrakr.com/lists/17599/items/all");
    assert.deepEqual(options.headers, {
      "wetrakr-api-key": "test-app-key",
      "wetrakr-api-version": "1",
    });
    assert.equal(options.params.sort_by, "editor_rank");
    assert.equal(options.params.sort_dir, "asc");
    assert.equal(options.maxRedirects, 0);
    calls.push(options.params.page);
    return options.params.page === 1
      ? page(
          Array.from({ length: 100 }, (_, index) => title(index + 1)),
          1,
          105,
        )
      : page(
          [
            {
              ...title(101, "show"),
              poster_path: "https://images.example.test/show.jpg",
              first_air_date: "2020-01-01",
              release_date: undefined,
            },
            title(1),
            title(102, "episode"),
            { type: "movie", ids: {} },
            title(103),
          ],
          2,
          105,
        );
  };
  const job = await startImport(redis, list);
  const first = await advanceImport(redis, job.jobId, 0);
  assert.equal(first.status, "progress");
  assert.deepEqual(JSON.parse(await redis.get(catalogId(list))), cached);
  assert.deepEqual(await advanceImport(redis, job.jobId, 0), first);
  const done = await advanceImport(redis, job.jobId, 1);
  assert.equal(done.status, "done");
  assert.equal(done.done, 102);
  assert.equal(done.skipped, 3);
  assert.deepEqual(calls, [1, 2]);
  const saved = JSON.parse(await redis.get(catalogId(list)));
  assert.deepEqual(
    saved.map((item) => item.id),
    [...Array.from({ length: 101 }, (_, index) => `tt${index + 1}`), "tt103"],
  );
  assert.equal(saved[0].poster, "https://image.tmdb.org/t/p/w500/poster.jpg");
  assert.equal(saved[0].tmdb_id, 1);
  assert.equal(saved[100].type, "series");
  assert.equal(saved[100].releaseInfo, "2020");
  assert.equal(saved[100].poster, "https://images.example.test/show.jpg");
  for (const definition of [exported, legacy])
    assert.deepEqual(JSON.parse(await redis.get(catalogId(definition))), cached);
  assert.equal(redis.expirations.has(catalogId(list)), false);
});

test("WeTrakr refuses missing keys and preserves snapshots on rejected, empty, oversized or malformed pages", async () => {
  const redis = new MemoryRedis();
  await redis.set(CONFIG_KEY, { lists: [list] });
  await assert.rejects(startImport(redis, list), /Save your WeTrakr app key/);
  await redis.set(CONFIG_KEY, { lists: [list], wetrakrApiKey: "test-app-key" });
  await redis.set(catalogId(list), JSON.stringify(cached));
  const invalid = [
    page([]),
    page([title(1)], 1, 10001),
    page([title(1)], 1, 2),
    { data: [title(1)], headers: {} },
    page([null]),
    page([{ type: "episode" }]),
    {
      ...page([title(1)]),
      headers: { ...page([title(1)]).headers, "x-pagination-page": "2" },
    },
  ];
  for (const result of invalid) {
    axios.get = async () => result;
    const job = await startImport(redis, list);
    await assert.rejects(advanceImport(redis, job.jobId, 0));
    assert.deepEqual(JSON.parse(await redis.get(catalogId(list))), cached);
  }
  for (const status of [401, 403, 429]) {
    axios.get = async () => {
      throw Object.assign(new Error("provider private details"), {
        isAxiosError: true,
        response: { status },
      });
    };
    const job = await startImport(redis, list);
    await assert.rejects(advanceImport(redis, job.jobId, 0));
    assert.deepEqual(JSON.parse(await redis.get(catalogId(list))), cached);
  }
});

test("WeTrakr fails safely if the source count changes between pages", async () => {
  const redis = new MemoryRedis();
  await redis.set(CONFIG_KEY, { lists: [list], wetrakrApiKey: "test-app-key" });
  await redis.set(catalogId(list), JSON.stringify(cached));
  axios.get = async (_url, options) =>
    options.params.page === 1 ? page([title(1)], 1, 2, 1) : page([title(2)], 2, 3, 1);
  const job = await startImport(redis, list);
  await advanceImport(redis, job.jobId, 0);
  await assert.rejects(advanceImport(redis, job.jobId, 1), /changed list/);
  assert.deepEqual(JSON.parse(await redis.get(catalogId(list))), cached);
});

test("WeTrakr UI saves the user's key and serves API and export catalogs independently without provider calls", async () => {
  const db = database();
  await db.redis.set(CONFIG_KEY, { lists: [exported, legacy] });
  await db.redis.set(catalogId(exported), JSON.stringify(cached));
  const { ui } = frontend();
  await ui.restore(db.userId);
  assert.equal(ui.state.wetrakrApiKey, "");
  assert.equal(ui.canImport(list), false);
  await ui.saveSettings({
    mdblistApiKey: "",
    tmdbAccessToken: "",
    wetrakrApiKey: "user-app",
    cacheBuster: "",
  });
  assert.equal(ui.canImport(list), true);
  axios.get = async (_url, options) => {
    assert.equal(options.headers["wetrakr-api-key"], "user-app");
    return page([title(42, "show")]);
  };
  ui.state.listUrl = "https://wetrakr.com/lists/17599";
  assert.equal(await ui.addList(), true);
  assert.equal(ui.state.lists[2].itemCount, 1);
  assert.equal(ui.state.lists[2].cached, true);
  axios.get = async () => {
    throw new Error("Catalog reads must not call providers");
  };
  const manifest = await request(`/${db.userId}/manifest.json`);
  assert.deepEqual(
    manifest.data.catalogs.map((item) => item.id),
    [catalogId(exported), catalogId(legacy), catalogId(list)],
  );
  assert.equal(manifest.data.id, "community.trakt.custom-lists");
  const config = JSON.parse(await db.redis.get(CONFIG_KEY));
  delete config.wetrakrApiKey;
  await db.redis.set(CONFIG_KEY, JSON.stringify(config));
  const api = await request(`/${db.userId}/catalog/movie/${catalogId(list)}.json`);
  assert.equal(api.data.metas[0].id, "tt42");
  assert.equal(api.data.metas[0].type, "series");
  const exportCatalog = await request(
    `/${db.userId}/catalog/movie/${catalogId(exported)}.json`,
  );
  assert.deepEqual(exportCatalog.data.metas, cached);
  const other = database("beta.upstash.io");
  assert.deepEqual(
    (await request(`/${other.userId}/catalog/movie/${catalogId(list)}.json`)).data.metas,
    [],
  );
  const restored = frontend().ui;
  await restored.restore(db.userId);
  assert.equal(restored.state.wetrakrApiKey, "");
  assert.equal(restored.state.lists[2].cached, true);
  ui.disconnect();
  assert.equal(ui.state.wetrakrApiKey, "");
});

test("WeTrakr API errors do not reflect request headers or provider response bodies", async () => {
  const db = database();
  await db.redis.set(CONFIG_KEY, { lists: [list], wetrakrApiKey: "private-app-key" });
  axios.get = async () => {
    throw Object.assign(new Error("private-app-key"), {
      isAxiosError: true,
      response: { status: 403, data: "private-app-key" },
    });
  };
  const started = await request(`/api/cache/${db.userId}`, { list });
  const result = await request(`/api/cache/${db.userId}/${started.data.jobId}`, {
    step: 0,
  });
  assert.equal(result.status, 400);
  assert.match(result.data.error, /rejected access/);
  assert.ok(!JSON.stringify(result.data).includes("private-app-key"));
});
