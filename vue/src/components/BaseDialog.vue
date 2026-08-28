<script setup lang="ts">
import { ref, watch, onMounted, nextTick } from "vue";
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
async function sync() {
  await nextTick();
  if (props.open && !dialog.value?.open) dialog.value?.showModal();
  if (!props.open && dialog.value?.open) dialog.value.close();
}
watch(() => props.open, sync);
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
    aria-labelledby="dialog-title"
    :aria-describedby="description ? 'dialog-description' : undefined"
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
          <h2 id="dialog-title">{{ title }}</h2>
          <p v-if="description" id="dialog-description">{{ description }}</p>
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
