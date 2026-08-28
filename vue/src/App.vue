<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  onBeforeUnmount,
  reactive,
  ref,
  watch,
} from "vue";
import { catalogId, listLabel } from "../../shared/lists.js";
import AppIcon from "./components/AppIcon.vue";
import BaseDialog from "./components/BaseDialog.vue";
import CoverArt from "./components/CoverArt.vue";
import ConnectionPanel from "./components/ConnectionPanel.vue";
import CatalogCard from "./components/CatalogCard.vue";
import ExportImport from "./components/ExportImport.vue";
import { useCatalogs } from "./composables/useCatalogs";
import type { Catalog, Meta, Provider, Settings } from "./types/catalog";

const library = useCatalogs();
const { state, busy, parsed, titleCount } = library;
type DialogKind =
  | "add"
  | "settings"
  | "install"
  | "edit"
  | "remove"
  | "preview"
  | "help"
  | "export"
  | null;
const dialogKind = ref<DialogKind>(null);
const exportProvider = ref<"wetrakr" | "imdb">("wetrakr");
const exportSourceName = ref("");
function openExport(provider: "wetrakr" | "imdb", sourceName = "") {
  exportProvider.value = provider;
  exportSourceName.value = sourceName;
  openDialog("export");
}
const filter = ref("all"),
  search = ref("");
const providerHint = ref<Provider>("mdblist"),
  providerKey = ref("");
const customCategory = ref(false),
  revealInstall = ref(false),
  copied = ref(false);
const selectedList = ref<Catalog | null>(null),
  editName = ref(""),
  editCategory = ref("");
const preview = ref<Meta[]>([]),
  previewLoading = ref(false),
  previewError = ref("");
const drafts = reactive<Settings>({
  mdblistApiKey: "",
  tmdbAccessToken: "",
  cacheBuster: "",
});
const providerNames = {
  mdblist: "MDBList",
  tmdb: "TMDB",
  trakt: "Trakt archive",
  wetrakr: "WeTrakr",
  imdb: "IMDb",
};
const filters = [
  { id: "all", label: "All lists" },
  { id: "mdblist", label: "MDBList" },
  { id: "tmdb", label: "TMDB" },
  { id: "trakt", label: "Trakt archive" },
  { id: "wetrakr", label: "WeTrakr" },
  { id: "imdb", label: "IMDb" },
];
const visibleLists = computed(() =>
  state.lists.filter(
    (list) =>
      (filter.value === "all" || list.provider === filter.value) &&
      `${listLabel(list)} ${list.categoryName} ${list.username}`
        .toLowerCase()
        .includes(search.value.toLowerCase().trim()),
  ),
);
const savedCount = computed(
  () => state.lists.filter((list) => list.cached).length,
);
const sourceCount = computed(
  () => new Set(state.lists.map((list) => list.provider)).size,
);
const databaseName = computed(() => {
  try {
    return new URL(state.upstashUrl).hostname;
  } catch {
    return "";
  }
});
const detectedProvider = computed(
  () => parsed.value.list?.provider || providerHint.value,
);
const needsKey = computed(
  () =>
    parsed.value.list &&
    parsed.value.list.provider !== "trakt" &&
    !library.canImport(parsed.value.list),
);
const dialogTitle = computed(
  () =>
    ({
      add: "Add something good.",
      export: `Your ${exportProvider.value === "imdb" ? "IMDb" : "WeTrakr"} lists, cached.`,
      settings: "Your workspace settings",
      install: "Take your collection with you.",
      edit: "Make it your own.",
      remove: "Remove this list?",
      preview: selectedList.value
        ? listLabel(selectedList.value)
        : "List preview",
      help: "A few things worth knowing.",
    })[dialogKind.value || "help"],
);
const dialogDescription = computed(
  () =>
    ({
      add: "A link is all you need to get started.",
      export: "Choose lists from your export to save directly in your own Upstash database.",
      settings: "Saved in your Upstash database. Only you control them.",
      install: "Your saved lists, ready in your favorite app.",
      edit: "Change how this list appears in your addon.",
      remove: "Only its place in your addon will change.",
      preview: "A peek at the titles in your saved snapshot.",
      help: "Simple on the outside. Your data underneath.",
    })[dialogKind.value || "help"],
);
let messageTimer: ReturnType<typeof setTimeout>,
  copyTimer: ReturnType<typeof setTimeout>,
  previewRequest = 0;
