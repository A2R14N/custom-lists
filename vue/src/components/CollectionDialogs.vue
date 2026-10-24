<script setup lang="ts">
import AppIcon from "./AppIcon.vue";
import type { CatalogLibrary } from "../composables/useCatalogs";
import { computed, ref } from "vue";
import { listLabel } from "../../../shared/lists.js";
import BaseDialog from "./BaseDialog.vue";
import AddListForm from "./AddListForm.vue";
import SettingsForm from "./SettingsForm.vue";
import InstallOptions from "./InstallOptions.vue";
import EditListForm from "./EditListForm.vue";
import CatalogPreview from "./CatalogPreview.vue";
import ExportImport from "./ExportImport.vue";
import HelpContent from "./HelpContent.vue";
import ConnectionPanel from "./ConnectionPanel.vue";
import ListOrderEditor from "./ListOrderEditor.vue";
import { providerNames } from "../config/providers";
import type { Catalog, Provider } from "../types/catalog";
const props = defineProps<{ library: CatalogLibrary }>();
const library = props.library;
const { state, busy } = library;
type DialogKind =
  | "add"
  | "settings"
  | "install"
  | "edit"
  | "remove"
  | "preview"
  | "help"
  | "export"
  | "connect"
  | "restore"
  | "order";
const dialogKind = ref<DialogKind | null>(null);
const providerHint = ref<Provider>("mdblist"),
  exportProvider = ref<"wetrakr" | "imdb">("wetrakr"),
  exportSourceName = ref("");
const selectedList = ref<Catalog | null>(null);
const dialogTitle = computed(
  () =>
    ({
      add: "Add a list",
      order: "List order & visibility",
      connect: "Connect your storage",
      restore: "Open your collection",
      export: `Import ${exportProvider.value === "imdb" ? "IMDb" : "WeTrakr"} lists`,
      settings: "Settings & connections",
      install: "Install your collection",
      edit: "Edit list",
      remove: "Remove this list?",
      preview: selectedList.value ? listLabel(selectedList.value) : "List preview",
      help: "How Custom Lists works",
    })[dialogKind.value || "help"],
);
const dialogDescription = computed(
  () =>
    ({
      add: "Paste a public list link or import a file from your exports.",
      order: "Put your lists in order and choose which rows appear in your addon.",
      connect: "Your lists and settings live in your own Upstash database.",
      restore: "Use your database credentials or private install link.",
      export:
        "Choose lists from your export to save directly in your own Upstash database.",
      settings: "Saved in your Upstash database. Only you control them.",
      install: "Your saved lists, ready in your favorite app.",
      edit: "Change how this list appears in your addon.",
      remove: "Only its place in your addon will change.",
      preview: "A peek at the titles in your saved snapshot.",
      help: "Connect your storage, add lists, then install in Stremio or Nuvio.",
    })[dialogKind.value || "help"],
);
function openDialog(kind: DialogKind) {
  state.error = "";
  if (kind === "install") state.addonUrl = library.buildAddonUrl();
  dialogKind.value = kind;
}
function closeDialog() {
  dialogKind.value = null;
  selectedList.value = null;
  state.error = "";
}
function openAdd(provider: Provider = "mdblist") {
  if (busy.value) return;
  providerHint.value = provider;
  state.listUrl = "";
  state.listName = "";
  state.category = "movie";
  openDialog("add");
}
function openExport(provider: "wetrakr" | "imdb", sourceName = "") {
  exportProvider.value = provider;
  exportSourceName.value = sourceName;
  openDialog("export");
}
function openEdit(list: Catalog) {
  selectedList.value = list;
  openDialog("edit");
}
function openConnection(returning = false) {
  if (!busy.value) openDialog(returning ? "restore" : "connect");
}
async function connect() {
  if (await library.connect()) closeDialog();
}
async function restore(url: string) {
  if (await library.restoreFromUrl(url)) closeDialog();
}
function openRemove(list: Catalog) {
  selectedList.value = list;
  openDialog("remove");
}
function showPreview(list: Catalog) {
  selectedList.value = list;
  openDialog("preview");
}
async function refresh(list: Catalog) {
  if (list.provider === "wetrakr" || list.provider === "imdb") {
    openExport(list.provider, list.sourceName);
    return;
  }
  if (!library.canImport(list)) {
    openDialog("settings");
    state.error = "Save your " + providerNames[list.provider] + " key before refreshing.";
    return;
  }
  await library.runImport(list);
}
function disconnect() {
  if (!busy.value) {
    closeDialog();
    library.disconnect();
  }
}
function exportComplete(count: number) {
  closeDialog();
  state.message =
    count +
    " " +
    providerNames[exportProvider.value] +
    " " +
    (count === 1 ? "list" : "lists") +
    " imported.";
}
const isOpen = computed(() => dialogKind.value !== null);
defineExpose({
  isOpen,
  openDialog,
  openAdd,
  openConnection,
  openExport,
  openEdit,
  openRemove,
  showPreview,
  refresh,
});
</script>

<template>
  <BaseDialog
    :open="!!dialogKind"
    :title="dialogTitle"
    :description="dialogDescription"
    :busy="
      state.saving || state.connecting || (dialogKind === 'export' && state.importing)
    "
    :wide="dialogKind === 'preview' || dialogKind === 'order'"
    @close="closeDialog"
  >
    <div
      v-if="state.error && dialogKind !== 'connect' && dialogKind !== 'restore'"
      class="alert alert-error"
      role="alert"
    >
      <AppIcon name="help" /><span>{{ state.error }}</span>
    </div>
    <ConnectionPanel
      v-if="dialogKind === 'connect' || dialogKind === 'restore'"
      :key="dialogKind"
      :state="state"
      :busy="busy"
      :initial-mode="dialogKind === 'restore' ? 'link' : 'database'"
      @connect="connect"
      @restore="restore"
    />
    <ListOrderEditor
      v-else-if="dialogKind === 'order'"
      :library="library"
      @complete="closeDialog"
      @cancel="closeDialog"
    />
    <AddListForm
      v-else-if="dialogKind === 'add'"
      :library="library"
      :provider="providerHint"
      @complete="closeDialog"
      @export="openExport"
    />
    <ExportImport
      v-else-if="dialogKind === 'export'"
      :provider="exportProvider"
      :initial-name="exportSourceName"
      :busy="busy"
      :cache-list="library.cacheExport"
      @complete="exportComplete"
    />
    <SettingsForm
      v-else-if="dialogKind === 'settings'"
      :library="library"
      @complete="closeDialog"
      @disconnect="disconnect"
    />
    <InstallOptions v-else-if="dialogKind === 'install'" :library="library" />
    <EditListForm
      v-else-if="(dialogKind === 'edit' || dialogKind === 'remove') && selectedList"
      :library="library"
      :list="selectedList"
      :confirm-remove="dialogKind === 'remove'"
      @complete="closeDialog"
      @remove="openDialog('remove')"
      @keep="openDialog('edit')"
    />
    <CatalogPreview
      v-else-if="dialogKind === 'preview' && selectedList"
      :list="selectedList"
      :load="library.previewList"
    />
    <HelpContent v-else-if="dialogKind === 'help'" />
  </BaseDialog>
</template>
