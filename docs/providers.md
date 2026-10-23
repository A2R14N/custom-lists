# Provider references

## Provider references and attribution

- [MDBList API](https://api.mdblist.com/) and its [OpenAPI schema](https://api.mdblist.com/schema/): list pagination, IMDb identifiers and appended metadata.
- [WeTrakr API list items](https://api.wetrakr.com/#/lists/lists-items), [required headers and pagination](https://api.wetrakr.com/#/conventions), and [changelog](https://api.wetrakr.com/#/changelog): API v1 public lists use the user's app/client ID, regular metadata pages, and `X-Pagination-*` headers. OAuth is not used; private lists remain available through exports.
- [TMDB v4 list API](https://developer.themoviedb.org/v4/reference/list-details), [movie external IDs](https://developer.themoviedb.org/reference/movie-external-ids), [TV external IDs](https://developer.themoviedb.org/reference/tv-series-external-ids).
- [TMDB API FAQ](https://developer.themoviedb.org/docs/faq): free noncommercial API usage requires attribution; commercial usage requires arranging the appropriate license. Public availability alone does not mean commercial use.

This product uses the TMDB API but is not endorsed or certified by TMDB. The official TMDB logo is included in the configuration page. Cinemeta is used as a metadata fallback for MDBList entries without posters.

The welcome page displays three movies from [TMDB's weekly trending feed](https://developer.themoviedb.org/reference/trending-movies). The public `/api/discovery/trending` endpoint uses a dedicated server credential, returns only bounded public artwork metadata, and never reads a user's database or provider keys. Results are cached for six hours in process and in shared HTTP caches. On provider failure, a previous process snapshot can be shown for up to 24 hours as “Recently trending”; missing configuration, unavailable data or image errors restore the bundled example posters for Interstellar, Dune: Part Two, and The Grand Budapest Hotel. Saved list covers always represent their own cached titles.

Manrope is self-hosted under the SIL Open Font License; its license is included at `vue/public/fonts/OFL-Manrope.txt`.
