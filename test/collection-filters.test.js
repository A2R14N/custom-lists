import { test } from "node:test";
import assert from "node:assert/strict";
import { useCatalogs } from "../vue/src/composables/useCatalogs.ts";
import { useCollectionFilters } from "../vue/src/composables/useCollectionFilters.ts";

function collection() {
  const { state } = useCatalogs({ appUrl: "https://example.test" });
  state.lists = [
    {
      provider: "mdblist",
      username: "alice",
      listId: "list-10",
      name: "List 10",
      categoryName: "movie",
      itemCount: 10,
      cached: true,
      coverPosters: [],
      status: "idle",
      error: "",
    },
    {
      provider: "tmdb",
      username: "",
      listId: "123",
      name: "List 2",
      categoryName: "series",
      itemCount: 20,
      cached: true,
      coverPosters: [],
      status: "idle",
      error: "",
    },
    {
      provider: "trakt",
      username: "alice",
      listId: "archive",
      name: "Favorites",
      categoryName: "cartoon",
      itemCount: 5,
      cached: true,
      coverPosters: [],
      status: "idle",
      error: "",
    },
  ];
  return { state, ...useCollectionFilters(state) };
}

test("collection search matches display names, providers, categories, and owners", () => {
  const view = collection();
  for (const [query, expected] of [
    [" list 2 ", ["tmdb"]],
    ["TRAKT ARCHIVE", ["trakt"]],
    ["series", ["tmdb"]],
    ["alice", ["mdblist", "trakt"]],
  ]) {
    view.search.value = query;
    assert.deepEqual(
      view.visibleLists.value.map((list) => list.provider),
      expected,
    );
  }
  view.filter.value = "mdblist";
  view.search.value = "series";
  assert.equal(view.visibleLists.value.length, 0);
});

test("collection sorting changes the view without mutating saved addon order", () => {
  const view = collection();
  const original = view.state.lists.map((list) => list.name);
  view.sortBy.value = "name";
  assert.deepEqual(
    view.visibleLists.value.map((list) => list.name),
    ["Favorites", "List 2", "List 10"],
  );
  view.sortBy.value = "titles";
  assert.deepEqual(
    view.visibleLists.value.map((list) => list.itemCount),
    [20, 10, 5],
  );
  assert.deepEqual(
    view.state.lists.map((list) => list.name),
    original,
  );
  view.sortBy.value = "addon";
  assert.deepEqual(
    view.visibleLists.value.map((list) => list.name),
    original,
  );
});

test("source counts track list changes independently of active search", () => {
  const view = collection();
  view.search.value = "missing";
  assert.deepEqual(view.sourceCounts.value, {
    all: 3,
    mdblist: 1,
    tmdb: 1,
    trakt: 1,
    wetrakr: 0,
    "wetrakr-api": 0,
    imdb: 0,
  });
  view.state.lists.pop();
  assert.equal(view.sourceCounts.value.all, 2);
  assert.equal(view.sourceCounts.value.trakt, 0);
});

test("reordering is available only in unfiltered addon order", () => {
  const view = collection();
  assert.equal(view.canReorder.value, true);
  view.filter.value = "tmdb";
  assert.equal(view.canReorder.value, false);
  view.clearFilters();
  assert.equal(view.canReorder.value, true);
  view.search.value = "movies";
  view.sortBy.value = "name";
  view.clearFilters();
  assert.equal(view.hasFilters.value, false);
  assert.equal(view.sortBy.value, "name");
  assert.equal(view.canReorder.value, false);
});

test("category and attention filters combine without changing the saved list order", () => {
  const view = collection();
  const original = view.state.lists.map((list) => list.listId);
  view.state.lists[0].error = "Provider quota reached";
  view.state.lists[1].cached = false;
  view.status.value = "attention";
  assert.deepEqual(
    view.visibleLists.value.map((list) => list.provider),
    ["mdblist", "tmdb"],
  );
  view.category.value = "series";
  assert.equal(view.visibleLists.value[0].provider, "tmdb");
  assert.equal(view.canReorder.value, false);
  assert.deepEqual(view.categories.value, ["cartoon", "movie", "series"]);
  view.clearFilters();
  view.status.value = "saved";
  assert.deepEqual(
    view.visibleLists.value.map((list) => list.provider),
    ["trakt"],
  );
  view.viewMode.value = "list";
  view.clearFilters();
  assert.equal(view.viewMode.value, "list");
  assert.equal(view.canReorder.value, true);
  assert.deepEqual(
    view.state.lists.map((list) => list.listId),
    original,
  );
});
