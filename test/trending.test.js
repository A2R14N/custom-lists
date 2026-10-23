import { test } from "node:test";
import assert from "node:assert/strict";
import axios from "axios";
import { createTrendingFeed } from "../src/services/trending.js";
import { useTrendingExample } from "../vue/src/composables/useTrendingExample.ts";
import { base, request } from "./helpers/addon.js";

const results = Array.from({ length: 20 }, (_, id) => ({
  id: id + 1,
  title: `Example movie ${id + 1}`,
  poster_path: `/poster-${id + 1}.jpg`,
  adult: false,
}));

test("trending filters and bounds public metadata, deduplicates requests and caches for six hours", async () => {
  let time = Date.UTC(2026, 0, 1);
  let calls = 0;
  const feed = createTrendingFeed({
    now: () => time,
    credentials: () => ({ token: "synthetic-server-token" }),
    request: async (url, options) => {
      calls++;
      assert.equal(url, "https://api.themoviedb.org/3/trending/movie/week");
      assert.deepEqual(options.params, { language: "en-US" });
      assert.equal(options.headers.Authorization, "Bearer synthetic-server-token");
      assert.equal(options.maxRedirects, 0);
      return {
        data: {
          results: [
            null,
            { ...results[0], adult: true },
            { ...results[0], media_type: "person" },
            { ...results[0], poster_path: "https://untrusted.invalid/poster.jpg" },
            results[0],
            results[0],
            { ...results[1], poster_path: results[0].poster_path },
            ...results.slice(1),
          ],
          secret: "not-public",
        },
      };
    },
  });
  const [first, concurrent] = await Promise.all([feed(), feed()]);
  assert.equal(calls, 1);
  assert.deepEqual(first, concurrent);
  assert.equal(first.items.length, 12);
  assert.equal(first.stale, false);
  assert.deepEqual(Object.keys(first.items[0]), ["id", "title", "poster", "url"]);
  assert.equal(first.items[0].poster, "https://image.tmdb.org/t/p/w500/poster-1.jpg");
  assert.ok(!JSON.stringify(first).includes("synthetic-server-token"));
  assert.ok(!JSON.stringify(first).includes("not-public"));
  time += 5 * 60 * 60 * 1000;
  await feed();
  assert.equal(calls, 1);
  time += 2 * 60 * 60 * 1000;
  await feed();
  assert.equal(calls, 2);
});

test("trending API key stays upstream, failures back off and stale data expires after one day", async () => {
  let time = Date.UTC(2026, 0, 1);
  let calls = 0;
  const feed = createTrendingFeed({
    now: () => time,
    credentials: () => ({ apiKey: "synthetic-server-key" }),
    request: (url, options) => {
      calls++;
      assert.equal(options.params.api_key, "synthetic-server-key");
      assert.deepEqual(options.headers, {});
      if (calls > 1) throw new Error("synthetic-server-key provider response");
      return Promise.resolve({ data: { results } });
    },
  });
  const initial = await feed();
  time += 7 * 60 * 60 * 1000;
  const stale = await feed();
  assert.equal(stale.stale, true);
  assert.equal(stale.updatedAt, initial.updatedAt);
  assert.ok(!JSON.stringify(stale).includes("synthetic-server-key"));
  await feed();
  assert.equal(calls, 2);
  time += 6 * 60 * 1000;
  await feed();
  assert.equal(calls, 3);
  time += 24 * 60 * 60 * 1000;
  assert.deepEqual(await feed(), { items: [], updatedAt: null, stale: false });
});

test("unconfigured, malformed and incomplete trending feeds fall back without publishing partial artwork", async () => {
  let configured = false;
  let calls = 0;
  const feed = createTrendingFeed({
    credentials: () => (configured ? { apiKey: "synthetic-server-key" } : {}),
    request: async () => {
      calls++;
      return { data: { results: results.slice(0, 2) } };
    },
  });
  assert.deepEqual((await feed()).items, []);
  assert.equal(calls, 0);
  configured = true;
  assert.deepEqual((await feed()).items, []);
  assert.equal(calls, 1);
  await feed();
  assert.equal(calls, 1);
  const malformed = createTrendingFeed({
    credentials: () => ({ apiKey: "synthetic-server-key" }),
    request: async () => ({ data: {} }),
  });
  assert.deepEqual((await malformed()).items, []);
});

