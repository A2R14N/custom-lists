<script setup lang="ts">
import AppIcon from "./AppIcon.vue";
const emit = defineEmits<{ help: [] }>();
</script>
<template>
  <footer class="site-footer content-width">
    <div class="footer-main">
      <div>
        <span class="footer-brand">Custom Lists</span>
        <p>Your collection, in your own storage.</p>
      </div>
      <div class="footer-links">
        <button @click="emit('help')">Help & privacy</button
        ><a
          href="https://github.com/A2R14N/custom-lists"
          target="_blank"
          rel="noopener noreferrer"
          >GitHub<AppIcon name="external" :size="13"
        /></a>
      </div>
    </div>
    <div class="tmdb-attribution">
      <img src="/tmdb-logo.svg" alt="TMDB" width="62" height="15" /><span
        >This product uses the TMDB API but is not endorsed or certified by TMDB.</span
      >
    </div>
  </footer>
</template>
