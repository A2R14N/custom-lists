import { computed, ref } from "vue";
import { catalogId, listLabel } from "../../../shared/lists.js";
import type { Catalog } from "../types/catalog";

export const orderKey = (list: Catalog) => `${catalogId(list)}|${list.categoryName}`;

export function useListOrdering(initial: Catalog[]) {
  const original = initial.map((list) => ({
    key: orderKey(list),
    hidden: !!list.hidden,
  }));
  const items = ref(initial.map((list) => ({ ...list })));
  const changed = computed(() =>
    items.value.some(
      (list, index) =>
        orderKey(list) !== original[index]?.key ||
        !!list.hidden !== original[index]?.hidden,
    ),
  );
  function move(from: number, to: number) {
    if (
      ![from, to].every(
        (index) => Number.isInteger(index) && index >= 0 && index < items.value.length,
      ) ||
      from === to
    )
      return;
    const next = [...items.value];
    next.splice(to, 0, ...next.splice(from, 1));
    items.value = next;
  }
  function sort(by: string) {
    if (by === "name")
      items.value = [...items.value].sort((a, b) =>
        listLabel(a).localeCompare(listLabel(b), undefined, {
          numeric: true,
          sensitivity: "base",
        }),
      );
    if (by === "titles")
      items.value = [...items.value].sort((a, b) => b.itemCount - a.itemCount);
  }
  return { items, changed, move, sort };
}
