import { reactive, computed } from "vue";
import {
  catalogId,
  normalizeList,
  parseListUrl,
  listLabel,
} from "../../../shared/lists.js";
import type {
  Catalog,
  CatalogState,
  ImportProgress,
  ListDefinition,
  Meta,
  SavedConfig,
  Settings,
  ExportList,
} from "../types/catalog";

export function useCatalogs() {
  const initial = (): CatalogState => ({
    upstashUrl: "",
    upstashToken: "",
    connected: false,
    connecting: false,
    saving: false,
    importing: false,
    mdblistApiKey: "",
    tmdbAccessToken: "",
    traktClientId: "",
    userId: "",
    cacheBuster: "",
    lists: [],
    listUrl: "",
    listName: "",
    category: "movie",
    addonUrl: "",
    error: "",
    message: "",
  });
  // Session-only previews: bounded, short-lived, and cleared when snapshots change.
  const previews = new Map<string, { expires: number; data: Promise<Meta[]> }>();
  const state = reactive<CatalogState>(initial());
  const busy = computed(
    () => state.connecting || state.saving || state.importing,
  );
  const parsed = computed<{ list: ListDefinition | null; error: string }>(
    () => {
      if (!state.listUrl.trim()) return { list: null, error: "" };
      try {
        return {
          list: parseListUrl(
            state.listUrl,
            state.category,
            state.listName,
          ) as ListDefinition,
          error: "",
        };
      } catch {
        return {
          list: null,
          error: "Paste a complete MDBList, TMDB, or saved Trakt list URL.",
        };
      }
    },
  );
  const titleCount = computed(() => {
    const seen = new Set<string>();
    return state.lists.reduce((count, list) => {
      const key = catalogId(list);
      if (seen.has(key)) return count;
      seen.add(key);
      return count + list.itemCount;
    }, 0);
  });
  const canImport = (list: ListDefinition) =>
    list.provider === "mdblist"
      ? !!state.mdblistApiKey.trim()
      : list.provider === "tmdb" && !!state.tmdbAccessToken.trim();
  const messageOf = (error: unknown) =>
    error instanceof Error
      ? error.message
      : "Something went wrong. Please try again.";

  async function request<T>(url: string, body?: unknown): Promise<T> {
    let response: Response;
    try {
      response = await fetch(url, {
        ...(body === undefined
          ? {}
          : {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            }),
        cache: "no-store",
        signal: AbortSignal.timeout(75000),
      });
    } catch {
      throw new Error(
        "We couldn’t reach the server. Check your connection and try again. Your saved lists are safe.",
      );
    }
    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error(
        "The server returned an unexpected response. Please try again.",
      );
    }
    if (!response.ok)
      throw new Error(data.error || "The request could not be completed.");
    return data as T;
  }

  function applyConfig(data: SavedConfig) {
    // Read and validate before changing the current workspace.
    const lists = (data.lists || []).map((list) => ({
      ...normalizeList(list),
      cached: !!list.cached,
      itemCount: list.itemCount || 0,
      coverPosters: list.coverPosters || [],
      status: "idle",
      error: "",
    })) as Catalog[];
    for (const key of [
      "upstashUrl",
      "upstashToken",
      "mdblistApiKey",
      "tmdbAccessToken",
      "traktClientId",
      "cacheBuster",
      "userId",
    ] as const) {
      state[key] = data[key] || "";
    }
    previews.clear();
    state.lists = lists;
    state.connected = true;
    state.addonUrl = lists.length ? buildAddonUrl() : "";
  }

  async function connect() {
    if (busy.value) return false;
    state.error = "";
    state.message = "";
    state.connecting = true;
    try {
      applyConfig(
        await request<SavedConfig>("/api/connect", {
          upstashUrl: state.upstashUrl.trim(),
          upstashToken: state.upstashToken.trim(),
        }),
      );
      state.message = state.lists.length
        ? "Welcome back. Your saved lists are right here."
        : "You’re connected. Let’s add your first list.";
      return true;
    } catch (error) {
      state.error = messageOf(error);
      return false;
    } finally {
      state.connecting = false;
    }
  }

  async function restore(identifier: string) {
    if (busy.value) return false;
    state.connecting = true;
    state.error = "";
    state.message = "";
    try {
      if (!/^[a-zA-Z0-9_-]+(?:~[^/]+)?$/.test(identifier))
        throw new Error(
          "That install link doesn’t look right. Copy the complete link from your addon.",
        );
      applyConfig(await request<SavedConfig>(`/api/config/${identifier}`));
      state.message = "Welcome back. Your saved lists are right here.";
      return true;
    } catch (error) {
      state.error = messageOf(error);
      return false;
    } finally {
      state.connecting = false;
    }
  }

  async function restoreFromUrl(value: string) {
    try {
      const url = new URL(value.trim().replace(/^stremio:\/\//i, "https://"));
      const match = url.pathname.match(
        /^\/([^/]+)\/(?:manifest\.json|configure)\/?$/,
      );
      if (
        !["https:", "http:"].includes(url.protocol) ||
        !match ||
        url.username ||
        url.password
      )
        throw new Error();
      // Only extract the identifier. Never send credentials to the pasted host.
      return await restore(match[1]);
    } catch {
      state.error =
        "Paste your complete private install link, ending in /manifest.json.";
      return false;
    }
  }

  async function persist(lists: Catalog[] = state.lists, settings?: Settings) {
    state.saving = true;
    try {
      const data = await request<{ userId: string }>("/api/config", {
        upstashUrl: state.upstashUrl,
        upstashToken: state.upstashToken,
        mdblistApiKey: state.mdblistApiKey,
        tmdbAccessToken: state.tmdbAccessToken,
        traktClientId: state.traktClientId,
        cacheBuster: state.cacheBuster,
        ...settings,
        lists: lists.map(normalizeList),
      });
      state.userId = data.userId;
      return true;
    } catch (error) {
      state.error = messageOf(error);
      return false;
    } finally {
      state.saving = false;
    }
  }

  async function saveSettings(settings: Settings) {
    if (busy.value) return false;
    state.error = "";
    if (!(await persist(state.lists, settings))) return false;
    Object.assign(state, settings);
    state.addonUrl = state.lists.length ? buildAddonUrl() : "";
    state.message = "Settings saved in your database.";
    return true;
  }

  async function addList(onAdded?: () => void) {
    if (busy.value || !parsed.value.list) return false;
    state.error = "";
    state.message = "";
    const list = reactive<Catalog>({
      ...parsed.value.list,
      cached: false,
      itemCount: 0,
      coverPosters: [],
      status: "idle",
      error: "",
    });
    if (list.provider !== "trakt" && !canImport(list)) {
      state.error = "Add your provider key to import this list.";
      return false;
    }
    if (
      state.lists.some(
        (item) =>
          catalogId(item) === catalogId(list) &&
          item.categoryName === list.categoryName,
      )
    ) {
      state.error = "This list is already in that category.";
      return false;
    }
    const next = [...state.lists, list];
    if (!(await persist(next))) return false;
    state.lists = next;
    state.listUrl = "";
    state.listName = "";
    state.category = "movie";
    state.addonUrl = buildAddonUrl();
    onAdded?.();
    if (list.provider === "trakt") {
      try {
        const data = await request<SavedConfig>(`/api/config/${state.userId}`);
        const saved = data.lists.find(
          (item) => catalogId(item) === catalogId(list),
        );
        list.cached = !!saved?.cached;
        list.itemCount = saved?.itemCount || 0;
        list.coverPosters = saved?.coverPosters || [];
        if (!list.cached)
          list.error =
            "No saved snapshot was found. Check the original Trakt list URL and its sorting options.";
        else
          state.message =
            "Your Trakt snapshot is ready. Nothing was changed in its cache.";
      } catch (error) {
        list.error = messageOf(error);
      }
    } else await runImport(list);
    return true;
  }

  async function runImport(list: Catalog) {
    if (busy.value) return;
    state.importing = true;
    list.status = "importing";
    list.error = "";
    list.skipped = 0;
    try {
      let progress = await request<ImportProgress>(
        `/api/cache/${state.userId}`,
        { list: normalizeList(list) },
      );
      list.progress = progress;
      while (progress.status !== "done") {
        progress = await request<ImportProgress>(
          `/api/cache/${state.userId}/${progress.jobId}`,
          { step: progress.step },
        );
        list.progress = progress;
      }
      for (const item of state.lists.filter(
        (item) => catalogId(item) === catalogId(list),
      )) {
        item.cached = true;
        item.itemCount = progress.done;
        item.coverPosters = progress.coverPosters || [];
      }
      previews.clear();
      list.skipped = progress.skipped;
      state.message = `${listLabel(list)} is ready to watch.`;
    } catch (error) {
      list.error =
        messageOf(error) +
        (list.cached ? " Your previous snapshot is still available." : "");
    } finally {
      list.status = "idle";
      state.importing = false;
    }
  }

  async function editList(list: Catalog, name: string, categoryName: string) {
    if (busy.value) return false;
    state.error = "";
    let definition: ListDefinition;
    try {
      definition = normalizeList({
        ...list,
        name,
        categoryName,
      }) as ListDefinition;
    } catch (error) {
      state.error = messageOf(error);
      return false;
    }
    const next = state.lists.map((item) =>
      item === list ? { ...item, ...definition, name: definition.name } : item,
    );
    if (!(await persist(next))) return false;
    state.lists = next;
    state.message = "List updated. The saved titles haven’t changed.";
    return true;
  }

  async function cacheExport(list: ExportList, categoryName: string) {
    if (busy.value || !state.connected) return false;
    state.importing = true;
    state.error = "";
    state.message = "";
    try {
      const result = await request<{ list: SavedConfig["lists"][number]; skipped: number }>(
        `/api/exports/${state.userId}`,
        { provider: list.provider || "wetrakr", sourceName: list.sourceName, categoryName, items: list.items },
      );
      previews.clear();
      const key = catalogId(result.list);
      const existing = state.lists.filter(item => catalogId(item) === key);
      const status = { cached: true, itemCount: result.list.itemCount || 0,
        coverPosters: result.list.coverPosters || [], skipped: result.skipped,
        error: "", status: "idle" as const };
      if (existing.length) existing.forEach(item => Object.assign(item, status));
      else state.lists.push({ ...normalizeList(result.list), ...status } as Catalog);
      state.addonUrl = buildAddonUrl();
      return true;
    } catch (error) {
      state.error = messageOf(error);
      return false;
    } finally { state.importing = false; }
  }

  async function moveList(list: Catalog, direction: number) {
    if (busy.value) return false;
    const index = state.lists.indexOf(list),
      target = index + direction;
    if (index < 0 || target < 0 || target >= state.lists.length) return false;
    state.error = "";
    const next = [...state.lists];
    [next[index], next[target]] = [next[target], next[index]];
    if (!(await persist(next))) return false;
    state.lists = next;
    state.message = "Catalog order saved.";
    return true;
  }

  async function removeList(list: Catalog) {
    if (busy.value) return false;
    state.error = "";
    const next = state.lists.filter((item) => item !== list);
    if (!(await persist(next))) return false;
    state.lists = next;
    state.addonUrl = next.length ? buildAddonUrl() : "";
    state.message =
      "List removed from your addon. Its saved snapshot is still in your database.";
    return true;
  }

  async function previewList(list: Catalog): Promise<Meta[]> {
    const key = `${state.userId}:${catalogId(list)}`;
    let entry = previews.get(key);
    if (!entry || entry.expires <= Date.now()) {
      previews.delete(key);
      if (previews.size >= 20) previews.delete(previews.keys().next().value!);
      const data = request<{ metas: Meta[] }>(
        `/${state.userId}/catalog/${encodeURIComponent(list.categoryName)}/${encodeURIComponent(catalogId(list))}/skip=0.json?preview=1`,
      ).then(result => result.metas.slice(0, 12));
      entry = { expires: Date.now() + 60000, data };
      previews.set(key, entry);
    }
    try {
      // Broken-image handling in the dialog must not mutate the cached preview.
      return (await entry.data).map(meta => ({ ...meta }));
    } catch (error) {
      if (previews.get(key) === entry) previews.delete(key);
      throw error;
    }
  }
  function buildAddonUrl() {
    const base = (
      import.meta.env.VITE_APP_URL || window.location.origin
    ).replace(/\/$/, "");
    const revision = state.cacheBuster.trim()
      ? `~${encodeURIComponent(state.cacheBuster.trim())}`
      : "";
    return `${base}/${state.userId.split("~")[0]}${revision}/manifest.json`;
  }

  function disconnect() {
    if (!busy.value) {
      previews.clear();
      Object.assign(state, initial());
    }
  }
  return {
    state,
    busy,
    parsed,
    titleCount,
    canImport,
    connect,
    restore,
    restoreFromUrl,
    saveSettings,
    addList,
    runImport,
    cacheExport,
    editList,
    moveList,
    removeList,
    previewList,
    buildAddonUrl,
    disconnect,
  };
}
