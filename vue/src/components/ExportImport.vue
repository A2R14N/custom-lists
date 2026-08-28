<script setup lang="ts">
import { computed, ref } from "vue";
import { readWeTrakrExport } from "../../../shared/wetrakr-file.js";
import { readImdbExport } from "../../../shared/imdb.js";
import { MAX_EXPORT_BYTES } from "../../../shared/wetrakr.js";
import AppIcon from "./AppIcon.vue";
import type { ExportList } from "../types/catalog";

const props = defineProps<{
  busy: boolean;
  provider: "wetrakr" | "imdb";
  initialName?: string;
  cacheList: (list: ExportList, category: string) => Promise<boolean>;
}>();
const emit = defineEmits<{ complete: [count: number] }>();
type Choice = ExportList & { selected: boolean; category: string; saved: boolean };
const sourceName = ref(props.initialName || "");
const label = computed(() => props.provider === "imdb" ? "IMDb" : "WeTrakr");
const choices = ref<Choice[]>([]), filename = ref(""), error = ref("");
const reading = ref(false), saving = ref(false), savingName = ref("");
const selected = computed(() => choices.value.filter(list => list.selected && !list.saved));
const locked = computed(() => props.busy || reading.value || saving.value);
const titleCount = computed(() => selected.value.reduce((sum, list) => sum + list.metas.length, 0));

async function chooseFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  choices.value = [];
  error.value = "";
  filename.value = "";
  if (!file) return;
  reading.value = true;
  try {
    if (file.size > MAX_EXPORT_BYTES) throw new Error("Choose an export smaller than 8 MB.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const lists = (props.provider === "imdb"
      ? [readImdbExport(bytes, file.name, "IMDb list")]
      : readWeTrakrExport(bytes, file.name)) as ExportList[];
    choices.value = lists.map(list => ({ ...list, selected: props.provider === "imdb" && list.metas.length > 0, saved: false,
      category: list.metas.length && list.metas.every(meta => meta.type === "series") ? "series" : "movie" }));
    filename.value = file.name;
  } catch (cause) { error.value = cause instanceof Error ? cause.message : "This export could not be read."; }
  finally { reading.value = false; }
}

async function saveSelected() {
  if (locked.value || !selected.value.length || (props.provider === "imdb" && !sourceName.value.trim())) return;
  const pending = [...selected.value];
  saving.value = true;
  let saved = 0;
  try {
    for (const list of pending) {
      savingName.value = list.sourceName;
      const payload = { ...list, provider: props.provider,
        sourceName: props.provider === "imdb" ? sourceName.value.trim() : list.sourceName };
      if (!(await props.cacheList(payload, list.category))) return;
      list.saved = true;
      list.selected = false;
      saved++;
    }
    emit("complete", saved);
  } finally { saving.value = false; savingName.value = ""; }
}
</script>

