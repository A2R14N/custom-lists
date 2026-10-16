<script setup lang="ts">
import AppIcon from "./AppIcon.vue";
import type { CatalogState } from "../types/catalog";
defineProps<{ state: CatalogState; busy: boolean }>();
const emit = defineEmits<{ help: []; settings: []; install: [] }>();
</script>

<template>
  <header class="site-header">
    <div class="header-inner">
      <a
        href="/"
        class="brand"
        aria-label="Custom Lists home"
        @click="state.connected && $event.preventDefault()"
        ><span class="brand-mark"
          ><img
            src="/brand/custom-lists-mark-v1.png"
            width="40"
            height="40"
            alt=""
            aria-hidden="true" /></span
        ><span>Custom Lists<span class="brand-period">.</span></span></a
      >
      <div v-if="!state.connected" class="header-actions">
        <span class="header-caption">A better way to browse.</span
        ><button class="text-button" @click="emit('help')">
          How it works<AppIcon name="external" :size="14" />
        </button>
      </div>
      <div v-else class="header-actions">
        <span class="connection-pill"><span></span>Your storage is connected</span
        ><button
          class="button button-quiet"
          aria-label="Settings"
          :disabled="busy"
          @click="emit('settings')"
        >
          <AppIcon name="settings" :size="17" /><span>Settings</span></button
        ><button
          class="button button-dark header-install"
          :disabled="!state.lists.length || busy"
          @click="emit('install')"
        >
          Install addon<AppIcon name="arrow" :size="16" />
        </button>
      </div>
    </div>
  </header>
</template>
