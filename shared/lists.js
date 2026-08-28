// Shared by the server and configuration UI. Legacy entries have no provider field.
const slug = /^(?!\.{1,2}$)[a-zA-Z0-9_.-]{1,150}$/;
const category = /^[\p{L}\p{N} _-]{1,60}$/u;
const mdbSorts = new Set(['rank', 'title', 'released', 'added', 'score', 'imdbrating', 'imdbvotes', 'tmdbpopular', 'usort']);

export function normalizeList(input) {
  if (!input || typeof input !== 'object') throw new Error('Invalid list.');
  const provider = input.provider || 'trakt';
  if (!['trakt', 'mdblist', 'tmdb', 'wetrakr', 'imdb'].includes(provider)) throw new Error('Unsupported list provider.');
  const listId = String(input.listId || '').trim();
  const username = String(input.username || '').trim();
  const categoryName = String(input.categoryName || 'movie').trim();
  const name = String(input.name || '').trim().slice(0, 120);
  const sourceName = provider === 'imdb' && typeof input.sourceName === 'string' ? input.sourceName.trim().normalize('NFC') : '';
  if (sourceName.length > 500 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(sourceName)) throw new Error('Invalid list source name.');
  const validCategory = provider === 'trakt' ? /^[^\u0000-\u001f\u007f]{1,256}$/u.test(categoryName) : category.test(categoryName);
  if (!validCategory) throw new Error('Use letters, numbers, spaces, underscores or dashes for the category.');
  const standalone = ['tmdb', 'wetrakr', 'imdb'].includes(provider);
  if (!slug.test(listId) || (!standalone && !slug.test(username))) throw new Error('Invalid list ID or username.');
  if (['wetrakr', 'imdb'].includes(provider) && !/^[a-f0-9]{64}$/.test(listId)) throw new Error('Invalid list export ID.');
  if (provider === 'tmdb' && !/^\d+$/.test(listId)) throw new Error('TMDB list IDs must be numeric.');
  const sort = String(input.sort || '').trim();
  if (provider === 'trakt' && sort && !/^[a-zA-Z0-9_,.:-]{1,100}$/.test(sort)) throw new Error('Invalid legacy sort.');
  if (provider === 'mdblist' && sort && !mdbSorts.has(sort)) throw new Error('Unsupported MDBList sort.');
  const order = input.order || 'asc';
  if (!['asc', 'desc'].includes(order)) throw new Error('Invalid sort direction.');
  return { provider, username: standalone ? '' : username, listId, categoryName,
    ...(name ? { name } : {}), ...(sourceName ? { sourceName } : {}), ...(sort && !standalone ? { sort } : {}),
    ...(provider === 'mdblist' && sort ? { order } : {}) };
}

export function catalogId(input) {
  const list = normalizeList(input);
  if (['tmdb', 'wetrakr', 'imdb'].includes(list.provider)) return `${list.provider}:${list.listId}`;
  return `${list.provider}:${list.username}:${list.listId}${list.sort ? `:${list.sort}${list.provider === 'mdblist' ? `:${list.order}` : ''}` : ''}`;
}

export function listLabel(list) {
  return list.name || (list.provider === 'imdb' ? 'IMDb export' : list.provider === 'wetrakr' ? 'WeTrakr export' : list.provider === 'tmdb' ? `TMDB list ${list.listId}` : `${list.username} / ${list.listId}`);
}

export function parseListUrl(value, categoryName = 'movie', name = '') {
  const url = new URL(value.trim());
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port) throw new Error('Use a public list URL.');
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  let match;
  if (host === 'themoviedb.org' && (match = url.pathname.match(/^\/list\/(\d+)(?:-[^/]*)?\/?$/))) {
    return normalizeList({ provider: 'tmdb', listId: match[1], categoryName, name });
  }
  if (host === 'mdblist.com' && (match = url.pathname.match(/^\/lists\/([^/]+)\/([^/]+)\/?$/))) {
    return normalizeList({ provider: 'mdblist', username: match[1], listId: match[2], categoryName, name,
      sort: url.searchParams.get('sort') || '', order: url.searchParams.get('order') || 'asc' });
  }
  if (host === 'mdblist.com' && (match = url.pathname.match(/^\/lists\/[^/]+\/external\/(\d+)\/?$/))) {
    return normalizeList({ provider: 'mdblist', username: 'external', listId: match[1], categoryName, name });
  }
  if (host === 'trakt.tv' && (match = url.pathname.match(/^\/users\/([^/]+)\/lists\/([^/]+)\/?$/))) {
    return normalizeList({ provider: 'trakt', username: match[1], listId: match[2], categoryName, name, sort: url.searchParams.get('sort') || '' });
  }
  throw new Error('Use a MDBList list URL or a TMDB /list/ URL. Trakt links can reattach existing snapshots only.');
}

export function isCatalogId(id) {
  if (typeof id !== 'string' || id.length > 450) return false;
  const [provider, username, listId, ...sort] = id.split(':');
  try {
    const list = ['tmdb', 'wetrakr', 'imdb'].includes(provider)
      ? { provider, listId: username }
      : { provider, username, listId, sort: provider === 'mdblist' ? sort[0] : sort.join(':'), order: sort[1] };
    return catalogId(list) === id;
  } catch { return false; }
}
