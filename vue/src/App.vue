<template>
  <div class="app-shell">
    <div class="noise"></div>
    <div class="blob blob-1"></div>
    <div class="blob blob-2"></div>
    <div class="blob blob-3"></div>

    <div class="page-wrapper">
      <!-- LEFT PANEL -->
      <aside class="left-panel">
        <div class="brand">
          <div class="brand-icon" style="background: transparent; border: none; padding: 0;">
            <img src="/icon.png" alt="Stremio" class="brand-logo" style="width: 44px; height: 44px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.5);" />
          </div>
          <div>
            <h1 class="brand-title">Custom Lists</h1>
            <p class="brand-sub">for Stremio</p>
          </div>
        </div>

        <div class="divider"></div>

        <p class="brand-desc">
          Connect your Trakt.tv watchlists to Stremio. All config lives in your own Upstash Redis — the server stores nothing.
        </p>

        <div class="feature-list">
          <div class="feature-item">
            <div class="feature-icon-wrap">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </div>
            <div>
              <div class="feature-label">Zero Server Storage</div>
              <div class="feature-sub">Your credentials never touch our server</div>
            </div>
          </div>
          <div class="feature-item">
            <div class="feature-icon-wrap">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            </div>
            <div>
              <div class="feature-label">Live Cache Progress</div>
              <div class="feature-sub">Watch lists populate in real-time</div>
            </div>
          </div>
          <div class="feature-item">
            <div class="feature-icon-wrap">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            </div>
            <div>
              <div class="feature-label">Short Install URL</div>
              <div class="feature-sub">Clean, portable addon link</div>
            </div>
          </div>
          <div class="feature-item">
            <div class="feature-icon-wrap">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
            </div>
            <div>
              <div class="feature-label">Bring Your Own Keys</div>
              <div class="feature-sub">Trakt + Upstash, no shared quotas</div>
            </div>
          </div>
        </div>

        <div class="left-footer">
          <a href="https://github.com/A2R14N/stremio-custom-lists" target="_blank" rel="noopener" class="footer-link">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
            View on GitHub
          </a>
        </div>
      </aside>

      <!-- RIGHT PANEL -->
      <main class="right-panel">
        <div class="form-card">

          <!-- Step indicators -->
          <div class="steps-bar">
            <div class="step" :class="{ active: true, done: state.upstashValid }">
              <div class="step-num">{{ state.upstashValid ? '✓' : '1' }}</div>
              <span>Upstash</span>
            </div>
            <div class="step-line" :class="{ done: state.upstashValid }"></div>
            <div class="step" :class="{ active: state.upstashValid, done: state.upstashValid && state.traktClientId }">
              <div class="step-num">{{ state.upstashValid && state.traktClientId ? '✓' : '2' }}</div>
              <span>Trakt</span>
            </div>
            <div class="step-line" :class="{ done: state.upstashValid && state.traktClientId }"></div>
            <div class="step" :class="{ active: state.upstashValid && !!state.traktClientId, done: state.lists.length > 0 }">
              <div class="step-num">{{ state.lists.length > 0 ? '✓' : '3' }}</div>
              <span>Lists</span>
            </div>
            <div class="step-line" :class="{ done: state.lists.length > 0 }"></div>
            <div class="step" :class="{ active: state.lists.length > 0, done: !!state.addonUrl }">
              <div class="step-num">{{ state.addonUrl ? '✓' : '4' }}</div>
              <span>Install</span>
            </div>
          </div>

          <!-- SECTION: Upstash -->
          <section class="form-section">
            <div class="section-header">
              <div class="section-label">
                <span class="section-dot upstash-dot"></span>
                Upstash Redis
              </div>
              <div class="section-badges">
                <span class="badge badge-required">Required</span>
                <span v-if="state.upstashValid" class="badge badge-success">✓ Connected</span>
                <span v-if="state.upstashError" class="badge badge-error">✗ Failed</span>
              </div>
            </div>
            <p class="section-desc">
              Your lists and Trakt credentials are stored in your own Upstash Redis DB.
              <a href="https://console.upstash.com/" target="_blank" class="link">Create a free DB ↗</a>
            </p>

            <div class="field-grid">
              <div class="input-group">
                <label class="input-label">REST Endpoint URL</label>
                <input
                  type="text"
                  v-model="state.upstashUrl"
                  placeholder="https://xxxx.upstash.io"
                  class="styled-input"
                  :class="{ 'input-valid': state.upstashValid, 'input-error': state.upstashError }"
                  autocomplete="off"
                  @blur="validateUpstash"
                />
              </div>
              <div class="input-group">
                <label class="input-label">REST Token</label>
                <input
                  type="password"
                  v-model="state.upstashToken"
                  placeholder="AXxx..."
                  class="styled-input"
                  :class="{ 'input-valid': state.upstashValid, 'input-error': state.upstashError }"
                  autocomplete="off"
                  @blur="validateUpstash"
                />
              </div>
            </div>

            <button
              class="btn-secondary"
              :class="{ loading: state.upstashValidating }"
              :disabled="state.upstashValidating || !state.upstashUrl || !state.upstashToken"
              @click="validateUpstash"
            >
              <span v-if="state.upstashValidating" class="spinner"></span>
              <svg v-else xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              {{ state.upstashValidating ? 'Testing…' : 'Verify Connection' }}
            </button>
          </section>

          <template v-if="state.upstashValid">

            <!-- SECTION: Trakt -->
            <section class="form-section">
              <div class="section-header">
                <div class="section-label">
                  <span class="section-dot trakt-dot"></span>
                  Trakt API
                </div>
              </div>
              <div class="input-group">
                <label class="input-label">
                  Client ID
                  <a href="https://trakt.tv/oauth/applications" target="_blank" class="link link-sm">Get one free ↗</a>
                </label>
                <input
                  type="password"
                  v-model="state.traktClientId"
                  placeholder="Paste your Trakt Client ID…"
                  class="styled-input"
                  autocomplete="off"
                />
              </div>
            </section>

            <!-- SECTION: Add List -->
            <section class="form-section" v-if="state.traktClientId">
              <div class="section-header">
                <div class="section-label">
                  <span class="section-dot list-dot"></span>
                  Add a Trakt List
                </div>
              </div>

              <div class="input-group">
                <label class="input-label">Trakt List URL</label>
                <input
                  type="text"
                  v-model="state.traktListUrl"
                  @input="parseTraktUrl"
                  placeholder="https://trakt.tv/users/username/lists/list-name?sort=released,asc"
                  class="styled-input"
                />
              </div>

              <div class="parsed-tags" v-if="state.traktUsername && state.traktListId">
                <span class="tag tag-user">👤 {{ state.traktUsername }}</span>
                <span class="tag tag-list">📋 {{ state.traktListId }}</span>
                <span class="tag tag-sort" v-if="state.traktSort">🔃 {{ state.traktSort }}</span>
              </div>
              <p class="field-error" v-if="!state.traktUsername && state.traktListUrl">
                ⚠️ Couldn't parse that URL — check it's a valid Trakt list link.
              </p>

              <div class="add-row">
                <div class="input-group" style="flex:1">
                  <label class="input-label">Stremio Category</label>
                  <input
                    type="text"
                    v-model="state.traktCategory"
                    placeholder="movie, series, cartoon…"
                    class="styled-input"
                    @keyup.enter="addList"
                  />
                </div>
                <button
                  class="btn-add"
                  @click="addList"
                  :disabled="!state.traktUsername || !state.traktListId || !state.traktCategory"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Add List
                </button>
              </div>
            </section>

            <!-- SECTION: Active Lists -->
            <section class="form-section" v-if="state.lists.length > 0">
              <div class="section-header">
                <div class="section-label">
                  <span class="section-dot active-dot"></span>
                  Active Lists
                </div>
                <span class="count-badge">{{ state.lists.length }}</span>
              </div>

              <div class="lists-table">
                <div class="lists-header">
                  <span>List</span>
                  <span>Category</span>
                  <span>Cache</span>
                  <span></span>
                </div>
                <div v-for="(list, index) in state.lists" :key="index" class="lists-row">
                  <div class="list-path">
                    <span class="list-user">{{ list.username }}</span
                    ><span class="list-sep">/</span
                    ><span class="list-name">{{ list.listId }}</span>
                    <span class="list-sort" v-if="list.sort"> ·&nbsp;{{ list.sort }}</span>
                  </div>
                  <span class="category-pill">{{ list.categoryName }}</span>
                  <span class="cache-status" :class="'cache-' + list.status">
                    <span v-if="list.status === 'caching'" class="spinner spinner-xs"></span>
                    <template v-if="list.status === 'caching'">{{ list.progress.done }}&thinsp;/&thinsp;{{ list.progress.total }}</template>
                    <template v-if="list.status === 'cached'">✓ Cached</template>
                    <template v-if="list.status === 'pending'">Queued</template>
                    <template v-if="list.status === 'error'">✗ Error</template>
                  </span>
                  <button class="btn-remove" @click="removeList(index)" title="Remove">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              </div>
            </section>

            <!-- Cache Buster (collapsed / advanced) -->
            <section class="form-section form-section-slim" v-if="state.lists.length > 0">
              <details class="advanced-details">
                <summary class="advanced-summary">Advanced options</summary>
                <div class="input-group" style="margin-top:12px">
                  <label class="input-label">
                    Cache Buster
                    <span class="label-hint">Change to force Stremio to re-fetch the manifest (e.g. 1 → 2)</span>
                  </label>
                  <input type="text" v-model="state.cacheBuster" placeholder="e.g. 1" class="styled-input styled-input-sm" />
                </div>
              </details>
            </section>

            <!-- GENERATE -->
            <div class="generate-area" v-if="state.lists.length > 0 && state.traktClientId">
              <button
                class="btn-generate"
                @click="generateAddon"
                :disabled="state.generating"
              >
                <span v-if="state.generating" class="spinner"></span>
                <svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                {{ state.generating ? 'Saving config…' : 'Generate Install URL' }}
              </button>
            </div>

            <!-- OUTPUT -->
            <div class="output-card" v-if="state.addonUrl">
              <div class="output-header">
                <div class="output-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                </div>
                <span class="output-label">Install URL Ready</span>
              </div>
              <div class="output-url-row">
                <input type="text" :value="state.addonUrl" readonly class="output-input" />
                <button class="btn-copy" @click="copyUrl">
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  Copy
                </button>
              </div>
              <button class="btn-install" @click="installStremio">
                <img src="/icon.png" width="18" height="18" alt="" style="border-radius: 4px;" />
                Open in Stremio
              </button>
            </div>

          </template>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup>
