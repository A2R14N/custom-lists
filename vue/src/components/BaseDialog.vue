<script setup lang="ts">
import { ref, watch, onMounted, nextTick, useId } from "vue";
import AppIcon from "./AppIcon.vue";
const props = defineProps<{
  open: boolean;
  title: string;
  description?: string;
  busy?: boolean;
  wide?: boolean;
}>();
const emit = defineEmits<{ close: [] }>();
const dialog = ref<HTMLDialogElement>();
const titleId = `dialog-title-${useId()}`;
const descriptionId = `${titleId}-description`;
async function sync() {
  await nextTick();
  if (props.open && !dialog.value?.open) dialog.value?.showModal();
  if (!props.open && dialog.value?.open) dialog.value.close();
}
watch(() => props.open, sync);
watch(
  () => props.title,
  async () => {
    await nextTick();
    if (props.open && dialog.value?.open)
      dialog.value.querySelector<HTMLElement>(`[id="${titleId}"]`)?.focus();
  },
);
onMounted(sync);
function dismiss() {
  if (!props.busy) emit("close");
}
</script>
<template>
  <dialog
    ref="dialog"
    class="dialog"
    :class="{ 'dialog-wide': wide }"
    :aria-labelledby="titleId"
    :aria-describedby="description ? descriptionId : undefined"
    @cancel.prevent="dismiss"
    @close="emit('close')"
    @click="
      (event) => {
        if (event.target === dialog) dismiss();
      }
    "
  >
    <div class="dialog-content">
      <header class="dialog-heading">
        <div>
          <h2 :id="titleId" tabindex="-1">{{ title }}</h2>
          <p v-if="description" :id="descriptionId">{{ description }}</p>
        </div>
        <button
          class="icon-button"
          aria-label="Close dialog"
          :disabled="busy"
          @click="dismiss"
        >
          <AppIcon name="close" />
        </button>
      </header>
      <slot />
    </div>
  </dialog>
</template>
