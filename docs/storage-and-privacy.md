# Storage and privacy

## Storage and imports

All persistent data and temporary import jobs are in the requesting user's Redis:

| Key                                                                      | Purpose                                           |
| ------------------------------------------------------------------------ | ------------------------------------------------- |
| `stremio:config`                                                         | List settings and provider keys                   |
| `trakt:…`, `mdblist:…`, `tmdb:…`, `wetrakr:…`, `wetrakr-api:…`, `imdb:…` | Full Stremio metadata snapshots, without expiry   |
| `stremio:import:<uuid>`                                                  | Temporary import progress, expires after one hour |

Catalog requests only read snapshots. A miss returns an empty catalog and does not contact a list provider. Use the list's **Refresh** control to import or retry it.

The browser advances an import one small page at a time. Keep the page open until it finishes. Each request fetches and resolves a page, then saves its progress to the same user database, so no server memory has to survive between requests. A completed import replaces the catalog with one Redis SET. Failed or empty refreshes do not replace a nonempty snapshot. Retried progress requests do not append a completed page twice.

Imports are capped at 10,000 source entries and reject oversized lists rather than silently truncating them. Redis storage/request limits and provider quotas still apply. Large lists create temporary copies while importing; leave sufficient space in your database. Concurrent refreshes of one list should be avoided: the last complete refresh wins.

## Privacy and public hosting

**Install URLs encode Redis credentials using Base64url. That is not encryption. Anyone with the URL can recover the token and access the database with its permissions. Never share an install/configuration URL.** Share only the public configuration homepage so each person connects their own database.

This retains compatibility with existing stateless installs. The backend receives credentials transiently to call Upstash and providers; it has no persistent user store. Provider keys stay in each user's Redis. The frontend does not save credentials to browser storage, and Google Analytics/Mixpanel are not used. Private API and page responses use `private, no-store` and `no-referrer`.

The public homepage's optional TMDB weekly trending example uses a separate server environment credential. Its fixed `/api/discovery/trending` endpoint is publicly cached and returns only movie IDs, titles, poster URLs, TMDB links and freshness metadata. It never reads a user's Redis or list-import keys. The homepage requests it without cookies, and remote poster requests omit the referring URL. User catalog artwork continues to come from each list's saved snapshot.

Use HTTPS and a trusted host. Configure hosting/proxy access logs to avoid credential-bearing paths; browser history and client synchronization can also retain URLs. This repository cannot control a hosting platform's logs. Use a separate database solely for this addon and rotate its token if a link is exposed. Public deployments should add infrastructure request limits and suitable resource budgets; per-user Redis does not prevent abuse of the host's compute.
