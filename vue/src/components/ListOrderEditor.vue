<script setup lang="ts">
import { computed, ref } from "vue";
import AppIcon from "./AppIcon.vue";
import { listLabel } from "../../../shared/lists.js";
import { useListOrdering, orderKey } from "../composables/useListOrdering";
import { providerNames, categoryLabel } from "../config/providers";
import type { CatalogLibrary } from "../composables/useCatalogs";
const props = defineProps<{ library: CatalogLibrary }>();
const { state, busy } = props.library;
const { items, changed, move, sort } = useListOrdering(state.lists);
const emit = defineEmits<{ complete: []; cancel: [] }>();
const draggedKey = ref("");
const overKey = ref("");
const message = ref("");
const positions = ref<Record<string, string>>({});
const shown = computed(() => items.value.filter((list) => !list.hidden).length);
const pendingPosition = computed(() =>
  Object.entries(positions.value).some(([key, text]) => {
    const value = Number(text);
    return (
      !!text &&
      Number.isInteger(value) &&
      value >= 1 &&
      value <= items.value.length &&
      value !== items.value.findIndex((list) => orderKey(list) === key) + 1
    );
  }),
);
function moveRow(from: number, to: number) {
  if (busy.value || from === to) return;
  const label = listLabel(items.value[from]);
  move(from, to);
  message.value = `${label} moved to position ${to + 1}.`;
}
function position(key: string, event?: Event) {
  const input = event?.target as HTMLInputElement | undefined;
  const text = positions.value[key] ?? input?.value ?? "";
  const value = Number(text);
  const index = items.value.findIndex((list) => orderKey(list) === key);
  delete positions.value[key];
  if (
    text &&
    index >= 0 &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= items.value.length
  )
    moveRow(index, value - 1);
  else if (input) input.value = String(index + 1);
}
function drag(index: number, event: DragEvent) {
  if (busy.value) return event.preventDefault();
  draggedKey.value = orderKey(items.value[index]);
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", draggedKey.value);
  }
}
function clearDrag() {
  draggedKey.value = "";
  overKey.value = "";
}
function drop(index: number) {
  const from = items.value.findIndex((list) => orderKey(list) === draggedKey.value);
  if (from >= 0) moveRow(from, index);
  clearDrag();
}
async function save() {
  for (const key of Object.keys(positions.value)) position(key);
  if (await props.library.saveListLayout(items.value)) emit("complete");
}
</script>
<template>
  <form class="list-order-editor" @submit.prevent="save">
    <div class="order-tools">
      <label
        >Start with a sort<select
          aria-label="Sort addon order"
          :disabled="busy"
          value=""
          @change="
            sort(($event.target as HTMLSelectElement).value);
            ($event.target as HTMLSelectElement).value = '';
          "
        >
          <option value="" disabled>Choose a sort…</option>
          <option value="name">Name A–Z</option>
          <option value="titles">Most saved titles</option>
        </select></label
      >
      <p>{{ shown }} shown · {{ items.length - shown }} hidden</p>
    </div>
    <p class="order-instructions">
      Use the arrows or enter a position. On desktop, you can also drag a handle. Uncheck
      Show to hide a row in your addon.
    </p>
    <div class="order-columns" aria-hidden="true">
      <span>Position</span><span>List</span><span>Show</span><span>Move</span>
    </div>
    <ol class="order-list">
      <li
        v-for="(list, index) in items"
        :key="orderKey(list)"
        class="order-row"
        :class="{
          'order-row-hidden': list.hidden,
          'order-drop-target': overKey === orderKey(list) && draggedKey !== overKey,
        }"
        @dragover.prevent="overKey = orderKey(list)"
        @drop.prevent="drop(index)"
      >
        <button
          type="button"
          class="icon-button order-handle"
          :draggable="!busy"
          :disabled="busy"
          :aria-label="`Drag ${listLabel(list)} to reorder`"
          @dragstart="drag(index, $event)"
          @dragend="clearDrag"
        >
          <AppIcon name="grip" :size="17" />
        </button>
        <input
          class="order-position"
          type="number"
          inputmode="numeric"
          :min="1"
          :max="items.length"
          :value="positions[orderKey(list)] ?? index + 1"
          :disabled="busy"
          :aria-label="`Position of ${listLabel(list)}`"
          @input="positions[orderKey(list)] = ($event.target as HTMLInputElement).value"
          @blur="position(orderKey(list), $event)"
          @keydown.enter.prevent="position(orderKey(list), $event)"
        />
        <div class="order-title">
          <strong>{{ listLabel(list) }}</strong
          ><small
            >{{ providerNames[list.provider] }} · {{ categoryLabel(list.categoryName)
            }}<span v-if="list.hidden"> · Hidden</span></small
          >
        </div>
        <label class="order-visible"
          ><input
            type="checkbox"
            :checked="!list.hidden"
            :disabled="busy"
            :aria-label="`Show ${listLabel(list)} in addon`"
            @change="list.hidden = !($event.target as HTMLInputElement).checked"
        /></label>
        <div class="order-arrows">
          <button
            type="button"
            class="icon-button"
            :disabled="busy || index === 0"
            :aria-label="`Move ${listLabel(list)} up`"
            @click="moveRow(index, index - 1)"
          >
            <AppIcon name="up" :size="17" /></button
          ><button
            type="button"
            class="icon-button"
            :disabled="busy || index === items.length - 1"
            :aria-label="`Move ${listLabel(list)} down`"
            @click="moveRow(index, index + 1)"
          >
            <AppIcon name="down" :size="17" />
          </button>
        </div>
      </li>
    </ol>
    <p class="sr-only" role="status">{{ message }}</p>
    <details class="order-client-help">
      <summary>Seeing the old order in your app?</summary>
      <p>
        Refresh or reinstall the addon to reload its lists. In Nuvio TV, enable “Follow
        addon order” in Catalog Order if you previously set a custom order. Hidden rows
        leave the addon manifest; their saved titles stay in your database.
      </p>
    </details>
    <div class="dialog-footer order-footer">
      <button
        type="button"
        class="button button-secondary"
        :disabled="busy"
        @click="emit('cancel')"
      >
        Cancel</button
      ><button
        class="button button-primary"
        :disabled="busy || (!changed && !pendingPosition)"
      >
        <span v-if="busy" class="spinner" />Save order & visibility
      </button>
    </div>
  </form>
</template>
