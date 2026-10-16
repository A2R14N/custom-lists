<script setup lang="ts">
import AppIcon from "./AppIcon.vue";
import type { CatalogLibrary } from "../composables/useCatalogs";
import { computed, ref, watch } from "vue";
import { providerNames } from "../config/providers";
import type { Provider } from "../types/catalog";
const props = defineProps<{ library: CatalogLibrary; provider: Provider }>();
const { state, busy, parsed } = props.library;
const library = props.library;
const emit = defineEmits<{ complete: []; export: [provider: "wetrakr" | "imdb"] }>();
const providerHint = ref(props.provider),
  providerKey = ref(""),
  customCategory = ref(false);
const detectedProvider = computed(
  () => parsed.value.list?.provider || providerHint.value,
);
const needsKey = computed(
  () =>
    parsed.value.list &&
    parsed.value.list.provider !== "trakt" &&
    !library.canImport(parsed.value.list),
);
watch(detectedProvider, () => {
  providerKey.value = "";
});
const openExport = (provider: "wetrakr" | "imdb") => emit("export", provider);
async function submitList() {
  if (busy.value || !parsed.value.list) return;
  if (needsKey.value) {
    const settings = {
      mdblistApiKey: state.mdblistApiKey,
      tmdbAccessToken: state.tmdbAccessToken,
      cacheBuster: state.cacheBuster,
    };
    if (detectedProvider.value === "mdblist")
      settings.mdblistApiKey = providerKey.value.trim();
    else settings.tmdbAccessToken = providerKey.value.trim();
    if (!(await library.saveSettings(settings))) return;
  }
  await library.addList(() => emit("complete"));
}
</script>

<template>
  <form @submit.prevent="submitList">
    <div class="source-choice" aria-label="List source">
      <button
        v-for="provider in ['mdblist', 'tmdb', 'trakt'] as const"
        :key="provider"
        type="button"
        :class="{ selected: detectedProvider === provider }"
        :aria-pressed="detectedProvider === provider"
        :disabled="!!parsed.list || busy"
        @click="providerHint = provider"
      >
        <span class="provider-dot" :class="provider"></span>{{ providerNames[provider] }}
      </button>
    </div>
    <label class="field-label" for="list-url">Paste a list URL</label>
    <div class="input-with-icon">
      <AppIcon name="link" :size="18" /><input
        id="list-url"
        v-model="state.listUrl"
        :disabled="busy"
        :placeholder="
          providerHint === 'tmdb'
            ? 'https://www.themoviedb.org/list/…'
            : providerHint === 'trakt'
              ? 'https://trakt.tv/users/…/lists/…'
              : 'https://mdblist.com/lists/…/…'
        "
        autocomplete="off"
        spellcheck="false"
        required
      />
    </div>
    <p v-if="parsed.error" class="inline-error" role="alert">
      {{ parsed.error }}
    </p>
    <p v-else-if="parsed.list" class="field-hint success-text">
      <AppIcon name="check" :size="14" />{{ providerNames[parsed.list.provider] }}
      list recognized
    </p>
    <p v-else class="field-hint">We’ll recognize the source automatically.</p>
    <div v-if="needsKey" class="inline-provider-setup">
      <div><AppIcon name="lock" :size="18" /><strong>One quick connection</strong></div>
      <p>
        {{
          detectedProvider === "mdblist"
            ? "Add your MDBList API key. We’ll save it for your next import."
            : "Add your TMDB API Read Access Token—the long token, not the v3 API key."
        }}
      </p>
      <label class="field-label" for="provider-key">{{
        detectedProvider === "mdblist" ? "MDBList API key" : "TMDB Read Access Token"
      }}</label
      ><input
        id="provider-key"
        v-model="providerKey"
        type="password"
        autocomplete="off"
        :disabled="busy"
        required
      /><a
        :href="
          detectedProvider === 'mdblist'
            ? 'https://mdblist.com/preferences/#api'
            : 'https://www.themoviedb.org/settings/api'
        "
        target="_blank"
        rel="noopener noreferrer"
        >Where do I find this?<AppIcon name="external" :size="13"
      /></a>
    </div>
    <div v-if="detectedProvider === 'trakt'" class="alert alert-info">
      <AppIcon name="archive" /><span
        >Trakt links can reconnect a snapshot already in your database. They won’t fetch
        new titles from Trakt.</span
      >
    </div>
    <div class="form-row">
      <div>
        <label class="field-label" for="list-name"
          >Give it a name <span>Optional</span></label
        ><input
          id="list-name"
          v-model="state.listName"
          placeholder="My weekend watchlist"
          maxlength="120"
          :disabled="busy"
        />
      </div>
      <div>
        <label class="field-label" for="list-category">Show under</label
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
          placeholder="Custom category"
          :disabled="busy"
          required
        />
      </div>
    </div>
    <button
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
    <div class="file-import-options">
      <h3>Import a file instead</h3>
      <p>No provider API key needed.</p>
      <div>
        <button
          type="button"
          class="button button-secondary"
          :disabled="busy"
          @click="openExport('wetrakr')"
        >
          <AppIcon name="archive" :size="17" />WeTrakr ZIP / CSV
        </button>
        <button
          type="button"
          class="button button-secondary"
          :disabled="busy"
          @click="openExport('imdb')"
        >
          <AppIcon name="film" :size="17" />IMDb CSV
        </button>
      </div>
    </div>
    <div class="dialog-footer">
      <p><AppIcon name="shield" :size="14" />Existing snapshots stay safe.</p>
      <button
        class="button button-primary"
        :disabled="busy || !parsed.list || (!!needsKey && !providerKey.trim())"
      >
        <span v-if="busy" class="spinner" />{{
          detectedProvider === "trakt" ? "Reconnect snapshot" : "Add to my collection"
        }}<AppIcon v-if="!busy" name="arrow" :size="16" />
      </button>
    </div>
  </form>
</template>
