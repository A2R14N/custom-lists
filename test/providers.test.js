import { test } from "node:test";
import assert from "node:assert/strict";
import axios from "axios";
import { catalogId } from "../shared/lists.js";
import { CONFIG_KEY } from "../src/services/user-store.js";
import { fetchProviderPage, resolvePage } from "../src/services/providers.js";
import { startImport, advanceImport } from "../src/services/imports.js";
import { MemoryRedis, legacy, mdb, tmdb, cached, entry } from "./helpers/addon.js";

test("MDBList importer follows cursors and publishes only a complete snapshot", async () => {
  const redis = new MemoryRedis();
  await redis.set(CONFIG_KEY, { lists: [mdb], mdblistApiKey: "mdb-key" });
  await redis.set(catalogId(mdb), JSON.stringify(cached));
  const calls = [];
  axios.get = async (url, options) => {
    calls.push({ url, options });
    return options.params.cursor
      ? { data: { items: [entry(2, "show")] }, headers: { "x-has-more": "false" } }
      : {
          data: { items: [entry(1)], next_cursor: "next-page" },
          headers: { "x-has-more": "true" },
        };
  };
  const job = await startImport(redis, mdb);
  const first = await advanceImport(redis, job.jobId, 0);
  assert.equal(first.status, "progress");
  assert.deepEqual(JSON.parse(await redis.get(catalogId(mdb))), cached);
  assert.equal(first.coverPosters, undefined);
  const retry = await advanceImport(redis, job.jobId, 0);
  assert.deepEqual(retry, first);
  assert.equal(calls.length, 1);
  const last = await advanceImport(redis, job.jobId, 1);
  assert.equal(last.status, "done");
  assert.equal(last.done, 2);
  assert.deepEqual(last.coverPosters, [cached[0].poster]);
  assert.deepEqual(
    JSON.parse(await redis.get(catalogId(mdb))).map((x) => x.id),
    ["tt1", "tt2"],
  );
  assert.equal(calls[0].url, "https://api.mdblist.com/lists/alice/favorites/items");
  assert.equal(calls[0].options.params.apikey, "mdb-key");
  assert.equal(calls[1].options.params.cursor, "next-page");
  assert.equal(redis.expirations.has(catalogId(mdb)), false);
});

test("MDBList handles legacy bucket pages, offset fallback, and repeated cursors", async () => {
  axios.get = async () => ({
    data: {
      movies: [{ ...entry(2), rank: 2 }],
      shows: [{ ...entry(1, "show"), rank: 1 }],
    },
    headers: { "x-has-more": "true" },
  });
  const page = await fetchProviderPage(mdb, { mdblistApiKey: "key" });
  assert.deepEqual(
    page.items.map((x) => x.imdb_id),
    ["tt1", "tt2"],
  );
  assert.deepEqual(page.next, { offset: 2 });
  axios.get = async () => ({
    data: { items: [entry(1)], next_cursor: "same" },
    headers: {},
  });
  await assert.rejects(
    fetchProviderPage(mdb, { mdblistApiKey: "key" }, { cursor: "same" }),
    /did not advance/,
  );
});

test("TMDB mixed lists resolve IMDb IDs with the user token and preserve page order", async () => {
  const redis = new MemoryRedis();
  await redis.set(CONFIG_KEY, { lists: [tmdb], tmdbAccessToken: "tmdb-token" });
  const calls = [];
  axios.get = async (url, options) => {
    calls.push({ url, options });
    assert.equal(options.headers.Authorization, "Bearer tmdb-token");
    if (url.includes("/4/list/"))
      return {
        data: {
          results: [
            { id: 10, media_type: "movie", title: "Movie", poster_path: "/a.jpg" },
            { id: 20, media_type: "tv", name: "Show" },
            { id: 30, media_type: "tv", name: "No IMDb" },
          ],
          total_pages: 1,
          total_results: 3,
        },
      };
    return {
      data: {
        imdb_id: url.includes("/30/") ? null : url.includes("/10/") ? "tt10" : "tt20",
      },
    };
  };
  const job = await startImport(redis, tmdb);
  const done = await advanceImport(redis, job.jobId, 0);
  assert.equal(done.done, 2);
  assert.equal(done.skipped, 1);
  const metas = JSON.parse(await redis.get(catalogId(tmdb)));
  assert.deepEqual(
    metas.map((x) => [x.id, x.type]),
    [
      ["tt10", "movie"],
      ["tt20", "series"],
    ],
  );
  assert.equal(metas[0].poster, "https://image.tmdb.org/t/p/w500/a.jpg");
  assert.ok(calls.some((call) => call.url.includes("/3/tv/20/external_ids")));
});

test("TMDB fetches subsequent list pages", async () => {
  axios.get = async () => ({
    data: {
      results: [{ id: 10, media_type: "movie" }],
      total_pages: 3,
      total_results: 50,
    },
  });
  assert.deepEqual(
    (await fetchProviderPage(tmdb, { tmdbAccessToken: "key" }, { page: 2 })).next,
    { page: 3 },
  );
});

test("failed, empty, and oversized refreshes retain previous snapshots", async () => {
  for (const scenario of ["failure", "empty", "oversized"]) {
    const redis = new MemoryRedis();
    await redis.set(CONFIG_KEY, { lists: [tmdb], tmdbAccessToken: "key" });
    await redis.set(catalogId(tmdb), JSON.stringify(cached));
    axios.get = async () => {
      if (scenario === "failure")
        throw Object.assign(new Error("quota"), {
          isAxiosError: true,
          response: { status: 429 },
        });
      return {
        data: {
          results: [],
          total_pages: 1,
          total_results: scenario === "oversized" ? 10001 : 0,
        },
      };
    };
    const job = await startImport(redis, tmdb);
    await assert.rejects(advanceImport(redis, job.jobId, 0));
    assert.deepEqual(JSON.parse(await redis.get(catalogId(tmdb))), cached);
  }
});

test("Trakt import is refused without touching its cache", async () => {
  const redis = new MemoryRedis();
  await redis.set(CONFIG_KEY, { lists: [legacy] });
  await redis.set(catalogId(legacy), JSON.stringify(cached));
  redis.writes = [];
  await assert.rejects(startImport(redis, legacy), /Trakt snapshots are preserved/);
  assert.equal(redis.writes.length, 0);
});

test("failed IMDb resolution does not silently publish a partial TMDB refresh", async () => {
  axios.get = async () => {
    throw Object.assign(new Error("timeout"), { isAxiosError: true });
  };
  await assert.rejects(
    resolvePage(tmdb, { tmdbAccessToken: "key" }, [{ id: 10, media_type: "movie" }]),
  );
});

test("metadata fallback uses Cinemeta for MDBList entries without posters", async () => {
  axios.get = async (url) => {
    assert.equal(url, "https://v3-cinemeta.strem.io/meta/movie/tt42.json");
    return {
      status: 200,
      data: { meta: { name: "Cinemeta title", poster: "https://example.com/rich.jpg" } },
    };
  };
  const metas = await resolvePage(mdb, {}, [
    { imdb_id: "tt42", title: "Fallback", mediatype: "movie" },
  ]);
  assert.equal(metas[0].name, "Cinemeta title");
  assert.equal(metas[0].id, "tt42");
});
