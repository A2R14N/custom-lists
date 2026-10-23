<script setup lang="ts">
import AppIcon from "./AppIcon.vue";
withDefaults(defineProps<{ tone?: string; label?: string }>(), {
  tone: "blue",
  label: "",
});
</script>
<template>
  <div class="cover-art" :class="`cover-${tone}`" aria-hidden="true">
    <span class="cover-frame frame-back"></span
    ><span class="cover-frame frame-front"><AppIcon name="film" :size="34" /></span
    ><span v-if="label" class="cover-label">{{ label }}</span>
  </div>
</template>
