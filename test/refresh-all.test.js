import { test } from "node:test";
import assert from "node:assert/strict";
import axios from "axios";
import { catalogId } from "../shared/lists.js";
import { CONFIG_KEY } from "../src/services/user-store.js";
import { database, mdb, tmdb, legacy, cached, entry } from "./helpers/addon.js";
import { frontend } from "./helpers/frontend.js";

test("batch refresh deduplicates categories, skips archives and files, and continues after a failed provider", async () => {
  const db = database();
  const exportList = { provider: "imdb", listId: "a".repeat(64), categoryName: "movie" };
  await db.redis.set(CONFIG_KEY, {
    lists: [mdb, { ...mdb, categoryName: "series" }, tmdb, legacy, exportList],
    mdblistApiKey: "mock-mdb",
    tmdbAccessToken: "mock-tmdb",
  });
  for (const list of [mdb, tmdb, legacy, exportList])
    await db.redis.set(catalogId(list), JSON.stringify(cached));
  const { ui } = frontend();
  await ui.restore(db.userId);
  assert.equal(ui.refreshableLists.value.length, 2);
  const calls = [];
  axios.get = async (url) => {
    calls.push(url);
    assert.equal(ui.busy.value, true);
    assert.equal(await ui.editList(ui.state.lists[0], "Must not save", "movie"), false);
    if (url.includes("mdblist"))
      throw Object.assign(new Error("quota"), {
        isAxiosError: true,
        response: { status: 429 },
      });
    if (url.includes("/4/list/"))
      return {
        data: {
          results: [{ id: 10, media_type: "movie", title: "New title" }],
          total_pages: 1,
          total_results: 1,
        },
      };
    return { data: { imdb_id: "tt10" } };
  };
  await ui.refreshAll();
  assert.equal(calls.filter((url) => url.includes("mdblist")).length, 1);
  assert.match(ui.state.lists[0].error, /quota/);
  assert.equal(ui.state.lists[2].itemCount, 1);
  assert.equal(ui.state.lists[2].error, "");
  assert.match(ui.state.message, /1 list updated.*1 failed/);
  assert.equal(ui.busy.value, false);
  assert.equal(ui.state.refreshProgress, null);
  for (const list of [mdb, legacy, exportList])
    assert.deepEqual(JSON.parse(await db.redis.get(catalogId(list))), cached);
});

test("stopping a batch completes the current snapshot and leaves later lists untouched", async () => {
  const db = database();
  const second = { ...mdb, listId: "later" };
  await db.redis.set(CONFIG_KEY, { lists: [mdb, second], mdblistApiKey: "mock-mdb" });
  await db.redis.set(catalogId(second), JSON.stringify(cached));
  const { ui } = frontend();
  await ui.restore(db.userId);
  axios.get = async () => {
    ui.stopRefresh();
    return { data: { items: [entry(2)] }, headers: {} };
  };
  await ui.refreshAll();
  assert.equal(ui.state.lists[0].cached, true);
  assert.deepEqual(JSON.parse(await db.redis.get(catalogId(second))), cached);
  assert.match(ui.state.message, /1 list updated.*stopped/);
  assert.equal(ui.state.stopAfterCurrent, false);
  ui.state.mdblistApiKey = "";
  assert.equal(ui.refreshableLists.value.length, 0);
  ui.disconnect();
  assert.equal(ui.state.refreshingAll, false);
});
