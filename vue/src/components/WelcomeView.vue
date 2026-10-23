<script setup lang="ts">
import AppIcon from "./AppIcon.vue";
import { onMounted, onBeforeUnmount } from "vue";
import { useTrendingExample } from "../composables/useTrendingExample";

const { posters, isTrending, heading, imageFailed, load, cancel } = useTrendingExample();
onMounted(load);
onBeforeUnmount(cancel);
defineProps<{ busy: boolean }>();
const emit = defineEmits<{ start: [returning: boolean]; help: [] }>();
</script>
<template>
  <div class="welcome content-width">
    <section class="welcome-hero" aria-labelledby="welcome-title">
      <div class="welcome-copy">
        <div class="platform-label">
          <span class="platform-icon"><AppIcon name="play" :size="13" /></span>For Stremio
          and Nuvio
        </div>
        <h1 id="welcome-title" tabindex="-1">Your lists,<br />ready to watch.</h1>
        <p class="hero-description">
          Bring the movies and series you’ve collected into the apps you watch with. One
          collection, in your own storage.
        </p>
        <div class="hero-actions">
          <button
            class="button button-primary button-large"
            :disabled="busy"
            @click="emit('start', false)"
          >
            Set up my collection<AppIcon name="plus" :size="18" /></button
          ><button class="text-button" :disabled="busy" @click="emit('start', true)">
            I have an install link<AppIcon name="chevron" :size="15" />
          </button>
        </div>
        <p class="welcome-note">
          <AppIcon name="shield" :size="15" />Your database. Your saved titles.
        </p>
      </div>
      <div
        class="welcome-visual"
        :aria-label="`${heading}: ${posters.map((item) => item.title).join(', ')}`"
      >
        <div class="shelf-orbit" aria-hidden="true"></div>
        <div class="hero-posters">
          <img
            v-for="(item, index) in posters"
            :key="item.poster"
            class="hero-poster"
            :class="['poster-left', 'poster-center', 'poster-right'][index]"
            :src="item.poster"
            :alt="`${item.title} poster`"
            width="342"
            height="513"
            :fetchpriority="index === 1 ? 'high' : 'auto'"
            referrerpolicy="no-referrer"
            @error="imageFailed = true"
          />
        </div>
        <div class="shelf-caption">
          <span class="shelf-caption-icon"><AppIcon name="layers" :size="21" /></span>
          <div>
            <strong>{{ heading }}</strong
            ><span>{{
              isTrending
                ? "Movies getting attention on TMDB."
                : "Your favorites, together."
            }}</span>
          </div>
          <span v-if="!isTrending" class="shelf-ready"
            ><AppIcon name="check" :size="13" />Ready to browse</span
          >
        </div>
        <a
          v-if="isTrending"
          class="example-label"
          href="https://www.themoviedb.org/trending/movie/week"
          target="_blank"
          rel="noopener noreferrer"
          >Weekly movie trends · TMDB<AppIcon name="external" :size="10"
        /></a>
        <span v-else class="example-label">Example collection</span>
      </div>
    </section>
    <section class="source-strip" aria-label="Supported sources">
      <p>Bring your lists from</p>
      <div>
        <span class="wordmark-mdb">mdblist</span><span class="wordmark-tmdb">TMDB</span
        ><span class="wordmark-wetrakr">WeTrakr</span
        ><span class="wordmark-imdb">IMDb</span
        ><span class="wordmark-trakt">Trakt archives</span>
      </div>
    </section>
    <section id="how-it-works" class="welcome-guide" aria-labelledby="guide-heading">
      <div class="guide-intro">
        <h2 id="guide-heading">A short setup. A longer watchlist.</h2>
        <button class="text-button" @click="emit('help')">
          How it works<AppIcon name="chevron" :size="15" />
        </button>
      </div>
      <div class="guide-steps">
        <article>
          <span class="step-number">1</span>
          <div>
            <h3>Connect your storage</h3>
            <p>
              Use a dedicated Upstash database, or reopen your collection with your
              private install link.
            </p>
          </div>
        </article>
        <article>
          <span class="step-number">2</span>
          <div>
            <h3>Bring a list</h3>
            <p>
              Paste a public list URL or upload a WeTrakr or IMDb export. Choose how it
              appears in your addon.
            </p>
          </div>
        </article>
        <article>
          <span class="step-number">3</span>
          <div>
            <h3>Open your streaming app</h3>
            <p>
              Install once in Stremio or Nuvio. Refresh your lists here whenever you’re
              ready.
            </p>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>
