<script setup lang="ts">
import { computed, ref, watch } from "vue";
import CoverArt from "./CoverArt.vue";

const props = withDefaults(defineProps<{ posters?: string[]; tone?: string }>(), {
  posters: () => [],
  tone: "blue",
});
const failed = ref<string[]>([]);
watch(() => props.posters, () => { failed.value = []; });
const visible = computed(() => props.posters.filter(url => !failed.value.includes(url)).slice(0, 3));
function onError(url: string) {
  if (!failed.value.includes(url)) failed.value = [...failed.value, url];
}
</script>

<template>
  <div v-if="visible.length" class="catalog-cover" :data-count="visible.length" aria-hidden="true">
    <img
      v-for="(poster, index) in visible"
      :key="poster"
      :src="poster"
      :data-slot="index"
      alt=""
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
  background: var(--input);
  border: 1px solid var(--line);
}
.catalog-cover img {
  position: absolute;
  width: 66%;
  height: 83%;
  top: 9%;
  object-fit: cover;
  background: var(--surface-raised);
  border: 1px solid #ffffff24;
  border-radius: 3px;
  box-shadow: 0 3px 8px #00000080;
}
.catalog-cover img[data-slot="0"] { left: 17%; z-index: 3; }
.catalog-cover img[data-slot="1"] { left: -12%; top: 15%; transform: rotate(-13deg); z-index: 1; }
.catalog-cover img[data-slot="2"] { right: -12%; top: 15%; transform: rotate(13deg); z-index: 2; }
.catalog-cover[data-count="1"] img {
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
  border-radius: inherit;
}
.catalog-cover[data-count="2"] img[data-slot="0"] { left: 28%; transform: rotate(6deg); }
.catalog-cover[data-count="2"] img[data-slot="1"] { left: 1%; transform: rotate(-10deg); }
</style>
