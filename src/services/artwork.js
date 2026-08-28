// Derived from the existing snapshot only: no network calls or persisted artwork.
export function selectCoverPosters(metas) {
  const posters = [], seenUrls = new Set(), seenTitles = new Set();
  if (!Array.isArray(metas)) return posters;
  for (const meta of metas) {
    if (!meta || typeof meta.poster !== 'string' || meta.poster.length > 2048) continue;
    try {
      const url = new URL(meta.poster.trim());
      if (url.protocol !== 'https:' || url.username || url.password) continue;
      url.hash = '';
      const title = meta.id ? `${meta.type || ''}:${meta.id}` : null;
      if (seenUrls.has(url.href) || (title && seenTitles.has(title))) continue;
      posters.push(url.href);
      seenUrls.add(url.href);
      if (title) seenTitles.add(title);
      // Three visible posters and one spare if an image fails to load.
      if (posters.length === 4) break;
    } catch { /* Old or malformed metadata simply uses the fallback artwork. */ }
  }
  return posters;
}
