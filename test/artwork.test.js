import { test, before } from "node:test";
import assert from "node:assert/strict";
import { selectCoverPosters } from "../src/services/artwork.js";

test("cover artwork selects bounded distinct HTTPS posters without changing old metadata", () => {
  const metas = [
    null,
    {},
    { poster: "javascript:alert(1)" },
    { poster: "data:image/png;base64,AAAA" },
    { poster: "http://example.com/insecure.jpg" },
    { poster: "https://user:secret@example.com/private.jpg" },
    { id: "tt1", type: "movie", poster: "https://example.com/1.jpg#fragment" },
    { id: "tt1", type: "movie", poster: "https://example.com/duplicate-title.jpg" },
    { id: "tt2", type: "movie", poster: "https://example.com/1.jpg" },
    ...[2, 3, 4, 5, 6].map((id) => ({
      id: `tt${id}`,
      type: "movie",
      poster: `https://example.com/${id}.jpg`,
    })),
  ];
  const before = JSON.stringify(metas);
  assert.deepEqual(
    selectCoverPosters(metas),
    [1, 2, 3, 4].map((id) => `https://example.com/${id}.jpg`),
  );
  assert.equal(JSON.stringify(metas), before);
  assert.deepEqual(selectCoverPosters(null), []);
  assert.deepEqual(selectCoverPosters([{ id: "tt42" }]), []);
});
