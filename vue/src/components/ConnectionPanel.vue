<script setup lang="ts">
import { nextTick, ref } from "vue";
import AppIcon from "./AppIcon.vue";
import type { CatalogState } from "../types/catalog";
const props = defineProps<{ state: CatalogState; busy: boolean }>();
const emit = defineEmits<{ connect: []; restore: [url: string] }>();
const returning = ref(false),
  installUrl = ref(""),
  showToken = ref(false);
async function chooseConnection(useLink: boolean) {
  returning.value = useLink;
  props.state.error = "";
  await nextTick();
  document.getElementById(useLink ? "restore-url" : "redis-url")?.focus();
}
</script>
<template>
  <section class="connection-card" aria-labelledby="connect-heading">
    <h2 id="connect-heading">
      {{ returning ? "Welcome back" : "Connect your collection" }}
    </h2>
    <p class="connection-intro">
      {{
        returning
          ? "Paste your private install link to pick up where you left off."
          : "Use your own Upstash storage to save lists and bring back your existing collection."
      }}
    </p>
    <div class="connection-options" role="group" aria-label="How to connect">
      <button
        type="button"
        :aria-pressed="!returning"
        :disabled="busy"
        @click="chooseConnection(false)"
      >
        <AppIcon name="database" :size="16" />Upstash credentials
      </button>
      <button
        type="button"
        :aria-pressed="returning"
        :disabled="busy"
        @click="chooseConnection(true)"
      >
        <AppIcon name="link" :size="16" />Existing install link
      </button>
    </div>
    <div v-if="state.error" class="alert alert-error" role="alert">
      <AppIcon name="help" /><span>{{ state.error }}</span>
    </div>
    <form v-if="!returning" @submit.prevent="emit('connect')">
      <label class="field-label" for="redis-url">Upstash REST URL</label>
      <input
        id="redis-url"
        v-model.trim="state.upstashUrl"
        type="url"
        placeholder="https://your-database.upstash.io"
        autocomplete="off"
        :disabled="busy"
        required
        spellcheck="false"
        aria-describedby="redis-url-hint"
      />
      <p id="redis-url-hint" class="field-hint">
        Find this in your Upstash database’s REST connection details.
      </p>
      <label class="field-label" for="redis-token"
        >REST token <span>Read/write</span></label
      >
      <div class="input-with-action">
        <input
          id="redis-token"
          v-model.trim="state.upstashToken"
          :type="showToken ? 'text' : 'password'"
          placeholder="Paste your token"
          autocomplete="off"
          :disabled="busy"
          required
          spellcheck="false"
        /><button
          type="button"
          class="icon-button"
          :aria-label="showToken ? 'Hide token' : 'Show token'"
          :aria-pressed="showToken"
          @click="showToken = !showToken"
        >
          <AppIcon name="eye" :size="18" />
        </button>
      </div>
      <button
        class="button button-primary button-full connect-button"
        :disabled="busy || !state.upstashUrl || !state.upstashToken"
      >
        <span v-if="busy" class="spinner" />{{
          busy ? "Opening your collection…" : "Connect & continue"
        }}<AppIcon v-if="!busy" name="arrow" :size="18" />
      </button>
    </form>
    <form v-else @submit.prevent="emit('restore', installUrl)">
      <label class="field-label" for="restore-url">Your private install link</label>
      <input
        id="restore-url"
        v-model="installUrl"
        type="password"
        placeholder="https://…/manifest.json"
        autocomplete="off"
        :disabled="busy"
        required
      />
      <p class="field-hint">This link contains your credentials. Keep it private.</p>
      <button
        class="button button-primary button-full connect-button"
        :disabled="busy || !installUrl"
      >
        <span v-if="busy" class="spinner" />{{
          busy ? "Opening your collection…" : "Restore my collection"
        }}<AppIcon v-if="!busy" name="arrow" :size="18" />
      </button>
    </form>
    <div class="connection-reassurance">
      <AppIcon name="shield" :size="15" /><span
        >Connecting won’t change or delete your saved lists.</span
      >
    </div>
    <div class="connection-divider"></div>
    <details v-if="!returning" class="storage-help">
      <summary>
        New to Upstash?
        <span>Start here <AppIcon name="down" :size="14" /></span>
      </summary>
      <div>
        <p>
          Upstash is the personal storage space for your lists. Use a dedicated database
          for this addon.
        </p>
        <ol>
          <li>
            <a
              href="https://console.upstash.com/"
              target="_blank"
              rel="noopener noreferrer"
              >Create a Redis database <AppIcon name="external" :size="13"
            /></a>
          </li>
          <li>Open its connection details and choose <strong>REST</strong>.</li>
          <li>Copy the URL and read/write token into the fields above.</li>
        </ol>
        <p>Your provider’s storage and usage limits apply.</p>
      </div>
    </details>
  </section>
</template>
