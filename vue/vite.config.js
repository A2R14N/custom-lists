import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  // Retain the browser support target used before the Vite upgrade.
  build: { target: ["es2020", "chrome87", "edge88", "firefox78", "safari14"] },
  server: {
    proxy: {
      "/api": "http://127.0.0.1:7700",
      // Serve metadata previews and install links through the backend in dev.
      "^/[^/]+/(catalog/|manifest\\.json$)": "http://127.0.0.1:7700",
    },
  },
});
