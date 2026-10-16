import { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import axios from "axios";
import { catalogId, normalizeList } from "../../shared/lists.js";
import { encodeUserId } from "../../src/services/user-store.js";
class MemoryRedis {
  constructor() {
    this.values = new Map();
    this.writes = [];
    this.expirations = new Map();
  }
  async get(key) {
    return this.values.get(key) ?? null;
  }
  async set(key, value, options = {}) {
    if (options.nx && this.values.has(key)) return null;
    this.values.set(key, value);
    this.writes.push({ key, value, options });
    if (options.ex) this.expirations.set(key, options.ex);
    return "OK";
  }
  async del(key) {
    return this.values.delete(key) ? 1 : 0;
  }
  async ping() {
    return "PONG";
  }
  multi() {
    const operations = [],
      redis = this;
    const transaction = {
      set(key, value) {
        operations.push([key, value]);
        return transaction;
      },
      async exec() {
        for (const [key, value] of operations) await redis.set(key, value);
        return operations.map(() => "OK");
      },
    };
    return transaction;
  }
}

const databases = new Map();
const legacy = {
  username: "a2r14n",
  listId: "droopy",
  categoryName: "cartoon",
  sort: "released,asc",
};
const mdb = normalizeList({
  provider: "mdblist",
  username: "alice",
  listId: "favorites",
  categoryName: "movie",
});
const tmdb = normalizeList({ provider: "tmdb", listId: "123", categoryName: "series" });
const cached = [
  {
    id: "tt0035824",
    name: "Dumb-Hounded",
    type: "movie",
    poster: "https://example.com/poster.jpg",
  },
];
const entry = (id, mediatype = "movie") => ({
  imdb_id: `tt${id}`,
  mediatype,
  title: `Title ${id}`,
  poster: "https://example.com/poster.jpg",
  release_year: 2020,
});
const originalGet = axios.get;
const originalFetch = globalThis.fetch;
let server, base;

before(async () => {
  process.env.DOTENV_CONFIG_PATH = "__nonexistent_test_env__";
  globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input.url);
    if (url.hostname === "127.0.0.1") return originalFetch(input, init);
    const redis = databases.get(url.hostname);
    assert.ok(redis, `Unexpected external request: ${url.origin}`);
    const body = JSON.parse(init.body);
    const execute = async (command) => {
      const [op, key, value, ...flags] = command;
      let result;
      if (op.toLowerCase() === "get") result = await redis.get(key);
      else if (op.toLowerCase() === "ping") result = "PONG";
      else if (op.toLowerCase() === "del") result = await redis.del(key);
      else if (op.toLowerCase() === "set") {
        const lowered = flags.map((x) => String(x).toLowerCase());
        const options = { nx: lowered.includes("nx") };
        const index = lowered.indexOf("ex");
        if (index >= 0) options.ex = Number(flags[index + 1]);
        result = await redis.set(key, value, options);
      } else throw new Error(`Unexpected Redis command ${op}`);
      if (result && typeof result === "object") result = JSON.stringify(result);
      if (typeof result === "string") result = Buffer.from(result).toString("base64");
      return { result };
    };
    const result = Array.isArray(body[0])
      ? await Promise.all(body.map(execute))
      : await execute(body);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  const { default: app } = await import("../../src/server/index.js");
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(() => {
  databases.clear();
  axios.get = async () => {
    throw new Error("Unexpected provider call");
  };
});

after(async () => {
  axios.get = originalGet;
  globalThis.fetch = originalFetch;
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

async function request(path, body) {
  const response = await fetch(
    base + path,
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {},
  );
  return {
    status: response.status,
    headers: response.headers,
    data: await response.json(),
  };
}

function database(host = "alpha.upstash.io") {
  const redis = new MemoryRedis();
  databases.set(host, redis);
  return {
    redis,
    userId: encodeUserId(`https://${host}`, "test-token"),
    upstashUrl: `https://${host}`,
    upstashToken: "test-token",
  };
}

export {
  MemoryRedis,
  databases,
  legacy,
  mdb,
  tmdb,
  cached,
  entry,
  base,
  database,
  request,
};
