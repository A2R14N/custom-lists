<template>
  <div class="app-shell">
    <!-- Ambient background blobs -->
    <div class="blob blob-1"></div>
    <div class="blob blob-2"></div>

    <div class="page-wrapper">
      <!-- LEFT PANEL -->
      <aside class="left-panel">
        <div class="brand">
          <img src="/stremio.png" alt="Stremio" class="brand-logo" />
          <h1 class="brand-title">Stremio<br/>Custom Lists</h1>
        </div>
        <p class="brand-desc">
          Import personal Trakt.tv watchlists into Stremio with sorting, caching, and zero server config required.
        </p>
        <div class="feature-list">
          <div class="feature-item">
            <span class="feature-icon">🎯</span>
            <div>
              <div class="feature-label">Bring Your Own Keys</div>
              <div class="feature-sub">Trakt &amp; Upstash credentials stay in your URL</div>
            </div>
          </div>
          <div class="feature-item">
            <span class="feature-icon">⚡</span>
            <div>
              <div class="feature-label">Serverless Caching</div>
              <div class="feature-sub">Lists cached permanently on Upstash Redis</div>
            </div>
          </div>
          <div class="feature-item">
            <span class="feature-icon">📋</span>
            <div>
              <div class="feature-label">Multi-List Support</div>
              <div class="feature-sub">Bundle unlimited Trakt lists into one addon</div>
            </div>
          </div>
        </div>
        <div class="left-footer">
          <a href="https://github.com/rleroi/Stremio-Streaming-Catalogs-Addon" target="_blank" rel="noopener" class="footer-link">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
            GitHub
          </a>
          <a href="https://ko-fi.com/rab1t" target="_blank" rel="noopener" class="footer-link">
            <img src="https://storage.ko-fi.com/cdn/brandasset/kofi_s_logo_nolabel.png" width="16" height="16" alt="Ko-fi" />
            Ko-fi
          </a>
        </div>
      </aside>

      <!-- RIGHT PANEL (CONFIG FORM) -->
      <main class="right-panel">
        <div class="form-card">
          <div class="form-header">
            <h2 class="form-title">Configure Addon</h2>
            <p class="form-subtitle">All credentials are encoded into your personal install URL — nothing is stored server-side.</p>
          </div>

          <!-- SECTION: Trakt -->
          <section class="form-section">
            <div class="section-label">
              <span class="section-dot trakt-dot"></span>
              Trakt API
            </div>
            <div class="input-group">
              <label class="input-label">Client ID
                <a href="https://trakt.tv/oauth/applications" target="_blank" class="input-hint-link">Get one free ↗</a>
              </label>
              <input
                type="password"
                v-model="state.traktClientId"
                placeholder="Paste your Trakt Client ID..."
                class="styled-input"
                autocomplete="off"
              />
            </div>
          </section>

          <!-- SECTION: Upstash -->
          <section class="form-section">
            <div class="section-label">
              <span class="section-dot upstash-dot"></span>
              Upstash Redis Cache
              <span class="section-badge">Optional</span>
            </div>
            <p class="section-desc">Caches your lists permanently so Stremio loads instantly after the first fetch. Leave blank to skip caching.</p>
            <div class="input-group">
              <label class="input-label">REST Endpoint URL
                <a href="https://console.upstash.com/" target="_blank" class="input-hint-link">Create free DB ↗</a>
              </label>
              <input
                type="text"
                v-model="state.upstashUrl"
                placeholder="https://xxxx.upstash.io"
                class="styled-input"
                autocomplete="off"
              />
            </div>
            <div class="input-group" style="margin-top:10px">
              <label class="input-label">REST Token</label>
              <input
                type="password"
                v-model="state.upstashToken"
                placeholder="Paste your Upstash token..."
                class="styled-input"
                autocomplete="off"
              />
            </div>
          </section>

          <!-- SECTION: Cache Buster -->
          <section class="form-section">
            <div class="section-label">
              <span class="section-dot active-dot"></span>
              Stremio Cache Buster
              <span class="section-badge">Optional</span>
            </div>
            <p class="section-desc">Stremio caches Addons heavily. If your Addon stops working due to Stremio caching the old manifest, change this value (e.g. from "1" to "2") to force Stremio to fetch the latest Addon URL.</p>
            <div class="input-group">
              <label class="input-label">Version String</label>
              <input
                type="text"
                v-model="state.cacheBuster"
                placeholder="e.g. 1"
                class="styled-input"
              />
            </div>
          </section>

          <!-- SECTION: Add List -->
          <section class="form-section">
            <div class="section-label">
              <span class="section-dot list-dot"></span>
              Trakt Lists
            </div>
            <div class="input-group">
              <label class="input-label">List URL</label>
              <input
                type="text"
                v-model="state.traktListUrl"
                @input="parseTraktUrl"
                placeholder="https://trakt.tv/users/username/lists/list-name?sort=released,asc"
                class="styled-input"
              />
            </div>

            <div class="parsed-tags" v-if="state.traktUsername && state.traktListId">
              <span class="tag">👤 {{ state.traktUsername }}</span>
              <span class="tag">📋 {{ state.traktListId }}</span>
              <span class="tag" v-if="state.traktSort">🔃 {{ state.traktSort }}</span>
            </div>
            <p class="parse-error" v-if="!state.traktUsername && state.traktListUrl">
              ⚠️  Couldn't parse that URL — check it's a valid Trakt list link.
            </p>

            <div class="input-row" style="margin-top:10px">
              <div class="input-group" style="flex:1">
                <label class="input-label">Stremio Category</label>
                <input
                  type="text"
                  v-model="state.traktCategory"
                  placeholder="e.g. cartoon, movie, series"
                  class="styled-input"
                  @keyup.enter="addList"
                />
              </div>
              <button class="btn-add" @click="addList">+ Add</button>
            </div>
          </section>

          <!-- SECTION: Active Lists Table -->
          <section class="form-section" v-if="state.lists.length > 0">
            <div class="section-label">
              <span class="section-dot active-dot"></span>
              Active Lists
              <span class="list-count">{{ state.lists.length }}</span>
            </div>
            <div class="lists-table">
              <div class="lists-header">
                <span>List</span>
                <span>Category</span>
                <span></span>
              </div>
              <div
                v-for="(list, index) in state.lists"
                :key="index"
                class="lists-row"
              >
                <div class="list-path">
                  <span class="list-user">{{ list.username }}</span>/<span class="list-name">{{ list.listId }}</span>
                  <span class="list-sort" v-if="list.sort"> · {{ list.sort }}</span>
                </div>
                <span class="category-badge">{{ list.categoryName }}</span>
                <button class="btn-remove" @click="removeList(index)">✕</button>
              </div>
            </div>
          </section>

          <!-- GENERATE -->
          <div class="generate-section">
            <button class="btn-generate" @click="generateAddon">
              <span>Generate Install URL</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </button>
          </div>

          <!-- OUTPUT -->
          <div class="output-card" v-if="state.addonUrl">
            <div class="output-label">Install URL</div>
            <div class="output-row">
              <input type="text" :value="state.addonUrl" readonly class="output-input" />
              <button class="btn-copy" @click="copyUrl">Copy</button>
            </div>
            <button class="btn-install" @click="installStremio">
              <img src="/stremio.png" width="20" height="20" alt="" />
              Open in Stremio
            </button>
          </div>

        </div>
      </main>
    </div>
  </div>
