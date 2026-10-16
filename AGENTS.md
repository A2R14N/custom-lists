# Custom Lists development

- Use Node.js 24 and npm. Run `npm run setup` before tests in a fresh checkout, then `npm run check` before submitting changes.
- Express lives in `src/server`, backend integrations in `src/services`, and browser/server parsing in `shared`.
- Vue screens and forms live in `vue/src/components`; `App.vue` composes them. Keep API state in `useCatalogs` and view-only search/sort state in `useCollectionFilters`.
- Each user supplies their own Upstash database. Never introduce shared persistent user storage or read repository environment secrets into frontend code.
- Preserve the addon identity, `stremio:config`, and existing catalog key formats. Missing provider fields mean Trakt. Cached Trakt lists must work without a Trakt API key.
- Catalog requests are Redis-only. Imports publish complete snapshots; failed imports and configuration removal must not delete cached titles.
- Connection validation must not write configuration. Keep credentials out of logs, analytics, browser storage, commits, and fixtures.
- Use official provider documentation when changing MDBList or TMDB requests.
- Tests use mocked provider/Redis calls. Never use a real user's database for automated verification.
- Keep local review artifacts under ignored `.work/`, not in published source or documentation.
