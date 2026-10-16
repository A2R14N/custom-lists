import { exportHeader, exportCsv, exportItems } from "./helpers/exports.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { catalogId, isCatalogId } from "../shared/lists.js";
import { CONFIG_KEY } from "../src/services/user-store.js";
import { startImport } from "../src/services/imports.js";
import { zipSync, strToU8 } from "fflate";
import {
  parseWeTrakrCsv,
  prepareWeTrakrList,
  MAX_EXPORT_BYTES,
} from "../shared/wetrakr.js";
import { readWeTrakrExport } from "../shared/wetrakr-file.js";
import { cacheWeTrakrExport } from "../src/services/export-cache.js";
import { MemoryRedis, legacy, mdb, cached, database, request } from "./helpers/addon.js";

test("WeTrakr CSV preserves quoted names, rank, media types and both identifiers", () => {
  const lists = parseWeTrakrCsv("\uFEFF" + exportCsv);
  assert.equal(lists.length, 2);
  assert.equal(lists[0].sourceName, "Weekend, favorites");
  assert.deepEqual(
    lists[0].metas.map((x) => [x.name, x.type, x.id, x.tmdb_id]),
    [
      ["First show", "series", "tt200", "20"],
      ['A "great" movie', "movie", "tt100", "10"],
    ],
  );
  assert.equal(lists[1].missingIds, 1);
  assert.equal(lists[1].unsupported, 1);
  assert.equal(lists[1].metas.length, 0);
  assert.equal(Object.hasOwn(lists[0].items[0], "list_description"), false);
  assert.equal(
    prepareWeTrakrList("Same", [...exportItems, exportItems[0]]).duplicates,
    1,
  );
});

test("WeTrakr reads original ZIP or CSV and ignores notes and unrelated files", () => {
  const zip = zipSync({
    "lists.csv": strToU8(exportCsv),
    "notes.csv": strToU8("private notes"),
    "../ignored.txt": strToU8("ignored"),
  });
  assert.deepEqual(readWeTrakrExport(zip, "export.zip"), parseWeTrakrCsv(exportCsv));
  assert.equal(readWeTrakrExport(strToU8(exportCsv), "lists.csv").length, 2);
  assert.throws(
    () => readWeTrakrExport(zipSync({ "notes.csv": strToU8("private") }), "empty.zip"),
    /valid WeTrakr ZIP/,
  );
  assert.throws(
    () => readWeTrakrExport(zip.slice(0, 30), "broken.zip"),
    /valid WeTrakr ZIP/,
  );
  assert.throws(
    () => readWeTrakrExport(new Uint8Array(MAX_EXPORT_BYTES + 1), "big.zip"),
    /smaller than 8 MB/,
  );
  assert.throws(
    () =>
      readWeTrakrExport(
        zipSync({ "lists.csv": new Uint8Array(MAX_EXPORT_BYTES + 1) }),
        "bomb.zip",
      ),
    /valid WeTrakr ZIP/,
  );
  assert.throws(() => readWeTrakrExport(new Uint8Array([255]), "lists.csv"), /UTF-8/);
});

test("WeTrakr rejects incomplete CSV and malformed IDs rather than publishing partial titles", () => {
  for (const csv of [
    "title,imdb_id\nMovie,tt100",
    exportHeader + '\n"unfinished',
    exportHeader + "\nList,,Movie,2020,movie,10,tt100,1",
    exportHeader + '\n"List"junk,,Movie,2020,movie,10,tt100,1,today',
  ])
    assert.throws(() => parseWeTrakrCsv(csv));
  assert.throws(() =>
    prepareWeTrakrList("List", [{ ...exportItems[0], imdb_id: "https://example.com" }]),
  );
  assert.throws(() =>
    prepareWeTrakrList("List", [{ ...exportItems[0], tmdb_id: "../private" }]),
  );
  assert.throws(() => prepareWeTrakrList("List", Array(10001).fill(exportItems[0])));
});

