<script setup lang="ts">
import AppIcon from "./AppIcon.vue";
import CoverArt from "./CoverArt.vue";
import ConnectionPanel from "./ConnectionPanel.vue";
import type { CatalogState } from "../types/catalog";
defineProps<{ state: CatalogState; busy: boolean }>();
const emit = defineEmits<{ connect: []; restore: [url: string]; help: [] }>();
</script>

<template>
  <div class="welcome-grid content-width">
    <section class="welcome-story">
      <div class="eyebrow"><AppIcon name="film" :size="16" /> For Stremio and Nuvio</div>
      <h1 tabindex="-1">Your lists.<br />Ready to browse.</h1>
      <p class="hero-description">
        Bring movie and series lists together in your streaming app. Import a link or an
        export, organize your collection, and choose what to watch next.
      </p>
      <div class="service-line">
        <span>MDBList</span><span class="service-separator">/</span><span>TMDB</span
        ><span class="service-separator">/</span><span>WeTrakr</span
        ><span class="service-separator">/</span>
        <span>IMDb</span>
      </div>
      <div
        class="collection-illustration"
        aria-label="Illustration of a personal collection"
      >
        <div class="illustration-heading">
          <span
            ><span class="window-dot"></span><span class="window-dot"></span
            ><span class="window-dot"></span></span
          ><span>A place for every watchlist</span><AppIcon name="grid" :size="14" />
        </div>
        <div class="sample-covers">
          <CoverArt tone="blue" label="The weekend edit" /><CoverArt
            tone="amber"
            label="A different perspective"
          /><CoverArt tone="green" label="Somewhere new" />
        </div>
        <div class="illustration-footer">
          <AppIcon name="check" :size="14" /> Your favorites. Ready when you are.<span
            >ILLUSTRATION</span
          >
        </div>
      </div>
    </section>
    <ConnectionPanel
      :state="state"
      :busy="busy"
      @connect="emit('connect')"
      @restore="(url) => emit('restore', url)"
    />
  </div>
  <section class="how-it-works content-width" aria-label="How it works">
    <div>
      <span class="feature-number">01</span>
      <h3>A space of your own</h3>
      <p>
        Your lists live in your personal Upstash database. No shared account, no shared
        collection.
      </p>
    </div>
    <div>
      <span class="feature-number">02</span>
      <h3>Bring your favorites</h3>
      <p>
        Paste an MDBList, TMDB or public WeTrakr link, or import a WeTrakr or IMDb export.
        Existing Trakt snapshots stay available.
      </p>
    </div>
    <div>
      <span class="feature-number">03</span>
      <h3>Less waiting. More watching.</h3>
      <p>
        Install once. Browse saved titles in your app, and refresh your lists whenever you
        choose.
      </p>
    </div>
  </section>
</template>
