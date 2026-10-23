<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from "vue";
import AppIcon from "./AppIcon.vue";
import CatalogCard from "./CatalogCard.vue";
import type { CatalogLibrary } from "../composables/useCatalogs";
import { useCollectionFilters } from "../composables/useCollectionFilters";
import { catalogId, listLabel } from "../../../shared/lists.js";
import { categoryLabel } from "../config/providers";
import type { Catalog, Provider } from "../types/catalog";
const props = defineProps<{ library: CatalogLibrary; dialogOpen: boolean }>();
const { state, busy, titleCount, refreshableLists } = props.library;
const {
  filter,
  search,
  sortBy,
  category,
  status,
  viewMode,
  categories,
  filters,
  visibleLists,
  hasFilters,
  canReorder,
  clearFilters,
} = useCollectionFilters(state);
const arranging = ref(false);
const dragged = ref<Catalog | null>(null);
const activeImport = computed(() =>
  state.lists.find((list) => list.status === "importing"),
);
const attentionCount = computed(
  () => state.lists.filter((list) => !list.cached || list.error).length,
);
const emit = defineEmits<{
  add: [provider?: Provider];
  export: [provider: "wetrakr" | "imdb", sourceName?: string];
  install: [];
  preview: [list: Catalog];
  edit: [list: Catalog];
  remove: [list: Catalog];
  refresh: [list: Catalog];
}>();
function arrange() {
  arranging.value = !arranging.value;
  if (arranging.value) {
    clearFilters();
    sortBy.value = "addon";
  }
}
function closeMenus(event: PointerEvent) {
  document.querySelectorAll<HTMLDetailsElement>(".catalog-menu[open]").forEach((menu) => {
    if (!menu.contains(event.target as Node)) menu.open = false;
  });
}
onMounted(() => document.addEventListener("pointerdown", closeMenus));
onBeforeUnmount(() => document.removeEventListener("pointerdown", closeMenus));
function startDrag(list: Catalog, event: DragEvent) {
  if (!arranging.value || !canReorder.value || busy.value) {
    event.preventDefault();
    return;
  }
  dragged.value = list;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", catalogId(list));
  }
}
async function dropOn(target: Catalog) {
  const source = dragged.value;
  dragged.value = null;
  if (source && source !== target && canReorder.value && arranging.value && !busy.value)
    await props.library.moveList(
      source,
      state.lists.indexOf(target) - state.lists.indexOf(source),
    );
}
</script>
<template>
  <div class="workspace content-width">
    <header class="workspace-heading">
      <div>
        <h1 tabindex="-1">Your collection</h1>
        <p v-if="state.lists.length">
          {{ state.lists.length }} {{ state.lists.length === 1 ? "list" : "lists" }} with
          {{ titleCount.toLocaleString() }} saved title entries.
        </p>
        <p v-else>Add a list, make it yours, then open it in your streaming app.</p>
      </div>
      <div class="workspace-actions">
        <button
          v-if="refreshableLists.length"
          class="button button-secondary"
          :disabled="busy"
          @click="library.refreshAll"
        >
          <AppIcon name="refresh" :size="17" />Refresh API lists</button
        ><button class="button button-primary" :disabled="busy" @click="emit('add')">
          <AppIcon name="plus" :size="18" />Add a list
        </button>
      </div>
    </header>
    <div v-if="state.error && !dialogOpen" class="alert alert-error" role="alert">
      <AppIcon name="help" /><span>{{ state.error }}</span
      ><button class="icon-button" aria-label="Dismiss error" @click="state.error = ''">
        <AppIcon name="close" :size="16" />
      </button>
    </div>
    <div v-if="activeImport" class="refresh-banner" role="status">
      <span class="spinner" />
      <div>
        <strong>Saving {{ listLabel(activeImport) }}</strong>
        <p v-if="state.refreshProgress">
          List {{ state.refreshProgress.done + 1 }} of {{ state.refreshProgress.total }}.
          {{ activeImport.progress?.processed || 0 }} entries processed. Keep this page
          open.
        </p>
        <p v-else>
          {{ activeImport.progress?.processed || 0 }} entries processed. Keep this page
          open until the import finishes.
        </p>
      </div>
      <button
        v-if="state.refreshingAll"
        class="text-button"
        :disabled="state.stopAfterCurrent"
        @click="library.stopRefresh"
      >
        {{
          state.stopAfterCurrent ? "Stopping after this list…" : "Stop after this list"
        }}
      </button>
    </div>
    <section v-if="state.lists.length" class="collection-section" aria-label="Your lists">
      <div class="collection-toolbar">
        <label class="collection-search"
          ><AppIcon name="search" :size="19" /><input
            v-model="search"
            type="search"
            aria-label="Search your lists"
            placeholder="Find a list…"
            @keydown.esc="search = ''" /></label
        ><label class="toolbar-select"
          ><span class="sr-only">Source</span
          ><select v-model="filter" aria-label="Filter by source">
            <option v-for="source in filters" :key="source.id" :value="source.id">
              {{ source.label === "All lists" ? "All sources" : source.label }}
            </option>
          </select></label
        ><label class="toolbar-select"
          ><span class="sr-only">Category</span
          ><select v-model="category" aria-label="Filter by category">
            <option value="">All categories</option>
            <option v-for="name in categories" :key="name" :value="name">
              {{ categoryLabel(name) }}
            </option>
          </select></label
        >
        <div class="view-switch" role="group" aria-label="Collection layout">
          <button
            :aria-pressed="viewMode === 'grid'"
            aria-label="Grid view"
            @click="viewMode = 'grid'"
          >
            <AppIcon name="grid" :size="17" /></button
          ><button
            :aria-pressed="viewMode === 'list'"
            aria-label="List view"
            @click="viewMode = 'list'"
          >
            <AppIcon name="list" :size="19" />
          </button>
        </div>
      </div>
      <div class="collection-subtoolbar">
        <div class="status-filters" role="group" aria-label="Filter by status">
          <button :aria-pressed="status === 'all'" @click="status = 'all'">
            All lists <span>{{ state.lists.length }}</span></button
          ><button :aria-pressed="status === 'saved'" @click="status = 'saved'">
            Saved</button
          ><button
            v-if="attentionCount"
            :aria-pressed="status === 'attention'"
            @click="status = 'attention'"
          >
            Needs attention <span>{{ attentionCount }}</span>
          </button>
        </div>
        <div class="collection-order">
          <label
            ><span class="sr-only">Sort lists</span
            ><select v-model="sortBy" aria-label="Sort lists">
              <option value="addon">Addon order</option>
              <option value="name">Name A–Z</option>
              <option value="titles">Most titles</option>
            </select></label
          ><button
            class="text-button"
            :class="{ 'arrange-active': arranging }"
            :disabled="busy"
            @click="arrange"
          >
            <AppIcon :name="arranging ? 'check' : 'settings'" :size="15" />{{
              arranging ? "Done arranging" : "Arrange"
            }}
          </button>
        </div>
      </div>
      <div v-if="arranging && canReorder" class="arrange-note">
        <AppIcon name="list" :size="17" /><span
          >Drag lists into place, or use the up and down buttons. This changes their order
          in your addon.</span
        >
      </div>
      <div v-if="hasFilters && visibleLists.length" class="filtered-results">
        <span role="status"
          >{{ visibleLists.length }} of {{ state.lists.length }} lists</span
        ><button class="text-button" @click="clearFilters">
          Clear filters<AppIcon name="close" :size="13" />
        </button>
      </div>
      <div
        v-if="visibleLists.length"
        class="catalog-collection"
        :class="{
          'layout-list': viewMode === 'list',
          'single-result': visibleLists.length === 1 && viewMode === 'grid',
          'is-arranging': arranging && canReorder,
        }"
      >
        <CatalogCard
          v-for="list in visibleLists"
          :key="`${catalogId(list)}|${list.categoryName}`"
          :list="list"
          :busy="busy"
          :index="state.lists.indexOf(list)"
          :total="state.lists.length"
          :reorderable="arranging && canReorder"
          :dragging="dragged === list"
          :draggable="arranging && canReorder && !busy"
          @dragstart="startDrag(list, $event)"
          @dragend="dragged = null"
          @dragover.prevent
          @drop.prevent="dropOn(list)"
          @preview="emit('preview', list)"
          @edit="emit('edit', list)"
          @remove="emit('remove', list)"
          @refresh="emit('refresh', list)"
          @move="(direction) => library.moveList(list, direction)"
        />
      </div>
      <div v-else class="empty-state">
        <span class="empty-icon"><AppIcon name="search" :size="28" /></span>
        <h2>No lists match</h2>
        <p>Try another name, source, or category.</p>
        <button class="button button-secondary" @click="clearFilters">
          Clear filters
        </button>
      </div>
      <footer class="collection-footnote">
        <span
          ><AppIcon name="shield" :size="15" />A failed refresh keeps your saved
          titles.</span
        ><button class="text-button" :disabled="busy" @click="emit('install')">
          Open install options<AppIcon name="chevron" :size="14" />
        </button>
      </footer>
    </section>
    <section v-else class="first-collection">
      <div class="empty-shelf" aria-hidden="true">
        <span></span><span></span><span></span>
      </div>
      <h2>A place for your watchlists.</h2>
      <p>Start with a public list or an export you already have.</p>
      <div class="empty-source-actions">
        <button class="button button-primary" @click="emit('add')">
          <AppIcon name="link" :size="17" />Add a list URL</button
        ><button class="button button-secondary" @click="emit('export', 'wetrakr')">
          <AppIcon name="upload" :size="17" />WeTrakr export</button
        ><button class="button button-secondary" @click="emit('export', 'imdb')">
          <AppIcon name="upload" :size="17" />IMDb CSV
        </button>
      </div>
      <button class="text-button" @click="emit('add', 'trakt')">
        Reconnect a saved Trakt list<AppIcon name="chevron" :size="14" />
      </button>
    </section>
  </div>
</template>
