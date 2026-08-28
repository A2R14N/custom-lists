<script setup lang="ts">
withDefaults(defineProps<{ tone?: string; label?: string }>(), {
  tone: "blue",
  label: "",
});
</script>
<template>
  <div class="cover-art" :class="`cover-${tone}`" aria-hidden="true">
    <svg viewBox="0 0 280 340" preserveAspectRatio="xMidYMid slice">
      <circle class="cover-sun" cx="185" cy="98" r="47" />
      <path
        class="cover-ridge-back"
        d="M-30 244 78 118 164 222 230 165 310 274V370H-30Z"
      />
      <path
        class="cover-ridge-front"
        d="m-30 308 98-114 88 114 74-65 80 77v50H-30Z"
      />
      <path
        class="cover-line"
        d="M-30 314h340M-30 323h340M-30 332h340"
        fill="none"
        stroke-width="1"
      />
    </svg>
    <div v-if="label" class="cover-caption">
      <span>A CUSTOM COLLECTION</span><strong>{{ label }}</strong
      ><span class="cover-caption-bottom">CURATED BY YOU <span>↗</span></span>
    </div>
  </div>
</template>