watch(detectedProvider, () => {
  providerKey.value = "";
});
watch(
  () => state.message,
  (value) => {
    clearTimeout(messageTimer);
    if (value)
      messageTimer = setTimeout(() => {
        state.message = "";
      }, 6500);
  },
);
watch(
  () => state.connected,
  async () => {
    await nextTick();
    document
      .querySelector<HTMLHeadingElement>("main h1")
      ?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  },
);
onBeforeUnmount(() => {
  clearTimeout(messageTimer);
  clearTimeout(copyTimer);
});

function openDialog(kind: DialogKind) {
  state.error = "";
  copied.value = false;
  if (kind === "settings")
    Object.assign(drafts, {
      mdblistApiKey: state.mdblistApiKey,
      tmdbAccessToken: state.tmdbAccessToken,
      cacheBuster: state.cacheBuster,
    });
  if (kind === "install") {
    revealInstall.value = false;
    state.addonUrl = library.buildAddonUrl();
  }
  dialogKind.value = kind;
}
function closeDialog() {
  previewRequest++;
  dialogKind.value = null;
  state.error = "";
  previewError.value = "";
}
function openAdd(provider: Provider = "mdblist") {
  if (busy.value) return;
  providerHint.value = provider;
  providerKey.value = "";
  customCategory.value = false;
  state.listUrl = "";
  state.listName = "";
  state.category = "movie";
  openDialog("add");
}
async function submitList() {
  if (busy.value || !parsed.value.list) return;
  if (needsKey.value) {
    const settings = {
      mdblistApiKey: state.mdblistApiKey,
      tmdbAccessToken: state.tmdbAccessToken,
      cacheBuster: state.cacheBuster,
    };
    if (detectedProvider.value === "mdblist")
      settings.mdblistApiKey = providerKey.value.trim();
    else settings.tmdbAccessToken = providerKey.value.trim();
    if (!(await library.saveSettings(settings))) return;
  }
  await library.addList(closeDialog);
}
async function saveSettings() {
  if (await library.saveSettings({ ...drafts })) closeDialog();
}
function openEdit(list: Catalog) {
  selectedList.value = list;
  editName.value = list.name || "";
  editCategory.value = list.categoryName;
  openDialog("edit");
}
async function saveEdit() {
  if (
    selectedList.value &&
    (await library.editList(
      selectedList.value,
      editName.value,
      editCategory.value,
    ))
  )
    closeDialog();
}
async function removeSelected() {
  if (selectedList.value && (await library.removeList(selectedList.value)))
    closeDialog();
}
async function refresh(list: Catalog) {
  if (list.provider === "wetrakr" || list.provider === "imdb") { openExport(list.provider, list.sourceName); return; }
  if (!library.canImport(list)) {
    openDialog("settings");
    state.error = `Save your ${providerNames[list.provider]} key before refreshing.`;
    return;
  }
  await library.runImport(list);
}
async function showPreview(list: Catalog) {
  const request = ++previewRequest;
  selectedList.value = list;
  preview.value = [];
  previewLoading.value = true;
  openDialog("preview");
  try {
    const titles = await library.previewList(list);
    if (request === previewRequest) preview.value = titles;
  } catch (error) {
    if (request === previewRequest)
      previewError.value =
        error instanceof Error
          ? error.message
          : "The preview couldn’t be loaded.";
  } finally {
    if (request === previewRequest) previewLoading.value = false;
  }
}
function failedPoster(meta: Meta) {
  meta.poster = undefined;
}
async function copyInstall() {
  try {
    await navigator.clipboard.writeText(state.addonUrl);
    copied.value = true;
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => {
      copied.value = false;
    }, 4000);
  } catch {
    state.error =
      "Clipboard access is unavailable. Reveal the link, then select and copy it.";
    revealInstall.value = true;
  }
}
function installStremio() {
  window.location.href = state.addonUrl.replace(/^https?:\/\//, "stremio://");
}
function disconnect() {
  if (busy.value) return;
  closeDialog();
  search.value = "";
  filter.value = "all";
  providerKey.value = "";
  Object.assign(drafts, {
    mdblistApiKey: "",
    tmdbAccessToken: "",
    cacheBuster: "",
  });
  selectedList.value = null;
  preview.value = [];
  library.disconnect();
}
onMounted(() => {
  const match = window.location.pathname.match(/^\/([^/]+)\/configure\/?$/);
  if (match) void library.restore(match[1]);
});
</script>

<template>
  <div class="site-shell">
    <a class="skip-link" href="#main">Skip to content</a>
    <header class="site-header">
      <div class="header-inner">
        <a
          href="/"
          class="brand"
          aria-label="Custom Lists home"
          @click="state.connected && $event.preventDefault()"
          ><span class="brand-mark"><img src="/brand/custom-lists-mark-v1.png" width="40" height="40" alt="" aria-hidden="true" /></span
          ><span>Custom Lists<span class="brand-period">.</span></span></a
        >
        <div v-if="!state.connected" class="header-actions">
          <span class="header-caption">A better way to browse.</span
          ><button class="text-button" @click="openDialog('help')">
            How it works<AppIcon name="external" :size="14" />
          </button>
        </div>
        <div v-else class="header-actions">
          <span class="connection-pill"
            ><span></span>Your storage is connected</span
          ><button
            class="button button-quiet"
            :disabled="busy"
            @click="openDialog('settings')"
          >
            <AppIcon name="settings" :size="17" /><span>Settings</span></button
          ><button
            class="button button-dark header-install"
            :disabled="!state.lists.length || busy"
            @click="openDialog('install')"
          >
            Install addon<AppIcon name="arrow" :size="16" />
          </button>
        </div>
      </div>
    </header>

    <main id="main">
      <template v-if="!state.connected">
        <div class="welcome-grid content-width">
          <section class="welcome-story">
            <div class="eyebrow">
              <span class="tiny-rule"></span> BUILT AROUND YOUR TASTE
            </div>
            <h1 tabindex="-1">Your taste.<br />Your <em>collection.</em></h1>
            <p class="hero-description">
              Bring the lists you love to Stremio and Nuvio.<br
                class="desktop-break"
              />
              Beautifully organized. Always yours.
            </p>
            <div class="service-line">
              <span>MDBList</span><span class="service-separator">/</span
              ><span>TMDB</span><span class="service-separator">/</span
              ><span>Saved Trakt lists</span>
            </div>
            <div
              class="collection-illustration"
              aria-label="Illustration of a personal collection"
            >
              <div class="illustration-heading">
                <span
                  ><span class="window-dot"></span
                  ><span class="window-dot"></span
                  ><span class="window-dot"></span></span
                ><span>YOUR COLLECTION, YOUR WAY</span
                ><AppIcon name="grid" :size="14" />
              </div>
              <div class="sample-covers">
                <CoverArt tone="blue" label="The weekend edit" /><CoverArt
                  tone="amber"
                  label="A different perspective"
                /><CoverArt tone="green" label="Somewhere new" />
              </div>
              <div class="illustration-footer">
                <AppIcon name="check" :size="14" /> Your favorites. Ready when
                you are.<span>ILLUSTRATION</span>
              </div>
            </div>
          </section>
          <ConnectionPanel
            :state="state"
            :busy="busy"
            @connect="library.connect"
            @restore="library.restoreFromUrl"
          />
        </div>
        <section class="how-it-works content-width" aria-label="How it works">
          <div>
            <span class="feature-number">01</span>
            <h3>A space of your own</h3>
            <p>
              Your lists live in your personal Upstash database. No shared
              account, no shared collection.
            </p>
          </div>
          <div>
            <span class="feature-number">02</span>
            <h3>Bring your favorites</h3>
            <p>
              Paste a list from MDBList or TMDB. Your previously saved Trakt
              lists stay right where they are.
            </p>
          </div>
          <div>
            <span class="feature-number">03</span>
            <h3>Less waiting. More watching.</h3>
            <p>
              Install once. Browse saved titles in your app, and refresh your
              lists whenever you choose.
            </p>
          </div>
        </section>
      </template>

      <div v-else class="workspace content-width">
        <div class="workspace-heading">
          <div>
            <div class="eyebrow">YOUR PERSONAL WORKSPACE</div>
            <h1 tabindex="-1">
              Your collection<span class="heading-period">.</span>
            </h1>
            <p>Good lists deserve a place of their own.</p>
          </div>
          <button
            class="button button-primary"
            :disabled="busy"
            @click="openAdd()"
          >
            <AppIcon name="plus" :size="18" />Add a list
          </button>
        </div>
        <div
          v-if="state.error && !dialogKind"
          class="alert alert-error"
          role="alert"
        >
          <AppIcon name="help" /><span>{{ state.error }}</span
          ><button
            class="icon-button"
            aria-label="Dismiss error"
            @click="state.error = ''"
          >
            <AppIcon name="close" :size="16" />
          </button>
        </div>
        <div class="workspace-stats">
          <div>
            <AppIcon name="grid" /><strong>{{ state.lists.length }}</strong
            ><span>{{
              state.lists.length === 1
                ? "list in your collection"
                : "lists in your collection"
            }}</span>
          </div>
          <div>
            <AppIcon name="film" /><strong>{{
              titleCount.toLocaleString()
            }}</strong
            ><span>saved title entries</span>
          </div>
          <div>
            <AppIcon name="link" /><strong>{{ sourceCount }}</strong
            ><span>{{
              sourceCount === 1 ? "list source" : "list sources"
            }}</span>
          </div>
        </div>
        <div class="workspace-grid">
          <section class="catalog-section" aria-label="Your catalogs">
            <div class="section-title">
              <h2>
                Your lists <span>{{ state.lists.length }}</span>
              </h2>
              <span>In the order they appear in your addon</span>
            </div>
            <div v-if="state.lists.length" class="list-toolbar">
              <div class="filter-tabs" aria-label="Filter lists by source">
                <button
                  v-for="item in filters"
                  :key="item.id"
                  :class="{ active: filter === item.id }"
                  :aria-pressed="filter === item.id"
                  @click="filter = item.id"
                >
                  {{ item.label }}
                </button>
              </div>
              <label class="search-input"
                ><AppIcon name="search" :size="17" /><input
                  v-model="search"
                  aria-label="Search your lists"
                  placeholder="Find a list…"
                  type="search"
              /></label>
            </div>
            <div
              v-if="state.lists.length && visibleLists.length"
              class="catalog-list"
            >
              <CatalogCard
                v-for="list in visibleLists"
                :key="`${catalogId(list)}|${list.categoryName}`"
                :list="list"
                :busy="busy"
                :index="state.lists.indexOf(list)"
                :total="state.lists.length"
                @preview="showPreview(list)"
                @edit="openEdit(list)"
                @refresh="refresh(list)"
                @move="(direction) => library.moveList(list, direction)"
              />
            </div>
            <div v-else-if="state.lists.length" class="empty-state">
              <AppIcon name="search" :size="32" />
              <h3>No lists found.</h3>
              <p>Try another search or look in a different source.</p>
              <button
                class="button button-secondary"
                @click="
                  search = '';
                  filter = 'all';
                "
              >
                Show all lists
              </button>
            </div>
            <div v-else class="empty-state first-list">
              <div class="empty-art">
                <CoverArt tone="amber" /><CoverArt tone="blue" /><CoverArt
                  tone="green"
                />
              </div>
              <h3>A collection with your name on it.</h3>
              <p>
                Start with a list you love. We’ll take care of<br />
                making it feel at home in your app.
              </p>
              <button class="button button-primary" @click="openAdd()">
                <AppIcon name="plus" :size="17" />Add your first list</button
              ><button class="text-button" @click="openAdd('trakt')">
                Have an old Trakt snapshot?
              </button>
            </div>
            <div v-if="state.lists.length" class="collection-note">
              <AppIcon name="shield" :size="15" /><span
                >Stored in your database. A failed refresh never replaces a
                saved snapshot.</span
              >
            </div>
          </section>
          <aside class="workspace-aside">
            <section class="install-panel">
              <div class="panel-icon"><AppIcon name="play" :size="22" /></div>
              <span class="eyebrow">THE BEST PART</span>
              <h2>Your next watch<br />is waiting.</h2>
              <p>Bring this collection to the screen you love.</p>
              <div class="app-tags">
                <span><i class="stremio-dot"></i>Stremio</span
                ><span><i class="nuvio-dot"></i>Nuvio</span>
              </div>
              <button
                class="button button-dark button-full"
                :disabled="!state.lists.length || busy"
                @click="openDialog('install')"
              >
                {{
                  state.lists.length
                    ? "Install your collection"
                    : "Add a list to get started"
                }}<AppIcon name="arrow" :size="17" /></button
              ><small>One private link. All your saved lists.</small>
            </section>
            <section class="sources-panel">
              <h3>A world of good lists.</h3>
              <p>Find your next rabbit hole.</p>
              <button :disabled="busy" @click="openAdd('mdblist')">
                <span class="source-logo mdb-logo">m<span>db</span></span
                ><span
                  ><strong>MDBList</strong
                  ><small>Lists for every kind of mood</small></span
                ><AppIcon name="plus" :size="17" /></button
              ><button :disabled="busy" @click="openAdd('tmdb')">
                <span class="source-logo tmdb-logo">tm<br />db</span
                ><span
                  ><strong>TMDB</strong
                  ><small>Discover something different</small></span
                ><AppIcon name="plus" :size="17" />
              </button>
              <button :disabled="busy" @click="openExport('wetrakr')">
                <span class="source-logo wetrakr-logo">w</span>
                <span><strong>WeTrakr</strong><small>Cache lists from your ZIP export</small></span>
                <AppIcon name="plus" :size="17" />
              </button>
              <button :disabled="busy" @click="openExport('imdb')">
                <span class="source-logo imdb-logo">IMDb</span>
                <span><strong>IMDb</strong><small>Cache lists from your CSV export</small></span>
                <AppIcon name="plus" :size="17" />
              </button>
            </section>
            <div class="database-note">
              <AppIcon name="database" :size="17" />
              <div>
                <strong>Your storage, connected</strong
                ><span :title="databaseName">{{ databaseName }}</span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>

    <footer class="site-footer content-width">
      <div>
        <span class="footer-brand">A little order. A lot to watch.</span>
        <p>Independent. No shared user database. No analytics.</p>
      </div>
      <div class="footer-links">
        <button @click="openDialog('help')">Help & privacy</button
        ><a
          href="https://github.com/A2R14N/custom-lists"
          target="_blank"
          rel="noopener noreferrer"
          >GitHub<AppIcon name="external" :size="13"
        /></a>
      </div>
      <div class="tmdb-attribution">
        <img src="/tmdb-logo.svg" alt="TMDB" width="62" height="15" /><span
          >This product uses the TMDB API but is not endorsed or certified by
          TMDB.</span
        >
      </div>
    </footer>
    <Transition name="toast"
      ><div
        v-if="state.message && state.connected"
        class="toast-message"
        role="status"
      >
        <span class="toast-check"><AppIcon name="check" :size="15" /></span
        ><span>{{ state.message }}</span
        ><button
          class="icon-button"
          aria-label="Dismiss notification"
          @click="state.message = ''"
        >
          <AppIcon name="close" :size="16" />
        </button></div
    ></Transition>

    <BaseDialog
      :open="!!dialogKind"
      :title="dialogTitle"
      :description="dialogDescription"
      :busy="state.saving || (dialogKind === 'export' && state.importing)"
      :wide="dialogKind === 'preview'"
      @close="closeDialog"
    >
      <div v-if="state.error" class="alert alert-error" role="alert">
        <AppIcon name="help" /><span>{{ state.error }}</span>
      </div>
      <form v-if="dialogKind === 'add'" @submit.prevent="submitList">
        <button type="button" class="text-button export-shortcut" :disabled="busy" @click="openExport('wetrakr')">Have a WeTrakr export? Cache it directly</button>
        <button type="button" class="text-button export-shortcut" :disabled="busy" @click="openExport('imdb')">Have an IMDb CSV? Cache it directly</button>
        <div class="source-choice" aria-label="List source">
          <button
            v-for="provider in ['mdblist', 'tmdb', 'trakt'] as const"
            :key="provider"
            type="button"
            :class="{ selected: detectedProvider === provider }"
            :aria-pressed="detectedProvider === provider"
            :disabled="!!parsed.list || busy"
            @click="providerHint = provider"
          >
            <span class="provider-dot" :class="provider"></span
            >{{ providerNames[provider] }}
          </button>
        </div>
        <label class="field-label" for="list-url">Paste a list URL</label>
        <div class="input-with-icon">
          <AppIcon name="link" :size="18" /><input
            id="list-url"
            v-model="state.listUrl"
            :disabled="busy"
            :placeholder="
              providerHint === 'tmdb'
                ? 'https://www.themoviedb.org/list/…'
                : providerHint === 'trakt'
                  ? 'https://trakt.tv/users/…/lists/…'
                  : 'https://mdblist.com/lists/…/…'
            "
            autocomplete="off"
            spellcheck="false"
            required
          />
        </div>
        <p v-if="parsed.error" class="inline-error" role="alert">
          {{ parsed.error }}
        </p>
        <p v-else-if="parsed.list" class="field-hint success-text">
          <AppIcon name="check" :size="14" />{{
            providerNames[parsed.list.provider]
          }}
          list recognized
        </p>
        <p v-else class="field-hint">
          We’ll recognize the source automatically.
        </p>
        <div v-if="needsKey" class="inline-provider-setup">
          <div>
            <AppIcon name="lock" :size="18" /><strong
              >One quick connection</strong
            >
          </div>
          <p>
            {{
              detectedProvider === "mdblist"
                ? "Add your MDBList API key. We’ll save it for your next import."
                : "Add your TMDB API Read Access Token—the long token, not the v3 API key."
            }}
          </p>
          <label class="field-label" for="provider-key">{{
            detectedProvider === "mdblist"
              ? "MDBList API key"
              : "TMDB Read Access Token"
          }}</label
          ><input
            id="provider-key"
            v-model="providerKey"
            type="password"
            autocomplete="off"
            :disabled="busy"
            required
          /><a
            :href="
              detectedProvider === 'mdblist'
                ? 'https://mdblist.com/preferences/#api'
                : 'https://www.themoviedb.org/settings/api'
            "
            target="_blank"
            rel="noopener noreferrer"
            >Where do I find this?<AppIcon name="external" :size="13"
          /></a>
        </div>
        <div v-if="detectedProvider === 'trakt'" class="alert alert-info">
          <AppIcon name="archive" /><span
            >Trakt links can reconnect a snapshot already in your database. They
            won’t fetch new titles from Trakt.</span
          >
        </div>
        <div class="form-row">
          <div>
            <label class="field-label" for="list-name"
              >Give it a name <span>Optional</span></label
            ><input
              id="list-name"
              v-model="state.listName"
              placeholder="My weekend watchlist"
              maxlength="120"
              :disabled="busy"
            />
          </div>
          <div>
            <label class="field-label" for="list-category">Show under</label
            ><select
              v-if="!customCategory"
              id="list-category"
              v-model="state.category"
              :disabled="busy"
            >
              <option value="movie">Movies</option>
              <option value="series">Series</option>
              <option value="cartoon">Cartoons</option></select
            ><input
              v-else
              id="list-category"
              v-model="state.category"
              placeholder="Custom category"
              :disabled="busy"
              required
            />
          </div>
        </div>
        <button
          type="button"
          class="text-button advanced-toggle"
          :disabled="busy"
          @click="
            customCategory = !customCategory;
            if (!customCategory) state.category = 'movie';
          "
        >
          {{
            customCategory ? "Use a standard category" : "Use a custom category"
          }}
        </button>
        <div class="dialog-footer">
          <p>
            <AppIcon name="shield" :size="14" />Existing snapshots stay safe.
          </p>
          <button
            class="button button-primary"
            :disabled="
              busy || !parsed.list || (!!needsKey && !providerKey.trim())
            "
          >
            <span v-if="busy" class="spinner" />{{
              detectedProvider === "trakt"
                ? "Reconnect snapshot"
                : "Add to my collection"
            }}<AppIcon v-if="!busy" name="arrow" :size="16" />
          </button>
        </div>
      </form>

      <ExportImport
        :provider="exportProvider"
        :initial-name="exportSourceName"
        v-else-if="dialogKind === 'export'"
        :busy="busy"
        :cache-list="library.cacheExport"
        @complete="(count) => { closeDialog(); state.message = `${count} ${exportProvider === 'imdb' ? 'IMDb' : 'WeTrakr'} ${count === 1 ? 'list' : 'lists'} cached in your database.`; }"
      />

      <form
        v-else-if="dialogKind === 'settings'"
        @submit.prevent="saveSettings"
      >
        <div class="settings-connection">
          <span class="panel-icon"><AppIcon name="database" /></span>
          <div>
            <strong>Upstash Redis</strong><small>{{ databaseName }}</small>
          </div>
          <span class="status-tag">Connected</span>
        </div>
        <div class="settings-divider"></div>
        <h3 class="form-section-heading">Your list sources</h3>
        <p class="field-hint">
          Keys are only needed to import or refresh lists. Saved titles keep
          working without them.
        </p>
        <label class="field-label" for="settings-mdb"
          >MDBList API key<a
            href="https://mdblist.com/preferences/#api"
            target="_blank"
            rel="noopener noreferrer"
            >Get key<AppIcon name="external" :size="12" /></a></label
        ><input
          id="settings-mdb"
          v-model="drafts.mdblistApiKey"
          type="password"
          autocomplete="off"
          placeholder="Optional · for MDBList imports"
          :disabled="busy"
        />
        <label class="field-label" for="settings-tmdb"
          >TMDB Read Access Token<a
            href="https://www.themoviedb.org/settings/api"
            target="_blank"
            rel="noopener noreferrer"
            >Get token<AppIcon name="external" :size="12" /></a></label
        ><input
          id="settings-tmdb"
          v-model="drafts.tmdbAccessToken"
          type="password"
          autocomplete="off"
          placeholder="Optional · the long bearer token"
          :disabled="busy"
        />
        <details class="advanced-settings">
          <summary>Advanced settings<AppIcon name="down" :size="15" /></summary>
          <label class="field-label" for="revision">Install link revision</label
          ><input
            id="revision"
            v-model="drafts.cacheBuster"
            placeholder="For example, 2"
            :disabled="busy"
          />
          <p class="field-hint">
            Changes your install link so a client can reload its manifest. Your
            saved snapshots stay the same. Reinstall using the new link
            afterward.
          </p>
        </details>
        <div class="dialog-footer">
          <button
            class="text-button danger-text"
            type="button"
            :disabled="busy"
            @click="disconnect"
          >
            Disconnect this session</button
          ><button class="button button-primary" :disabled="busy">
            <span v-if="state.saving" class="spinner" />Save settings
          </button>
        </div>
      </form>

      <div v-else-if="dialogKind === 'install'">
        <div class="install-summary">
          <span class="summary-mark"><AppIcon name="check" :size="23" /></span>
          <div>
            <strong>Your collection is ready.</strong>
            <p>
              {{ savedCount }} saved {{ savedCount === 1 ? "list" : "lists" }} ·
              {{ titleCount.toLocaleString() }} title entries
            </p>
          </div>
        </div>
        <div v-if="savedCount < state.lists.length" class="alert alert-info">
          <AppIcon name="help" /><span
            >Some lists aren’t cached yet. They will appear empty until you
            import them.</span
          >
        </div>
        <button class="install-app-button" @click="installStremio">
          <span class="app-symbol stremio-symbol"><AppIcon name="play" /></span
          ><span
            ><strong>Open in Stremio</strong
            ><small>Install directly in the Stremio app</small></span
          ><AppIcon name="external" :size="19" />
        </button>
        <button class="install-app-button" @click="copyInstall">
          <span class="app-symbol nuvio-symbol">n</span
          ><span
            ><strong>{{
              copied ? "Link copied" : "Copy link for Nuvio"
            }}</strong
            ><small>Paste it into Nuvio’s addon installer</small></span
          ><AppIcon :name="copied ? 'check' : 'copy'" :size="19" />
        </button>
        <div class="private-link-box">
          <label class="field-label" for="install-link"
            >Your private install link<button
              class="text-button"
              @click="revealInstall = !revealInstall"
            >
              {{ revealInstall ? "Hide" : "Reveal" }}
            </button></label
          >
          <div class="input-with-action">
            <input
              id="install-link"
              :type="revealInstall ? 'text' : 'password'"
              :value="state.addonUrl"
              readonly
              autocomplete="off"
            /><button
              class="icon-button"
              aria-label="Copy private install link"
              @click="copyInstall"
            >
              <AppIcon :name="copied ? 'check' : 'copy'" :size="17" />
            </button>
          </div>
        </div>
        <p v-if="copied" class="field-hint success-text" role="status">
          Copied. Keep this link private.
        </p>
        <div class="privacy-warning">
          <AppIcon name="lock" :size="18" />
          <p>
            <strong>Treat this link like a password.</strong> It contains
            recoverable access credentials for your database. Share the homepage
            with friends, never this link.
          </p>
        </div>
      </div>

      <form
        v-else-if="dialogKind === 'edit' && selectedList"
        @submit.prevent="saveEdit"
      >
        <label class="field-label" for="edit-name">Display name</label
        ><input
          id="edit-name"
          v-model="editName"
          :placeholder="listLabel(selectedList)"
          maxlength="120"
          :disabled="busy"
        /><label class="field-label" for="edit-category">Category</label
        ><input
          id="edit-category"
          v-model="editCategory"
          list="category-options"
          :disabled="busy"
          required
        /><datalist id="category-options">
          <option value="movie" />
          <option value="series" />
          <option value="cartoon" />
        </datalist>
        <p class="field-hint">
          The source and cached titles stay unchanged. Clients may require a
          manifest reload to show edits.
        </p>
        <div class="dialog-footer">
          <button
            type="button"
            class="text-button danger-text"
            :disabled="busy"
            @click="openDialog('remove')"
          >
            <AppIcon name="trash" :size="16" />Remove list</button
          ><button class="button button-primary" :disabled="busy">
            <span v-if="state.saving" class="spinner" />Save changes
          </button>
        </div>
      </form>
      <div v-else-if="dialogKind === 'remove' && selectedList">
        <div class="removal-summary">
          <AppIcon name="archive" :size="28" /><strong>{{
            listLabel(selectedList)
          }}</strong>
          <p>
            The snapshot stays in your database. You can reconnect it later
            using the original list URL.
          </p>
        </div>
        <div class="dialog-footer">
          <button
            class="button button-secondary"
            :disabled="busy"
            @click="openDialog('edit')"
          >
            Keep this list</button
          ><button
            class="button button-danger"
            :disabled="busy"
            @click="removeSelected"
          >
            <span v-if="state.saving" class="spinner" />Remove from addon
          </button>
        </div>
      </div>
      <div v-else-if="dialogKind === 'preview'">
        <div v-if="previewLoading" class="preview-loading" role="status">
          <span class="spinner" />Opening your saved titles…
        </div>
        <div v-else-if="previewError" class="alert alert-error" role="alert">
          {{ previewError }}
        </div>
        <div v-else-if="!preview.length" class="empty-state">
          <AppIcon name="film" :size="30" />
          <h3>No saved titles yet.</h3>
          <p>Import this list first, then come back for a look.</p>
        </div>
        <div v-else class="poster-grid">
          <article v-for="meta in preview" :key="`${meta.type}:${meta.id}`">
            <img
              v-if="meta.poster"
              :src="meta.poster"
              :alt="meta.name"
              decoding="async"
              loading="lazy"
              referrerpolicy="no-referrer"
              @error="failedPoster(meta)"
            />
            <div v-else class="poster-fallback">
              <AppIcon name="film" :size="28" />
            </div>
            <h3>{{ meta.name }}</h3>
            <p>
              {{
                meta.releaseInfo ||
                (meta.type === "series" ? "Series" : "Movie")
              }}
            </p>
          </article>
        </div>
        <p v-if="preview.length" class="field-hint preview-caption">
          Showing the first {{ preview.length }} saved titles. Open your addon
          to browse the full collection.
        </p>
      </div>
      <div v-else-if="dialogKind === 'help'" class="help-content">
        <section>
          <span>01</span>
          <div>
            <h3>Connect your own storage.</h3>
            <p>
              Create a dedicated Upstash Redis database and connect with its
              REST URL and read/write token. Your settings, provider keys, and
              snapshots live there.
            </p>
          </div>
        </section>
        <section>
          <span>02</span>
          <div>
            <h3>Bring a list. Keep a snapshot.</h3>
            <p>
              Paste a public MDBList or TMDB link and add that provider’s key
              when asked. Keep the page open during import. Existing Trakt
              snapshots stay readable without a Trakt subscription.
            </p>
          </div>
        </section>
        <section>
          <span>03</span>
          <div>
            <h3>Install once. Make it yours.</h3>
            <p>
              Open the install link in Stremio or copy it into Nuvio. Refresh
              snapshots when you choose. This addon provides catalogs, not
              playback streams.
            </p>
          </div>
        </section>
        <div class="privacy-warning">
          <AppIcon name="lock" />
          <p>
            <strong>A note on privacy.</strong> Install links encode your
            database credentials; they aren’t encrypted. Credentials pass
            through the backend, and hosting access logs may retain URLs. Use a
            dedicated database and a trusted host. We don’t save credentials in
            browser storage or use analytics.
          </p>
        </div>
      </div>
    </BaseDialog>
  </div>
</template>