</template>

<script setup>
import { reactive, onMounted } from 'vue';

const state = reactive({
  traktClientId: '',
  upstashUrl: '',
  upstashToken: '',
  traktListUrl: '',
  traktUsername: '',
  traktListId: '',
  traktSort: '',
  traktCategory: '',
  cacheBuster: '',
  lists: [],
  addonUrl: '',
});

onMounted(() => {
  try {
    const path = window.location.pathname;
    if (path.length > 2) {
      const segments = path.split('/');
      let base64Segment = segments.find(s => s && s !== 'configure' && s !== 'manifest.json' && s !== 'nfx');
      if (base64Segment) {
        let b64 = base64Segment.replace(/-/g, '+').replace(/_/g, '/');
        while (b64.length % 4) b64 += '=';
        const decoded = JSON.parse(atob(b64));
        if (decoded.traktClientId && !decoded.traktClientId.includes('http')) {
          state.traktClientId = decoded.traktClientId;
          localStorage.setItem('stremio_trakt_client_id', decoded.traktClientId);
        }
        if (decoded.upstashUrl) state.upstashUrl = decoded.upstashUrl;
        if (decoded.upstashToken) state.upstashToken = decoded.upstashToken;
        if (decoded.cacheBuster) state.cacheBuster = decoded.cacheBuster;
        if (decoded.lists && Array.isArray(decoded.lists)) state.lists = decoded.lists;
        if (state.traktClientId && state.lists.length > 0) generateAddon();
      }
    }
  } catch (e) {
    console.error('Failed to parse config from URL', e);
  }

  if (!state.traktClientId) {
    const savedId = localStorage.getItem('stremio_trakt_client_id');
    if (savedId) state.traktClientId = savedId;
  }
});

