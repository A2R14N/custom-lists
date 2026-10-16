import { exportItems, imdbCsv } from "./helpers/exports.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import axios from "axios";
import { catalogId } from "../shared/lists.js";
import { CONFIG_KEY } from "../src/services/user-store.js";
import { parseImdbCsv } from "../shared/imdb.js";
import { legacy, mdb, cached, entry, base, database } from "./helpers/addon.js";
import { frontend } from "./helpers/frontend.js";

test("frontend loads legacy data, invalid URLs clear parsing, and revisions affect URLs", async () => {
  const db = database();
  await db.redis.set(CONFIG_KEY, { lists: [legacy] });
  await db.redis.set(catalogId(legacy), JSON.stringify(cached));
  db.redis.writes = [];
  const { ui } = frontend();
  ui.state.upstashUrl = db.upstashUrl;
  ui.state.upstashToken = db.upstashToken;
  await ui.connect();
  assert.equal(ui.state.lists.length, 1);
  assert.equal(ui.state.lists[0].cached, true);
  assert.equal(db.redis.writes.length, 0);
  assert.deepEqual(Array.from(ui.state.lists[0].coverPosters), [cached[0].poster]);
  ui.state.listUrl = "https://mdblist.com/lists/alice/favorites";
  assert.ok(ui.parsed.value.list);
  ui.state.listUrl = "broken";
  assert.equal(ui.parsed.value.list, null);
  const original = ui.buildAddonUrl();
  ui.state.cacheBuster = "2";
  assert.notEqual(ui.buildAddonUrl(), original);
  assert.ok(ui.buildAddonUrl().includes("~2/manifest.json"));
});

test("redesigned UI restores a private link through this server, never the pasted host", async () => {
  const db = database();
  await db.redis.set(CONFIG_KEY, { lists: [legacy] });
  await db.redis.set(catalogId(legacy), JSON.stringify(cached));
  db.redis.writes = [];
  const context = frontend(),
    calls = [];
  context.fetch = (url, init) => {
    calls.push(url);
    return fetch(base + url, init);
  };
  assert.equal(
    await context.ui.restoreFromUrl(
      `https://old-host.invalid/${db.userId}/manifest.json`,
    ),
    true,
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0], `/api/config/${db.userId}`);
  assert.equal(context.ui.state.lists[0].cached, true);
  assert.equal(db.redis.writes.length, 0);
  assert.equal(await context.ui.restoreFromUrl("https://unrelated.invalid/"), false);
  assert.equal(calls.length, 1);
});

test("redesigned UI edits and reorders catalogs without rewriting their snapshots", async () => {
  const db = database();
  await db.redis.set(CONFIG_KEY, { lists: [legacy, mdb] });
  await db.redis.set(catalogId(legacy), JSON.stringify(cached));
  const { ui } = frontend();
  ui.state.upstashUrl = db.upstashUrl;
  ui.state.upstashToken = db.upstashToken;
  await ui.connect();
  db.redis.writes = [];
  assert.equal(
    await ui.editList(ui.state.lists[0], "Saturday cartoons", "cartoon"),
    true,
  );
  assert.equal(ui.state.lists[0].name, "Saturday cartoons");
  assert.deepEqual(Array.from(ui.state.lists[0].coverPosters), [cached[0].poster]);
  assert.equal(await ui.moveList(ui.state.lists[1], -1), true);
  assert.equal(ui.state.lists[0].provider, "mdblist");
  assert.equal(await ui.removeList(ui.state.lists[1]), true);
  assert.equal(ui.state.lists.length, 1);
  assert.ok(db.redis.writes.every((write) => write.key === CONFIG_KEY));
  assert.deepEqual(JSON.parse(await db.redis.get(catalogId(legacy))), cached);
});

test("cover artwork updates across matching catalogs only after a successful refresh", async () => {
  const db = database();
  await db.redis.set(CONFIG_KEY, {
    lists: [mdb, { ...mdb, categoryName: "cartoon" }],
    mdblistApiKey: "key",
  });
  await db.redis.set(catalogId(mdb), JSON.stringify(cached));
  const { ui } = frontend();
  ui.state.upstashUrl = db.upstashUrl;
  ui.state.upstashToken = db.upstashToken;
  await ui.connect();
  axios.get = async () => ({
    data: { items: [{ ...entry(42), poster: "https://example.com/new.jpg" }] },
    headers: {},
  });
  await ui.runImport(ui.state.lists[0]);
  for (const list of ui.state.lists)
    assert.deepEqual(Array.from(list.coverPosters), ["https://example.com/new.jpg"]);
  axios.get = async () => {
    throw new Error("Provider unavailable");
  };
  await ui.runImport(ui.state.lists[0]);
  for (const list of ui.state.lists)
    assert.deepEqual(Array.from(list.coverPosters), ["https://example.com/new.jpg"]);
  assert.match(ui.state.lists[0].error, /previous snapshot is still available/);
});

