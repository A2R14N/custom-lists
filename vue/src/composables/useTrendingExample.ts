import { computed, ref } from "vue";

type Poster = { title: string; poster: string; url?: string };
const examples: Poster[] = [
  { title: "The Grand Budapest Hotel", poster: "/editorial/grand-budapest.jpg" },
  { title: "Interstellar", poster: "/editorial/interstellar.jpg" },
  { title: "Dune: Part Two", poster: "/editorial/dune.jpg" },
];

export function useTrendingExample(transport: typeof fetch = fetch) {
  const items = ref<Poster[]>([]);
  const stale = ref(false);
  const imageFailed = ref(false);
  const isTrending = computed(() => items.value.length >= 3 && !imageFailed.value);
  const posters = computed(() => (isTrending.value ? items.value.slice(0, 3) : examples));
  const heading = computed(() =>
    isTrending.value
      ? stale.value
        ? "Recently trending"
        : "Trending this week"
      : "The next movie night",
  );
  let controller: AbortController | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function cancel() {
    controller?.abort();
    clearTimeout(timer);
  }
  async function load() {
    cancel();
    const active = new AbortController();
    controller = active;
    timer = setTimeout(() => active.abort(), 5500);
    try {
      const response = await transport("/api/discovery/trending", {
        signal: active.signal,
        credentials: "omit",
        referrerPolicy: "no-referrer",
      });
      if (!response.ok) return;
      const feed = await response.json();
      if (active.signal.aborted || !Array.isArray(feed.items)) return;
      const valid = feed.items.filter(
        (item: Poster) =>
          item &&
          typeof item.title === "string" &&
          item.title.trim() &&
          item.title.length <= 200 &&
          typeof item.poster === "string" &&
          /^https:\/\/image\.tmdb\.org\/t\/p\/w500\/[\w-]+\.(jpg|png|webp)$/.test(
            item.poster,
          ) &&
          typeof item.url === "string" &&
          /^https:\/\/www\.themoviedb\.org\/movie\/\d+$/.test(item.url),
      );
      if (valid.length >= 3) {
        items.value = valid.slice(0, 3);
        stale.value = feed.stale === true;
        imageFailed.value = false;
      }
    } catch {
      // Discovery is optional; the bundled example remains usable offline.
    } finally {
      if (controller === active) clearTimeout(timer);
    }
  }
  return { posters, isTrending, heading, imageFailed, load, cancel };
}
