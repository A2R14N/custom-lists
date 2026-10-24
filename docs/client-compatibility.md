# Catalog order and visibility

Reviewed on October 24, 2026 against the official releases:

- [Stremio Web v5.0.0-beta.43](https://github.com/Stremio/stremio-web/releases/tag/v5.0.0-beta.43).
- [Nuvio TV 1.0.0 stable](https://github.com/NuvioMedia/NuvioTV/releases/tag/1.0.0).
- [Nuvio Desktop 0.1.32-alpha](https://github.com/NuvioMedia/NuvioDesktop/releases/tag/0.1.32-alpha).

## Addon behavior

The [Stremio addon manifest](https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/api/responses/manifest.md) still requires a `type` for each catalog. Custom Lists keeps the existing types, category names and cache IDs. Hiding a row omits that entry from `manifest.catalogs`; it does not remove its configuration or cached snapshot. This avoids depending on a client-specific hide hint and applies to the addon's Home/Discover catalog listings after the manifest reloads.

The manifest array reflects the saved order. In [Nuvio TV's released order implementation](https://github.com/NuvioMedia/NuvioTV/blob/1.0.0/app/src/main/java/com/nuvio/tv/ui/screens/addon/CatalogOrderViewModel.kt), a custom client order can override that sequence. Enable **Follow addon order** in Nuvio's Catalog Order screen to follow the addon's order. Client-side hiding is separate and can keep a row hidden even after it is shown in this addon.

Clients may retain a cached manifest or their own layout preferences. Refresh or reinstall the addon after changing rows; use an install-link revision if needed to force a new manifest URL. Hiding is not access control: an already known private catalog URL can still read its saved snapshot, preserving existing installs and metadata access.

Verification consists of released-source/protocol review and isolated HTTP/UI regression checks. Native Stremio and Nuvio clients were not exercised on every platform.