test("redesigned UI keeps local lists on a failed save and clears credentials on disconnect", async () => {
  const db = database();
  await db.redis.set(CONFIG_KEY, { lists: [legacy] });
  const context = frontend(),
    { ui } = context;
  ui.state.upstashUrl = db.upstashUrl;
  ui.state.upstashToken = db.upstashToken;
  await ui.connect();
  context.fetch = async () =>
    new Response(JSON.stringify({ error: "Test save failure" }), { status: 502 });
  assert.equal(await ui.removeList(ui.state.lists[0]), false);
  assert.equal(ui.state.lists.length, 1);
  assert.equal(await ui.editList(ui.state.lists[0], "Changed", "movie"), false);
  assert.notEqual(ui.state.lists[0].name, "Changed");
  ui.disconnect();
  assert.equal(ui.state.connected, false);
  assert.equal(ui.state.upstashToken, "");
  assert.equal(ui.state.userId, "");
  assert.equal(ui.state.lists.length, 0);
});

test("WeTrakr UI sends only selected rows and changes its state only after successful caching", async () => {
  const alpha = database(),
    beta = database("beta.upstash.io");
  const context = frontend(),
    { ui } = context;
  ui.state.upstashUrl = alpha.upstashUrl;
  ui.state.upstashToken = alpha.upstashToken;
  await ui.connect();
  const selected = { sourceName: "Weekend", items: exportItems };
  assert.equal(await ui.cacheExport(selected, "cartoon"), true);
  assert.equal(ui.state.lists[0].itemCount, 2);
  assert.equal(ui.state.lists[0].provider, "wetrakr");
  assert.equal(ui.canImport(ui.state.lists[0]), false);
  assert.equal(await beta.redis.get(CONFIG_KEY), null);
  context.fetch = async () =>
    new Response(JSON.stringify({ error: "Cache unavailable" }), { status: 502 });
  assert.equal(
    await ui.cacheExport({ ...selected, items: [exportItems[0]] }, "movie"),
    false,
  );
  assert.equal(ui.state.lists[0].itemCount, 2);
  assert.equal(ui.state.importing, false);
});

test("IMDb frontend sends its provider and preserves the last snapshot after a failed update", async () => {
  const db = database();
  const context = frontend(),
    { ui } = context;
  ui.state.upstashUrl = db.upstashUrl;
  ui.state.upstashToken = db.upstashToken;
  await ui.connect();
  const parsed = parseImdbCsv(imdbCsv, "Weekend");
  assert.equal(await ui.cacheExport(parsed, "movie"), true);
  assert.equal(ui.state.lists[0].provider, "imdb");
  assert.equal(ui.state.lists[0].itemCount, 3);
  assert.equal(ui.canImport(ui.state.lists[0]), false);
  context.fetch = async () =>
    new Response(JSON.stringify({ error: "Cache unavailable" }), { status: 502 });
  assert.equal(
    await ui.cacheExport({ ...parsed, items: [parsed.items[0]] }, "movie"),
    false,
  );
  assert.equal(ui.state.lists[0].itemCount, 3);
  assert.equal(ui.state.importing, false);
});

test("preview reuse deduplicates requests, isolates image failures and clears on reconnect", async () => {
  const db = database();
  await db.redis.set(CONFIG_KEY, { lists: [legacy] });
  await db.redis.set(catalogId(legacy), JSON.stringify(cached));
  const context = frontend(),
    { ui } = context;
  ui.state.upstashUrl = db.upstashUrl;
  ui.state.upstashToken = db.upstashToken;
  await ui.connect();
  const original = context.fetch;
  let calls = 0;
  context.fetch = (url, init) => {
    if (url.includes("?preview=1")) calls++;
    return original(url, init);
  };
  const [first, second] = await Promise.all([
    ui.previewList(ui.state.lists[0]),
    ui.previewList(ui.state.lists[0]),
  ]);
  first[0].poster = "";
  assert.equal(second[0].poster, cached[0].poster);
  await ui.previewList(ui.state.lists[0]);
  assert.equal(calls, 1);
  await db.redis.set(
    catalogId(legacy),
    JSON.stringify([{ ...cached[0], name: "Updated" }]),
  );
  await ui.connect();
  assert.equal((await ui.previewList(ui.state.lists[0]))[0].name, "Updated");
  assert.equal(calls, 2);
  ui.disconnect();
  ui.state.upstashUrl = db.upstashUrl;
  ui.state.upstashToken = db.upstashToken;
  await ui.connect();
  context.fetch = async () =>
    new Response(JSON.stringify({ error: "Unavailable" }), { status: 502 });
  await assert.rejects(ui.previewList(ui.state.lists[0]), /Unavailable/);
  context.fetch = original;
  assert.equal((await ui.previewList(ui.state.lists[0]))[0].name, "Updated");
});
