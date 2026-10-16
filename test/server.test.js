import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { normalizeList, catalogId } from "../shared/lists.js";
import { CONFIG_KEY } from "../src/services/user-store.js";
import { legacy, mdb, tmdb, cached, base, database, request } from "./helpers/addon.js";

test("connect reads saved Trakt lists without writing or clearing configuration", async () => {
  const db = database();
  await db.redis.set(CONFIG_KEY, JSON.stringify({ lists: [legacy] }));
  await db.redis.set(catalogId(legacy), JSON.stringify(cached));
  db.redis.writes = [];
  const result = await request("/api/connect", {
    upstashUrl: db.upstashUrl,
    upstashToken: db.upstashToken,
  });
  assert.equal(result.status, 200);
  assert.equal(result.data.lists[0].cached, true);
  assert.equal(result.data.lists[0].itemCount, 1);
  assert.equal(result.data.lists[0].provider, "trakt");
  assert.equal(db.redis.writes.length, 0);
  assert.deepEqual(result.data.lists[0].coverPosters, [cached[0].poster]);
  assert.match(result.headers.get("cache-control"), /private, no-store/);
});

test("cached legacy catalog works with no config or Trakt key, and isolates users", async () => {
  const alpha = database();
  const beta = database("beta.upstash.io");
  await alpha.redis.set(catalogId(legacy), JSON.stringify(cached));
  for (const suffix of ["", "~2"]) {
    const result = await request(
      `/${alpha.userId}${suffix}/catalog/cartoon/${catalogId(legacy)}.json`,
    );
    assert.equal(result.status, 200);
    assert.deepEqual(result.data.metas, cached);
  }
  const missing = await request(
    `/${beta.userId}/catalog/cartoon/${catalogId(legacy)}.json`,
  );
  assert.deepEqual(missing.data.metas, []);
  const forbidden = await request(`/${alpha.userId}/catalog/movie/stremio:config.json`);
  assert.deepEqual(forbidden.data.metas, []);
});

test("manifest advertises all providers while keeping addon and Trakt IDs", async () => {
  const db = database();
  await db.redis.set(CONFIG_KEY, { lists: [legacy, mdb, tmdb] });
  const result = await request(`/${db.userId}/manifest.json`);
  assert.equal(result.status, 200);
  assert.equal(result.data.id, "community.trakt.custom-lists");
  assert.deepEqual(
    result.data.catalogs.map((x) => x.id),
    [catalogId(legacy), catalogId(mdb), catalogId(tmdb)],
  );
  assert.ok(result.data.types.includes("cartoon"));
});

test("manifest branding uses a public same-host asset without leaking configured credentials", async () => {
  const db = database();
  await db.redis.set(CONFIG_KEY, { lists: [legacy] });
  const publicManifest = await request("/manifest.json");
  const configured = await request(
    `/${db.userId}~revision/manifest.json?private=not-for-logo`,
  );
  assert.equal(publicManifest.data.name, "Custom Lists");
  assert.equal(configured.data.name, "Custom Lists");
  assert.equal(configured.data.logo, publicManifest.data.logo);
  const logo = new URL(configured.data.logo);
  assert.equal(logo.host, new URL(base).host);
  assert.equal(logo.pathname, "/brand/custom-lists-icon-v1.png");
  assert.equal(logo.search, "");
  assert.ok(!logo.href.includes(db.userId));
  const asset = fs.readFileSync(
    new URL("../vue/public" + logo.pathname, import.meta.url),
  );
  assert.equal(asset.subarray(1, 4).toString(), "PNG");
  assert.equal(asset.readUInt32BE(16), 512);
  assert.equal(asset.readUInt32BE(20), 512);
  const proxied = await fetch(base + "/manifest.json", {
    headers: { "X-Forwarded-Proto": "https", "X-Forwarded-Host": "untrusted.example" },
  });
  const proxyLogo = new URL((await proxied.json()).logo);
  assert.equal(proxyLogo.protocol, "https:");
  assert.equal(proxyLogo.host, new URL(base).host);
});

test("saving new lists and removing manifest entries never changes cached snapshots", async () => {
  const db = database();
  await db.redis.set(CONFIG_KEY, { lists: [legacy], traktClientId: "old" });
  await db.redis.set(catalogId(legacy), JSON.stringify(cached));
  const save = await request("/api/config", {
    upstashUrl: db.upstashUrl,
    upstashToken: db.upstashToken,
    mdblistApiKey: "new",
    lists: [legacy, mdb],
  });
  assert.equal(save.status, 200);
  assert.equal(JSON.parse(await db.redis.get(CONFIG_KEY)).traktClientId, "old");
  await request("/api/config", {
    upstashUrl: db.upstashUrl,
    upstashToken: db.upstashToken,
    lists: [mdb],
  });
  assert.deepEqual(JSON.parse(await db.redis.get(catalogId(legacy))), cached);
});

