import { MAX_EXPORT_BYTES, MAX_EXPORT_ITEMS, value, csvRows, prepareExportList } from './export-core.js';
export { MAX_EXPORT_BYTES, MAX_EXPORT_ITEMS } from './export-core.js';
export const prepareWeTrakrList = (name, entries) => prepareExportList(name, entries, 'WeTrakr');
const fail = message => { throw new Error(`WeTrakr export: ${message}`); };

export function parseWeTrakrCsv(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > MAX_EXPORT_BYTES) fail('choose a CSV smaller than 8 MB.');
  const rows = csvRows(text.replace(/^\uFEFF/, ''));
  const headers = rows.shift()?.map(name => name.trim());
  const required = ['list_name', 'title', 'year', 'type', 'tmdb_id', 'imdb_id', 'rank'];
  if (!headers || new Set(headers).size !== headers.length || required.some(key => !headers.includes(key))) fail('choose the original lists.csv from WeTrakr.');
  const lists = new Map();
  for (const row of rows) {
    if (row.length !== headers.length) fail('a CSV row has missing or extra columns.');
    const sourceName = value(row[headers.indexOf('list_name')]).normalize('NFC');
    if (!sourceName) fail('a list name is required.');
    if (!lists.has(sourceName)) lists.set(sourceName, []);
    const item = Object.fromEntries(required.filter(key => key !== 'list_name').map(key => [key, row[headers.indexOf(key)]]));
    lists.get(sourceName).push(item);
    if (lists.size > 200 || lists.get(sourceName).length > MAX_EXPORT_ITEMS) fail('use at most 200 lists and 10,000 entries per list.');
  }
  if (!lists.size) fail('no lists were found.');
  return [...lists].map(([sourceName, items]) => ({ ...prepareWeTrakrList(sourceName, items), items }));
}
