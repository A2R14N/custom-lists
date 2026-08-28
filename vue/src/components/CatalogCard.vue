<script setup lang="ts">
import { computed } from "vue";
import { listLabel } from "../../../shared/lists.js";
import AppIcon from "./AppIcon.vue";
import CatalogCover from "./CatalogCover.vue";
import type { Catalog } from "../types/catalog";
const props = defineProps<{
  list: Catalog;
  busy: boolean;
  index: number;
  total: number;
}>();
const emit = defineEmits<{
  preview: [];
  edit: [];
  refresh: [];
  move: [direction: number];
}>();
const provider = computed(
  () =>
    ({ mdblist: "MDBList", tmdb: "TMDB", trakt: "Trakt archive", wetrakr: "WeTrakr", imdb: "IMDb" })[
      props.list.provider
    ],
);
const progress = computed(() =>
  props.list.progress?.total
    ? Math.min(
        100,
        (props.list.progress.processed / props.list.progress.total) * 100,
      )
    : null,
);
</script>
<template>
  <article
    class="catalog-card"
    :class="{ 'is-importing': list.status === 'importing' }"
  >
    <button
      class="catalog-art-button"
      :disabled="!list.cached || busy"
      :aria-label="`Preview ${listLabel(list)}`"
      @click="emit('preview')"
    >
      <CatalogCover
        :posters="list.coverPosters"
        :tone="
          list.provider === 'trakt'
            ? 'amber'
            : list.provider === 'tmdb'
              ? 'green'
              : 'blue'
        "
      /><span><AppIcon name="play" :size="18" /></span>
    </button>
    <div class="catalog-info">
      <div class="catalog-provider">
        <span class="provider-dot" :class="list.provider"></span>{{ provider
        }}<span v-if="list.provider === 'trakt'" class="archive-label"
          >PRESERVED</span
        >
      </div>
      <h3>{{ listLabel(list) }}</h3>
      <div class="catalog-meta">
        <span>{{
          list.categoryName === "movie"
            ? "Movies"
            : list.categoryName === "series"
              ? "Series"
              : list.categoryName
        }}</span
        ><span class="meta-dot">·</span
        ><span>{{
          list.cached
            ? `${list.itemCount.toLocaleString()} saved ${list.itemCount === 1 ? "title" : "titles"}`
            : "Not saved yet"
        }}</span>
      </div>
      <p v-if="['wetrakr', 'imdb'].includes(list.provider)" class="field-hint">Saved from export · upload a new export to update</p>
      <div
        v-if="list.status === 'importing'"
        class="import-state"
        role="status"
      >
        <div>
          <span class="spinner" />Saving
          {{ list.progress?.done || 0 }} titles<span
            v-if="list.progress?.total"
          >
            of {{ list.progress.total }}</span
          >…
        </div>
        <progress
          :value="progress ?? undefined"
          max="100"
          aria-label="List import progress"
        ></progress
        ><small>Keep this tab open until it’s done.</small>
      </div>
      <p v-if="list.error" class="inline-error" role="alert">
        {{ list.error }}
      </p>
      <p v-if="list.skipped" class="field-hint">
        {{ list.skipped }} entries were skipped (unsupported, missing IMDb ID, or duplicates).
      </p>
    </div>
    <div class="catalog-actions">
      <span
        v-if="list.cached && !list.error && list.status !== 'importing'"
        class="ready-label"
        ><span></span>Ready</span
      ><button
        v-if="list.provider !== 'trakt'"
        class="icon-button"
        :aria-label="`${['wetrakr', 'imdb'].includes(list.provider) ? 'Upload updated export for' : 'Refresh'} ${listLabel(list)}`"
        :title="['wetrakr', 'imdb'].includes(list.provider) ? 'Upload updated export' : `Refresh ${listLabel(list)}`"
        :disabled="busy"
        @click="emit('refresh')"
      >
        <AppIcon name="refresh" :size="17" /></button
      ><button
        class="icon-button"
        :aria-label="`Edit ${listLabel(list)}`"
        title="Edit list"
        :disabled="busy"
        @click="emit('edit')"
      >
        <AppIcon name="settings" :size="18" />
      </button>
      <div v-if="total > 1" class="reorder-buttons">
        <button
          class="icon-button"
          :aria-label="`Move ${listLabel(list)} up`"
          :disabled="busy || index === 0"
          @click="emit('move', -1)"
        >
          <AppIcon name="up" :size="14" /></button
        ><button
          class="icon-button"
          :aria-label="`Move ${listLabel(list)} down`"
          :disabled="busy || index === total - 1"
          @click="emit('move', 1)"
        >
          <AppIcon name="down" :size="14" />
        </button>
      </div>
    </div>
  </article>
</template>