<template>
  <form class="export-import" @submit.prevent="saveSelected">
    <div class="alert alert-info">
      <AppIcon name="shield" />
      <span>Read locally, cache directly. Nothing is imported into another platform. No provider key needed.</span>
    </div>
    <label class="field-label" for="wetrakr-file">Choose your {{ label }} export</label>
    <input id="wetrakr-file" type="file" :accept="provider === 'imdb' ? '.csv' : '.zip,.csv'" :disabled="locked" @change="chooseFile" />
    <p class="field-hint">{{ provider === 'imdb' ? 'Select the original IMDb CSV. Up to 8 MB. Ratings, notes and other personal fields are ignored.' : 'Select the original ZIP or its lists.csv. Up to 8 MB. Notes and other files are ignored.' }}</p>
    <template v-if="provider === 'imdb'">
      <label class="field-label" for="imdb-list-name">List name</label>
      <input id="imdb-list-name" v-model="sourceName" placeholder="For example: Movies to watch" maxlength="120" required :disabled="locked" />
      <p class="field-hint">IMDb exports contain no list name or ID. Use a unique name for each list. Upload updated export fills this name in for you; using it again replaces the saved snapshot.</p>
    </template>
    <p v-if="reading" role="status">Reading your lists…</p>
    <p v-if="error" class="inline-error" role="alert">{{ error }}</p>
    <template v-if="choices.length">
      <div class="export-summary">
        <span>{{ choices.length }} {{ choices.length === 1 ? 'list' : 'lists' }} found <small>{{ filename }}</small></span>
        <button v-if="choices.length > 1" type="button" class="text-button" :disabled="locked" @click="choices.forEach(list => { list.selected = !list.saved && list.metas.length > 0; })">Select all</button>
      </div>
      <div class="export-choices">
        <div v-for="(list, index) in choices" :key="list.sourceName" class="export-choice">
          <label :for="`export-list-${index}`">
            <input :id="`export-list-${index}`" v-model="list.selected" type="checkbox" :disabled="locked || list.saved || !list.metas.length" />
            <span><strong>{{ provider === 'imdb' ? sourceName.trim() || 'IMDb list' : list.sourceName }}</strong>
              <small>{{ list.saved ? 'Cached successfully' : `${list.metas.length} titles ready · ${list.total} exported` }}</small>
              <small v-if="list.missingIds">{{ list.missingIds }} missing IMDb IDs</small>
              <small v-if="list.unsupported">{{ list.unsupported }} unsupported entries (such as episodes)</small>
              <small v-if="list.duplicates">{{ list.duplicates }} duplicate titles</small>
            </span>
          </label>
          <select v-model="list.category" :disabled="locked || list.saved" :aria-label="`Category for ${list.sourceName}`">
            <option value="movie">Movies</option><option value="series">Series</option><option value="cartoon">Cartoons</option>
          </select>
        </div>
      </div>
      <p class="field-hint">List order and available IDs are preserved for supported titles. Re-uploading the same source list name updates only its {{ label }} cache and keeps your saved display settings. Other providers’ caches are separate.</p>
      <p v-if="saving" class="field-hint" role="status">Caching {{ savingName }}… Keep this page open.</p>
    </template>
    <div class="dialog-footer">
      <p>{{ titleCount }} titles selected</p>
      <button class="button button-primary" :disabled="locked || !selected.length || (provider === 'imdb' && !sourceName.trim())">
        <span v-if="saving" class="spinner" />Cache selected lists<AppIcon v-if="!saving" name="arrow" :size="16" />
      </button>
    </div>
  </form>
</template>

<style scoped>
.export-summary { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin: 24px 0 12px; }
.export-summary small { display: block; color: #999; font-size: 11px; overflow-wrap: anywhere; }
.export-choices { display: grid; gap: 10px; max-height: 360px; overflow-y: auto; }
.export-choice { display: flex; align-items: center; gap: 12px; padding: 14px; border: 1px solid #333; border-radius: 12px; background: #151515; }
.export-choice label { display: flex; align-items: flex-start; flex: 1; gap: 12px; min-width: 0; cursor: pointer; }
.export-choice input[type="checkbox"] { width: 17px; height: 17px; min-height: 0; flex-shrink: 0; margin-top: 3px; accent-color: #db9a55; }
.export-choice strong { display: block; font-size: 13px; overflow-wrap: anywhere; }
.export-choice small { display: block; margin-top: 4px; color: #aaa; font-size: 11px; }
.export-choice select { width: 110px; flex-shrink: 0; padding: 9px; font-size: 12px; }
input[type="file"] { width: 100%; padding: 16px; border: 1px dashed #555; border-radius: 12px; background: #151515; color: #bbb; }
input[type="file"]::file-selector-button { margin-right: 12px; padding: 8px 12px; border: 1px solid #555; border-radius: 8px; background: #292929; color: #eee; cursor: pointer; }
@media (max-width: 480px) { .export-choice { flex-wrap: wrap; } .export-choice label { flex-basis: 100%; } .export-choice select { margin-left: 29px; } }
</style>
