import { computed, ref } from "vue";
import { listLabel } from "../../../shared/lists.js";
import { providerNames, providerFilters } from "../config/providers.ts";
import type { SourceFilter } from "../config/providers.ts";
import type { CatalogState } from "../types/catalog";

export function useCollectionFilters(state: CatalogState) {
  const filter = ref<SourceFilter>("all");
  const search = ref("");
  const sortBy = ref<"addon" | "name" | "titles">("addon");
  const visibleLists = computed(() => {
    const query = search.value.toLowerCase().trim();
    const lists = state.lists.filter(
      (list) =>
        (filter.value === "all" || list.provider === filter.value) &&
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
  const hasFilters = computed(() => filter.value !== "all" || !!search.value.trim());
  const canReorder = computed(() => sortBy.value === "addon" && !hasFilters.value);
  function clearFilters() {
    search.value = "";
    filter.value = "all";
  }
  return {
    filter,
    search,
    sortBy,
    filters: providerFilters,
    visibleLists,
    sourceCounts,
    hasFilters,
    canReorder,
    clearFilters,
  };
}
