import axios from 'axios';
import { fetchCinemetaMeta, getBasicMeta } from './cinemeta.js';

const timeout = 12000;
export const MAX_ITEMS = 10000;
const options = { timeout, maxRedirects: 0, maxContentLength: 8 * 1024 * 1024 };

export function requireProviderKey(provider, config) {
  if (provider === 'imdb') throw new Error('IMDb export: select a new CSV to update this snapshot.');
  if (provider === 'wetrakr') throw new Error('WeTrakr export: select a new ZIP or CSV to update this snapshot.');
  if (provider === 'trakt') throw new Error('Trakt snapshots are preserved without contacting Trakt. Import new lists from MDBList or TMDB.');
  if (provider === 'mdblist' && !config.mdblistApiKey) throw new Error('Save your MDBList API key before importing.');
  if (provider === 'tmdb' && !config.tmdbAccessToken) throw new Error('Save your TMDB API Read Access Token before importing.');
}

export function providerError(error) {
  if (/^(WeTrakr|IMDb) export:/.test(error.message || '')) return error.message;
  const status = error.response?.status;
  if (status === 401 || status === 403) return 'The provider rejected access. Check your API credentials and list visibility.';
  if (status === 404) return 'The provider could not find this list or title.';
  if (status === 429) return 'Provider quota reached. Your previous snapshot is safe; try again after the quota resets.';
  if (error.isAxiosError) return 'The provider request failed. Your previous snapshot is unchanged; try again later.';
  // Only expose errors produced by our validation/import code. Redis/network errors
  // can include response bodies or credential-bearing URLs.
  if (/^(Save your |Trakt snapshots |Save this list |Invalid (list|sort|legacy|import|Upstash|install)|Use |Unsupported |This import|Import (expired|progress)|The list was removed|TMDB returned|MDBList returned|No usable titles)/.test(error.message || '')) return error.message;
  return 'Import failed. Check your Redis connection and provider credentials. Your previous snapshot is unchanged.';
}

export async function fetchProviderPage(list, config, position = {}) {
  requireProviderKey(list.provider, config);
  if (list.provider === 'tmdb') {
    const page = position.page || 1;
    const { data } = await axios.get(`https://api.themoviedb.org/4/list/${list.listId}`, {
      ...options, headers: { Authorization: `Bearer ${config.tmdbAccessToken}` }, params: { page, language: 'en-US' },
    });
    if (!Array.isArray(data.results) || !Number.isInteger(data.total_pages) || data.total_pages < 0) throw new Error('TMDB returned an invalid list response.');
    if (data.total_results > MAX_ITEMS) throw new Error(`This importer supports up to ${MAX_ITEMS} items. No snapshot was replaced.`);
    if (!data.results.length && page < data.total_pages) throw new Error('TMDB returned an incomplete page.');
    return { items: data.results, total: data.total_results, next: page < data.total_pages ? { page: page + 1 } : null };
  }
  const path = list.username === 'external'
    ? `external/lists/${list.listId}/items`
    : `lists/${encodeURIComponent(list.username)}/${encodeURIComponent(list.listId)}/items`;
  const params = { apikey: config.mdblistApiKey, limit: 50, unified: true, append_to_response: 'poster,description' };
  if (list.sort) { params.sort = list.sort; params.order = list.order; }
  if (position.cursor) params.cursor = position.cursor;
  else if (position.offset) params.offset = position.offset;
  const { data, headers } = await axios.get(`https://api.mdblist.com/${path}`, { ...options, params });
  let items;
  if (Array.isArray(data)) items = data;
  else if (Array.isArray(data.items)) items = data.items;
  else if (Array.isArray(data.movies) && Array.isArray(data.shows)) {
    items = [...data.movies.map(item => ({ ...item, mediatype: 'movie' })), ...data.shows.map(item => ({ ...item, mediatype: 'show' }))];
    if (!list.sort || list.sort === 'rank') items.sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
  } else throw new Error('MDBList returned an invalid list response.');
  const cursor = data.next_cursor || data.pagination?.next_cursor;
  if (cursor && cursor === position.cursor) throw new Error('MDBList pagination did not advance.');
  const more = ['true', '1'].includes(String(headers['x-has-more']).toLowerCase()) || data.pagination?.has_more === true;
  if (more && !items.length) throw new Error('MDBList returned an incomplete page.');
  return { items, total: data.pagination?.total ?? null,
    next: cursor ? { cursor } : more ? { offset: (position.offset || 0) + items.length } : null };
}

async function tmdbMeta(item, config) {
  if (!['movie', 'tv'].includes(item.media_type)) return null;
  if (!Number.isInteger(item.id) || item.id < 1) throw new Error('TMDB returned an invalid title ID.');
  const { data } = await axios.get(`https://api.themoviedb.org/3/${item.media_type}/${item.id}/external_ids`, {
    ...options, headers: { Authorization: `Bearer ${config.tmdbAccessToken}` },
  });
  if (!/^tt\d+$/.test(data.imdb_id || '')) return null;
  const type = item.media_type === 'tv' ? 'series' : 'movie';
  const title = item.title || item.name || data.imdb_id;
  return { ...getBasicMeta(data.imdb_id, title, type),
    ...(item.poster_path ? { poster: `https://image.tmdb.org/t/p/w500${item.poster_path}` } : {}),
    description: item.overview || '', releaseInfo: (item.release_date || item.first_air_date || '').slice(0, 4) };
}

async function mdblistMeta(item) {
  const mediaType = item.mediatype || item.media_type || item.type;
  if (!['movie', 'show', 'tv', 'series'].includes(mediaType)) return null;
  const id = item.imdb_id || item.ids?.imdb || item.imdb;
  if (!/^tt\d+$/.test(id || '')) return null;
  const type = mediaType === 'movie' ? 'movie' : 'series';
  const title = item.title || item.name || id;
  const poster = typeof item.poster === 'string' && /^https:\/\//.test(item.poster) ? item.poster : null;
  if (!poster) {
    const cinemeta = await fetchCinemetaMeta(id, type, title);
    if (cinemeta) return cinemeta;
  }
  return { ...getBasicMeta(id, title, type), ...(poster ? { poster } : {}),
    description: item.description || '', releaseInfo: String(item.release_year || item.year || '') };
}

export async function resolvePage(list, config, items) {
  const metas = [];
  // Each request resolves one small page; users' Redis holds resumable progress.
  for (let offset = 0; offset < items.length; offset += 10) {
    const chunk = items.slice(offset, offset + 10);
    metas.push(...await Promise.all(chunk.map(item => list.provider === 'tmdb' ? tmdbMeta(item, config) : mdblistMeta(item))));
  }
  return metas.filter(Boolean);
}
