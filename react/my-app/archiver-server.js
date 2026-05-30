/**
 * FlowMusic.app Archiver API Server
 * Express server that wraps the archiver for browser communication
 * Run: node archiver-server.js
 */

const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs/promises');
const { existsSync } = require('fs');
const http = require('http');
const WebSocket = require('ws');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const archiverAccounts = require('./src/config/flowmusicArchiverAccounts.json');
const { buildRetrievalIndex, searchRetrievalIndex } = require('./src/services/mmssRetrievalIndex.js');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.ARCHIVER_PORT || 3456;
const ARCHIVER_PATH = path.join(__dirname, '..', '..', 'flowmusic-archiver');
const PRODUCER_BASE_URL = 'https://www.flowmusic.app';
const PRODUCER_USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36';
const MISTRAL_API_BASE = 'https://api.mistral.ai/v1';
const MISTRAL_MODEL = process.env.MISTRAL_MODEL || 'mistral-large-latest';
const MMSS_BRIDGE_DIR = path.join(__dirname, 'tmp');
const MMSS_LIBRARY_STATE_PATH = path.join(MMSS_BRIDGE_DIR, 'mmss-library-state.json');
const MMSS_GENESIS_HANDOFF_PATH = path.join(MMSS_BRIDGE_DIR, 'mmss-genesis-handoff.json');
const MMSS_IMPORT_QUEUE_PATH = path.join(MMSS_BRIDGE_DIR, 'mmss-import-queue.json');
const MMSS_MISTRAL_PRESET_PATH = path.join(MMSS_BRIDGE_DIR, 'mmss-mistral-preset.json');

// Middleware
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

async function ensureMmssBridgeDir() {
  await fs.mkdir(MMSS_BRIDGE_DIR, { recursive: true });
}

async function readJsonFileSafe(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (_error) {
    return fallback;
  }
}

async function writeJsonFileSafe(filePath, payload) {
  await ensureMmssBridgeDir();
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8');
}

app.get('/api/mistral/status', (_req, res) => {
  const hasKey = Boolean(process.env.MISTRAL_API_KEY && process.env.MISTRAL_API_KEY.length > 10);
  res.json({
    configured: hasKey,
    available: hasKey,
    source: hasKey ? 'server_env' : 'missing',
    defaultModel: MISTRAL_MODEL,
  });
});