import { reactive, onMounted } from 'vue';

const state = reactive({
  upstashUrl: '',
  upstashToken: '',
  upstashValid: false,
  upstashError: false,
  upstashValidating: false,
  traktClientId: '',
  cacheBuster: '',
  traktListUrl: '',
  traktUsername: '',
  traktListId: '',
  traktSort: '',
  traktCategory: '',
  lists: [],
  userId: null,
  addonUrl: '',
  generating: false,
});

onMounted(async () => {
  const path = window.location.pathname;
  const match = path.match(/^\/([^\/]+)\//);
  const urlUserId = match?.[1];
  if (urlUserId && urlUserId !== 'configure') {
    try {
      const res = await fetch(`/api/config/${urlUserId}`);
      if (res.ok) {
        const data = await res.json();
        state.upstashUrl = data.upstashUrl || '';
        state.upstashToken = data.upstashToken || '';
        state.traktClientId = data.traktClientId || '';
        state.lists = (data.lists || []).map(l => ({ ...l, status: 'cached', progress: { done: 0, total: 0 } }));
        state.upstashValid = true;
        state.userId = urlUserId;
        state.addonUrl = buildAddonUrl(urlUserId);
      }
    } catch (e) {
      console.error('Failed to load config:', e);
    }
  }
});

async function validateUpstash() {
  if (!state.upstashUrl || !state.upstashToken || state.upstashValidating) return;
  state.upstashValidating = true;
  state.upstashValid = false;
  state.upstashError = false;
  try {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        upstashUrl: state.upstashUrl.trim(),
        upstashToken: state.upstashToken.trim(),
        traktClientId: state.traktClientId || '',
        lists: state.lists.map(({ username, listId, sort, categoryName }) => ({ username, listId, sort, categoryName })),
      }),
    });
    if (res.ok) {
      const { userId } = await res.json();
      state.userId = userId;
      state.upstashValid = true;
    } else {
      state.upstashError = true;
    }
  } catch {
    state.upstashError = true;
  } finally {
    state.upstashValidating = false;
  }
}

