import axios from "axios";
import { getBasicMeta } from "./cinemeta.js";

// Public list API v1. Export snapshots keep their separate wetrakr:<hash> keys.
// See https://api.wetrakr.com/#/lists/lists-items and #/conventions/pagination.
export async function fetchWeTrakrPage(list, config, position = {}) {
  const page = position.page || 1;
  const { data, headers } = await axios.get(
    `https://api.wetrakr.com/lists/${list.listId}/items/all`,
    {
      timeout: 12000,
      maxRedirects: 0,
      maxContentLength: 8 * 1024 * 1024,
      headers: { "wetrakr-api-key": config.wetrakrApiKey, "wetrakr-api-version": "1" },
      // Regular pages retain metadata and the owner's pinned/manual list order.
      params: { page, limit: 100, sort_by: "editor_rank", sort_dir: "asc" },
    },
  );
  const current = Number(headers?.["x-pagination-page"]);
  const pages = Number(headers?.["x-pagination-page-count"]);
  const total = Number(headers?.["x-pagination-item-count"]);
  const limit = Number(headers?.["x-pagination-limit"]);
  if (
    !Array.isArray(data) ||
    !Number.isSafeInteger(current) ||
    current !== page ||
    !Number.isSafeInteger(pages) ||
    pages < 0 ||
    !Number.isSafeInteger(total) ||
    total < 0 ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 100 ||
    data.length !== Math.min(limit, Math.max(0, total - (page - 1) * limit)) ||
    (total > 0 && pages !== Math.ceil(total / limit)) ||
    (total > 0 && (pages < page || data.length === 0)) ||
    (total === 0 && (data.length !== 0 || pages > 1 || page !== 1))
  )
    throw new Error("WeTrakr returned an invalid or incomplete list page.");
  if (total > 10000)
    throw new Error(
      "This importer supports up to 10000 items. No snapshot was replaced.",
    );
  // A malformed supported title is a failed page, not a partially saved refresh.
  if (
    data.some(
      (item) =>
        !item ||
        typeof item !== "object" ||
        Array.isArray(item) ||
        typeof item.type !== "string",
    )
  )
    throw new Error("WeTrakr returned an invalid title.");
  return { items: data, total, next: page < pages ? { page: page + 1 } : null };
}

export function weTrakrMeta(item) {
  if (!["movie", "show"].includes(item.type)) return null;
  const id = item.ids?.imdb;
  if (!/^tt\d+$/.test(id || "")) return null;
  const type = item.type === "show" ? "series" : "movie";
  const poster = typeof item.poster_path === "string" ? item.poster_path : "";
  return {
    ...getBasicMeta(id, item.title || id, type),
    ...(poster.startsWith("/") && !poster.startsWith("//")
      ? { poster: `https://image.tmdb.org/t/p/w500${poster}` }
      : /^https:\/\//.test(poster)
        ? { poster }
        : {}),
    description: typeof item.overview === "string" ? item.overview : "",
    releaseInfo: String(item.release_date || item.first_air_date || "").slice(0, 4),
    ...(Number.isSafeInteger(item.ids?.tmdb) && item.ids.tmdb > 0
      ? { tmdb_id: item.ids.tmdb }
      : {}),
  };
}
