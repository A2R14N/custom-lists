import { useCatalogs } from "../../vue/src/composables/useCatalogs.ts";
import { base } from "./addon.js";

// Exercise the real Vue composable with the isolated test server's transport.
export function frontend() {
  const context = { fetch: (url, init) => fetch(base + url, init) };
  context.ui = useCatalogs({
    appUrl: base,
    fetch: (url, init) => context.fetch(url, init),
  });
  return context;
}
