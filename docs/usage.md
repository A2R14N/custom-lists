# Using Custom Lists

## Use

1. Open the configuration page and enter the REST URL and read/write REST token for a **dedicated Upstash Redis database**.
2. Click **Connect & continue**. This only reads existing data; it never saves an empty configuration. Returning users can instead choose **Already have an install link?** to restore their workspace.
3. Choose **Add a list** and paste a public list URL. The source is detected automatically. Add a display name and category if needed.
4. The app requests a provider key only when required: your [MDBList API key](https://mdblist.com/preferences/#api), [TMDB API Read Access Token](https://www.themoviedb.org/settings/api), or [WeTrakr app key/client ID](https://wetrakr.com/profile/settings/api). TMDB uses the long bearer token, not the v3 API key. Choose **Add to my collection** and keep the page open during import.
5. Choose **Install addon**. Open it in Stremio, or copy the private HTTPS URL into Nuvio's addon installer.

The workspace includes source filters with list counts, search by name/source/category, title previews, display-name editing, and ordering controls. Sort the workspace by addon order, name, or title count; sorting only changes the view, not the order in your addon. To change addon order, clear filters and choose **Addon order**, then use the list's up/down controls. File import buttons for WeTrakr and IMDb are also available inside **Add a list**. Provider keys and advanced install-link settings are under **Settings**. Disconnect clears credentials from this session without deleting your database.

List covers are full-color poster collages derived from the first distinct posters in each saved snapshot, displayed within a black and charcoal interface. They update after a successful import and work with legacy Trakt caches too. Missing or broken posters fall back to muted illustrated covers. No new image files or Redis keys are stored; images load directly from the cached poster URLs with no referrer.

Supported URLs include:

- `https://mdblist.com/lists/username/list-name`
- `https://mdblist.com/lists/official/list-name`
- `https://mdblist.com/lists/username/external/12345`
- `https://www.themoviedb.org/list/12345-list-name`
- `https://wetrakr.com/lists/17599`
- Old `https://trakt.tv/users/username/lists/list-name?sort=released,asc` links can reattach **already cached** snapshots. There are no new Trakt API imports.

TMDB public lists support movies and television. Entries without an IMDb ID and unsupported types are skipped and counted. MDBList sort parameters supported by this UI: rank, title, released, added, score, imdbrating, imdbvotes, tmdbpopular, usort; optional `order=asc|desc`.

Custom categories such as `cartoon` are preserved. Items retain their actual `movie` or `series` type. Client handling of custom categories may vary; test your target Stremio/Nuvio version.

## WeTrakr API lists

Paste a public WeTrakr `/lists/<numeric-id>` link under **Add a list**, then supply your own registered application key (client ID). You can also save it under **Settings**. If API-key creation is not available in your account, follow the access instructions in the [official API documentation](https://api.wetrakr.com/). The key is saved only in your Upstash configuration and sent to WeTrakr by the backend.

API imports preserve the owner's pinned/manual order, support movies and shows, and report skipped unsupported items, missing IMDb IDs and duplicates. **Refresh** imports the latest list manually. Catalog browsing only reads your snapshot and needs no active WeTrakr key. Failed, incomplete, empty or oversized refreshes retain the previous snapshot.

API lists use `wetrakr-api:<numeric-id>` keys. Existing ZIP/CSV lists retain `wetrakr:<sha256>` keys and their upload workflow; matching names never merge or overwrite them. Private lists and tracking lists (Watching, Planning, Watched) are not supported through this API integration; use an export instead. There is no account authorization or automatic sync.

## Cache a WeTrakr export directly

Choose **WeTrakr** in the sources panel, or **Have a WeTrakr export?** inside Add a list. Select the original ZIP or `lists.csv`, choose which lists to cache and their categories, then click **Cache selected lists**. This does not import your data into another platform and requires no provider API key.

The browser reads the ZIP locally and ignores notes and unrelated files. Only selected list names and title rows are sent to the addon backend, which validates them and writes complete snapshots to your own Upstash database. The original ZIP and CSV are not stored on the server. Posters use the existing IMDb-based image service; no metadata API calls are required to create the cache. IMDb IDs are used for Stremio title identity, and TMDB IDs are retained in each supported metadata entry.

The preview shows omitted entries before caching: titles without an IMDb ID, unsupported types such as individual episodes, and duplicates. Movie/show types and numeric rank order are preserved. Invalid CSV, invalid IDs, oversized files and lists with no usable titles fail without replacing a snapshot. Limits: 8 MB ZIP/CSV, 50,000 rows per file, 200 lists, 10,000 rows per list, and 2 MB selected-list request payload.

Updates are manual: select a new export. The export has no list ID, so the exact Unicode-normalized source list name determines its `wetrakr:<sha256>` cache key. Re-uploading the same source name updates that WeTrakr snapshot while preserving existing display names and categories. A renamed source list creates a new snapshot; different lists with identical source names cannot be distinguished by this export format. Each selected list publishes in one Redis transaction; a multi-list upload can partially succeed and shows which lists were saved. Existing Trakt/MDBList/TMDB cache keys are never reused or replaced.

## IMDb CSV exports

Choose **IMDb** in the sources panel (or **Have an IMDb CSV?** under Add a list), select the original CSV, give it a unique list name, select the list and click **Cache selected lists**. No IMDb key or intermediary platform is required. The browser parses the file; only normalized title rows are sent to your own Upstash cache. Personal ratings, descriptions and other unused fields are not uploaded.

IMDb does not include the list name or ID in these exports. Reuse the exact same name when uploading an updated CSV to replace that IMDb snapshot while preserving its display name and category. Different names create separate caches; other providers, including preserved Trakt snapshots, remain unchanged. IMDb snapshots do not automatically refresh.

Movie, TV Movie, Short, TV Short, Video and TV Special map to movies; TV Series and TV Mini Series map to series. Episodes, games, unknown types and entries without IMDb title IDs are reported and skipped. Entries retain their Position order. IMDb exports do not contain TMDB IDs; none are invented or required. The limits are 8 MB per CSV and 10,000 entries per list. Cache keys use `imdb:<sha256-of-source-name>`.

## Existing Trakt data is preserved

- The addon ID remains `community.trakt.custom-lists`.
- Legacy list entries without `provider` are interpreted as Trakt.
- The `stremio:config` key stays in the same user database.
- Cached `trakt:username:listId[:sort]` keys are read as-is. They are not migrated, renamed, refreshed, expired or deleted.
- Saved catalogs are served even if `traktClientId` is absent or no longer usable.
- Adding other providers retains loaded Trakt entries. Removing a list only removes its manifest entry; its Redis snapshot remains.
- To reconfigure an installed addon, use its configure action, or replace `/manifest.json` with `/configure` in the existing URL.
- Back up your Redis before deploying any upgrade. No real Redis data is modified by the repository's test suite.
