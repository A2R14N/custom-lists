<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from "vue";
import AppIcon from "./AppIcon.vue";
import type { Catalog, Meta } from "../types/catalog";
const props = defineProps<{ list: Catalog; load: (list: Catalog) => Promise<Meta[]> }>();
const preview = ref<Meta[]>([]),
  previewLoading = ref(true),
  previewError = ref("");
let requestId = 0;
onMounted(loadPreview);
onBeforeUnmount(() => {
  requestId++;
});
async function loadPreview() {
  const request = ++requestId;
  preview.value = [];
  previewLoading.value = true;
  previewError.value = "";
  try {
    const titles = await props.load(props.list);
    if (request === requestId) preview.value = titles;
  } catch (error) {
    if (request === requestId)
      previewError.value =
        error instanceof Error ? error.message : "The preview couldn’t be loaded.";
  } finally {
    if (request === requestId) previewLoading.value = false;
  }
}
function failedPoster(meta: Meta) {
  meta.poster = undefined;
}
</script>

<template>
  <div>
    <div v-if="previewLoading" class="preview-loading" role="status">
      <span class="spinner" />Opening your saved titles…
    </div>
    <div v-else-if="previewError" class="preview-error">
      <div class="alert alert-error" role="alert">{{ previewError }}</div>
      <button class="button button-secondary" @click="loadPreview">Try again</button>
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
          {{ meta.releaseInfo || (meta.type === "series" ? "Series" : "Movie") }}
        </p>
      </article>
    </div>
    <p v-if="preview.length" class="field-hint preview-caption">
      Showing the first {{ preview.length }} saved titles. Open your addon to browse the
      full collection.
    </p>
  </div>
</template>