function parseTraktUrl() {
  const urlStr = state.traktListUrl.trim();
  if (!urlStr) { state.traktUsername = ''; state.traktListId = ''; state.traktSort = ''; return; }
  try {
    const url = new URL(urlStr);
    if (!url.hostname.includes('trakt.tv')) return;
    const m = url.pathname.match(/\/users\/([^\/]+)\/lists\/([^\/]+)/i);
    if (m) { state.traktUsername = m[1]; state.traktListId = m[2]; }
    state.traktSort = url.searchParams.get('sort') || '';
  } catch {}
}

async function addList() {
  if (!state.traktUsername || !state.traktListId || !state.traktCategory) return;
  if (!state.userId) { await saveConfig(); if (!state.userId) return; }

  const listEntry = reactive({
    username: state.traktUsername.trim(),
    listId: state.traktListId.trim(),
    sort: state.traktSort.trim() || undefined,
    categoryName: state.traktCategory.trim().toLowerCase(),
    status: 'caching',
    progress: { done: 0, total: 0 },
  });

  state.lists.push(listEntry);
  state.traktListUrl = ''; state.traktUsername = ''; state.traktListId = ''; state.traktSort = ''; state.traktCategory = '';

  await saveConfig();
  cacheListSSE(listEntry, state.userId);
}