test("Nuvio-shaped encoded catalog URLs preserve private configuration and real item media types", async () => {
  const db = database();
  const lists = [
    legacy,
    mdb,
    tmdb,
    normalizeList({
      provider: "imdb",
      listId: "a".repeat(64),
      categoryName: "Family Cartoons",
      name: "IMDb sample",
    }),
    normalizeList({
      provider: "wetrakr",
      listId: "b".repeat(64),
      categoryName: "cartoon",
      name: "Export sample",
    }),
  ];
  const metas = [
    {
      id: "tt100",
      type: "movie",
      name: "Movie",
      poster: "https://example.com/movie.jpg",
      posterShape: "poster",
    },
    {
      id: "tt200",
      type: "series",
      name: "Series",
      imdb_id: "tt200",
      tmdb_id: "20",
      releaseInfo: "2020",
    },
  ];
  await db.redis.set(CONFIG_KEY, JSON.stringify({ lists }));
  for (const list of lists) await db.redis.set(catalogId(list), JSON.stringify(metas));
  db.redis.writes = [];
  const configured = `${db.userId}~review%20one`;
  const manifest = await request(`/${configured}/manifest.json?client=nuvio`);
  assert.equal(manifest.status, 200);
  for (const field of ["id", "name", "version"])
    assert.ok(typeof manifest.data[field] === "string" && manifest.data[field].length);
  assert.deepEqual(manifest.data.resources, ["catalog"]);
  assert.equal(manifest.data.behaviorHints.configurable, true);
  for (const catalog of manifest.data.catalogs) {
    // Nuvio hides home catalogs with required extras; none should be required here.
    assert.ok(!(catalog.extra || []).some((extra) => extra.isRequired));
    const encodedId = encodeURIComponent(catalog.id);
    assert.ok(encodedId.includes("%3A"));
    const result = await request(
      `/${configured}/catalog/${encodeURIComponent(catalog.type)}/${encodedId}.json?client=nuvio`,
    );
    assert.equal(result.status, 200);
    assert.deepEqual(result.data.metas, metas);
    // HomeCatalogParser requires all three fields and routes each item's own type.
    assert.ok(result.data.metas.every((meta) => meta.id && meta.type && meta.name));
    assert.deepEqual(
      result.data.metas.map((meta) => meta.type),
      ["movie", "series"],
    );
  }
  assert.equal(db.redis.writes.length, 0);
});

test("Nuvio full-list loading and explicit raw-count pagination return every cached item without writes", async () => {
  const db = database();
  const key = catalogId(legacy);
  const metas = Array.from({ length: 205 }, (_, i) => ({
    id: `tt${i + 1000}`,
    name: `Title ${i}`,
    type: i % 2 ? "series" : "movie",
  }));
  const snapshot = JSON.stringify(metas);
  await db.redis.set(key, snapshot);
  db.redis.writes = [];
  const route = `/${db.userId}~review/catalog/cartoon/${encodeURIComponent(key)}`;
  // Nuvio's first request omits skip, so retaining the full snapshot avoids loss.
  assert.deepEqual((await request(`${route}.json`)).data.metas, metas);
  const combined = [];
  for (const [skip, count] of [
    [0, 100],
    [100, 100],
    [200, 5],
    [205, 0],
  ]) {
    const response = await fetch(base + `${route}/skip=${skip}.json?client=nuvio`, {
      headers: { "Cache-Control": "no-cache" },
    });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("cache-control"), /no-store/);
    const page = (await response.json()).metas;
    assert.equal(page.length, count);
    combined.push(...page);
  }
  assert.deepEqual(combined, metas);
  for (const skip of ["-1", "1.5", "NaN", "9007199254740992"]) {
    assert.equal((await request(`${route}/skip=${skip}.json`)).status, 400);
  }
  assert.equal(await db.redis.get(key), snapshot);
  assert.equal(db.redis.writes.length, 0);
});

test("malformed input and unknown APIs return JSON errors", async () => {
  assert.equal(
    (
      await request("/api/connect", {
        upstashUrl: "https://127.0.0.1",
        upstashToken: "key",
      })
    ).status,
    400,
  );
  assert.equal((await request("/api/missing")).status, 404);
  const response = await fetch(base + "/api/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{",
  });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /Invalid request/);
});

test("UI preview bounds responses without changing addon pagination or full snapshots", async () => {
  const db = database();
  const metas = Array.from({ length: 150 }, (_, i) => ({
    id: `tt${i}`,
    type: "movie",
    name: `Title ${i}`,
  }));
  await db.redis.set(catalogId(legacy), JSON.stringify(metas));
  db.redis.writes = [];
  const path = `/${db.userId}/catalog/cartoon/${encodeURIComponent(catalogId(legacy))}`;
  const preview = await request(path + "/skip=0.json?preview=1");
  assert.deepEqual(preview.data.metas, metas.slice(0, 12));
  assert.match(preview.headers.get("cache-control"), /no-store/);
  assert.equal((await request(path + "/skip=0.json")).data.metas.length, 100);
  assert.equal((await request(path + ".json")).data.metas.length, 150);
  assert.equal(db.redis.writes.length, 0);
});
