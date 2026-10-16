import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeList, catalogId, parseListUrl, isCatalogId } from "../shared/lists.js";
import { encodeUserId, decodeUserId, mergeConfig } from "../src/services/user-store.js";
import { legacy } from "./helpers/addon.js";

test("legacy list identity and install identifiers remain compatible", () => {
  assert.equal(catalogId(legacy), "trakt:a2r14n:droopy:released,asc");
  const id = Buffer.from("https://alpha.upstash.io|test-token").toString("base64url");
  assert.deepEqual(decodeUserId(id + "~2"), {
    upstashUrl: "https://alpha.upstash.io",
    upstashToken: "test-token",
  });
  assert.equal(encodeUserId("https://alpha.upstash.io", "test-token"), id);
  assert.equal(normalizeList(legacy).provider, "trakt");
  assert.equal(
    normalizeList({ ...legacy, categoryName: "Kids & Family" }).categoryName,
    "Kids & Family",
  );
});

test("parses provider URLs, preserves sorting, and rejects lookalike domains", () => {
  assert.equal(
    catalogId(parseListUrl("https://www.themoviedb.org/list/123-tv-favorites")),
    "tmdb:123",
  );
  assert.equal(
    catalogId(
      parseListUrl("https://mdblist.com/lists/alice/favorites?sort=title&order=desc"),
    ),
    "mdblist:alice:favorites:title:desc",
  );
  assert.equal(
    catalogId(parseListUrl("https://mdblist.com/lists/alice/external/42")),
    "mdblist:external:42",
  );
  assert.equal(
    catalogId(
      parseListUrl("https://trakt.tv/users/a2r14n/lists/droopy?sort=released,asc"),
    ),
    catalogId(legacy),
  );
  for (const url of [
    "https://trakt.tv.evil.test/users/a/lists/b",
    "https://mdblist.com.evil.test/lists/a/b",
    "https://user:pass@mdblist.com/lists/a/b",
    "garbage",
  ])
    assert.throws(() => parseListUrl(url));
  assert.equal(isCatalogId("stremio:config"), false);
  assert.equal(isCatalogId("tmdb:123:extra"), false);
  assert.equal(isCatalogId(catalogId(legacy)), true);
});

test("rejects arbitrary Redis destinations before making requests", () => {
  for (const url of [
    "http://alpha.upstash.io",
    "https://127.0.0.1",
    "https://alpha.upstash.io.evil.test",
    "https://alpha.upstash.io/path",
    "https://alpha.upstash.io?token=x",
  ])
    assert.throws(() => encodeUserId(url, "token"));
});

test("merging provider keys preserves legacy lists and unknown saved settings", () => {
  const previous = { traktClientId: "old-key", lists: [legacy], customOption: true };
  const merged = mergeConfig(previous, { mdblistApiKey: "new-key" });
  assert.deepEqual(merged.lists, [legacy]);
  assert.equal(merged.traktClientId, "old-key");
  assert.equal(merged.customOption, true);
  assert.throws(() => mergeConfig(previous, { lists: [legacy, legacy] }));
  assert.deepEqual(previous.lists, [legacy]);
});
