<script setup lang="ts">
import AppIcon from "./AppIcon.vue";
import type { CatalogLibrary } from "../composables/useCatalogs";
import { computed } from "vue";
import { catalogId } from "../../../shared/lists.js";
import CoverArt from "./CoverArt.vue";
import CatalogCard from "./CatalogCard.vue";
import { useCollectionFilters } from "../composables/useCollectionFilters";
import type { Catalog, Provider } from "../types/catalog";
const props = defineProps<{ library: CatalogLibrary; dialogOpen: boolean }>();
const { state, busy, titleCount } = props.library;
const library = props.library;
const {
  filter,
  search,
  sortBy,
  filters,
  visibleLists,
  sourceCounts,
  hasFilters,
  canReorder,
  clearFilters,
} = useCollectionFilters(state);
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
const emit = defineEmits<{
  add: [provider?: Provider];
  export: [provider: "wetrakr" | "imdb", sourceName?: string];
  install: [];
  preview: [list: Catalog];
  edit: [list: Catalog];
  refresh: [list: Catalog];
}>();
const openAdd = (provider: Provider = "mdblist") => emit("add", provider);
const openExport = (provider: "wetrakr" | "imdb", sourceName = "") =>
  emit("export", provider, sourceName);
const openDialog = (_kind: "install") => emit("install");
const showPreview = (list: Catalog) => emit("preview", list);
const openEdit = (list: Catalog) => emit("edit", list);
const refresh = (list: Catalog) => emit("refresh", list);
function addFromCurrentSource() {
  if (filter.value === "wetrakr" || filter.value === "imdb") openExport(filter.value);
  else openAdd(filter.value === "all" ? "mdblist" : filter.value);
}
</script>

