import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import Mixpanel from 'mixpanel';
import { fileURLToPath } from 'url';
import path from 'path';
import { handleConfiguredManifest, handleDefaultManifest } from './routes/manifest.js';
import { handleCatalog } from './routes/catalog.js';
import { handleSaveConfig, handleGetConfig, handleCacheList } from './routes/userconfig.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from Vue build
app.use(express.static(path.join(__dirname, '../../vue/dist')));

// Initialize tracking
const mixpanel = process.env.MIXPANEL_TOKEN ? Mixpanel.init(process.env.MIXPANEL_TOKEN) : null;

// ─── API Routes ───────────────────────────────────────────────────────────────

// Save user config to their own Upstash Redis, returns { userId }
app.post('/api/config', handleSaveConfig);

// Load user config from their Upstash Redis
app.get('/api/config/:userId', handleGetConfig);

// SSE: cache a single Trakt list into user's Upstash Redis with live progress
app.post('/api/cache/:userId', handleCacheList);

// ─── Stremio Addon Routes ─────────────────────────────────────────────────────

app.get('/:configuration/manifest.json', (req, res) => {
  handleConfiguredManifest(req, res, mixpanel);
});

app.get('/manifest.json', (req, res) => {
  handleDefaultManifest(req, res, mixpanel);
});

app.get('/:configuration?/catalog/:type/:id/:extra?.json', (req, res) => {
  handleCatalog(req, res, mixpanel);
});

// Fallback to Vue SPA
app.get(/.*/, (req, res) => {
  res.setHeader('Cache-Control', 'max-age=86400,stale-while-revalidate=86400,stale-if-error=86400,public');
  res.setHeader('content-type', 'text/html');
  res.sendFile(path.join(__dirname, '../../vue/dist/index.html'));
});

export default app;