test("credential echoes are excluded from both public text and outgoing poster URLs", async () => {
  const feed = createTrendingFeed({
    credentials: () => ({ apiKey: "synthetic-server-key", token: "synthetic-token" }),
    request: async () => ({
      data: {
        results: [
          { ...results[0], title: "Error with synthetic-server-key" },
          { ...results[1], poster_path: "/synthetic-token.jpg" },
          ...results.slice(2),
        ],
      },
    }),
  });
  const response = await feed();
  assert.equal(response.items[0].id, 3);
  assert.ok(!JSON.stringify(response).includes("synthetic-server-key"));
  assert.ok(!JSON.stringify(response).includes("synthetic-token"));
});

test("homepage uses bounded trending artwork, labels stale data and restores examples on image failure", async () => {
  const feed = createTrendingFeed({
    credentials: () => ({ apiKey: "synthetic-server-key" }),
    request: async () => ({ data: { results } }),
  });
  const publicData = await feed();
  const ui = useTrendingExample(async (url, options) => {
    assert.equal(url, "/api/discovery/trending");
    assert.equal(options.credentials, "omit");
    return Response.json({ ...publicData, stale: true });
  });
  assert.equal(ui.isTrending.value, false);
  await ui.load();
  assert.equal(ui.isTrending.value, true);
  assert.equal(ui.posters.value.length, 3);
  assert.equal(ui.heading.value, "Recently trending");
  ui.imageFailed.value = true;
  assert.equal(ui.isTrending.value, false);
  assert.equal(ui.heading.value, "The next movie night");
  assert.match(ui.posters.value[0].poster, /^\/editorial\//);
  const unsafe = useTrendingExample(async () =>
    Response.json({
      items: Array(3).fill({
        title: "Unsafe",
        poster: "https://evil.invalid/poster.jpg",
      }),
    }),
  );
  await unsafe.load();
  assert.equal(unsafe.isTrending.value, false);
  const offline = useTrendingExample(async () => {
    throw new Error("Offline");
  });
  await offline.load();
  assert.equal(offline.isTrending.value, false);
});

test("only the public trending route is cacheable; credential-bearing routes stay private", async () => {
  const saved = [
    process.env.TMDB_TRENDING_API_KEY,
    process.env.TMDB_TRENDING_ACCESS_TOKEN,
  ];
  delete process.env.TMDB_TRENDING_API_KEY;
  delete process.env.TMDB_TRENDING_ACCESS_TOKEN;
  try {
    const result = await request("/api/discovery/trending?ignored=not-reflected");
    assert.equal(result.status, 200);
    assert.match(result.headers.get("cache-control"), /^public,/);
    assert.deepEqual(result.data, { items: [], updatedAt: null, stale: false });
    const other = await fetch(base + "/private/catalog/movie/missing.json");
    assert.match(other.headers.get("cache-control"), /private, no-store/);
  } finally {
    for (const [index, name] of [
      "TMDB_TRENDING_API_KEY",
      "TMDB_TRENDING_ACCESS_TOKEN",
    ].entries()) {
      if (saved[index] === undefined) delete process.env[name];
      else process.env[name] = saved[index];
    }
  }
});

test("HTTP discovery failures reveal no provider credentials in headers or response bodies", async () => {
  const previous = process.env.TMDB_TRENDING_API_KEY;
  const previousToken = process.env.TMDB_TRENDING_ACCESS_TOKEN;
  process.env.TMDB_TRENDING_API_KEY = "synthetic-http-key";
  delete process.env.TMDB_TRENDING_ACCESS_TOKEN;
  let calls = 0;
  let upstream;
  axios.get = async (url, options) => {
    calls++;
    upstream = { url, options };
    throw Object.assign(new Error("synthetic-http-key in upstream request"), {
      response: {
        status: 302,
        headers: { location: "https://untrusted.invalid/?api_key=synthetic-http-key" },
        data: "synthetic-http-key",
      },
    });
  };
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await fetch(base + "/api/discovery/trending");
      const body = await response.text();
      assert.equal(response.status, 200);
      assert.deepEqual(JSON.parse(body), { items: [], updatedAt: null, stale: false });
      assert.ok(!body.includes("synthetic-http-key"));
      assert.ok(!JSON.stringify([...response.headers]).includes("synthetic-http-key"));
      assert.equal(response.headers.get("location"), null);
    }
    assert.equal(calls, 1);
    assert.equal(upstream.url, "https://api.themoviedb.org/3/trending/movie/week");
    assert.equal(upstream.options.params.api_key, "synthetic-http-key");
    assert.equal(upstream.options.maxRedirects, 0);
  } finally {
    if (previous === undefined) delete process.env.TMDB_TRENDING_API_KEY;
    else process.env.TMDB_TRENDING_API_KEY = previous;
    if (previousToken === undefined) delete process.env.TMDB_TRENDING_ACCESS_TOKEN;
    else process.env.TMDB_TRENDING_ACCESS_TOKEN = previousToken;
  }
});