<template>
  <div class="workspace content-width">
    <div class="workspace-heading">
      <div>
        <h1 tabindex="-1">Your collection</h1>
        <p>Organize your lists, preview titles, and browse them in your addon.</p>
      </div>
      <button class="button button-primary" :disabled="busy" @click="openAdd()">
        <AppIcon name="plus" :size="18" />Add a list
      </button>
    </div>
    <div v-if="state.error && !dialogOpen" class="alert alert-error" role="alert">
      <AppIcon name="help" /><span>{{ state.error }}</span
      ><button class="icon-button" aria-label="Dismiss error" @click="state.error = ''">
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
        <AppIcon name="film" /><strong>{{ titleCount.toLocaleString() }}</strong
        ><span>saved title entries</span>
      </div>
      <div>
        <AppIcon name="link" /><strong>{{ sourceCount }}</strong
        ><span>{{ sourceCount === 1 ? "list source" : "list sources" }}</span>
      </div>
    </div>
    <div class="workspace-grid">
      <section class="catalog-section" aria-label="Your catalogs">
        <div class="section-title">
          <h2>
            Your lists <span>{{ state.lists.length }}</span>
          </h2>
          <span>{{
            sortBy === "addon" ? "In addon order" : "Sorting changes this view only"
          }}</span>
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
              <span class="filter-count">{{ sourceCounts[item.id] }}</span>
            </button>
          </div>
        </div>
        <div v-if="state.lists.length" class="collection-controls">
          <label class="search-input"
            ><AppIcon name="search" :size="17" /><input
              v-model="search"
              aria-label="Search your lists"
              placeholder="Search lists, sources, or categories…"
              type="search"
              @keydown.esc="search = ''"
          /></label>
          <label class="sort-control" for="list-sort"
            >Sort by
            <select id="list-sort" v-model="sortBy">
              <option value="addon">Addon order</option>
              <option value="name">Name A–Z</option>
              <option value="titles">Most titles</option>
            </select>
          </label>
        </div>
        <div v-if="state.lists.length" class="collection-results">
          <p role="status" aria-live="polite" aria-atomic="true">
            {{
              hasFilters
                ? `${visibleLists.length} of ${state.lists.length} lists`
                : `${state.lists.length} ${state.lists.length === 1 ? "list" : "lists"}`
            }}
            <span v-if="!canReorder && visibleLists.length">
              Reordering is available in unfiltered addon order.</span
            >
          </p>
          <button v-if="hasFilters" class="text-button" @click="clearFilters">
            Clear filters
          </button>
        </div>
        <div v-if="state.lists.length && visibleLists.length" class="catalog-list">
          <CatalogCard
            v-for="list in visibleLists"
            :key="`${catalogId(list)}|${list.categoryName}`"
            :list="list"
            :busy="busy"
            :index="state.lists.indexOf(list)"
            :total="state.lists.length"
            :reorderable="canReorder"
            @preview="showPreview(list)"
            @edit="openEdit(list)"
            @refresh="refresh(list)"
            @move="(direction) => library.moveList(list, direction)"
          />
        </div>
        <div v-else-if="state.lists.length" class="empty-state">
          <AppIcon name="search" :size="32" />
          <h3>
            {{
              search.trim()
                ? "No matching lists"
                : `No ${filters.find((item) => item.id === filter)?.label} lists yet`
            }}
          </h3>
          <p>
            {{
              search.trim()
                ? `Nothing matches “${search.trim()}”. Try another name, source, or category.`
                : "Add a list from this source, or return to your full collection."
            }}
          </p>
          <button
            v-if="filter !== 'all' && !search.trim()"
            class="button button-primary"
            @click="addFromCurrentSource"
          >
            <AppIcon name="plus" :size="17" />Add
            {{ filters.find((item) => item.id === filter)?.label }} list
          </button>
          <button class="button button-secondary" @click="clearFilters">
            Show all lists
          </button>
        </div>
        <div v-else class="empty-state first-list">
          <div class="empty-art">
            <CoverArt tone="amber" /><CoverArt tone="blue" /><CoverArt tone="green" />
          </div>
          <h3>Add your first list</h3>
          <p>
            Paste a public MDBList or TMDB link, or import your WeTrakr or IMDb export.
            Then install your collection in Stremio or Nuvio.
          </p>
          <button class="button button-primary" @click="openAdd()">
            <AppIcon name="plus" :size="17" />Add your first list</button
          ><button class="text-button" @click="openAdd('trakt')">
            Have an old Trakt snapshot?
          </button>
        </div>
        <div v-if="state.lists.length" class="collection-note">
          <AppIcon name="shield" :size="15" /><span
            >Stored in your database. A failed refresh never replaces a saved
            snapshot.</span
          >
        </div>
      </section>
      <aside class="workspace-aside">
        <section class="install-panel">
          <div class="panel-icon"><AppIcon name="play" :size="22" /></div>
          <h2>Browse in your app</h2>
          <p>Install your saved lists in Stremio or Nuvio with one private link.</p>
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
          <h3>Add from a source</h3>
          <p>Import a public link or a file export.</p>
          <button :disabled="busy" @click="openAdd('mdblist')">
            <span class="source-logo mdb-logo">m<span>db</span></span
            ><span
              ><strong>MDBList</strong><small>Lists for every kind of mood</small></span
            ><AppIcon name="plus" :size="17" /></button
          ><button :disabled="busy" @click="openAdd('tmdb')">
            <span class="source-logo tmdb-logo">tm<br />db</span
            ><span><strong>TMDB</strong><small>Discover something different</small></span
            ><AppIcon name="plus" :size="17" />
          </button>
          <button :disabled="busy" @click="openExport('wetrakr')">
            <span class="source-logo wetrakr-logo">w</span>
            <span
              ><strong>WeTrakr</strong
              ><small>Cache lists from your ZIP export</small></span
            >
            <AppIcon name="plus" :size="17" />
          </button>
          <button :disabled="busy" @click="openExport('imdb')">
            <span class="source-logo imdb-logo">IMDb</span>
            <span
              ><strong>IMDb</strong><small>Cache lists from your CSV export</small></span
            >
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
</template>