app.post('/api/mistral/chat', async (req, res) => {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: 'Mistral API key is not configured on server' });
    return;
  }

  try {
    const response = await fetch(`${MISTRAL_API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: req.body?.model || MISTRAL_MODEL,
        messages: req.body?.messages || [],
        temperature: req.body?.temperature ?? 0.7,
        max_tokens: req.body?.max_tokens ?? 4096,
        response_format: req.body?.response_format,
      }),
    });

    const responseText = await response.text();
    if (!response.ok) {
      res.status(response.status).json({ error: responseText });
      return;
    }

    res.type('application/json').send(responseText);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Mistral proxy request failed' });
  }
});

app.get('/api/mmss/library-state', async (_req, res) => {
  const payload = await readJsonFileSafe(MMSS_LIBRARY_STATE_PATH, {
    promptLibrary: null,
    updatedAt: null,
  });
  res.json(payload);
});

app.post('/api/mmss/library-state', async (req, res) => {
  try {
    const payload = {
      promptLibrary: req.body?.promptLibrary || null,
      updatedAt: new Date().toISOString(),
    };
    await writeJsonFileSafe(MMSS_LIBRARY_STATE_PATH, payload);
    const blockCount = Array.isArray(payload.promptLibrary?.blocks) ? payload.promptLibrary.blocks.length : 0;
    const sequenceCount = Array.isArray(payload.promptLibrary?.sequences) ? payload.promptLibrary.sequences.length : 0;
    console.log(`[MMSS] library-state updated: ${blockCount} block(s), ${sequenceCount} sequence(s) at ${payload.updatedAt}`);
    res.json({ ok: true, updatedAt: payload.updatedAt });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/mmss/genesis-handoff', async (_req, res) => {
  const payload = await readJsonFileSafe(MMSS_GENESIS_HANDOFF_PATH, {
    json: null,
    source: null,
    updatedAt: null,
  });
  res.json(payload);
});

app.post('/api/mmss/genesis-handoff', async (req, res) => {
  try {
    const payload = {
      json: req.body?.json ?? null,
      source: req.body?.source ?? 'my-app',
      updatedAt: new Date().toISOString(),
    };
    await writeJsonFileSafe(MMSS_GENESIS_HANDOFF_PATH, payload);
    console.log(`[MMSS] genesis-handoff updated from ${payload.source} at ${payload.updatedAt}`);
    res.json({ ok: true, updatedAt: payload.updatedAt });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/mmss/import-queue', async (_req, res) => {
  const queue = await readJsonFileSafe(MMSS_IMPORT_QUEUE_PATH, []);
  res.json({ items: queue });
});

app.post('/api/mmss/import-queue', async (req, res) => {
  try {
    const queue = await readJsonFileSafe(MMSS_IMPORT_QUEUE_PATH, []);
    const nextItem = {
      id: `import_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      json: req.body?.json ?? null,
      source: req.body?.source ?? 'json-genesis',
      createdAt: new Date().toISOString(),
    };
    queue.push(nextItem);
    await writeJsonFileSafe(MMSS_IMPORT_QUEUE_PATH, queue);
    console.log(`[MMSS] import queued from ${nextItem.source}: ${nextItem.id}`);
    res.json({ ok: true, item: nextItem });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/mmss/import-queue/ack', async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const queue = await readJsonFileSafe(MMSS_IMPORT_QUEUE_PATH, []);
    const nextQueue = queue.filter((item) => !ids.includes(item.id));
    await writeJsonFileSafe(MMSS_IMPORT_QUEUE_PATH, nextQueue);
    res.json({ ok: true, removed: ids.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/mmss/mistral-preset', async (_req, res) => {
  const payload = await readJsonFileSafe(MMSS_MISTRAL_PRESET_PATH, {
    preset: null,
    updatedAt: null,
  });
  res.json(payload);
});

app.post('/api/mmss/mistral-preset', async (req, res) => {
  try {
    const payload = {
      preset: req.body?.preset ?? null,
      updatedAt: new Date().toISOString(),
    };
    await writeJsonFileSafe(MMSS_MISTRAL_PRESET_PATH, payload);
    console.log(`[MMSS] mistral-preset updated at ${payload.updatedAt}`);
    res.json({ ok: true, updatedAt: payload.updatedAt });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/mmss/retrieval-candidates', async (req, res) => {
  try {
    const payload = await readJsonFileSafe(MMSS_LIBRARY_STATE_PATH, {
      promptLibrary: null,
      updatedAt: null,
    });
    const promptLibrary = payload?.promptLibrary || { blocks: [] };
    const query = {
      prompt: req.body?.prompt || '',
      queries: Array.isArray(req.body?.queries) ? req.body.queries : [],
      blockRoles: Array.isArray(req.body?.blockRoles) ? req.body.blockRoles : [],
      limit: Number(req.body?.limit) || 8,
    };
    const pinnedIds = Array.isArray(req.body?.pinnedIds) ? req.body.pinnedIds : [];
    const index = buildRetrievalIndex(promptLibrary);
    const items = searchRetrievalIndex(index, query, { pinnedIds });

    console.log(
      `[MMSS] retrieval-candidates: ${items.length} hit(s) from ${index.length} block(s) for ${query.queries.length || 1} query source(s)`,
    );
    res.json({
      items,
      total: items.length,
      indexedBlocks: index.length,
      updatedAt: payload?.updatedAt || null,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.use((error, _req, res, next) => {
  if (error?.type === 'entity.too.large') {
    res.status(413).json({
      error: 'Request payload too large',
      detail: 'Increase bridge payload limit or reduce prompt library size',
    });
    return;
  }

  if (error) {
    next(error);
    return;
  }

  next();
});

// Active processes store
const activeProcesses = new Map();
const libraryCatalogCache = {
  value: null,
  expiresAt: 0
};

const DEFAULT_ACCOUNTS = archiverAccounts.map((account) => ({
  ...account,
  isConfigured: false,
}));

function resolveAccountFile(preferredName, legacyName) {
  const preferredPath = path.join(ARCHIVER_PATH, preferredName);
  if (existsSync(preferredPath) || !legacyName) {
    return preferredPath;
  }

  const legacyPath = path.join(ARCHIVER_PATH, legacyName);
  return existsSync(legacyPath) ? legacyPath : preferredPath;
}

function resolveAccountDir(account) {
  const preferredPath = path.join(ARCHIVER_PATH, account.outputDir);
  if (existsSync(preferredPath) || !account.legacyOutputDir) {
    return preferredPath;
  }

  const legacyPath = path.join(ARCHIVER_PATH, account.legacyOutputDir);
  return existsSync(legacyPath) ? legacyPath : preferredPath;
}

function findAccount(accountId) {
  return DEFAULT_ACCOUNTS.find((item) => item.id === accountId);
}

async function scanTrackDirectory(accountId, trackDirPath) {
  const trackFiles = await fs.readdir(trackDirPath, { withFileTypes: true });
  const fileNames = trackFiles.filter((entry) => entry.isFile()).map((entry) => entry.name);
  const dirName = path.basename(trackDirPath);
  const trackId = dirName.slice(0, 36);

  if (!trackId || !fileNames.includes('meta.json')) {
    return null;
  }

  const audioFileName =
    fileNames.find((name) => /\.(m4a|mp3|wav|ogg)$/i.test(name)) || null;
  const imageFileName =
    fileNames.find((name) => /\.(jpg|jpeg|png|webp)$/i.test(name)) || null;
  const metaPath = path.join(trackDirPath, 'meta.json');
  const metaStat = await fs.stat(metaPath);

  return {
    trackId,
    dirName,
    audioFileName,
    imageFileName,
    updatedAt: metaStat.mtime.toISOString(),
    metaUrl: `http://localhost:${PORT}/api/library/meta/${accountId}/${trackId}`,
    audioUrl: audioFileName
      ? `http://localhost:${PORT}/api/library/file/${accountId}/${trackId}/${encodeURIComponent(audioFileName)}`
      : null,
    coverUrl: imageFileName
      ? `http://localhost:${PORT}/api/library/file/${accountId}/${trackId}/${encodeURIComponent(imageFileName)}`
      : null
  };
}

async function scanAccountCatalog(account) {
  const accountDir = resolveAccountDir(account);
  const sessionsDir = path.join(accountDir, 'sessions');
  const result = {
    accountId: account.id,
    outputDir: account.outputDir,
    resolvedOutputDir: accountDir,
    trackCount: 0,
    latestUpdatedAt: null,
    tracks: [],
    sessionCount: 0
  };

  if (!existsSync(accountDir)) {
    return result;
  }

  const rootEntries = await fs.readdir(accountDir, { withFileTypes: true });

  for (const entry of rootEntries) {
    if (!entry.isDirectory()) continue;
    if (!/^[0-9a-f]{2}$/i.test(entry.name)) continue;

    const bucketDir = path.join(accountDir, entry.name);
    const trackEntries = await fs.readdir(bucketDir, { withFileTypes: true });

    for (const trackEntry of trackEntries) {
      if (!trackEntry.isDirectory()) continue;

      const trackData = await scanTrackDirectory(account.id, path.join(bucketDir, trackEntry.name));
      if (!trackData) continue;

      result.tracks.push(trackData);
      result.trackCount += 1;

      if (!result.latestUpdatedAt || trackData.updatedAt > result.latestUpdatedAt) {
        result.latestUpdatedAt = trackData.updatedAt;
      }
    }
  }

  if (existsSync(sessionsDir)) {
    const sessionEntries = await fs.readdir(sessionsDir, { withFileTypes: true });
    result.sessionCount = sessionEntries.filter(
      (entry) => entry.isFile() && /^session_.+\.json$/i.test(entry.name)
    ).length;
  }

  result.tracks.sort((left, right) => left.trackId.localeCompare(right.trackId));

  return result;
}

async function buildLibraryCatalog(force = false) {
  const now = Date.now();
  if (!force && libraryCatalogCache.value && libraryCatalogCache.expiresAt > now) {
    return libraryCatalogCache.value;
  }

  const accounts = [];
  for (const account of DEFAULT_ACCOUNTS) {
    accounts.push(await scanAccountCatalog(account));
  }

  const catalog = {
    generatedAt: new Date().toISOString(),
    source: ARCHIVER_PATH,
    accounts
  };

  libraryCatalogCache.value = catalog;
  libraryCatalogCache.expiresAt = now + 15000;
  return catalog;
}

async function findTrackDirectory(accountId, trackId) {
  const account = findAccount(accountId);
  if (!account) {
    throw new Error('Account not found');
  }

  const accountDir = resolveAccountDir(account);
  if (!existsSync(accountDir)) {
    throw new Error('Account output directory not found');
  }

  const bucket = String(trackId).slice(0, 2).toLowerCase();
  const bucketDir = path.join(accountDir, bucket);

  if (existsSync(bucketDir)) {
    const matches = await fs.readdir(bucketDir, { withFileTypes: true });
    const match = matches.find(
      (entry) => entry.isDirectory() && entry.name.toLowerCase().startsWith(String(trackId).toLowerCase())
    );

    if (match) {
      return path.join(bucketDir, match.name);
    }
  }

  const rootEntries = await fs.readdir(accountDir, { withFileTypes: true });
  for (const entry of rootEntries) {
    if (!entry.isDirectory()) continue;
    if (!/^[0-9a-f]{2}$/i.test(entry.name)) continue;

    const bucketPath = path.join(accountDir, entry.name);
    const trackEntries = await fs.readdir(bucketPath, { withFileTypes: true });
    const match = trackEntries.find(
      (trackEntry) =>
        trackEntry.isDirectory() &&
        trackEntry.name.toLowerCase().startsWith(String(trackId).toLowerCase())
    );

    if (match) {
      return path.join(bucketPath, match.name);
    }
  }

  throw new Error('Track directory not found');
}

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('Client connected');
  
  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

// Broadcast to all clients
function broadcast(data) {
  const message = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

function getPlaywright() {
  return require(path.join(ARCHIVER_PATH, 'node_modules', 'playwright'));
}

function extractAccessTokenFromCookies(cookies) {
  let rawCookieVal = '';

  for (let i = 0; i < 5; i += 1) {
    const cookie = cookies.find(
      (item) => item.name === `sb-api-auth-token.${i}` || item.name === `sb-sb-auth-token.${i}`
    );

    if (cookie) {
      rawCookieVal += cookie.value;
    }
  }

  if (!rawCookieVal.startsWith('base64-')) {
    return null;
  }

  let base64Part = rawCookieVal.substring(7);

  try {
    base64Part = decodeURIComponent(base64Part);
  } catch {
    // noop
  }

  base64Part = base64Part.replace(/-/g, '+').replace(/_/g, '/');
  while (base64Part.length % 4) {
    base64Part += '=';
  }

  const parsed = JSON.parse(Buffer.from(base64Part, 'base64').toString('utf8'));
  return parsed?.access_token || parsed?.session?.access_token || null;
}

async function loadProducerAccessToken(page, context) {
  let token = extractAccessTokenFromCookies(await context.cookies(PRODUCER_BASE_URL));

  if (token) {
    return token;
  }

  return page.evaluate(() => {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.includes('auth-token')) continue;

      try {
        const value = JSON.parse(localStorage.getItem(key));
        if (value?.access_token) return value.access_token;
        if (value?.session?.access_token) return value.session.access_token;
      } catch {
        // noop
      }
    }

    return null;
  });
}

async function fetchConversationBatch(account, conversationIds) {
  const authFile = resolveAccountFile(account.authStateFile, account.legacyAuthStateFile);
  if (!existsSync(authFile)) {
    throw new Error(`Auth state not found for ${account.id}`);
  }

  const { chromium } = getPlaywright();
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ],
    ignoreDefaultArgs: ['--enable-automation']
  });

  try {
    const context = await browser.newContext({
      storageState: authFile,
      userAgent: PRODUCER_USER_AGENT,
      viewport: { width: 1280, height: 720 }
    });

    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    const page = await context.newPage();
    await page.goto(PRODUCER_BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000);

    const accessToken = await loadProducerAccessToken(page, context);
    if (!accessToken) {
      throw new Error(`Could not extract FlowMusic.app access token for ${account.id}`);
    }

    return page.evaluate(async ({ accessToken, conversationIds }) => {
      const headers = {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`
      };

      const conversations = [];
      const failed = [];

      for (const conversationId of conversationIds) {
        try {
          const response = await fetch(`/__api/conversations/${conversationId}`, {
            headers,
            credentials: 'include'
          });

          const text = await response.text();
          let data = null;

          try {
            data = JSON.parse(text);
          } catch {
            // noop
          }

          if (!response.ok) {
            failed.push({
              conversationId,
              status: response.status,
              error: data?.detail || text.slice(0, 300)
            });
            continue;
          }

          conversations.push(data);
        } catch (error) {
          failed.push({
            conversationId,
            status: 0,
            error: error?.message || String(error)
          });
        }
      }

      return { conversations, failed };
    }, { accessToken, conversationIds });
  } finally {
    await browser.close();
  }
}

// Get account with status
async function getAccountStatus(account) {
  const authFile = resolveAccountFile(account.authStateFile, account.legacyAuthStateFile);
  const outputDir = resolveAccountDir(account);
  const manifestPath = path.join(outputDir, 'producer_manifest.json');
  const completionPath = path.join(outputDir, 'completion.json');
  const verificationPath = path.join(outputDir, 'verification_summary.json');

  const status = {
    ...account,
    isConfigured: existsSync(authFile),
    hasManifest: existsSync(manifestPath),
    hasCompletion: existsSync(completionPath),
    hasVerification: existsSync(verificationPath),
    totalSongs: 0,
    completedSongs: 0,
    downloadedAudio: 0,
    missingAudio: 0
  };

  if (status.hasVerification) {
    try {
      const data = JSON.parse(await fs.readFile(verificationPath, 'utf8'));
      status.totalSongs = data.manifest_items || 0;
      status.completedSongs = data.completed_items || 0;
      status.downloadedAudio = data.downloaded_audio || 0;
      status.missingAudio = data.missing_audio || 0;
    } catch (e) {
      console.warn('Failed to read verification:', e);
    }
  } else if (status.hasCompletion) {
    try {
      const data = JSON.parse(await fs.readFile(completionPath, 'utf8'));
      status.completedSongs = data.completed?.length || 0;
    } catch (e) {
      console.warn('Failed to read completion:', e);
    }
  }

  // Read manifest to get total songs count if verification not available
  if (status.hasManifest && status.totalSongs === 0) {
    try {
      const manifestData = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
      // Manifest can be either an array or an object with items
      if (Array.isArray(manifestData)) {
        status.totalSongs = manifestData.length;
      } else if (manifestData && typeof manifestData === 'object') {
        status.totalSongs = Object.keys(manifestData).length;
      }
    } catch (e) {
      console.warn('Failed to read manifest for stats:', e);
    }
  }

  return status;
}

// API Routes

// Get all accounts with status
app.get('/api/accounts', async (req, res) => {
  try {
    const accounts = await Promise.all(
      DEFAULT_ACCOUNTS.map(acc => getAccountStatus(acc))
    );
    res.json({ accounts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single account status
app.get('/api/accounts/:accountId', async (req, res) => {
  try {
    const account = DEFAULT_ACCOUNTS.find(a => a.id === req.params.accountId);
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    const status = await getAccountStatus(account);
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start archiver for account
app.post('/api/accounts/:accountId/start', (req, res) => {
  const { accountId } = req.params;
  const { headful = false, skipHarvest = false, concurrency = 4 } = req.body;
  
  const account = DEFAULT_ACCOUNTS.find(a => a.id === accountId);
  if (!account) {
    return res.status(404).json({ error: 'Account not found' });
  }

  // Stop existing process if any
  if (activeProcesses.has(accountId)) {
    activeProcesses.get(accountId).kill();
    activeProcesses.delete(accountId);
  }

  const env = {
    ...process.env,
    FLOWMUSIC_AUTH_STATE: path.join(ARCHIVER_PATH, account.authStateFile),
    FLOWMUSIC_OUTPUT_DIR: path.join(ARCHIVER_PATH, account.outputDir),
    PRODUCER_AUTH_STATE: path.join(ARCHIVER_PATH, account.authStateFile),
    PRODUCER_OUTPUT_DIR: path.join(ARCHIVER_PATH, account.outputDir),
    PRODUCER_CONCURRENCY: String(concurrency),
    PRODUCER_BASE_URL: 'https://www.flowmusic.app'
  };

  const args = ['archiver.mjs'];
  if (headful) args.push('--headful');
  if (skipHarvest) args.push('--skip-harvest');

  console.log(`Starting archiver for ${accountId}:`, args.join(' '));

  const process_ = spawn('node', args, {
    cwd: ARCHIVER_PATH,
    env,
    shell: true
  });

  activeProcesses.set(accountId, process_);

  // Stream output via WebSocket
  process_.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(Boolean);
    lines.forEach(line => {
      broadcast({
        type: 'log',
        accountId,
        logType: 'stdout',
        line,
        time: Date.now()
      });
    });
  });

  process_.stderr.on('data', (data) => {
    const lines = data.toString().split('\n').filter(Boolean);
    lines.forEach(line => {
      broadcast({
        type: 'log',
        accountId,
        logType: 'stderr',
        line,
        time: Date.now()
      });
    });
  });

  process_.on('close', (code) => {
    console.log(`Archiver for ${accountId} exited with code ${code}`);
    activeProcesses.delete(accountId);
    broadcast({
      type: 'complete',
      accountId,
      code,
      time: Date.now()
    });
  });

  process_.on('error', (err) => {
    console.error(`Archiver for ${accountId} error:`, err);
    activeProcesses.delete(accountId);
    broadcast({
      type: 'error',
      accountId,
      error: err.message,
      time: Date.now()
    });
  });

  res.json({ started: true, accountId, pid: process_.pid });
});

// Stop archiver for account
app.post('/api/accounts/:accountId/stop', (req, res) => {
  const { accountId } = req.params;
  
  if (activeProcesses.has(accountId)) {
    activeProcesses.get(accountId).kill('SIGTERM');
    activeProcesses.delete(accountId);
    return res.json({ stopped: true, accountId });
  }
  
  res.status(404).json({ error: 'No active process for this account' });
});

// Get running processes
app.get('/api/running', (req, res) => {
  const running = Array.from(activeProcesses.keys());
  res.json({ running });
});

// Trigger login ready
app.post('/api/login-ready', async (req, res) => {
  try {
    const loginReadyFile = path.join(ARCHIVER_PATH, 'producer_login_ready');
    await fs.writeFile(loginReadyFile, '');
    res.json({ triggered: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cleanup account auth
app.post('/api/accounts/:accountId/cleanup', async (req, res) => {
  try {
    const { accountId } = req.params;
    const account = DEFAULT_ACCOUNTS.find(a => a.id === accountId);
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const authFile = resolveAccountFile(account.authStateFile, account.legacyAuthStateFile);
    if (existsSync(authFile)) {
      await fs.unlink(authFile);
    }
    
    res.json({ cleaned: true, accountId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fetch conversation payloads for one account using saved FlowMusic.app auth
app.post('/api/accounts/:accountId/conversations/batch', async (req, res) => {
  try {
    const { accountId } = req.params;
    const { conversationIds = [] } = req.body || {};

    if (!Array.isArray(conversationIds) || conversationIds.length === 0) {
      return res.json({ accountId, conversations: [], failed: [] });
    }

    const uniqueConversationIds = Array.from(
      new Set(
        conversationIds
          .filter((value) => typeof value === 'string')
          .map((value) => value.trim())
          .filter(Boolean)
      )
    );

    const account = DEFAULT_ACCOUNTS.find((item) => item.id === accountId);
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const result = await fetchConversationBatch(account, uniqueConversationIds);
    res.json({
      accountId,
      conversations: result.conversations || [],
      failed: result.failed || []
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all stats
app.get('/api/stats', async (req, res) => {
  try {
    const stats = await Promise.all(
      DEFAULT_ACCOUNTS.map(acc => getAccountStatus(acc))
    );
    res.json({ stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/library/catalog', async (req, res) => {
  try {
    const force = String(req.query.force || '').toLowerCase() === 'true';
    const catalog = await buildLibraryCatalog(force);
    res.json(catalog);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/library/meta/:accountId/:trackId', async (req, res) => {
  try {
    const { accountId, trackId } = req.params;
    const trackDir = await findTrackDirectory(accountId, trackId);
    const metaPath = path.join(trackDir, 'meta.json');

    if (!existsSync(metaPath)) {
      return res.status(404).json({ error: 'meta.json not found' });
    }

    const metaText = await fs.readFile(metaPath, 'utf8');
    res.type('application/json').send(metaText);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.get('/api/library/file/:accountId/:trackId/:fileName', async (req, res) => {
  try {
    const { accountId, trackId, fileName } = req.params;
    const decodedFileName = decodeURIComponent(fileName);
    const trackDir = await findTrackDirectory(accountId, trackId);
    const filePath = path.join(trackDir, decodedFileName);

    if (!existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.sendFile(filePath);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.get('/api/library/session/:accountId/:conversationId', async (req, res) => {
  try {
    const { accountId, conversationId } = req.params;
    const account = findAccount(accountId);
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const sessionsDir = path.join(resolveAccountDir(account), 'sessions');
    const sessionPath = path.join(sessionsDir, `session_${conversationId}.json`);

    if (!existsSync(sessionPath)) {
      return res.status(404).json({ error: 'Session file not found' });
    }

    res.sendFile(sessionPath);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    archiverPath: ARCHIVER_PATH,
    archiverExists: existsSync(path.join(ARCHIVER_PATH, 'archiver.mjs'))
  });
});

// Start server
server.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log('FlowMusic.app Archiver API Server');
  console.log('='.repeat(50));
  console.log(`HTTP API: http://localhost:${PORT}`);
  console.log(`WebSocket: ws://localhost:${PORT}`);
  console.log(`Archiver path: ${ARCHIVER_PATH}`);
  console.log('='.repeat(50));
  console.log('Endpoints:');
  console.log(`  GET  /api/accounts          - List all accounts`);
  console.log(`  GET  /api/accounts/:id      - Get account status`);
  console.log(`  POST /api/accounts/:id/start - Start archiver`);
  console.log(`  POST /api/accounts/:id/stop  - Stop archiver`);
  console.log(`  POST /api/accounts/:id/conversations/batch - Fetch conversation payloads`);
  console.log(`  GET  /api/running           - List running processes`);
  console.log(`  POST /api/login-ready       - Trigger login ready`);
  console.log(`  GET  /api/stats             - Get all stats`);
  console.log(`  GET  /api/library/catalog   - Scan live FlowMusic backup folders`);
  console.log(`  GET  /api/library/meta/:accountId/:trackId - Read live meta.json`);
  console.log(`  GET  /api/library/file/:accountId/:trackId/:fileName - Stream live media file`);
  console.log(`  GET  /api/library/session/:accountId/:conversationId - Read live session file`);
  console.log(`  GET  /api/health            - Health check`);
  console.log('='.repeat(50));
});