test("WeTrakr caches directly with no provider key and preserves other providers", async () => {
  const db = database();
  await db.redis.set(CONFIG_KEY, {
    lists: [legacy, mdb],
    customOption: true,
    mdblistApiKey: "saved-key",
  });
  await db.redis.set(catalogId(legacy), JSON.stringify(cached));
  db.redis.writes = [];
  const saved = await request(`/api/exports/${db.userId}`, {
    sourceName: "Weekend",
    items: exportItems,
    categoryName: "cartoon",
  });
  assert.equal(saved.status, 200);
  assert.equal(saved.data.list.itemCount, 2);
  const key = catalogId(saved.data.list);
  assert.match(key, /^wetrakr:[0-9a-f]{64}$/);
  assert.equal(isCatalogId(key), true);
  const catalog = await request(`/${db.userId}/catalog/cartoon/${key}.json`);
  assert.equal(catalog.data.metas[0].id, "tt100");
  assert.equal(catalog.data.metas[0].tmdb_id, "10");
  assert.equal(catalog.data.metas[1].type, "series");
  const config = JSON.parse(await db.redis.get(CONFIG_KEY));
  assert.equal(config.lists.length, 3);
  assert.equal(config.customOption, true);
  assert.equal(config.mdblistApiKey, "saved-key");
  assert.deepEqual(JSON.parse(await db.redis.get(catalogId(legacy))), cached);
  assert.ok(db.redis.writes.every((write) => [key, CONFIG_KEY].includes(write.key)));
  assert.equal(db.redis.expirations.has(key), false);
  assert.equal(
    (await request(`/${db.userId}/manifest.json`)).data.catalogs.at(-1).id,
    key,
  );
});

test("repeat WeTrakr exports update only their cache and keep edited names and categories", async () => {
  const redis = new MemoryRedis();
  const first = await cacheWeTrakrExport(redis, {
    sourceName: "Same",
    items: exportItems,
    categoryName: "cartoon",
  });
  const key = catalogId(first.list);
  const config = JSON.parse(await redis.get(CONFIG_KEY));
  config.lists[0].name = "My custom name";
  await redis.set(CONFIG_KEY, JSON.stringify(config));
  const next = await cacheWeTrakrExport(redis, {
    sourceName: "Same",
    items: [exportItems[1]],
    categoryName: "movie",
  });
  assert.equal(catalogId(next.list), key);
  assert.equal(next.list.name, "My custom name");
  assert.equal(next.list.categoryName, "cartoon");
  assert.equal(JSON.parse(await redis.get(CONFIG_KEY)).lists.length, 1);
  assert.equal(JSON.parse(await redis.get(key)).length, 1);
  await assert.rejects(startImport(redis, next.list), /select a new ZIP or CSV/);
});

test("invalid or failed WeTrakr publications leave saved config and caches untouched", async () => {
  const redis = new MemoryRedis();
  const first = await cacheWeTrakrExport(redis, {
    sourceName: "Same",
    items: exportItems,
  });
  const key = catalogId(first.list),
    oldConfig = await redis.get(CONFIG_KEY),
    oldCache = await redis.get(key);
  for (const items of [
    [],
    [{ ...exportItems[0], imdb_id: "" }],
    [{ ...exportItems[0], rank: "invalid" }],
  ]) {
    await assert.rejects(cacheWeTrakrExport(redis, { sourceName: "Same", items }));
    assert.equal(await redis.get(CONFIG_KEY), oldConfig);
    assert.equal(await redis.get(key), oldCache);
  }
  redis.multi = () => ({
    set() {
      return this;
    },
    async exec() {
      throw new Error("Transaction unavailable");
    },
  });
  await assert.rejects(
    cacheWeTrakrExport(redis, { sourceName: "Same", items: [exportItems[0]] }),
  );
  assert.equal(await redis.get(CONFIG_KEY), oldConfig);
  assert.equal(await redis.get(key), oldCache);
});
