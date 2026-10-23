<script setup lang="ts">
import { computed, ref } from "vue";
import { listLabel } from "../../../shared/lists.js";
import { providerNames, categoryLabel } from "../config/providers";
import AppIcon from "./AppIcon.vue";
import CatalogCover from "./CatalogCover.vue";
import type { Catalog } from "../types/catalog";
const props = defineProps<{
  list: Catalog;
  busy: boolean;
  index: number;
  total: number;
  reorderable?: boolean;
  dragging?: boolean;
}>();
const emit = defineEmits<{
  preview: [];
  edit: [];
  remove: [];
  refresh: [];
  move: [direction: number];
}>();
const menu = ref<HTMLDetailsElement>();
const fromFile = computed(() => ["wetrakr", "imdb"].includes(props.list.provider));
const progress = computed(() =>
  props.list.progress?.total
    ? Math.min(100, (props.list.progress.processed / props.list.progress.total) * 100)
    : null,
);
function action(kind: "edit" | "remove" | "refresh") {
  if (menu.value) menu.value.open = false;
  if (kind === "edit") emit("edit");
  else if (kind === "remove") emit("remove");
  else emit("refresh");
}
</script>
<template>
  <article
    class="catalog-card"
    :class="{
      'is-importing': list.status === 'importing',
      'is-dragging': dragging,
      'has-error': !!list.error,
    }"
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
          list.provider === 'tmdb'
            ? 'green'
            : list.provider === 'trakt'
              ? 'amber'
              : 'blue'
        "
      /><span class="catalog-art-cta"
        ><AppIcon name="play" :size="14" />Preview titles</span
      ><span v-if="reorderable" class="catalog-position">{{ index + 1 }}</span>
    </button>
    <div class="catalog-body">
      <div class="catalog-title-row">
        <div>
          <span class="catalog-provider"
            ><span class="provider-dot" :class="list.provider"></span
            >{{ providerNames[list.provider] }}</span
          >
          <h2>
            <button :disabled="!list.cached || busy" @click="emit('preview')">
              {{ listLabel(list) }}
            </button>
          </h2>
        </div>
        <details
          ref="menu"
          class="catalog-menu"
          @keydown.esc="menu && (menu.open = false)"
        >
          <summary class="icon-button" :aria-label="`Actions for ${listLabel(list)}`">
            <AppIcon name="more" :size="20" />
          </summary>
          <div class="catalog-menu-panel">
            <button :disabled="busy" @click="action('edit')">
              <AppIcon name="settings" :size="16" />Edit list</button
            ><button
              v-if="list.provider !== 'trakt'"
              :disabled="busy"
              @click="action('refresh')"
            >
              <AppIcon :name="fromFile ? 'upload' : 'refresh'" :size="16" />{{
                fromFile ? "Upload updated export" : "Refresh list"
              }}</button
            ><button class="danger-text" :disabled="busy" @click="action('remove')">
              <AppIcon name="trash" :size="16" />Remove from addon
            </button>
          </div>
        </details>
      </div>
      <p class="catalog-meta">
        {{ categoryLabel(list.categoryName) }}<span></span
        >{{ list.itemCount.toLocaleString() }} saved
        {{ list.itemCount === 1 ? "title" : "titles" }}
      </p>
      <div v-if="list.status === 'importing'" class="import-state" role="status">
        <span class="spinner" />Saving {{ list.progress?.done || 0 }} titles…<progress
          :value="progress ?? undefined"
          max="100"
          aria-label="Import progress"
        ></progress>
      </div>
      <p v-if="list.error" class="inline-error" role="alert">{{ list.error }}</p>
      <p v-if="list.skipped" class="field-hint">
        {{ list.skipped }} unsupported, missing-ID or duplicate entries skipped.
      </p>
      <div class="catalog-bottom">
        <span v-if="list.error" class="catalog-state state-error"
          ><AppIcon name="help" :size="13" />Refresh failed</span
        ><span v-else-if="list.status === 'importing'" class="catalog-state"
          >Importing</span
        ><span v-else-if="!list.cached" class="catalog-state state-pending"
          >Not imported</span
        ><span v-else class="catalog-state state-ready"
          ><AppIcon
            :name="list.provider === 'trakt' ? 'archive' : 'check'"
            :size="13"
          />{{
            list.provider === "trakt"
              ? "Preserved"
              : fromFile
                ? "Saved from export"
                : "Saved"
          }}</span
        >
        <div v-if="reorderable" class="reorder-buttons">
          <button
            class="icon-button"
            :disabled="busy || index === 0"
            :aria-label="`Move ${listLabel(list)} up`"
            @click="emit('move', -1)"
          >
            <AppIcon name="up" :size="16" /></button
          ><button
            class="icon-button"
            :disabled="busy || index === total - 1"
            :aria-label="`Move ${listLabel(list)} down`"
            @click="emit('move', 1)"
          >
            <AppIcon name="down" :size="16" />
          </button>
        </div>
        <button
          v-else-if="list.provider !== 'trakt'"
          class="text-button catalog-refresh"
          :disabled="busy"
          :aria-label="`${fromFile ? 'Upload updated export for' : list.error ? 'Retry refresh for' : 'Refresh'} ${listLabel(list)}`"
          @click="emit('refresh')"
        >
          <AppIcon :name="fromFile ? 'upload' : 'refresh'" :size="13" />{{
            fromFile ? "Update export" : list.error ? "Try again" : "Refresh"
          }}
        </button>
      </div>
    </div>
  </article>
</template>
