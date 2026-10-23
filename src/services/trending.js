import axios from "axios";

const FRESH_MS = 6 * 60 * 60 * 1000;
const STALE_MS = 24 * 60 * 60 * 1000;
const RETRY_MS = 5 * 60 * 1000;
const unavailable = () => ({ items: [], updatedAt: null, stale: false });

// Public editorial metadata only. Never read a user's Redis or provider settings.
export function createTrendingFeed({
  request = (url, options) => axios.get(url, options),
  now = Date.now,
  credentials = () => ({
    token: process.env.TMDB_TRENDING_ACCESS_TOKEN,
    apiKey: process.env.TMDB_TRENDING_API_KEY,
  }),
} = {}) {
  let snapshot = null;
  let pending = null;
  let nextAttemptAt = 0;

  const fallback = () =>
    snapshot && now() - snapshot.time < STALE_MS
      ? { ...snapshot.data, stale: true }
      : unavailable();

  return async function getTrending() {
    if (snapshot && now() - snapshot.time < FRESH_MS)
      return { ...snapshot.data, stale: false };
    if (pending) return pending;
    if (now() < nextAttemptAt) return fallback();
    const { token, apiKey } = credentials();
    if (!token && !apiKey) return fallback();
    const secrets = [token, apiKey].filter(Boolean);

    pending = (async () => {
      try {
        const { data } = await Promise.resolve().then(() =>
          request("https://api.themoviedb.org/3/trending/movie/week", {
            params: { language: "en-US", ...(!token ? { api_key: apiKey } : {}) },
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            timeout: 4000,
            maxContentLength: 1024 * 1024,
            maxRedirects: 0,
          }),
        );
        const seenIds = new Set();
        const seenPosters = new Set();
        const items = [];
        if (!Array.isArray(data?.results)) throw new Error("Invalid trending feed");
        for (const item of data.results.slice(0, 100)) {
          if (
            !item ||
            !Number.isSafeInteger(item.id) ||
            item.id < 1 ||
            item.adult === true ||
            (item.media_type && item.media_type !== "movie") ||
            typeof item.title !== "string" ||
            !item.title.trim() ||
            item.title.length > 200 ||
            typeof item.poster_path !== "string" ||
            !/^\/[\w-]{1,180}\.(jpg|png|webp)$/.test(item.poster_path) ||
            secrets.some(
              (secret) =>
                item.title.includes(secret) || item.poster_path.includes(secret),
            ) ||
            seenIds.has(item.id) ||
            seenPosters.has(item.poster_path)
          )
            continue;
          seenIds.add(item.id);
          seenPosters.add(item.poster_path);
          items.push({
            id: item.id,
            title: item.title.trim(),
            poster: `https://image.tmdb.org/t/p/w500${item.poster_path}`,
            url: `https://www.themoviedb.org/movie/${item.id}`,
          });
          if (items.length === 12) break;
        }
        if (items.length < 3) throw new Error("Incomplete trending feed");
        const time = now();
        snapshot = { time, data: { items, updatedAt: new Date(time).toISOString() } };
        nextAttemptAt = time + FRESH_MS;
        return { ...snapshot.data, stale: false };
      } catch {
        // Provider errors can contain credentials. Never log or return them.
        nextAttemptAt = now() + RETRY_MS;
        return fallback();
      } finally {
        pending = null;
      }
    })();
    return pending;
  };
}

export const getTrending = createTrendingFeed();
