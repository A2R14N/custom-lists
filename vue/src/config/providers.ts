import type { Provider } from "../types/catalog";

export const providerNames: Record<Provider, string> = {
  mdblist: "MDBList",
  tmdb: "TMDB",
  trakt: "Trakt archive",
  wetrakr: "WeTrakr",
  imdb: "IMDb",
};

export type SourceFilter = "all" | Provider;

export const providerFilters: Array<{ id: SourceFilter; label: string }> = [
  { id: "all", label: "All lists" },
  ...Object.entries(providerNames).map(([id, label]) => ({ id: id as Provider, label })),
];
