<script setup lang="ts">
import AppIcon from "./AppIcon.vue";
import type { CatalogLibrary } from "../composables/useCatalogs";
import { computed, reactive } from "vue";
import type { Settings } from "../types/catalog";
const props = defineProps<{ library: CatalogLibrary }>();
const { state, busy } = props.library;
const drafts = reactive<Settings>({
  mdblistApiKey: state.mdblistApiKey,
  tmdbAccessToken: state.tmdbAccessToken,
  cacheBuster: state.cacheBuster,
});
const databaseName = computed(() => new URL(state.upstashUrl).hostname);
const emit = defineEmits<{ complete: []; disconnect: [] }>();
const disconnect = () => emit("disconnect");
async function saveSettings() {
  if (await props.library.saveSettings({ ...drafts })) emit("complete");
}
</script>

<template>
  <form @submit.prevent="saveSettings">
    <div class="settings-connection">
      <span class="panel-icon"><AppIcon name="database" /></span>
      <div>
        <strong>Upstash Redis</strong><small>{{ databaseName }}</small>
      </div>
      <span class="status-tag">Connected</span>
    </div>
    <div class="settings-divider"></div>
    <h3 class="form-section-heading">Your list sources</h3>
    <p class="field-hint">
      Keys are only needed to import or refresh lists. Saved titles keep working without
      them.
    </p>
    <label class="field-label" for="settings-mdb"
      >MDBList API key<a
        href="https://mdblist.com/preferences/#api"
        target="_blank"
        rel="noopener noreferrer"
        >Get key<AppIcon name="external" :size="12" /></a></label
    ><input
      id="settings-mdb"
      v-model="drafts.mdblistApiKey"
      type="password"
      autocomplete="off"
      placeholder="Optional · for MDBList imports"
      :disabled="busy"
    />
    <label class="field-label" for="settings-tmdb"
      >TMDB Read Access Token<a
        href="https://www.themoviedb.org/settings/api"
        target="_blank"
        rel="noopener noreferrer"
        >Get token<AppIcon name="external" :size="12" /></a></label
    ><input
      id="settings-tmdb"
      v-model="drafts.tmdbAccessToken"
      type="password"
      autocomplete="off"
      placeholder="Optional · the long bearer token"
      :disabled="busy"
    />
    <details class="advanced-settings">
      <summary>Advanced settings<AppIcon name="down" :size="15" /></summary>
      <label class="field-label" for="revision">Install link revision</label
      ><input
        id="revision"
        v-model="drafts.cacheBuster"
        placeholder="For example, 2"
        :disabled="busy"
      />
      <p class="field-hint">
        Changes your install link so a client can reload its manifest. Your saved
        snapshots stay the same. Reinstall using the new link afterward.
      </p>
    </details>
    <div class="dialog-footer">
      <button
        class="text-button danger-text"
        type="button"
        :disabled="busy"
        @click="disconnect"
      >
        Disconnect this session</button
      ><button class="button button-primary" :disabled="busy">
        <span v-if="state.saving" class="spinner" />Save settings
      </button>
    </div>
  </form>
</template>
