import { MAX_EXPORT_BYTES, csvRows, prepareExportList } from './export-core.js';

const fail = message => { throw new Error(`IMDb export: ${message}`); };
const types = new Map([
  ...['movie', 'tvmovie', 'short', 'tvshort', 'video', 'tvspecial'].map(type => [type, 'movie']),
  ...['tvseries', 'tvminiseries'].map(type => [type, 'series']),
]);

export function parseImdbCsv(text, sourceName) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > MAX_EXPORT_BYTES) fail('choose a CSV smaller than 8 MB.');
  const rows = csvRows(text.replace(/^\uFEFF/, ''), 'IMDb');
  const headers = rows.shift()?.map(header => header.trim());
  const required = ['Position', 'Const', 'Title', 'Title Type', 'Year'];
  if (!headers || new Set(headers).size !== headers.length || required.some(key => !headers.includes(key))) fail('choose an original IMDb list CSV with Position, Const, Title, Title Type and Year columns.');
  const items = rows.map(row => {
    if (row.length !== headers.length) fail('a CSV row has missing or extra columns.');
    const cell = key => row[headers.indexOf(key)].trim();
    return { title: cell('Title'), imdb_id: cell('Const'), tmdb_id: '',
      type: types.get(cell('Title Type').toLowerCase().replace(/[\s-]/g, '')) || 'unsupported',
      year: cell('Year'), rank: cell('Position') };
  });
  return { ...prepareExportList(sourceName, items, 'IMDb'), provider: 'imdb', items };
}

export function readImdbExport(bytes, filename, sourceName) {
  if (!(bytes instanceof Uint8Array) || !bytes.length || bytes.length > MAX_EXPORT_BYTES) fail('choose a CSV smaller than 8 MB.');
  if (!/\.csv$/i.test(filename)) fail('choose the original IMDb CSV file.');
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { fail('the export must use UTF-8 text.'); }
  return parseImdbCsv(text, sourceName);
}
