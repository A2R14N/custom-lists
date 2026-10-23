# Architecture

Custom Lists is an Express addon with a Vue configuration interface. The Node and Vercel entry points share the same server. Each user connects their own Upstash Redis database; there is no shared application database.

## Repository map

| Path                                          | Responsibility                                                       |
| --------------------------------------------- | -------------------------------------------------------------------- |
| `index.js`, `api/index.js`                    | Node and Vercel entry points                                         |
| `src/server/`                                 | Express app and HTTP routes                                          |
| `src/services/`                               | User storage, provider requests, imports, exports, metadata, artwork |
| `shared/`                                     | Browser/server list identities and export parsing                    |
| `vue/src/App.vue`                             | Application composition, session startup, notifications              |
| `vue/src/components/CollectionWorkspace.vue`  | Collection view and its actions                                      |
| `vue/src/components/CollectionDialogs.vue`    | Dialog routing and coordination                                      |
| `vue/src/components/*Form.vue`                | Add, edit, and settings forms with local draft state                 |
| `vue/src/composables/useCatalogs.ts`          | API transport and collection state                                   |
| `vue/src/composables/useCollectionFilters.ts` | View-only search, filters, and sorting                               |
| `vue/src/config/providers.ts`                 | Provider display names and filter options                            |
| `vue/src/styles/`                             | Tokens, foundations, layout, welcome, artwork, collection, dialogs   |
| `test/*.test.js`                              | Focused regression suites                                            |
| `test/helpers/`                               | Synthetic fixtures, in-memory Redis, isolated HTTP server            |

## Data flow

1. The configuration UI connects with the user's Redis REST URL and token. Connection validation reads existing data without saving an empty configuration.
2. Provider imports advance one bounded page per request, storing temporary progress in that same Redis database. A completed import publishes a full snapshot in one write. Failed refreshes preserve the previous snapshot.
3. File exports are parsed locally. Only selected normalized title rows reach the server, which validates them and publishes each snapshot with its configuration in one Redis transaction.
4. Catalog requests read snapshots only. They do not contact list providers or start imports.
5. Workspace search, category/source/status filters, layout and sorting are view-only. Arrangement mode persists addon order through drag-and-drop or explicit up/down actions.
6. Batch refresh runs unique eligible API snapshots sequentially, keeps each failure on its list, and holds a session lock until the queue completes. Stopping the queue finishes the current snapshot before skipping later lists.
7. The optional homepage example reads public weekly movie trends through `src/services/trending.js`, using a separate server credential. `useTrendingExample` handles loading, stale labels and bundled artwork fallback. This flow uses no Redis and does not affect addon catalogs or saved-list covers.

## Compatibility rules

- Preserve the addon ID `community.trakt.custom-lists`, the `stremio:config` key, and existing catalog key formats.
- Missing provider fields mean Trakt. Legacy snapshots remain readable without a Trakt subscription or API key.
- Removing a list changes its manifest entry; it does not delete its cached snapshot.
- Keep credentials out of browser storage, analytics, logs, source files, and test fixtures. Private install URLs contain recoverable credentials and must not be shared.
- Provider keys are needed for imports, not for reading cached catalogs.

## Tests

Tests run in separate Node test processes. Suites using the HTTP harness get a server on a random local port, mocked provider calls, and isolated in-memory Redis instances. Frontend tests import the actual Vue composable and inject its transport, rather than rewriting source code or simulating Vue's reactivity.

See [development and deployment](development.md) for commands, and [storage and privacy](storage-and-privacy.md) for operational limits.
