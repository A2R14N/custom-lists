# Custom Lists for Stremio & Nuvio

<img src="icon.png" alt="Custom Lists stacked-card logo" width="96" height="96" />

Import public **MDBList** and **TMDB** lists, or cache **WeTrakr ZIP/CSV exports directly**, in **your own Upstash Redis**. Existing Trakt snapshots and install URLs keep working without a Trakt subscription or API key.

This addon provides catalogs, not playback streams. Each user supplies their own Redis credentials and optional provider keys. There is no shared user database, disk cache, tracking, or administrator-owned catalog store.

## Use

1. Open the configuration page and enter the REST URL and read/write REST token for a **dedicated Upstash Redis database**.
2. Click **Connect & continue**. This only reads existing data; it never saves an empty configuration. Returning users can instead choose **Already have an install link?** to restore their workspace.
3. Choose **Add a list** and paste a public list URL. The source is detected automatically. Add a display name and category if needed.
4. The app requests a provider key only when required: your [MDBList API key](https://mdblist.com/preferences/#api) or [TMDB API Read Access Token](https://www.themoviedb.org/settings/api). TMDB uses the long bearer token, not the v3 API key. Choose **Add to my collection** and keep the page open during import.
5. Choose **Install addon**. Open it in Stremio, or copy the private HTTPS URL into Nuvio's addon installer.

The workspace includes source filters, search, title previews, display-name editing, and ordering controls. Provider keys and advanced install-link settings are under **Settings**. Disconnect clears credentials from this session without deleting your database.

List covers are full-color poster collages derived from the first distinct posters in each saved snapshot, displayed within a black and charcoal interface. They update after a successful import and work with legacy Trakt caches too. Missing or broken posters fall back to muted illustrated covers. No new image files or Redis keys are stored; images load directly from the cached poster URLs with no referrer.

Supported URLs include:

- `https://mdblist.com/lists/username/list-name`
- `https://mdblist.com/lists/official/list-name`
- `https://mdblist.com/lists/username/external/12345`
- `https://www.themoviedb.org/list/12345-list-name`
- Old `https://trakt.tv/users/username/lists/list-name?sort=released,asc` links can reattach **already cached** snapshots. There are no new Trakt API imports.

TMDB public lists support movies and television. Entries without an IMDb ID and unsupported types are skipped and counted. MDBList sort parameters supported by this UI: rank, title, released, added, score, imdbrating, imdbvotes, tmdbpopular, usort; optional `order=asc|desc`.

Custom categories such as `cartoon` are preserved. Items retain their actual `movie` or `series` type. Client handling of custom categories may vary; test your target Stremio/Nuvio version.

## Cache a WeTrakr export directly

Choose **WeTrakr** in the sources panel, or **Have a WeTrakr export?** inside Add a list. Select the original ZIP or `lists.csv`, choose which lists to cache and their categories, then click **Cache selected lists**. This does not import your data into another platform and requires no provider API key.

The browser reads the ZIP locally and ignores notes and unrelated files. Only selected list names and title rows are sent to the addon backend, which validates them and writes complete snapshots to your own Upstash database. The original ZIP and CSV are not stored on the server. Posters use the existing IMDb-based image service; no metadata API calls are required to create the cache. IMDb IDs are used for Stremio title identity, and TMDB IDs are retained in each supported metadata entry.

The preview shows omitted entries before caching: titles without an IMDb ID, unsupported types such as individual episodes, and duplicates. Movie/show types and numeric rank order are preserved. Invalid CSV, invalid IDs, oversized files and lists with no usable titles fail without replacing a snapshot. Limits: 8 MB ZIP/CSV, 50,000 rows per file, 200 lists, 10,000 rows per list, and 2 MB selected-list request payload.

Updates are manual: select a new export. The export has no list ID, so the exact Unicode-normalized source list name determines its `wetrakr:<sha256>` cache key. Re-uploading the same source name updates that WeTrakr snapshot while preserving existing display names and categories. A renamed source list creates a new snapshot; different lists with identical source names cannot be distinguished by this export format. Each selected list publishes in one Redis transaction; a multi-list upload can partially succeed and shows which lists were saved. Existing Trakt/MDBList/TMDB cache keys are never reused or replaced.

## Existing Trakt data is preserved

- The addon ID remains `community.trakt.custom-lists`.
- Legacy list entries without `provider` are interpreted as Trakt.
- The `stremio:config` key stays in the same user database.
- Cached `trakt:username:listId[:sort]` keys are read as-is. They are not migrated, renamed, refreshed, expired or deleted.
- Saved catalogs are served even if `traktClientId` is absent or no longer usable.
- Adding other providers retains loaded Trakt entries. Removing a list only removes its manifest entry; its Redis snapshot remains.
- To reconfigure an installed addon, use its configure action, or replace `/manifest.json` with `/configure` in the existing URL.
- Back up your Redis before deploying any upgrade. No real Redis data is modified by the repository's test suite.

## Storage and imports

All persistent data and temporary import jobs are in the requesting user's Redis:

| Key | Purpose |
| --- | --- |
| `stremio:config` | List settings and provider keys |
| `trakt:…`, `mdblist:…`, `tmdb:…`, `wetrakr:…` | Full Stremio metadata snapshots, without expiry |
| `stremio:import:<uuid>` | Temporary import progress, expires after one hour |

Catalog requests only read snapshots. A miss returns an empty catalog and does not contact a list provider. Use the list's **Refresh** control to import or retry it.

The browser advances an import one small page at a time. Keep the page open until it finishes. Each request fetches and resolves a page, then saves its progress to the same user database, so no server memory has to survive between requests. A completed import replaces the catalog with one Redis SET. Failed or empty refreshes do not replace a nonempty snapshot. Retried progress requests do not append a completed page twice.

Imports are capped at 10,000 source entries and reject oversized lists rather than silently truncating them. Redis storage/request limits and provider quotas still apply. Large lists create temporary copies while importing; leave sufficient space in your database. Concurrent refreshes of one list should be avoided: the last complete refresh wins.

## Privacy and public hosting

**Install URLs encode Redis credentials using Base64url. That is not encryption. Anyone with the URL can recover the token and access the database with its permissions. Never share an install/configuration URL.** Share only the public configuration homepage so each person connects their own database.

This retains compatibility with existing stateless installs. The backend receives credentials transiently to call Upstash and providers; it has no persistent user store. Provider keys stay in each user's Redis. The frontend does not save credentials to browser storage, and Google Analytics/Mixpanel are not used. API and page responses use `private, no-store` and `no-referrer`.

Use HTTPS and a trusted host. Configure hosting/proxy access logs to avoid credential-bearing paths; browser history and client synchronization can also retain URLs. This repository cannot control a hosting platform's logs. Use a separate database solely for this addon and rotate its token if a link is exposed. Public deployments should add infrastructure request limits and suitable resource budgets; per-user Redis does not prevent abuse of the host's compute.

## Development

Use Node.js 24 LTS, matching the Vercel and Docker runtimes.

```sh
npm ci
cd vue
npm ci
npm run build
cd ..
npm start
```

Backend: `http://localhost:7700`. For development, run `npm run dev` in the root and `npm run dev` in `vue`. Vite proxies API, catalog preview, and configured manifest requests to the backend. `VITE_APP_URL` is optional and controls generated install links; never put secrets in frontend environment variables.

The interface uses Vue 3, TypeScript, and Vite with shared design tokens and reusable components. `npm run typecheck` in `vue` checks scripts and templates; `npm run build` runs the same check before bundling. The API remains Node/Express, and the Redis key format is unchanged.

Tests use Node's built-in runner: `npm test`. Provider, Redis and Cinemeta calls are mocked; they never use `.env` credentials or contact real accounts.

## Deploy

- **Vercel:** use the repository root, framework preset **Other**, and Node.js **24.x**. The committed configuration runs tests before building, installs from lockfiles, excludes local environment files, includes the built configuration page in the function, and prevents shared caching of private URLs. The repository's build command builds Vue and routes addon/API requests to `api/index.js`. Import steps are bounded to fit a 60-second function budget. Deployment-plan limits may still apply.
- **Node/Docker:** build Vue before starting the Express server. `PORT` defaults to 7700. Docker Compose is included.
- No server-side Upstash, MDBList or TMDB credentials are needed; do not configure a shared database for users.

## Provider references and attribution

- [MDBList API](https://api.mdblist.com/) and its [OpenAPI schema](https://api.mdblist.com/schema/): list pagination, IMDb identifiers and appended metadata.
- [TMDB v4 list API](https://developer.themoviedb.org/v4/reference/list-details), [movie external IDs](https://developer.themoviedb.org/reference/movie-external-ids), [TV external IDs](https://developer.themoviedb.org/reference/tv-series-external-ids).
- [TMDB API FAQ](https://developer.themoviedb.org/docs/faq): free noncommercial API usage requires attribution; commercial usage requires arranging the appropriate license. Public availability alone does not mean commercial use.

This product uses the TMDB API but is not endorsed or certified by TMDB. The official TMDB logo is included in the configuration page. Cinemeta is used as a metadata fallback for MDBList entries without posters.

## IMDb CSV exports

Choose **IMDb** in the sources panel (or **Have an IMDb CSV?** under Add a list), select the original CSV, give it a unique list name, select the list and click **Cache selected lists**. No IMDb key or intermediary platform is required. The browser parses the file; only normalized title rows are sent to your own Upstash cache. Personal ratings, descriptions and other unused fields are not uploaded.

IMDb does not include the list name or ID in these exports. Reuse the exact same name when uploading an updated CSV to replace that IMDb snapshot while preserving its display name and category. Different names create separate caches; other providers, including preserved Trakt snapshots, remain unchanged. IMDb snapshots do not automatically refresh.

Movie, TV Movie, Short, TV Short, Video and TV Special map to movies; TV Series and TV Mini Series map to series. Episodes, games, unknown types and entries without IMDb title IDs are reported and skipped. Entries retain their Position order. IMDb exports do not contain TMDB IDs; none are invented or required. The limits are 8 MB per CSV and 10,000 entries per list. Cache keys use `imdb:<sha256-of-source-name>`.
