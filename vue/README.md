# Custom Lists interface

Vue 3 + TypeScript + Vite. The interface has no browser-persisted credentials, analytics, external fonts, or shared user store.

## Run

Use Node 24. Run `npm ci`, then `npm run dev`; start the API separately on port 7700. Vite proxies API, catalog preview, and configured manifest requests. `npm run build` checks Vue scripts/templates with `vue-tsc` before creating `dist`. `npm run typecheck` checks types without generating assets.

## Structure

- `src/App.vue`: application composition, session startup, and notifications.
- `src/components/WelcomeView.vue`: connection onboarding and introduction.
- `src/components/CollectionWorkspace.vue`: collection view and actions.
- `src/components/CollectionDialogs.vue`: dialog routing; individual forms own their drafts.
- `src/composables/useCatalogs.ts`: typed API requests and collection state.
- `src/components/`: shared dialog, connection form, collection cards, icons, and vector artwork.
- `src/types/catalog.ts`: UI and API response types.
- `src/styles/`: design tokens and focused feature styles, including their responsive rules.
- `src/style.css`: stylesheet import order.
- `src/composables/useCollectionFilters.ts`: view-only search, filtering, and sorting.
- `src/config/providers.ts`: shared provider display names and filter options.
- `../shared/lists.js`: list parsing and cache IDs shared with the API.

Provider keys are requested in context on first import. Advanced settings are separate from the primary connect → add → install flow. Legacy Trakt lists are treated as preserved snapshots; edits and removals only change configuration, not cached titles. Regression suites live in the root `test/` directory and import the real Vue composable with an isolated transport.

Private install URLs still encode recoverable Redis credentials for compatibility. UI masking is not encryption. Use a dedicated database and never share an install link.
