<script setup lang="ts">
withDefaults(defineProps<{ name: string; size?: number }>(), { size: 20 });
const paths: Record<string, string[]> = {
  arrow: ["M5 12h14m-5-5 5 5-5 5"],
  plus: ["M12 5v14M5 12h14"],
  close: ["m6 6 12 12M18 6 6 18"],
  check: ["m5 12 4 4L19 6"],
  chevron: ["m8 5 7 7-7 7"],
  down: ["m6 9 6 6 6-6"],
  up: ["m6 15 6-6 6 6"],
  link: [
    "m10 13 4-4M8 16l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 1 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0",
  ],
  lock: ["M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5zM12 14v3"],
  database: [
    "M20 5c0 4-16 4-16 0s16-4 16 0v14c0 4-16 4-16 0V5M4 12c0 4 16 4 16 0",
  ],
  grid: ["M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"],
  film: ["M3 4h18v16H3zM7 4v16M17 4v16M3 9h4m-4 6h4m10-6h4m-4 6h4"],
  play: ["m8 4 12 8-12 8z"],
  copy: ["M9 9h12v12H9zM15 9V3H3v12h6"],
  external: ["M14 3h7v7m0-7L11 13M10 3H3v18h18v-7"],
  settings: ["M4 7h16M4 17h16M8 4v6M16 14v6"],
  search: ["M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0m-2 5 6 6"],
  refresh: [
    "M20 7V3m0 4h-4M4 17v4m0-4h4M5 8a8 8 0 0 1 15-1M4 17a8 8 0 0 0 15-1",
  ],
  shield: ["m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6z", "m8 12 3 3 5-6"],
  archive: ["M3 3h18v5H3zM5 8v13h14V8M9 12h6"],
  trash: ["M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"],
  eye: [
    "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12",
    "M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  ],
  help: [
    "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M9 8a3 3 0 0 1 6 0c0 2-3 2-3 5m0 3v.2",
  ],
  more: ["M5 12h.01M12 12h.01M19 12h.01"],
};
</script>
<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path
      v-for="(path, index) in paths[name] || paths.film"
      :key="index"
      :d="path"
    />
  </svg>
</template>
