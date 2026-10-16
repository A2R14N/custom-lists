import { exportItems, imdbHeader, imdbCsv } from "./helpers/exports.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { catalogId, isCatalogId } from "../shared/lists.js";
import { CONFIG_KEY } from "../src/services/user-store.js";
import { startImport } from "../src/services/imports.js";
import { strToU8 } from "fflate";
import { MAX_EXPORT_BYTES } from "../shared/wetrakr.js";
import { cacheWeTrakrExport, cacheListExport } from "../src/services/export-cache.js";
import { parseImdbCsv, readImdbExport } from "../shared/imdb.js";
import { legacy, cached, database, request } from "./helpers/addon.js";

test("IMDb CSV preserves Position order and titles without uploading private fields or inventing TMDB IDs", () => {
  const parsed = readImdbExport(
    strToU8("\uFEFF" + imdbCsv),
    "random-uuid.csv",
    "Weekend",
  );
  assert.equal(parsed.provider, "imdb");
  assert.equal(parsed.total, 3);
  assert.equal(parsed.skipped, 0);
  assert.deepEqual(
    parsed.metas.map((x) => [x.id, x.type, x.name]),
    [
      ["tt200", "series", "Series, one"],
      ["tt100", "movie", 'A "great" movie'],
      ["tt300", "movie", "Special"],
    ],
  );
  assert.ok(parsed.metas.every((meta) => !Object.hasOwn(meta, "tmdb_id")));
  assert.ok(
    parsed.items.every(
      (item) =>
        Object.keys(item).sort().join(",") === "imdb_id,rank,title,tmdb_id,type,year",
    ),
  );
  assert.ok(!JSON.stringify(parsed).includes("private"));
});

test("IMDb maps supported title types and reports duplicates, missing IDs and unsupported entries", () => {
  const kinds = [
    "Movie",
    "TV Movie",
    "Short",
    "TV Short",
    "Video",
    "TV Special",
    "TV Series",
    "TV Mini Series",
    "TV Episode",
    "Video Game",
    "Unknown",
  ];
  const csv =
    imdbHeader +
    "\n" +
    kinds.map((kind, i) => `${i + 1},tt${100 + i},Title,${kind},2020,,`).join("\n") +
    "\n12,tt100,Duplicate,Movie,2020,,\n13,,No ID,Movie,2020,,";
  const parsed = parseImdbCsv(csv, "Types");
  assert.equal(parsed.metas.length, 8);
  assert.equal(parsed.unsupported, 3);
  assert.equal(parsed.duplicates, 1);
  assert.equal(parsed.missingIds, 1);
  assert.deepEqual(
    parsed.metas.map((x) => x.type),
    [...Array(6).fill("movie"), "series", "series"],
  );
});

test("IMDb rejects malformed or oversized exports before caching", () => {
  for (const csv of [
    imdbHeader,
    imdbCsv.replace("Const", "Title"),
    imdbCsv.replace("tt100", "https://example.com"),
    imdbCsv.replace("2,tt100", "bad,tt100"),
    imdbHeader + '\n"unfinished',
    imdbHeader + "\n1,tt123,Too few",
  ]) {
    assert.throws(() => parseImdbCsv(csv, "Name"), /^Error: IMDb export:/);
  }
  assert.throws(() => parseImdbCsv(imdbCsv, ""), /list name/);
  assert.throws(() => readImdbExport(strToU8(imdbCsv), "wrong.zip", "Name"), /CSV file/);
  assert.throws(() => readImdbExport(new Uint8Array([255]), "list.csv", "Name"), /UTF-8/);
  assert.throws(
    () => readImdbExport(new Uint8Array(MAX_EXPORT_BYTES + 1), "large.csv", "Name"),
    /8 MB/,
  );
  assert.throws(
    () =>
      parseImdbCsv(
        imdbHeader + "\n" + Array(10001).fill("1,tt123,Title,Movie,2020,,").join("\n"),
        "Name",
      ),
    /10,000/,
  );
});

test("IMDb cache is isolated from WeTrakr and other users, updates in place, and survives invalid imports", async () => {
  const db = database(),
    other = database("other.upstash.io");
  await db.redis.set(CONFIG_KEY, { lists: [legacy], customOption: true });
  await db.redis.set(catalogId(legacy), JSON.stringify(cached));
  const wetrakr = await cacheWeTrakrExport(db.redis, {
    sourceName: "Weekend",
    items: exportItems,
  });
  const originalWetrakr = await db.redis.get(catalogId(wetrakr.list));
  const payload = { ...parseImdbCsv(imdbCsv, "Weekend"), categoryName: "movie" };
  const saved = await request(`/api/exports/${db.userId}`, payload);
  assert.equal(saved.status, 200);
  const key = catalogId(saved.data.list);
  assert.match(key, /^imdb:[a-f0-9]{64}$/);
  assert.ok(isCatalogId(key));
  assert.equal(
    (await request(`/${db.userId}/catalog/movie/${key}.json`)).data.metas.length,
    3,
  );
  assert.ok(
    (await request(`/${db.userId}/manifest.json`)).data.catalogs.some(
      (item) => item.id === key,
    ),
  );
  const config = JSON.parse(await db.redis.get(CONFIG_KEY));
  config.lists.at(-1).name = "Custom display";
  await db.redis.set(CONFIG_KEY, JSON.stringify(config));
  const updated = await cacheListExport(db.redis, {
    ...payload,
    items: [payload.items[0]],
    categoryName: "series",
  });
  assert.equal(updated.list.name, "Custom display");
  assert.equal(updated.list.categoryName, "movie");
  assert.equal(updated.list.sourceName, "Weekend");
  const oldConfig = await db.redis.get(CONFIG_KEY),
    oldCache = await db.redis.get(key);
  for (const patch of [
    { items: [] },
    { items: [{ ...payload.items[0], imdb_id: "invalid" }] },
    { provider: "trakt" },
  ]) {
    assert.equal(
      (await request(`/api/exports/${db.userId}`, { ...payload, ...patch })).status,
      400,
    );
    assert.equal(await db.redis.get(CONFIG_KEY), oldConfig);
    assert.equal(await db.redis.get(key), oldCache);
  }
  assert.equal(await db.redis.get(catalogId(wetrakr.list)), originalWetrakr);
  assert.deepEqual(JSON.parse(await db.redis.get(catalogId(legacy))), cached);
  assert.equal(await other.redis.get(CONFIG_KEY), null);
  assert.equal(db.redis.expirations.has(key), false);
  await assert.rejects(startImport(db.redis, updated.list), /select a new CSV/);
});
