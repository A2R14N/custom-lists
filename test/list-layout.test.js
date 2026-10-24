import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeList, catalogId } from "../shared/lists.js";
import { useListOrdering, orderKey } from "../vue/src/composables/useListOrdering.ts";
import { CONFIG_KEY } from "../src/services/user-store.js";
import { database, mdb, legacy, tmdb, cached, request } from "./helpers/addon.js";
import { frontend } from "./helpers/frontend.js";

test("hidden rows retain their catalog IDs and default visibility remains compatible", () => {
  assert.equal(catalogId({ ...mdb, hidden: true }), catalogId(mdb));
  assert.equal(normalizeList({ ...mdb, hidden: true }).hidden, true);
  assert.equal(Object.hasOwn(normalizeList(mdb), "hidden"), false);
  assert.equal(Object.hasOwn(normalizeList({ ...mdb, hidden: false }), "hidden"), false);
  for (const hidden of ["true", 1, null])
    assert.throws(() => normalizeList({ ...mdb, hidden }), /visibility/);
});

test("order drafts insert rather than swap, and cancellation does not change the collection", () => {
  const initial = [legacy, mdb, tmdb, { ...mdb, listId: "last" }].map((list) => ({
    ...normalizeList(list),
    cached: true,
    itemCount: 1,
    coverPosters: [],
    status: "idle",
    error: "",
  }));
  const before = JSON.stringify(initial);
  const draft = useListOrdering(initial);
  assert.equal(draft.changed.value, false);
  draft.move(0, 3);
  assert.deepEqual(
    draft.items.value.map(orderKey),
    [initial[1], initial[2], initial[3], initial[0]].map(orderKey),
  );
  draft.move(3, 0);
  assert.equal(draft.changed.value, false);
  draft.items.value[0].hidden = true;
  assert.equal(draft.changed.value, true);
  draft.move(-1, 2);
  draft.move(0, 99);
  assert.equal(JSON.stringify(initial), before);
});

test("order and visibility save once, survive reload, and leave every snapshot intact", async () => {
  const db = database();
  const lists = [legacy, mdb, tmdb, { ...mdb, categoryName: "series" }];
  await db.redis.set(CONFIG_KEY, { lists });
  for (const list of lists) await db.redis.set(catalogId(list), JSON.stringify(cached));
  const { ui } = frontend();
  await ui.restore(db.userId);
  db.redis.writes = [];
  const draft = useListOrdering(ui.state.lists);
  draft.move(0, 3);
  draft.items.value[0].hidden = true;
  assert.equal(await ui.saveListLayout(draft.items.value), true);
  assert.equal(db.redis.writes.length, 1);
  assert.equal(db.redis.writes[0].key, CONFIG_KEY);
  const manifest = await request(`/${db.userId}/manifest.json`);
  assert.deepEqual(
    manifest.data.catalogs.map((item) => `${item.id}|${item.type}`),
    [tmdb, { ...mdb, categoryName: "series" }, legacy].map(
      (list) => `${catalogId(list)}|${list.categoryName}`,
    ),
  );
  assert.equal(ui.addonLists.value.length, 3);
  const reloaded = frontend().ui;
  await reloaded.restore(db.userId);
  assert.equal(reloaded.state.lists[0].hidden, true);
  const sameSnapshot = await request(
    `/${db.userId}/catalog/movie/${catalogId(mdb)}.json`,
  );
  assert.deepEqual(sameSnapshot.data.metas, cached);
  for (const list of lists)
    assert.deepEqual(JSON.parse(await db.redis.get(catalogId(list))), cached);
  assert.equal(
    await reloaded.editList(reloaded.state.lists[0], "Visible again", "movie", false),
    true,
  );
  const restored = await request(`/${db.userId}/manifest.json`);
  assert.equal(restored.data.catalogs.length, 4);
  assert.equal(restored.data.catalogs[0].name, "Visible again");
});

test("failed or invalid layout saves preserve the current collection and cached data", async () => {
  const db = database();
  await db.redis.set(CONFIG_KEY, { lists: [legacy, mdb, tmdb] });
  const context = frontend();
  await context.ui.restore(db.userId);
  const before = JSON.stringify(context.ui.state.lists);
  db.redis.writes = [];
  assert.equal(
    await context.ui.saveListLayout([
      context.ui.state.lists[0],
      context.ui.state.lists[0],
      context.ui.state.lists[2],
    ]),
    false,
  );
  assert.equal(db.redis.writes.length, 0);
  const draft = useListOrdering(context.ui.state.lists);
  draft.move(0, 2);
  draft.items.value[0].hidden = true;
  context.fetch = async () =>
    Response.json({ error: "Synthetic save failure" }, { status: 503 });
  assert.equal(await context.ui.saveListLayout(draft.items.value), false);
  assert.equal(JSON.stringify(context.ui.state.lists), before);
  assert.equal(db.redis.writes.length, 0);
});

test("all rows can be hidden and shown again without removing lists or changing types", async () => {
  const db = database();
  await db.redis.set(CONFIG_KEY, { lists: [legacy, mdb] });
  const { ui } = frontend();
  await ui.restore(db.userId);
  assert.equal(
    await ui.saveListLayout(ui.state.lists.map((list) => ({ ...list, hidden: true }))),
    true,
  );
  assert.deepEqual((await request(`/${db.userId}/manifest.json`)).data.catalogs, []);
  assert.equal(ui.state.lists.length, 2);
  assert.equal(ui.addonLists.value.length, 0);
  assert.equal(
    await ui.saveListLayout(ui.state.lists.map((list) => ({ ...list, hidden: false }))),
    true,
  );
  assert.equal((await request(`/${db.userId}/manifest.json`)).data.catalogs.length, 2);
  const invalid = await request("/api/config", {
    upstashUrl: db.upstashUrl,
    upstashToken: db.upstashToken,
    lists: [{ ...mdb, hidden: "false" }],
  });
  assert.equal(invalid.status, 400);
});
