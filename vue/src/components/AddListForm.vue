<script setup lang="ts">
import { computed, ref, watch } from "vue";
import AppIcon from "./AppIcon.vue";
import type { CatalogLibrary } from "../composables/useCatalogs";
import { providerNames } from "../config/providers";
import type { Provider } from "../types/catalog";
const props = defineProps<{ library: CatalogLibrary; provider: Provider }>();
const { state, busy, parsed } = props.library;
const emit = defineEmits<{ complete: []; export: [provider: "wetrakr" | "imdb"] }>();
const method = ref<"link" | "file">("link");
const providerKey = ref("");
const customCategory = ref(false);
const detectedProvider = computed(() => parsed.value.list?.provider || props.provider);
const needsKey = computed(
  () =>
    parsed.value.list &&
    parsed.value.list.provider !== "trakt" &&
    !props.library.canImport(parsed.value.list),
);
const keyLabel = computed(() =>
  detectedProvider.value === "mdblist"
    ? "MDBList API key"
    : detectedProvider.value === "wetrakr-api"
      ? "WeTrakr app key"
      : "TMDB read access token",
);
const keyUrl = computed(() =>
  detectedProvider.value === "mdblist"
    ? "https://mdblist.com/preferences/#api"
    : detectedProvider.value === "wetrakr-api"
      ? "https://wetrakr.com/profile/settings/api"
      : "https://www.themoviedb.org/settings/api",
);
const placeholder = computed(() =>
  props.provider === "tmdb"
    ? "https://www.themoviedb.org/list/…"
    : props.provider === "wetrakr-api"
      ? "https://wetrakr.com/lists/…"
      : props.provider === "trakt"
        ? "https://trakt.tv/users/…/lists/…"
        : "https://mdblist.com/lists/…/…",
);
watch(detectedProvider, () => {
  providerKey.value = "";
});
async function submitList() {
  if (busy.value || !parsed.value.list) return;
  if (needsKey.value) {
    const settings = {
      mdblistApiKey: state.mdblistApiKey,
      tmdbAccessToken: state.tmdbAccessToken,
      wetrakrApiKey: state.wetrakrApiKey,
      cacheBuster: state.cacheBuster,
    };
    if (detectedProvider.value === "mdblist")
      settings.mdblistApiKey = providerKey.value.trim();
    else if (detectedProvider.value === "wetrakr-api")
      settings.wetrakrApiKey = providerKey.value.trim();
    else settings.tmdbAccessToken = providerKey.value.trim();
    if (!(await props.library.saveSettings(settings))) return;
  }
  await props.library.addList(() => emit("complete"));
}
</script>
<template>
  <div>
    <div class="import-methods" role="group" aria-label="Import method">
      <button :aria-pressed="method === 'link'" :disabled="busy" @click="method = 'link'">
        <AppIcon name="link" :size="16" />List URL</button
      ><button
        :aria-pressed="method === 'file'"
        :disabled="busy"
        @click="method = 'file'"
      >
        <AppIcon name="upload" :size="16" />Upload export
      </button>
    </div>
    <form v-if="method === 'link'" @submit.prevent="submitList">
      <label class="field-label" for="list-url">Public list URL</label>
      <div class="input-with-icon">
        <AppIcon name="link" :size="18" /><input
          id="list-url"
          v-model="state.listUrl"
          :placeholder="placeholder"
          autocomplete="off"
          spellcheck="false"
          :disabled="busy"
          required
        />
      </div>
      <p v-if="parsed.error" class="inline-error" role="alert">{{ parsed.error }}</p>
      <p v-else-if="parsed.list" class="field-hint success-text">
        <AppIcon name="check" :size="14" />{{ providerNames[parsed.list.provider] }} list
        recognized
      </p>
      <p v-else class="field-hint">
        MDBList, TMDB or WeTrakr. Saved Trakt links can reconnect an existing snapshot.
      </p>
      <div v-if="needsKey" class="inline-provider-setup">
        <div>
          <AppIcon name="lock" :size="17" /><strong
            >Connect {{ providerNames[detectedProvider] }}</strong
          >
        </div>
        <p v-if="detectedProvider === 'tmdb'">
          Use the long API read access token, not the v3 API key.
        </p>
        <p v-else-if="detectedProvider === 'wetrakr-api'">
          Use your own app key (client ID). Public lists only; private lists can be
          imported from an export.
        </p>
        <p v-else>Your key is saved in your database for future imports.</p>
        <label class="field-label" for="provider-key">{{ keyLabel }}</label
        ><input
          id="provider-key"
          v-model="providerKey"
          type="password"
          autocomplete="off"
          :disabled="busy"
          required
        /><a :href="keyUrl" target="_blank" rel="noopener noreferrer"
          >Get a key or token<AppIcon name="external" :size="13"
        /></a>
      </div>
      <div v-if="detectedProvider === 'trakt'" class="alert alert-info">
        <AppIcon name="archive" /><span
          >Reconnects titles already saved in your database. New Trakt imports are not
          supported.</span
        >
      </div>
      <details class="display-options">
        <summary>Display options<AppIcon name="down" :size="16" /></summary>
        <label class="field-label" for="list-name"
          >Display name <span>Optional</span></label
        ><input
          id="list-name"
          v-model="state.listName"
          placeholder="For example: Weekend movies"
          maxlength="120"
          :disabled="busy"
        /><label class="field-label" for="list-category">Category</label
        ><select
          v-if="!customCategory"
          id="list-category"
          v-model="state.category"
          :disabled="busy"
        >
          <option value="movie">Movies</option>
          <option value="series">Series</option>
          <option value="cartoon">Cartoons</option></select
        ><input
          v-else
          id="list-category"
          v-model="state.category"
          placeholder="Category name"
          :disabled="busy"
          required
        /><button
          type="button"
          class="text-button advanced-toggle"
          :disabled="busy"
          @click="
            customCategory = !customCategory;
            if (!customCategory) state.category = 'movie';
          "
        >
          {{ customCategory ? "Use a standard category" : "Use a custom category" }}
        </button>
      </details>
      <div class="dialog-footer">
        <p><AppIcon name="shield" :size="14" />Saved titles stay safe.</p>
        <button
          class="button button-primary"
          :disabled="busy || !parsed.list || (!!needsKey && !providerKey.trim())"
        >
          <span v-if="busy" class="spinner" />{{
            detectedProvider === "trakt" ? "Reconnect list" : "Import list"
          }}
        </button>
      </div>
    </form>
    <div v-else class="file-import-options file-import-picker">
      <h3>Bring an export you already have.</h3>
      <p>
        Files are read in your browser. Choose the lists to save in the next step. No
        provider key is required.
      </p>
      <div>
        <button
          class="button button-secondary"
          :disabled="busy"
          @click="emit('export', 'wetrakr')"
        >
          <AppIcon name="archive" :size="18" />WeTrakr ZIP or CSV</button
        ><button
          class="button button-secondary"
          :disabled="busy"
          @click="emit('export', 'imdb')"
        >
          <AppIcon name="film" :size="18" />IMDb CSV
        </button>
      </div>
    </div>
  </div>
</template>
