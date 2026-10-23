# Using Custom Lists

## Use

1. Choose **Set up my collection** and enter the REST URL and read/write REST token for a **dedicated Upstash Redis database**.
2. Click **Connect storage**. This only reads existing data; it never saves an empty configuration. Returning users can choose **I have an install link** to reopen their collection.
3. Choose **Add a list** and paste a public list URL. The source is detected automatically. Expand **Display options** to add a display name or change its category.
4. The app requests a provider key only when required: your [MDBList API key](https://mdblist.com/preferences/#api), [TMDB API Read Access Token](https://www.themoviedb.org/settings/api), or [WeTrakr app key/client ID](https://wetrakr.com/profile/settings/api). TMDB uses the long bearer token, not the v3 API key. Choose **Import list** and keep the page open during import.
5. Choose **Install addon**. Open it in Stremio, or copy the private HTTPS URL into Nuvio's addon installer.

Switch between grid and list layouts, search by name/source/category, and combine source, category and saved-status filters. **Needs attention** shows lists with failed refreshes or no imported snapshot. Use the list menu to edit, refresh or remove a list. Sort by addon order, name, or title count; sorting only changes this view. Choose **Arrange** to clear filters and change addon order with drag-and-drop or the up/down buttons, then choose **Done arranging**. File import choices are under **Add a list → Upload export**. Provider keys and advanced install-link settings are under **Settings**. Disconnect clears credentials from this session without deleting your database.

**Refresh API lists** updates each eligible MDBList, TMDB and WeTrakr API snapshot once, even when it appears in several categories. It skips lists without a saved provider key, file exports and preserved Trakt snapshots. A failed list does not stop the queue. **Stop after this list** finishes the current import and leaves later lists untouched. Keep the page open during imports. Existing snapshots remain available after a failed refresh.

List covers use posters from each saved snapshot in a bright interface with a locally hosted Manrope font. Covers update after a successful import and work with legacy Trakt caches. Missing or broken images use an illustrated fallback. Covers add no Redis keys and load cached poster URLs with no referrer. The welcome page includes three static example posters; these are separate from your personal collection.

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

Choose **Add a list → Upload export → WeTrakr ZIP or CSV**. Select the original ZIP or `lists.csv`, choose which lists to import and their categories, then click **Import selected lists**. This does not import your data into another platform and requires no provider API key.

The browser reads the ZIP locally and ignores notes and unrelated files. Only selected list names and title rows are sent to the addon backend, which validates them and writes complete snapshots to your own Upstash database. The original ZIP and CSV are not stored on the server. Posters use the existing IMDb-based image service; no metadata API calls are required to create the cache. IMDb IDs are used for Stremio title identity, and TMDB IDs are retained in each supported metadata entry.

The preview shows omitted entries before caching: titles without an IMDb ID, unsupported types such as individual episodes, and duplicates. Movie/show types and numeric rank order are preserved. Invalid CSV, invalid IDs, oversized files and lists with no usable titles fail without replacing a snapshot. Limits: 8 MB ZIP/CSV, 50,000 rows per file, 200 lists, 10,000 rows per list, and 2 MB selected-list request payload.

Updates are manual: select a new export. The export has no list ID, so the exact Unicode-normalized source list name determines its `wetrakr:<sha256>` cache key. Re-uploading the same source name updates that WeTrakr snapshot while preserving existing display names and categories. A renamed source list creates a new snapshot; different lists with identical source names cannot be distinguished by this export format. Each selected list publishes in one Redis transaction; a multi-list upload can partially succeed and shows which lists were saved. Existing Trakt/MDBList/TMDB cache keys are never reused or replaced.

## IMDb CSV exports

Choose **Add a list → Upload export → IMDb CSV**, select the original CSV, give it a unique list name, select the list and click **Import selected lists**. No IMDb key or intermediary platform is required. The browser parses the file; only normalized title rows are sent to your own Upstash cache. Personal ratings, descriptions and other unused fields are not uploaded.

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