function parseTraktUrl() {
  const urlStr = state.traktListUrl.trim();
  if (!urlStr) { state.traktUsername = ''; state.traktListId = ''; state.traktSort = ''; return; }
  try {
    const url = new URL(urlStr);
    if (!url.hostname.includes('trakt.tv')) return;
    const match = url.pathname.match(/\/users\/([^\/]+)\/lists\/([^\/]+)/i);
    if (match) { state.traktUsername = match[1]; state.traktListId = match[2]; }
    state.traktSort = url.searchParams.get('sort') || '';
  } catch(e) {}
}

function addList() {
  if (!state.traktUsername || !state.traktListId || !state.traktCategory) {
    alert('Please provide a valid Trakt.tv List URL and Category.');
    return;
  }
  state.lists.push({
    username: state.traktUsername.trim(),
    listId: state.traktListId.trim(),
    sort: state.traktSort.trim() || undefined,
    categoryName: state.traktCategory.trim().toLowerCase()
  });
  state.traktListUrl = ''; state.traktUsername = ''; state.traktListId = ''; state.traktSort = ''; state.traktCategory = '';
}

function removeList(index) { state.lists.splice(index, 1); }

function generateAddon() {
  if (!state.traktClientId) { alert('Please provide your Trakt Client ID.'); return; }
  if (state.lists.length === 0) { alert('Please add at least one list.'); return; }

  const config = {
    traktClientId: state.traktClientId.trim(),
    lists: state.lists,
  };
  if (state.upstashUrl.trim()) config.upstashUrl = state.upstashUrl.trim();
  if (state.upstashToken.trim()) config.upstashToken = state.upstashToken.trim();
  if (state.cacheBuster.trim()) config.cacheBuster = state.cacheBuster.trim();

  localStorage.setItem('stremio_trakt_client_id', config.traktClientId);

  const base64url = btoa(JSON.stringify(config))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const baseUrl = import.meta.env.VITE_APP_URL || window.location.origin;
  state.addonUrl = `${baseUrl}/${base64url}/manifest.json`;
}

