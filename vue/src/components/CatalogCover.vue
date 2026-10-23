<script setup lang="ts">
import { computed, ref, watch } from "vue";
import CoverArt from "./CoverArt.vue";

const props = withDefaults(defineProps<{ posters?: string[]; tone?: string }>(), {
  posters: () => [],
  tone: "blue",
});
const failed = ref<string[]>([]);
watch(
  () => props.posters,
  () => {
    failed.value = [];
  },
);
const visible = computed(() =>
  props.posters.filter((url) => !failed.value.includes(url)).slice(0, 3),
);
function onError(url: string) {
  if (!failed.value.includes(url)) failed.value = [...failed.value, url];
}
</script>

<template>
  <div
    v-if="visible.length"
    class="catalog-cover"
    :data-count="visible.length"
    aria-hidden="true"
  >
    <img
      v-for="(poster, index) in visible"
      :key="poster"
      :src="poster"
      :data-slot="index"
      alt=""
      :draggable="false"
      loading="lazy"
      decoding="async"
      referrerpolicy="no-referrer"
      @error="onError(poster)"
    />
  </div>
  <CoverArt v-else :tone="tone" />
</template>

<style scoped>
.catalog-cover {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  isolation: isolate;
  border-radius: inherit;
  background: var(--surface-hover);
  display: flex;
}
.catalog-cover img {
  width: 35%;
  min-width: 0;
  height: 100%;
  object-fit: cover;
  object-position: center 24%;
  background: var(--surface-hover);
}
.catalog-cover img[data-slot="0"] {
  width: 42%;
}
.catalog-cover img[data-slot="1"] {
  width: 31%;
}
.catalog-cover img[data-slot="2"] {
  width: 27%;
}
.catalog-cover[data-count="1"] img {
  width: 100%;
}
.catalog-cover[data-count="2"] img {
  width: 50%;
}
</style>
