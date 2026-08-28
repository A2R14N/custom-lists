import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { handleConfiguredManifest, handleDefaultManifest } from './routes/manifest.js';
import { handleCatalog } from './routes/catalog.js';
import { handleListExport } from '../services/export-cache.js';
import { handleConnect, handleSaveConfig, handleGetConfig, handleCacheList, handleCacheStep } from './routes/userconfig.js';

const directory = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.disable('x-powered-by');
app.use(cors());
app.use((req, res, next) => {
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Credential-bearing URLs and user data must not be stored in shared HTTP caches.
  res.setHeader('Cache-Control', 'private, no-store');
  next();
});
// Only selected, normalized list rows are sent here, never the ZIP or notes.
app.post('/api/exports/:userId', express.json({ limit: '2mb' }), handleListExport);
app.use(express.json({ limit: '128kb' }));
app.use(express.static(path.join(directory, '../../vue/dist'), { index: false, cacheControl: false }));

app.post('/api/connect', handleConnect);
app.post('/api/config', handleSaveConfig);
app.get('/api/config/:userId', handleGetConfig);
app.post('/api/cache/:userId', handleCacheList);
app.post('/api/cache/:userId/:jobId', handleCacheStep);
app.get('/:configuration/manifest.json', handleConfiguredManifest);
app.get('/manifest.json', handleDefaultManifest);
app.get('/:configuration?/catalog/:type/:id/:extra?.json', handleCatalog);
app.use('/api', (req, res) => res.status(404).json({ error: 'Unknown API route.' }));
app.get(/.*/, (req, res) => res.sendFile(path.join(directory, '../../vue/dist/index.html')));
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  res.status(error.type === 'entity.too.large' ? 413 : 400).json({ error: 'Invalid request body.' });
});

export default app;