function installStremio() {
  if (state.addonUrl) window.location.href = state.addonUrl.replace(/https?:\/\//, 'stremio://');
}

function copyUrl() {
  navigator.clipboard.writeText(state.addonUrl)
    .then(() => alert('URL copied!'))
    .catch(() => alert('Copy failed — please copy manually.'));
}
</script>

<style scoped>
/* ─── Base ─────────────────────────────────────────── */
.app-shell {
  min-height: 100vh;
  background: #0b0d14;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  position: relative;
  overflow: hidden;
  font-family: 'Inter', system-ui, sans-serif;
}

/* Ambient blobs */
.blob { position: fixed; border-radius: 50%; filter: blur(80px); opacity: 0.18; pointer-events: none; }
.blob-1 { width: 500px; height: 500px; background: #7c3aed; top: -100px; left: -100px; }
.blob-2 { width: 400px; height: 400px; background: #4f46e5; bottom: -80px; right: -80px; }

/* ─── Layout ────────────────────────────────────────── */
.page-wrapper {
  display: flex;
  gap: 40px;
  width: 100%;
  max-width: 980px;
  z-index: 1;
}

/* ─── Left Panel ────────────────────────────────────── */
.left-panel {
  flex: 0 0 280px;
  display: flex;
  flex-direction: column;
  color: #fff;
  padding: 12px 0;
}

.brand { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
.brand-logo { width: 40px; height: 40px; object-fit: contain; }
.brand-title { font-size: 22px; font-weight: 700; line-height: 1.2; color: #fff; }

.brand-desc { font-size: 13px; color: #9ca3af; line-height: 1.6; margin-bottom: 28px; }

.feature-list { display: flex; flex-direction: column; gap: 16px; }
.feature-item { display: flex; align-items: flex-start; gap: 12px; }
.feature-icon { font-size: 20px; line-height: 1; margin-top: 2px; }
.feature-label { font-size: 13px; font-weight: 600; color: #e5e7eb; }
.feature-sub { font-size: 12px; color: #6b7280; margin-top: 2px; }

.left-footer { margin-top: auto; padding-top: 32px; display: flex; gap: 16px; }
.footer-link { display: flex; align-items: center; gap: 6px; color: #6b7280; font-size: 12px; text-decoration: none; transition: color 0.2s; }
.footer-link:hover { color: #9ca3af; }

/* ─── Right Panel ───────────────────────────────────── */
.right-panel { flex: 1; min-width: 0; }

.form-card {
  background: #13151f;
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 20px;
  padding: 32px;
  box-shadow: 0 24px 80px rgba(0,0,0,0.5);
}

.form-header { margin-bottom: 28px; }
.form-title { font-size: 22px; font-weight: 700; color: #f9fafb; margin-bottom: 6px; }
.form-subtitle { font-size: 13px; color: #6b7280; line-height: 1.5; }

/* ─── Sections ──────────────────────────────────────── */
.form-section { margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid rgba(255,255,255,0.06); }
.form-section:last-of-type { border-bottom: none; margin-bottom: 0; }

.section-label {
  display: flex; align-items: center; gap: 8px;
  font-size: 12px; font-weight: 600; color: #9ca3af;
  text-transform: uppercase; letter-spacing: 0.06em;
  margin-bottom: 12px;
}
.section-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.trakt-dot { background: #e4405f; }
.upstash-dot { background: #00c896; }
.list-dot { background: #7c3aed; }
.active-dot { background: #f59e0b; }

.section-badge {
  background: rgba(255,255,255,0.07);
  color: #9ca3af; font-size: 10px; padding: 2px 7px;
  border-radius: 99px; font-weight: 500;
  text-transform: none; letter-spacing: 0;
}
.list-count {
  background: #7c3aed; color: #fff;
  font-size: 11px; padding: 1px 7px;
  border-radius: 99px; font-weight: 700;
  text-transform: none; letter-spacing: 0;
}

.section-desc { font-size: 12px; color: #6b7280; margin-bottom: 12px; line-height: 1.5; }

/* ─── Inputs ────────────────────────────────────────── */
.input-group { display: flex; flex-direction: column; gap: 6px; }

.input-label {
  font-size: 12px; font-weight: 500; color: #9ca3af;
  display: flex; align-items: center; justify-content: space-between;
}
.input-hint-link { color: #7c3aed; font-size: 11px; text-decoration: none; transition: color .2s; }
.input-hint-link:hover { color: #a78bfa; }

.styled-input {
  width: 100%; box-sizing: border-box;
  background: #0b0d14;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 10px;
  padding: 10px 14px;
  color: #f3f4f6;
  font-size: 13px;
  transition: border-color .2s, box-shadow .2s;
  outline: none;
}
.styled-input::placeholder { color: #4b5563; }
.styled-input:focus {
  border-color: #7c3aed;
  box-shadow: 0 0 0 3px rgba(124,58,237,0.15);
}

.input-row { display: flex; align-items: flex-end; gap: 10px; }

/* ─── Parsed Tags ───────────────────────────────────── */
.parsed-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.tag {
  background: rgba(124,58,237,0.15); border: 1px solid rgba(124,58,237,0.3);
  color: #c4b5fd; font-size: 11px; padding: 3px 9px; border-radius: 99px;
}
.parse-error { font-size: 12px; color: #f87171; margin-top: 6px; }

/* ─── Buttons ───────────────────────────────────────── */
.btn-add {
  flex-shrink: 0; padding: 10px 18px;
  background: rgba(124,58,237,0.2);
  border: 1px solid rgba(124,58,237,0.4);
  border-radius: 10px; color: #c4b5fd;
  font-size: 13px; font-weight: 600; cursor: pointer;
  white-space: nowrap; transition: background .2s, transform .1s;
}
.btn-add:hover { background: rgba(124,58,237,0.35); transform: translateY(-1px); }

.btn-remove {
  background: transparent; border: none; color: #6b7280;
  font-size: 12px; cursor: pointer; padding: 4px; border-radius: 6px;
  transition: color .2s, background .2s;
}
.btn-remove:hover { color: #f87171; background: rgba(248,113,113,0.1); }

/* ─── Lists Table ───────────────────────────────────── */
.lists-table {
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 12px; overflow: hidden;
}
.lists-header {
  display: grid; grid-template-columns: 1fr auto auto;
  gap: 12px; padding: 8px 14px;
  background: rgba(255,255,255,0.04);
  font-size: 11px; color: #6b7280; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.05em;
}
.lists-row {
  display: grid; grid-template-columns: 1fr auto auto;
  gap: 12px; align-items: center;
  padding: 10px 14px;
  border-top: 1px solid rgba(255,255,255,0.05);
  transition: background .15s;
}
.lists-row:hover { background: rgba(255,255,255,0.02); }
.list-path { font-size: 12px; font-family: monospace; color: #d1d5db; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.list-user { color: #9ca3af; }
.list-name { color: #e5e7eb; font-weight: 600; }
.list-sort { color: #7c3aed; }
.category-badge {
  font-size: 11px; padding: 2px 8px;
  background: rgba(124,58,237,0.15); border: 1px solid rgba(124,58,237,0.25);
  color: #a78bfa; border-radius: 99px; white-space: nowrap;
}

/* ─── Generate ──────────────────────────────────────── */
.generate-section { padding-top: 20px; }
.btn-generate {
  width: 100%; display: flex; align-items: center; justify-content: center; gap: 10px;
  padding: 14px 24px;
  background: linear-gradient(135deg, #7c3aed, #4f46e5);
  border: none; border-radius: 12px;
  color: #fff; font-size: 15px; font-weight: 700;
  cursor: pointer; transition: opacity .2s, transform .15s;
  box-shadow: 0 4px 24px rgba(124,58,237,0.4);
}
.btn-generate:hover { opacity: 0.92; transform: translateY(-1px); }
.btn-generate:active { transform: translateY(0); }

/* ─── Output ────────────────────────────────────────── */
.output-card {
  margin-top: 16px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px; padding: 16px;
}
.output-label { font-size: 11px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px; }
.output-row { display: flex; gap: 8px; margin-bottom: 10px; }
.output-input {
  flex: 1; background: #0b0d14; border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px; padding: 9px 12px; color: #9ca3af; font-size: 12px;
  font-family: monospace; outline: none; min-width: 0;
}
.btn-copy {
  padding: 9px 16px; background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.1); border-radius: 8px;
  color: #d1d5db; font-size: 13px; font-weight: 500; cursor: pointer;
  transition: background .2s; white-space: nowrap;
}
.btn-copy:hover { background: rgba(255,255,255,0.12); }
.btn-install {
  width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 11px; background: rgba(124,58,237,0.15);
  border: 1px solid rgba(124,58,237,0.35); border-radius: 8px;
  color: #c4b5fd; font-size: 14px; font-weight: 600; cursor: pointer;
  transition: background .2s, transform .1s;
}
.btn-install:hover { background: rgba(124,58,237,0.25); transform: translateY(-1px); }

/* ─── Responsive ────────────────────────────────────── */
@media (max-width: 700px) {
  .page-wrapper { flex-direction: column; }
  .left-panel { flex: none; }
  .brand-title { font-size: 18px; }
}
</style>
