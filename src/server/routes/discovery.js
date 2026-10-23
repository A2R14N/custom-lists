import { getTrending } from "../../services/trending.js";

export async function handleTrending(req, res) {
  const feed = await getTrending();
  // Only this fixed, credential-free route may use shared HTTP caching.
  res.setHeader(
    "Cache-Control",
    feed.items.length && !feed.stale
      ? "public, max-age=300, s-maxage=21600"
      : "public, max-age=60, s-maxage=60",
  );
  res.json(feed);
}
