<script setup lang="ts">
import AppIcon from "./AppIcon.vue";
import type { CatalogLibrary } from "../composables/useCatalogs";
import { ref } from "vue";
import { listLabel } from "../../../shared/lists.js";
import type { Catalog } from "../types/catalog";
const props = defineProps<{
  library: CatalogLibrary;
  list: Catalog;
  confirmRemove: boolean;
}>();
const { busy, state } = props.library;
const selectedList = props.list;
const editName = ref(props.list.name || ""),
  editCategory = ref(props.list.categoryName);
const emit = defineEmits<{ complete: []; remove: []; keep: [] }>();
async function saveEdit() {
  if (await props.library.editList(props.list, editName.value, editCategory.value))
    emit("complete");
}
async function removeSelected() {
  if (await props.library.removeList(props.list)) emit("complete");
}
</script>

<template>
  <form v-if="!confirmRemove" @submit.prevent="saveEdit">
    <label class="field-label" for="edit-name">Display name</label
    ><input
      id="edit-name"
      v-model="editName"
      :placeholder="listLabel(selectedList)"
      maxlength="120"
      :disabled="busy"
    /><label class="field-label" for="edit-category">Category</label
    ><input
      id="edit-category"
      v-model="editCategory"
      list="category-options"
      :disabled="busy"
      required
    /><datalist id="category-options">
      <option value="movie" />
      <option value="series" />
      <option value="cartoon" />
    </datalist>
    <p class="field-hint">
      The source and cached titles stay unchanged. Clients may require a manifest reload
      to show edits.
    </p>
    <div class="dialog-footer">
      <button
        type="button"
        class="text-button danger-text"
        :disabled="busy"
        @click="emit('remove')"
      >
        <AppIcon name="trash" :size="16" />Remove list</button
      ><button class="button button-primary" :disabled="busy">
        <span v-if="state.saving" class="spinner" />Save changes
      </button>
    </div>
  </form>
  <div v-else>
    <div class="removal-summary">
      <AppIcon name="archive" :size="28" /><strong>{{ listLabel(selectedList) }}</strong>
      <p>
        The snapshot stays in your database. You can reconnect it later using the original
        list URL.
      </p>
    </div>
    <div class="dialog-footer">
      <button class="button button-secondary" :disabled="busy" @click="emit('keep')">
        Keep this list
      </button>
      <button class="button button-danger" :disabled="busy" @click="removeSelected">
        <span v-if="state.saving" class="spinner" />Remove from addon
      </button>
    </div>
  </div>
</template>
