<script setup lang="ts">
import AppIcon from "./AppIcon.vue";
import type { CatalogState } from "../types/catalog";
defineProps<{ state: CatalogState; busy: boolean }>();
const emit = defineEmits<{ help: []; settings: []; install: []; start: [] }>();
</script>
<template>
  <header class="site-header">
    <div class="header-inner">
      <a href="#main" class="brand" aria-label="Custom Lists home"
        ><span class="brand-mark"><AppIcon name="layers" :size="26" /></span
        ><span>Custom Lists</span></a
      >
      <nav class="header-actions" aria-label="Main navigation">
        <template v-if="!state.connected"
          ><button class="text-button header-help" @click="emit('help')">
            How it works</button
          ><button class="button button-primary" :disabled="busy" @click="emit('start')">
            Connect storage
          </button></template
        ><template v-else
          ><span class="connection-pill"><span></span>Storage connected</span
          ><button
            class="button button-quiet"
            aria-label="Settings"
            :disabled="busy"
            @click="emit('settings')"
          >
            <AppIcon name="settings" :size="18" /><span>Settings</span></button
          ><button
            class="button button-primary header-install"
            :disabled="!state.lists.length || busy"
            @click="emit('install')"
          >
            <AppIcon name="play" :size="15" />Install addon
          </button></template
        >
      </nav>
    </div>
  </header>
</template>
