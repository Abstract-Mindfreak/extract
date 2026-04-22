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

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.ARCHIVER_PORT || 3456;
const ARCHIVER_PATH = path.join(__dirname, '..', '..', 'producer-ai-archiver');
const PRODUCER_BASE_URL = 'https://www.flowmusic.app';
const PRODUCER_USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36';

// Middleware
app.use(cors());
app.use(express.json());

// Active processes store
const activeProcesses = new Map();

// Default accounts config
const DEFAULT_ACCOUNTS = [
  {
    id: 'account_1',
    name: 'Account 1',
    color: '#ef4444',
    authStateFile: 'producer_auth_1.json',
    outputDir: 'producer_backup_1',
    isConfigured: false
  },
  {
    id: 'account_2',
    name: 'Account 2',
    color: '#3b82f6',
    authStateFile: 'producer_auth_2.json',
    outputDir: 'producer_backup_2',
    isConfigured: false
  },
  {
    id: 'account_3',
    name: 'Account 3',
    color: '#22c55e',
    authStateFile: 'producer_auth_3.json',
    outputDir: 'producer_backup_3',
    isConfigured: false
  },
  {
    id: 'account_4',
    name: 'Account 4',
    color: '#a855f7',
    authStateFile: 'producer_auth_4.json',
    outputDir: 'producer_backup_4',
    isConfigured: false
  },
  {
    id: 'account_5',
    name: 'Account 5',
    color: '#f97316',
    authStateFile: 'producer_auth_5.json',
    outputDir: 'producer_backup_5',
    isConfigured: false
  }
];

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
  const authFile = path.join(ARCHIVER_PATH, account.authStateFile);
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
  const authFile = path.join(ARCHIVER_PATH, account.authStateFile);
  const outputDir = path.join(ARCHIVER_PATH, account.outputDir);
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

    const authFile = path.join(ARCHIVER_PATH, account.authStateFile);
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
  console.log(`  GET  /api/health            - Health check`);
  console.log('='.repeat(50));
});
