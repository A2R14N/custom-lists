import { computed, ref } from "vue";
import { listLabel } from "../../../shared/lists.js";
import { providerNames, providerFilters } from "../config/providers.ts";
import type { SourceFilter } from "../config/providers.ts";
import type { CatalogState } from "../types/catalog";

export function useCollectionFilters(state: CatalogState) {
  const filter = ref<SourceFilter>("all");
  const search = ref("");
  const category = ref("");
  const status = ref<"all" | "saved" | "attention" | "hidden">("all");
  const viewMode = ref<"grid" | "list">("grid");
  const categories = computed(() =>
    [...new Set(state.lists.map((list) => list.categoryName))].sort(),
  );
  const sortBy = ref<"addon" | "name" | "titles">("addon");
  const visibleLists = computed(() => {
    const query = search.value.toLowerCase().trim();
    const lists = state.lists.filter(
      (list) =>
        (filter.value === "all" || list.provider === filter.value) &&
        (!category.value || list.categoryName === category.value) &&
        (status.value === "all" ||
          (status.value === "hidden"
            ? !!list.hidden
            : status.value === "saved"
              ? list.cached && !list.error
              : !list.cached || !!list.error)) &&
        `${listLabel(list)} ${list.categoryName} ${list.username} ${providerNames[list.provider]}`
          .toLowerCase()
          .includes(query),
    );
    if (sortBy.value === "name")
      lists.sort((a, b) =>
        listLabel(a).localeCompare(listLabel(b), undefined, {
          numeric: true,
          sensitivity: "base",
        }),
      );
    if (sortBy.value === "titles") lists.sort((a, b) => b.itemCount - a.itemCount);
    return lists;
  });
  const sourceCounts = computed(() =>
    Object.fromEntries(
      providerFilters.map((item) => [
        item.id,
        item.id === "all"
          ? state.lists.length
          : state.lists.filter((list) => list.provider === item.id).length,
      ]),
    ),
  );
  const hasFilters = computed(
    () =>
      filter.value !== "all" ||
      !!search.value.trim() ||
      !!category.value ||
      status.value !== "all",
  );
  const canReorder = computed(() => sortBy.value === "addon" && !hasFilters.value);
  function clearFilters() {
    search.value = "";
    filter.value = "all";
    category.value = "";
    status.value = "all";
  }
  return {
    filter,
    search,
    category,
    status,
    viewMode,
    categories,
    sortBy,
    filters: providerFilters,
    visibleLists,
    sourceCounts,
    hasFilters,
    canReorder,
    clearFilters,
  };
}
