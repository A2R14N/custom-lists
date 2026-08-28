export const MAX_EXPORT_ITEMS = 10000;
export const MAX_EXPORT_BYTES = 8 * 1024 * 1024;
const errorFor = label => message => { throw new Error(`${label} export: ${message}`); };

export function value(input, limit = 500, label = 'WeTrakr') {
  const fail = errorFor(label);
  if (typeof input !== 'string' && typeof input !== 'number') fail('invalid field value.');
  const text = String(input).trim();
  if (text.length > limit || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) fail('invalid field value.');
  return text;
}

export function prepareExportList(sourceName, entries, label = 'WeTrakr') {
  const fail = errorFor(label);
  const field = (input, limit) => value(input, limit, label);
  const source = field(sourceName).normalize('NFC');
  if (!source) fail('a list name is required.');
  if (!Array.isArray(entries) || !entries.length || entries.length > MAX_EXPORT_ITEMS) fail('use 1–10,000 entries per list.');
  const ordered = entries.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) fail('invalid title row.');
    const title = field(item.title, 500), type = field(item.type, 30);
    const imdb = field(item.imdb_id ?? '', 30), tmdb = field(item.tmdb_id ?? '', 20);
    const year = field(item.year ?? '', 4), rank = field(item.rank ?? '', 12);
    if (!title || (imdb && !/^tt\d+$/.test(imdb)) || (tmdb && !/^[1-9]\d*$/.test(tmdb)) ||
        (year && !/^\d{4}$/.test(year)) || (rank && !/^\d+$/.test(rank))) fail('invalid title, identifier, year, or rank.');
    return { title, type, imdb, tmdb, year, rank: rank ? Number(rank) : index + 1, index };
  }).sort((a, b) => a.rank - b.rank || a.index - b.index);
  const seen = new Set(), metas = [];
  let missingIds = 0, unsupported = 0, duplicates = 0;
  for (const item of ordered) {
    if (!['movie', 'show', 'tv', 'series'].includes(item.type)) { unsupported++; continue; }
    if (!item.imdb) { missingIds++; continue; }
    const type = item.type === 'movie' ? 'movie' : 'series';
    const identity = `${type}:${item.imdb}`;
    if (seen.has(identity)) { duplicates++; continue; }
    seen.add(identity);
    metas.push({ id: item.imdb, imdb_id: item.imdb, ...(item.tmdb ? { tmdb_id: item.tmdb } : {}),
      type, name: item.title, releaseInfo: item.year, posterShape: 'poster',
      poster: `https://live.metahub.space/poster/medium/${item.imdb}/img` });
  }
  return { sourceName: source, metas, total: entries.length, missingIds, unsupported, duplicates,
    skipped: missingIds + unsupported + duplicates };
}

// Strict CSV quoting, including escaped quotes, embedded newlines and UTF-8 BOM.
// No CSV content is executed or rendered as HTML.
export function csvRows(text, label = 'WeTrakr') {
  const fail = errorFor(label);
  const rows = [];
  let row = [], field = '', quoted = false, closed = false;
  const endField = () => { row.push(field); field = ''; closed = false; };
  const endRow = () => {
    endField();
    if (row.some(cell => cell.trim())) rows.push(row);
    row = [];
    if (rows.length > 50001) fail('use at most 50,000 rows per file.');
  };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { quoted = false; closed = true; }
      } else field += char;
    } else if (char === ',') endField();
    else if (char === '\r' || char === '\n') { endRow(); if (char === '\r' && text[i + 1] === '\n') i++; }
    else if (char === '"' && !field && !closed) quoted = true;
    else if (closed || char === '"') fail('invalid CSV quoting.');
    else field += char;
    if (field.length > 65536 || row.length > 100) fail('a CSV field is too large.');
  }
  if (quoted) fail('the CSV is incomplete.');
  if (field || row.length || closed) endRow();
  return rows;
}
