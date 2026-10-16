<script setup lang="ts">
import AppIcon from "./AppIcon.vue";
import type { CatalogLibrary } from "../composables/useCatalogs";
import { computed, ref, onBeforeUnmount } from "vue";
const props = defineProps<{ library: CatalogLibrary }>();
const { state, titleCount } = props.library;
const savedCount = computed(() => state.lists.filter((list) => list.cached).length);
const revealInstall = ref(false),
  copied = ref(false);
let copyTimer: ReturnType<typeof setTimeout>;
onBeforeUnmount(() => clearTimeout(copyTimer));
async function copyInstall() {
  try {
    await navigator.clipboard.writeText(state.addonUrl);
    copied.value = true;
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => {
      copied.value = false;
    }, 4000);
  } catch {
    state.error =
      "Clipboard access is unavailable. Reveal the link, then select and copy it.";
    revealInstall.value = true;
  }
}
function installStremio() {
  window.location.href = state.addonUrl.replace(/^https?:\/\//, "stremio://");
}
</script>

<template>
  <div>
    <div class="install-summary">
      <span class="summary-mark"><AppIcon name="check" :size="23" /></span>
      <div>
        <strong>Your collection is ready.</strong>
        <p>
          {{ savedCount }} saved {{ savedCount === 1 ? "list" : "lists" }} ·
          {{ titleCount.toLocaleString() }} title entries
        </p>
      </div>
    </div>
    <div v-if="savedCount < state.lists.length" class="alert alert-info">
      <AppIcon name="help" /><span
        >Some lists aren’t cached yet. They will appear empty until you import them.</span
      >
    </div>
    <button class="install-app-button" @click="installStremio">
      <span class="app-symbol stremio-symbol"><AppIcon name="play" /></span
      ><span
        ><strong>Open in Stremio</strong
        ><small>Install directly in the Stremio app</small></span
      ><AppIcon name="external" :size="19" />
    </button>
    <button class="install-app-button" @click="copyInstall">
      <span class="app-symbol nuvio-symbol">n</span
      ><span
        ><strong>{{ copied ? "Link copied" : "Copy link for Nuvio" }}</strong
        ><small>Paste it into Nuvio’s addon installer</small></span
      ><AppIcon :name="copied ? 'check' : 'copy'" :size="19" />
    </button>
    <div class="private-link-box">
      <label class="field-label" for="install-link"
        >Your private install link<button
          class="text-button"
          @click="revealInstall = !revealInstall"
        >
          {{ revealInstall ? "Hide" : "Reveal" }}
        </button></label
      >
      <div class="input-with-action">
        <input
          id="install-link"
          :type="revealInstall ? 'text' : 'password'"
          :value="state.addonUrl"
          readonly
          autocomplete="off"
        /><button
          class="icon-button"
          aria-label="Copy private install link"
          @click="copyInstall"
        >
          <AppIcon :name="copied ? 'check' : 'copy'" :size="17" />
        </button>
      </div>
    </div>
    <p v-if="copied" class="field-hint success-text" role="status">
      Copied. Keep this link private.
    </p>
    <div class="privacy-warning">
      <AppIcon name="lock" :size="18" />
      <p>
        <strong>Treat this link like a password.</strong> It contains recoverable access
        credentials for your database. Share the homepage with friends, never this link.
      </p>
    </div>
  </div>
</template>
