<script setup lang="ts">
import { nextTick, onMounted, onBeforeUnmount, ref, watch } from "vue";
import AppIcon from "./components/AppIcon.vue";
import SiteHeader from "./components/SiteHeader.vue";
import SiteFooter from "./components/SiteFooter.vue";
import WelcomeView from "./components/WelcomeView.vue";
import CollectionWorkspace from "./components/CollectionWorkspace.vue";
import CollectionDialogs from "./components/CollectionDialogs.vue";
import { useCatalogs } from "./composables/useCatalogs";
const library = useCatalogs();
const { state, busy } = library;
const dialogs = ref<InstanceType<typeof CollectionDialogs>>();
let messageTimer: ReturnType<typeof setTimeout>;
watch(
  () => state.message,
  (value) => {
    clearTimeout(messageTimer);
    if (value)
      messageTimer = setTimeout(() => {
        state.message = "";
      }, 6500);
  },
);
watch(
  () => state.connected,
  async () => {
    await nextTick();
    document.querySelector<HTMLHeadingElement>("main h1")?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  },
);
onBeforeUnmount(() => clearTimeout(messageTimer));
onMounted(() => {
  const match = window.location.pathname.match(/^\/([^/]+)\/configure\/?$/);
  if (match) void library.restore(match[1]);
});
</script>
<template>
  <div class="site-shell">
    <a class="skip-link" href="#main">Skip to content</a>
    <SiteHeader
      :state="state"
      :busy="busy"
      @help="dialogs?.openDialog('help')"
      @settings="dialogs?.openDialog('settings')"
      @install="dialogs?.openDialog('install')"
      @start="dialogs?.openConnection(false)"
    />
    <main id="main">
      <WelcomeView
        v-if="!state.connected"
        :busy="busy"
        @start="dialogs?.openConnection"
        @help="dialogs?.openDialog('help')"
      />
      <CollectionWorkspace
        v-else
        :library="library"
        :dialog-open="dialogs?.isOpen ?? false"
        @add="dialogs?.openAdd"
        @export="dialogs?.openExport"
        @install="dialogs?.openDialog('install')"
        @preview="dialogs?.showPreview"
        @edit="dialogs?.openEdit"
        @refresh="dialogs?.refresh"
        @remove="dialogs?.openRemove"
      />
    </main>
    <SiteFooter @help="dialogs?.openDialog('help')" />
    <Transition name="toast"
      ><div v-if="state.message && state.connected" class="toast-message" role="status">
        <span class="toast-check"><AppIcon name="check" :size="15" /></span
        ><span>{{ state.message }}</span
        ><button
          class="icon-button"
          aria-label="Dismiss notification"
          @click="state.message = ''"
        >
          <AppIcon name="close" :size="16" />
        </button></div
    ></Transition>
    <CollectionDialogs ref="dialogs" :library="library" />
  </div>
</template>
