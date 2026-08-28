export type Provider = "mdblist" | "tmdb" | "trakt" | "wetrakr" | "imdb";
export interface ExportItem {
  title: string;
  year: string;
  type: string;
  tmdb_id: string;
  imdb_id: string;
  rank: string;
}
export interface ExportList {
  provider?: "wetrakr" | "imdb";
  sourceName: string;
  items: ExportItem[];
  total: number;
  skipped: number;
  missingIds: number;
  unsupported: number;
  duplicates: number;
  metas: Meta[];
}
export interface ListDefinition {
  sourceName?: string;
  provider: Provider;
  username: string;
  listId: string;
  categoryName: string;
  name?: string;
  sort?: string;
  order?: string;
}
export interface ImportProgress {
  jobId: string;
  step: number;
  status: "progress" | "done";
  done: number;
  processed: number;
  total: number | null;
  skipped: number;
  coverPosters?: string[];
}
export interface Catalog extends ListDefinition {
  cached: boolean;
  itemCount: number;
  coverPosters: string[];
  status: "idle" | "importing";
  error: string;
  skipped?: number;
  progress?: ImportProgress;
}
export interface Settings {
  mdblistApiKey: string;
  tmdbAccessToken: string;
  cacheBuster: string;
}
export interface CatalogState extends Settings {
  upstashUrl: string;
  upstashToken: string;
  traktClientId: string;
  userId: string;
  connected: boolean;
  connecting: boolean;
  saving: boolean;
  importing: boolean;
  lists: Catalog[];
  listUrl: string;
  listName: string;
  category: string;
  addonUrl: string;
  error: string;
  message: string;
}
export interface SavedConfig extends Settings {
  upstashUrl: string;
  upstashToken: string;
  traktClientId?: string;
  userId: string;
  lists: Array<ListDefinition & { cached?: boolean; itemCount?: number; coverPosters?: string[] }>;
}
export interface Meta {
  id: string;
  name: string;
  type: string;
  poster?: string;
  releaseInfo?: string;
}