function cacheListSSE(listEntry, userId) {
  const idx = state.lists.indexOf(listEntry);
  fetch(`/api/cache/${userId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: listEntry.username, listId: listEntry.listId, sort: listEntry.sort, traktClientId: state.traktClientId }),
  }).then(async (res) => {
    if (!res.ok || !res.body) { state.lists[idx].status = 'error'; return; }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n'); buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const ev = JSON.parse(line.slice(6));
          if (ev.status === 'progress') { state.lists[idx].progress.done = ev.done; state.lists[idx].progress.total = ev.total; }
          else if (ev.status === 'done') { state.lists[idx].status = 'cached'; state.lists[idx].progress = { done: ev.done, total: ev.total }; }
          else if (ev.status === 'error') { state.lists[idx].status = 'error'; }
        } catch {}
      }
    }
  }).catch(() => { if (state.lists[idx]) state.lists[idx].status = 'error'; });
}

function removeList(index) { state.lists.splice(index, 1); }

async function saveConfig() {
  try {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        upstashUrl: state.upstashUrl.trim(),
        upstashToken: state.upstashToken.trim(),
        traktClientId: state.traktClientId.trim(),
        lists: state.lists.map(({ username, listId, sort, categoryName }) => ({ username, listId, sort, categoryName })),
      }),
    });
    if (res.ok) { const { userId } = await res.json(); state.userId = userId; }
    else alert('Failed to save config. Check your Upstash credentials.');
  } catch { alert('Failed to reach server.'); }
}

async function generateAddon() {
  if (!state.traktClientId) { alert('Please provide your Trakt Client ID.'); return; }
  if (state.lists.length === 0) { alert('Please add at least one list.'); return; }
  state.generating = true;
  await saveConfig();
  state.generating = false;
  if (state.userId) state.addonUrl = buildAddonUrl(state.userId);
}

function buildAddonUrl(userId) {
  const baseUrl = import.meta.env.VITE_APP_URL || window.location.origin;
  return `${baseUrl}/${userId}/manifest.json`;
}

function installStremio() {
  if (state.addonUrl) window.location.href = state.addonUrl.replace(/https?:\/\//, 'stremio://');
}

function copyUrl() {
  navigator.clipboard.writeText(state.addonUrl)
    .then(() => alert('Copied!'))
    .catch(() => alert('Copy failed — please copy manually.'));
}
</script>

<style scoped>
/* ── Reset / Base ──────────────────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; }

.app-shell {
  min-height: 100vh;
  background: #080a12;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 24px;
  position: relative;
  overflow: hidden;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  color: #e2e8f0;
}

/* Noise texture */
.noise {
  position: fixed; inset: 0; pointer-events: none; z-index: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
  opacity: 0.4;
}

/* Glow blobs */
.blob { position: fixed; border-radius: 50%; pointer-events: none; filter: blur(120px); }
.blob-1 { width: 600px; height: 600px; background: radial-gradient(circle, #4f46e530, transparent 70%); top: -200px; left: -200px; }
.blob-2 { width: 500px; height: 500px; background: radial-gradient(circle, #7c3aed25, transparent 70%); bottom: -150px; right: -150px; }
.blob-3 { width: 300px; height: 300px; background: radial-gradient(circle, #0ea5e920, transparent 70%); top: 50%; left: 50%; transform: translate(-50%,-50%); }

/* ── Layout ─────────────────────────────────────────── */
.page-wrapper {
  display: flex;
  gap: 48px;
  width: 100%;
  max-width: 1000px;
  z-index: 1;
  align-items: flex-start;
}

/* ── Left Panel ─────────────────────────────────────── */
.left-panel {
  flex: 0 0 260px;
  display: flex;
  flex-direction: column;
  padding: 8px 0;
  position: sticky;
  top: 32px;
}

.brand { display: flex; align-items: center; gap: 14px; margin-bottom: 24px; }
.brand-icon {
  width: 44px; height: 44px;
  background: rgba(124,58,237,0.15);
  border: 1px solid rgba(124,58,237,0.3);
  border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
}
.brand-logo { width: 26px; height: 26px; object-fit: contain; }
.brand-title { font-size: 18px; font-weight: 700; color: #f1f5f9; line-height: 1.2; }
.brand-sub { font-size: 11px; color: #475569; margin-top: 2px; font-weight: 500; letter-spacing: 0.03em; }

.divider { height: 1px; background: rgba(255,255,255,0.06); margin-bottom: 20px; }

.brand-desc { font-size: 12.5px; color: #64748b; line-height: 1.7; margin-bottom: 24px; }

.feature-list { display: flex; flex-direction: column; gap: 14px; }
.feature-item { display: flex; align-items: flex-start; gap: 11px; }
.feature-icon-wrap {
  width: 28px; height: 28px; flex-shrink: 0;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  color: #7c3aed; margin-top: 1px;
}
.feature-label { font-size: 12.5px; font-weight: 600; color: #cbd5e1; }
.feature-sub { font-size: 11.5px; color: #475569; margin-top: 2px; line-height: 1.4; }

.left-footer { margin-top: auto; padding-top: 32px; }
.footer-link {
  display: inline-flex; align-items: center; gap: 7px;
  color: #475569; font-size: 12px; text-decoration: none;
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 8px; padding: 7px 12px;
  background: rgba(255,255,255,0.03);
  transition: color .2s, background .2s, border-color .2s;
}
.footer-link:hover { color: #94a3b8; background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.12); }

/* ── Right Panel ────────────────────────────────────── */
.right-panel { flex: 1; min-width: 0; }

.form-card {
  background: #0f1117;
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 20px;
  padding: 32px;
  box-shadow: 0 0 0 1px rgba(255,255,255,0.03), 0 32px 96px rgba(0,0,0,0.6);
}

/* ── Steps Bar ──────────────────────────────────────── */
.steps-bar {
  display: flex;
  align-items: center;
  gap: 0;
  margin-bottom: 32px;
  padding-bottom: 28px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.step {
  display: flex; flex-direction: column; align-items: center; gap: 5px;
  flex-shrink: 0;
}
.step-num {
  width: 28px; height: 28px;
  border-radius: 50%;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.10);
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 700; color: #4b5563;
  transition: all .3s;
}
.step.active .step-num { border-color: #7c3aed; color: #a78bfa; background: rgba(124,58,237,0.15); }
.step.done .step-num { background: #7c3aed; border-color: #7c3aed; color: #fff; }
.step span { font-size: 10.5px; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.05em; transition: color .3s; }
.step.active span { color: #9ca3af; }
.step.done span { color: #7c3aed; }
.step-line {
  flex: 1; height: 1px;
  background: rgba(255,255,255,0.08);
  margin: 0 8px;
  margin-bottom: 20px;
  transition: background .4s;
}
.step-line.done { background: #7c3aed; }

/* ── Form Sections ──────────────────────────────────── */
.form-section {
  margin-bottom: 28px;
  padding-bottom: 28px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}
.form-section:last-of-type, .form-section-slim { border-bottom: none; margin-bottom: 20px; padding-bottom: 0; }

.section-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 10px;
}
.section-label {
  display: flex; align-items: center; gap: 8px;
  font-size: 11.5px; font-weight: 700; color: #6b7280;
  text-transform: uppercase; letter-spacing: 0.08em;
}
.section-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.trakt-dot { background: #e4405f; box-shadow: 0 0 6px #e4405f80; }
.upstash-dot { background: #00c896; box-shadow: 0 0 6px #00c89680; }
.list-dot { background: #7c3aed; box-shadow: 0 0 6px #7c3aed80; }
.active-dot { background: #f59e0b; box-shadow: 0 0 6px #f59e0b80; }

.section-badges { display: flex; gap: 6px; align-items: center; }
.section-desc { font-size: 12px; color: #4b5563; margin-bottom: 14px; line-height: 1.6; }

/* ── Badges ─────────────────────────────────────────── */
.badge { font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 99px; letter-spacing: 0.03em; }
.badge-required { background: rgba(239,68,68,0.12); color: #f87171; border: 1px solid rgba(239,68,68,0.2); }
.badge-success { background: rgba(52,211,153,0.12); color: #34d399; border: 1px solid rgba(52,211,153,0.2); }
.badge-error { background: rgba(248,113,113,0.12); color: #f87171; border: 1px solid rgba(248,113,113,0.2); }
.count-badge {
  background: rgba(124,58,237,0.2); color: #a78bfa;
  border: 1px solid rgba(124,58,237,0.3);
  font-size: 11px; font-weight: 700; padding: 2px 9px; border-radius: 99px;
}

/* ── Inputs ─────────────────────────────────────────── */
.field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
.input-group { display: flex; flex-direction: column; gap: 6px; }

.input-label {
  font-size: 11.5px; font-weight: 600; color: #6b7280;
  display: flex; align-items: center; justify-content: space-between;
}
.label-hint { font-size: 11px; color: #374151; font-weight: 400; }

.link { color: #7c3aed; text-decoration: none; font-size: 11px; transition: color .2s; }
.link:hover { color: #a78bfa; }
.link-sm { font-size: 10.5px; }

.styled-input {
  width: 100%;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.09);
  border-radius: 10px;
  padding: 10px 13px;
  color: #e2e8f0;
  font-size: 13px;
  transition: border-color .2s, box-shadow .2s, background .2s;
  outline: none;
  font-family: inherit;
}
.styled-input::placeholder { color: #374151; }
.styled-input:focus {
  border-color: rgba(124,58,237,0.6);
  box-shadow: 0 0 0 3px rgba(124,58,237,0.12);
  background: rgba(255,255,255,0.05);
}
.styled-input-sm { max-width: 160px; }
.input-valid { border-color: rgba(52,211,153,0.5) !important; }
.input-error { border-color: rgba(248,113,113,0.5) !important; }

.add-row { display: flex; gap: 10px; align-items: flex-end; margin-top: 12px; }

/* ── Parsed Tags ────────────────────────────────────── */
.parsed-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.tag {
  font-size: 11px; padding: 3px 10px; border-radius: 99px;
  border: 1px solid; font-weight: 500;
}
.tag-user { background: rgba(99,102,241,0.1); border-color: rgba(99,102,241,0.25); color: #818cf8; }
.tag-list { background: rgba(124,58,237,0.1); border-color: rgba(124,58,237,0.25); color: #a78bfa; }
.tag-sort { background: rgba(20,184,166,0.1); border-color: rgba(20,184,166,0.25); color: #2dd4bf; }
.field-error { font-size: 12px; color: #f87171; margin-top: 8px; }

/* ── Buttons ────────────────────────────────────────── */
.btn-secondary {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 8px 16px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 9px; color: #94a3b8;
  font-size: 12px; font-weight: 600; cursor: pointer;
  transition: background .2s, border-color .2s, color .2s;
  font-family: inherit;
}
.btn-secondary:hover:not(:disabled) {
  background: rgba(255,255,255,0.09); color: #cbd5e1; border-color: rgba(255,255,255,0.16);
}
.btn-secondary:disabled { opacity: 0.4; cursor: not-allowed; }

.btn-add {
  flex-shrink: 0;
  display: inline-flex; align-items: center; gap: 6px;
  padding: 10px 18px;
  background: rgba(124,58,237,0.15);
  border: 1px solid rgba(124,58,237,0.35);
  border-radius: 10px; color: #a78bfa;
  font-size: 13px; font-weight: 600; cursor: pointer;
  white-space: nowrap; transition: background .2s, transform .1s;
  font-family: inherit;
}
.btn-add:hover:not(:disabled) { background: rgba(124,58,237,0.28); transform: translateY(-1px); }
.btn-add:disabled { opacity: 0.35; cursor: not-allowed; }

.btn-remove {
  display: flex; align-items: center; justify-content: center;
  width: 26px; height: 26px;
  background: transparent; border: 1px solid transparent;
  border-radius: 7px; color: #374151; cursor: pointer;
  transition: color .15s, background .15s, border-color .15s;
}
.btn-remove:hover { color: #f87171; background: rgba(248,113,113,0.1); border-color: rgba(248,113,113,0.2); }

/* ── Lists Table ────────────────────────────────────── */
.lists-table {
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 12px; overflow: hidden;
  background: rgba(255,255,255,0.015);
}
.lists-header {
  display: grid; grid-template-columns: 1fr auto auto 26px;
  gap: 16px; padding: 9px 14px;
  background: rgba(255,255,255,0.035);
  font-size: 10.5px; color: #374151; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.06em;
}
.lists-row {
  display: grid; grid-template-columns: 1fr auto auto 26px;
  gap: 16px; align-items: center;
  padding: 11px 14px;
  border-top: 1px solid rgba(255,255,255,0.045);
  transition: background .15s;
}
.lists-row:hover { background: rgba(255,255,255,0.025); }

.list-path { font-size: 12px; font-family: 'SF Mono', 'Fira Code', monospace; color: #94a3b8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.list-sep { color: #374151; margin: 0 1px; }
.list-user { color: #475569; }
.list-name { color: #cbd5e1; font-weight: 600; }
.list-sort { color: #6d28d9; font-size: 11px; }

.category-pill {
  font-size: 10.5px; padding: 3px 9px;
  background: rgba(124,58,237,0.12); border: 1px solid rgba(124,58,237,0.22);
  color: #7c3aed; border-radius: 99px; white-space: nowrap; font-weight: 600;
}

.cache-status {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 11px; font-weight: 700; white-space: nowrap;
}
.cache-cached { color: #34d399; }
.cache-caching { color: #fbbf24; }
.cache-pending { color: #374151; }
.cache-error { color: #f87171; }

/* ── Spinners ───────────────────────────────────────── */
.spinner {
  display: inline-block; flex-shrink: 0;
  width: 13px; height: 13px;
  border: 2px solid rgba(255,255,255,0.15);
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin .65s linear infinite;
}
.spinner-xs { width: 9px; height: 9px; border-width: 1.5px; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Advanced (details/summary) ─────────────────────── */
.advanced-details { }
.advanced-summary {
  font-size: 11.5px; color: #374151; font-weight: 600;
  cursor: pointer; user-select: none;
  display: flex; align-items: center; gap: 6px;
  list-style: none; outline: none;
  transition: color .2s;
}
.advanced-summary:hover { color: #6b7280; }
.advanced-summary::-webkit-details-marker { display: none; }
.advanced-summary::before {
  content: '›'; font-size: 14px; transition: transform .2s; display: inline-block;
}
details[open] .advanced-summary::before { transform: rotate(90deg); }

/* ── Generate ───────────────────────────────────────── */
.generate-area { padding-top: 8px; }
.btn-generate {
  width: 100%; display: flex; align-items: center; justify-content: center; gap: 10px;
  padding: 15px 24px;
  background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%);
  border: none; border-radius: 12px;
  color: #fff; font-size: 14px; font-weight: 700;
  cursor: pointer; transition: opacity .2s, transform .15s, box-shadow .2s;
  box-shadow: 0 4px 20px rgba(124,58,237,0.35), 0 1px 0 rgba(255,255,255,0.1) inset;
  letter-spacing: 0.01em; font-family: inherit;
}
.btn-generate:hover:not(:disabled) { opacity: 0.93; transform: translateY(-1px); box-shadow: 0 8px 30px rgba(124,58,237,0.45); }
.btn-generate:active:not(:disabled) { transform: translateY(0); }
.btn-generate:disabled { opacity: 0.4; cursor: not-allowed; }

/* ── Output ─────────────────────────────────────────── */
.output-card {
  margin-top: 16px;
  background: rgba(124,58,237,0.06);
  border: 1px solid rgba(124,58,237,0.2);
  border-radius: 14px; padding: 18px;
}
.output-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.output-icon {
  width: 28px; height: 28px;
  background: rgba(124,58,237,0.2); border: 1px solid rgba(124,58,237,0.3);
  border-radius: 8px; display: flex; align-items: center; justify-content: center;
  color: #a78bfa; flex-shrink: 0;
}
.output-label { font-size: 12px; font-weight: 700; color: #a78bfa; text-transform: uppercase; letter-spacing: 0.07em; }
.output-url-row { display: flex; gap: 8px; margin-bottom: 10px; }
.output-input {
  flex: 1; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1);
  border-radius: 9px; padding: 9px 13px; color: #64748b; font-size: 12px;
  font-family: 'SF Mono', 'Fira Code', monospace; outline: none; min-width: 0;
}
.btn-copy {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 9px 14px; background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.1); border-radius: 9px;
  color: #94a3b8; font-size: 12.5px; font-weight: 600; cursor: pointer;
  transition: background .2s; white-space: nowrap; font-family: inherit;
}
.btn-copy:hover { background: rgba(255,255,255,0.12); color: #cbd5e1; }
.btn-install {
  width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 11px; background: rgba(124,58,237,0.12);
  border: 1px solid rgba(124,58,237,0.28); border-radius: 10px;
  color: #a78bfa; font-size: 13.5px; font-weight: 600; cursor: pointer;
  transition: background .2s, transform .1s; font-family: inherit;
}
.btn-install:hover { background: rgba(124,58,237,0.22); transform: translateY(-1px); }

/* ── Responsive ─────────────────────────────────────── */
@media (max-width: 720px) {
  .page-wrapper { flex-direction: column; gap: 24px; }
  .left-panel { flex: none; position: static; }
  .field-grid { grid-template-columns: 1fr; }
}
</style>
