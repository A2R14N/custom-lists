import { unzipSync } from 'fflate';
import { MAX_EXPORT_BYTES, parseWeTrakrCsv } from './wetrakr.js';

export function readWeTrakrExport(bytes, filename) {
  if (!(bytes instanceof Uint8Array) || !bytes.length || bytes.length > MAX_EXPORT_BYTES) throw new Error('Choose an export smaller than 8 MB.');
  let csv = bytes;
  if (/\.zip$/i.test(filename)) {
    let count = 0, found = false;
    try {
      const files = unzipSync(bytes, { filter: entry => {
        if (++count > 500) throw new Error('Too many files.');
        // Ignore notes and all unrelated files. Nothing is extracted to disk.
        if (entry.name !== 'lists.csv') return false;
        if (found || !entry.originalSize || entry.originalSize > MAX_EXPORT_BYTES) throw new Error('Invalid lists.csv size.');
        found = true;
        return true;
      } });
      csv = files['lists.csv'];
      if (!found || !csv || csv.length > MAX_EXPORT_BYTES) throw new Error('Missing lists.csv.');
    } catch { throw new Error('Choose a valid WeTrakr ZIP containing one lists.csv smaller than 8 MB, or select lists.csv directly.'); }
  } else if (!/\.csv$/i.test(filename)) throw new Error('Choose the WeTrakr ZIP or lists.csv file.');
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(csv); }
  catch { throw new Error('The export must use UTF-8 text.'); }
  return parseWeTrakrCsv(text);
}
