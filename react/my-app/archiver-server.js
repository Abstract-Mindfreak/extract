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
const https = require('https');
const WebSocket = require('ws');
require('dotenv').config({ path: path.join(__dirname, '.env'), override: true });
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env'), override: true });
const archiverAccounts = require('./src/config/flowmusicArchiverAccounts.json');
const { buildRetrievalIndex, searchRetrievalIndex } = require('./src/services/mmssRetrievalIndex.js');
const { buildMmssQualityReport } = require('./src/services/mmssQualityReport.js');
const { executeReadOnlyQuery } = require('./db');
const {
  ANSWER_MODEL: LOCAL_RAG_ANSWER_MODEL,
  EMBEDDING_MODEL: LOCAL_RAG_EMBEDDING_MODEL,
  answerWithRag: answerWithLocalRag,
  buildPromptContext: buildLocalRagPromptContext,
  cancelJob: cancelLocalRagJob,
  gatherStats: gatherLocalRagStats,
  getEmbeddingDimension: getLocalRagEmbeddingDimension,
  getJobStatus: getLocalRagJobStatus,
  normalizeDatabaseIdentifier: normalizeLocalRagDatabase,
  searchRag: searchLocalRag,
  startVectorizationJob: startLocalRagVectorizationJob,
} = require('./server/localRagService.js');
const {
  DATABASE_URL,
  clearSettings,
  clearEntities,
  countEntities,
  deleteEntity,
  deleteSetting,
  getEntity,
  getSetting,
  getStatus: getDatabaseStatus,
  listEntities,
  listSettings,
  setSetting,
  setSettings,
  upsertEntities,
  upsertEntity,
} = require('./server/postgresPersistence.js');
const {
  MMSS_INVARIANTS_TABLE,
  cancelJob: cancelMmssInvariantsJob,
  gatherStats: gatherMmssInvariantsStats,
  getJobStatus: getMmssInvariantsJobStatus,
  startExtractionJob: startMmssInvariantsExtractionJob,
  syncOntologySeed: syncMmssOntologySeed,
} = require('./server/mmssInvariantsService.js');
const {
  cancelDesignSkillTreeJob,
  designSkillTree: designMmssSkillTree,
  getDesignSkillTreeJobStatus,
  runDummySkillTreeExecution,
  startDesignSkillTreeJob,
} = require('./server/mmssSkillTreeService.js');
const {
  buildGeneratedAlbumFlowmusicPayload,
  getRuntimeHealth: getMmssRuntimeHealth,
  listCustomInstructions,
  saveGeneratedAlbum,
  saveCustomInstruction,
  syncCollectionFromFiltered,
  syncMmssFiltered,
  syncTrackPrompts,
} = require('./server/mmssRuntimePersistenceService.js');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.ARCHIVER_PORT || 3456;
const RAG_CHUNKS_CLEANER_SCRIPT = path.join(__dirname, '..', 'react_agent', 'сhunks-cleaner.py');
const ragChunkRefreshJobs = new Map();

function resolveRagChunksCleanerScript() {
  const scriptsDir = path.join(__dirname, '..', 'react_agent');
  const directCandidates = [
    path.join(scriptsDir, 'chunks-cleaner.py'),
    path.join(scriptsDir, 'сhunks-cleaner.py'),
  ];
  for (const candidate of directCandidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  try {
    const matches = require('fs')
      .readdirSync(scriptsDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && /hunks-cleaner\.py$/i.test(entry.name))
      .map((entry) => path.join(scriptsDir, entry.name));
    if (matches.length) {
      return matches[0];
    }
  } catch (_error) {
    return directCandidates[0];
  }

  return directCandidates[0];
}

function createUtilityJobId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getRagChunkRefreshJob(jobId) {
  return jobId ? ragChunkRefreshJobs.get(jobId) || null : null;
}

function cancelRagChunkRefreshJob(jobId) {
  const job = getRagChunkRefreshJob(jobId);
  if (!job) return null;
  if (job.child && job.status === 'running') {
    job.cancelRequested = true;
    job.child.kill();
  }
  return job;
}

async function startRagChunkRefreshJob() {
  const cleanerScript = resolveRagChunksCleanerScript();
  if (!existsSync(cleanerScript)) {
    throw new Error(`chunks-cleaner.py not found: ${cleanerScript}`);
  }

  const job = {
    jobId: createUtilityJobId('rag_chunks_refresh'),
    status: 'running',
    progress: 5,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
    cancelRequested: false,
    logs: [],
    scriptPath: cleanerScript,
    child: null,
  };
  ragChunkRefreshJobs.set(job.jobId, job);

  const child = spawn('python', [cleanerScript], {
    cwd: path.dirname(cleanerScript),
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  job.child = child;

  const appendLog = (prefix, chunk) => {
    const text = String(chunk || '').trim();
    if (!text) return;
    job.logs.push(`${prefix}${text}`);
    if (job.logs.length > 120) {
      job.logs = job.logs.slice(-120);
    }
    job.updatedAt = new Date().toISOString();
  };

  child.stdout.on('data', (chunk) => {
    appendLog('', chunk);
    job.progress = Math.min(95, job.progress + 2);
  });
  child.stderr.on('data', (chunk) => {
    appendLog('[stderr] ', chunk);
    job.progress = Math.min(95, job.progress + 1);
  });

  child.on('error', (error) => {
    job.status = 'failed';
    job.error = error?.message || String(error);
    job.progress = 100;
    job.completedAt = new Date().toISOString();
    job.updatedAt = job.completedAt;
    job.child = null;
  });

  child.on('close', (code, signal) => {
    job.completedAt = new Date().toISOString();
    job.updatedAt = job.completedAt;
    job.child = null;
    job.progress = 100;
    if (job.cancelRequested || signal) {
      job.status = 'cancelled';
    } else if (code === 0) {
      job.status = 'completed';
    } else {
      job.status = 'failed';
      job.error = `chunks-cleaner exited with code ${code}`;
    }
  });

  return { ...job, child: undefined };
}
const ARCHIVER_PATH = path.join(__dirname, '..', '..', 'flowmusic-archiver');
const PRODUCER_BASE_URL = 'https://www.flowmusic.app';
const PRODUCER_USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36';
const MISTRAL_API_BASE = 'https://api.mistral.ai/v1';
const MISTRAL_MODEL = process.env.MISTRAL_MODEL || 'mistral-large-latest';
const OLLAMA_API_BASE = process.env.OLLAMA_API_BASE || 'http://127.0.0.1:11434/api';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gemma3:4b';
const OLLAMA_REQUEST_TIMEOUT_MS = Number(process.env.OLLAMA_REQUEST_TIMEOUT_MS || 600000);
const OLLAMA_ALLOW_FALLBACK_HOSTS = process.env.OLLAMA_ALLOW_FALLBACK_HOSTS === '1';
const FLOWMUSIC_AGENT_API_BASE = process.env.FLOWMUSIC_AGENT_API_BASE || 'http://127.0.0.1:8766';
const MISTRAL_MODE_PROFILES = {
  plan: {
    temperature: 0.2,
    max_tokens: 1400,
    response_format: { type: 'json_object' },
  },
  generate: {
    temperature: 0.4,
    max_tokens: 4096,
    response_format: { type: 'json_object' },
  },
  validate: {
    temperature: 0.15,
    max_tokens: 1800,
    response_format: { type: 'json_object' },
  },
};
const MMSS_BRIDGE_DIR = path.join(__dirname, 'tmp');
const MMSS_LIBRARY_STATE_PATH = path.join(MMSS_BRIDGE_DIR, 'mmss-library-state.json');
const MMSS_GENESIS_HANDOFF_PATH = path.join(MMSS_BRIDGE_DIR, 'mmss-genesis-handoff.json');
const MMSS_IMPORT_QUEUE_PATH = path.join(MMSS_BRIDGE_DIR, 'mmss-import-queue.json');
const MMSS_MISTRAL_PRESET_PATH = path.join(MMSS_BRIDGE_DIR, 'mmss-mistral-preset.json');
const PROMPT_DB_LOCAL_LIBRARY_MIRROR_PATH = path.join(__dirname, '..', '..', 'prompt-db-local', 'shared', 'react-prompt-library.json');
const DEFAULT_MMSS_METRICS_CONTRACT = {
  requiredMetrics: ['V', 'N', 'S', 'D_f', 'G_S', 'R_T'],
  operatorFamilies: ['relation', 'projection', 'constraint', 'transformation'],
  principleTags: ['schema', 'principle', 'operator', 'example', 'metrics', 'rule'],
  qualityExpectations: {
    explicitHierarchy: true,
    operatorTraceability: true,
    measurableOutputFields: true,
  },
};
const MMSS_ONTOLOGY_SEED_PATH = path.join(__dirname, '..', '..', 'database', 'seeds', 'mmss_ontology_seed.json');
const DEBUG_OLLAMA = process.env.DEBUG_OLLAMA !== '0';

function stripWrappingQuotes(value) {
  if (!value) return value;
  const first = value[0];
  const last = value[value.length - 1];
  if ((first === '"' && last === '"') || (first === '\'' && last === '\'')) {
    return value.slice(1, -1);
  }
  return value;
}

function readEnvFile(filePath) {
  const env = {};
  try {
    const text = require('fs').readFileSync(filePath, 'utf8');
    for (const rawLine of text.split(/\r?\n/u)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const separator = line.indexOf('=');
      if (separator <= 0) continue;
      const key = line.slice(0, separator).trim();
      if (!key) continue;
      env[key] = stripWrappingQuotes(line.slice(separator + 1).trim());
    }
  } catch (_error) {
    return env;
  }
  return env;
}

function buildFreshRuntimeEnv() {
  const rootEnv = readEnvFile(path.join(__dirname, '..', '..', '.env'));
  const appEnv = readEnvFile(path.join(__dirname, '.env'));
  return {
    ...process.env,
    ...appEnv,
    ...rootEnv,
  };
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

function createTraceId(prefix = 'req') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function debugLog(scope, traceId, message, extra = null) {
  if (!DEBUG_OLLAMA && scope.startsWith('OLLAMA')) {
    return;
  }

  const head = `[${scope}]${traceId ? ` [${traceId}]` : ''} ${message}`;
  if (extra == null) {
    console.log(head);
    return;
  }
  console.log(head, extra);
}

function toPreview(value, maxLength = 600) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

function extractSqlBlock(content) {
  const match = String(content || '').match(/```sql\s*([\s\S]*?)```/i);
  return match?.[1]?.trim() || null;
}

function buildOllamaDatabaseFollowUpPrompt(originalPrompt, sql, rows) {
  return `${originalPrompt}

The following SQL query was executed successfully:
\`\`\`sql
${sql}
\`\`\`

Database result:
${JSON.stringify(rows, null, 2)}

Now generate the final answer as JSON only.
Do not emit SQL.
Do not emit markdown.
Do not add explanations before or after JSON.`;
}

function getOllamaApiCandidates() {
  const normalized = String(OLLAMA_API_BASE || '').replace(/\/+$/, '');
  const candidates = [normalized];

  if (!OLLAMA_ALLOW_FALLBACK_HOSTS) {
    return candidates.filter(Boolean);
  }

  if (!normalized.includes('127.0.0.1:11434')) {
    candidates.push('http://127.0.0.1:11434/api');
  }

  if (!normalized.includes('localhost:11434')) {
    candidates.push('http://localhost:11434/api');
  }

  return Array.from(new Set(candidates.filter(Boolean)));
}

async function fetchOllamaJson(pathname, payload) {
  const candidates = getOllamaApiCandidates();
  let lastError = null;
  const traceId = payload?.traceId || createTraceId('ollama');

  for (const baseUrl of candidates) {
    const targetUrl = `${baseUrl}${pathname}`;
    try {
      const url = new URL(targetUrl);
      const transport = url.protocol === 'https:' ? https : http;
      const body = JSON.stringify(payload);

      debugLog('OLLAMA', traceId, `POST ${targetUrl}`, {
        model: payload?.model,
        stream: payload?.stream,
        promptChars: String(payload?.prompt || '').length,
        bodyBytes: Buffer.byteLength(body),
        timeoutMs: OLLAMA_REQUEST_TIMEOUT_MS,
        options: payload?.options || {},
      });

      const response = await new Promise((resolve, reject) => {
        const request = transport.request(
          {
            protocol: url.protocol,
            hostname: url.hostname,
            port: url.port,
            path: `${url.pathname}${url.search}`,
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(body),
            },
            timeout: OLLAMA_REQUEST_TIMEOUT_MS,
          },
          (incoming) => {
            const chunks = [];
            incoming.on('data', (chunk) => chunks.push(chunk));
            incoming.on('end', () => {
              resolve({
                statusCode: incoming.statusCode || 500,
                body: Buffer.concat(chunks).toString('utf8'),
              });
            });
          },
        );

        request.on('timeout', () => {
          request.destroy(new Error(`Request timeout after ${OLLAMA_REQUEST_TIMEOUT_MS}ms`));
        });
        request.on('error', (error) => reject(error));
        request.write(body);
        request.end();
      });

      const responseText = response.body || '';
      debugLog('OLLAMA', traceId, `Response from ${targetUrl}`, {
        status: response.statusCode,
        responseChars: responseText.length,
        preview: toPreview(responseText, 300),
      });

      if (response.statusCode < 200 || response.statusCode >= 300) {
        return {
          ok: false,
          status: response.statusCode,
          text: responseText,
          url: targetUrl,
          traceId,
        };
      }

      return {
        ok: true,
        status: response.statusCode,
        text: responseText,
        url: targetUrl,
        traceId,
      };
    } catch (error) {
      lastError = { error, url: targetUrl };
      debugLog('OLLAMA', traceId, `Transport failure for ${targetUrl}`, {
        name: error?.name || 'Error',
        message: error?.message || String(error),
        code: error?.code || null,
        cause: error?.cause?.message || error?.cause || null,
      });
    }
  }

  if (lastError) {
    const detail = {
      lastTarget: lastError.url,
      name: lastError.error?.name || 'Error',
      message: lastError.error?.message || 'unknown error',
      code: lastError.error?.code || null,
      cause: lastError.error?.cause?.message || lastError.error?.cause || null,
      traceId,
    };
    throw new Error(`All Ollama endpoints failed. ${JSON.stringify(detail)}`);
  }

  throw new Error('No Ollama endpoint candidates available');
}

async function resolveOllamaModelName(requestedModel) {
  const rawModel = String(requestedModel || OLLAMA_MODEL || '').trim();
  if (!rawModel) {
    return OLLAMA_MODEL;
  }

  const candidates = getOllamaApiCandidates();
  for (const baseUrl of candidates) {
    try {
      const response = await fetch(`${baseUrl}/tags`);
      const payload = await response.json();
      if (!response.ok) continue;

      const models = Array.isArray(payload?.models) ? payload.models : [];
      const modelNames = models
        .map((item) => item?.model || item?.name)
        .filter(Boolean)
        .map(String);

      if (modelNames.includes(rawModel)) {
        return rawModel;
      }

      const latestVariant = `${rawModel}:latest`;
      if (modelNames.includes(latestVariant)) {
        return latestVariant;
      }
    } catch (_error) {
      // noop, fetchOllamaJson will provide the final transport error later
    }
  }

  return rawModel;
}

app.get('/api/database/status', async (_req, res) => {
  try {
    const payload = await getDatabaseStatus();
    res.json({
      ...payload,
      configured: true,
      source: 'postgresql',
    });
  } catch (error) {
    res.status(503).json({
      available: false,
      configured: false,
      source: 'postgresql',
      databaseUrl: DATABASE_URL,
      error: error.message || 'Database unavailable',
    });
  }
});

app.post('/api/db/query', async (req, res) => {
  try {
    const sql = typeof req.body?.sql === 'string' ? req.body.sql : '';
    const database = typeof req.body?.database === 'string' ? req.body.database : 'default';
    if (!sql.trim()) {
      res.status(400).json({ error: 'SQL query required' });
      return;
    }

    console.log(`[DB] Executing query on ${database}: ${sql.slice(0, 200)}`);
    const rows = await executeReadOnlyQuery(sql, database);
    res.json({
      success: true,
      rowCount: rows.length,
      data: rows,
      database,
    });
  } catch (error) {
    console.error('[DB] Error:', error.message || error);
    res.status(500).json({ error: error.message || 'Database query failed' });
  }
});

app.get('/api/rag/status', async (req, res) => {
  try {
    const database = normalizeLocalRagDatabase(req.query.database);
    const stats = await gatherLocalRagStats(database);
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error?.message || 'Failed to load local RAG status',
    });
  }
});

app.get('/api/rag/job/:jobId', async (req, res) => {
  const job = getLocalRagJobStatus(req.params.jobId);
  if (!job) {
    return res.status(404).json({
      success: false,
      error: 'RAG job not found',
    });
  }

  res.json({
    success: true,
    data: job,
  });
});

app.post('/api/rag/job/:jobId/cancel', async (req, res) => {
  const job = cancelLocalRagJob(req.params.jobId);
  if (!job) {
    return res.status(404).json({
      success: false,
      error: 'RAG job not found',
    });
  }

  res.json({
    success: true,
    data: job,
  });
});

app.post('/api/rag/vectorize', async (req, res) => {
  try {
    const job = await startLocalRagVectorizationJob({
      database: req.body?.database,
      batchSize: req.body?.batchSize,
      sourceTables: req.body?.sourceTables,
    });
    res.json({
      success: true,
      data: {
        ...job,
        embeddingModel: LOCAL_RAG_EMBEDDING_MODEL,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error?.message || 'Failed to start vectorization job',
    });
  }
});

app.post('/api/rag/search', async (req, res) => {
  try {
    const payload = await searchLocalRag({
      database: req.body?.database,
      query: req.body?.query,
      topK: req.body?.topK,
      sourceTables: req.body?.sourceTables,
      sourceScopes: req.body?.sourceScopes,
      queryBudget: req.body?.queryBudget,
      mode: req.body?.mode,
    });
    res.json({
      success: true,
      data: payload,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error?.message || 'Failed to run local RAG search',
    });
  }
});

app.post('/api/rag/context', async (req, res) => {
  try {
    const payload = await buildLocalRagPromptContext({
      database: req.body?.database,
      query: req.body?.query,
      topK: req.body?.topK,
      sourceTables: req.body?.sourceTables,
      sourceScopes: req.body?.sourceScopes,
      queryBudget: req.body?.queryBudget,
      filterProfile: req.body?.filterProfile,
      includeRelationLayer: req.body?.includeRelationLayer,
      mode: req.body?.mode,
    });
    res.json({
      success: true,
      data: payload,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error?.message || 'Failed to build RAG context',
    });
  }
});

app.post('/api/rag/answer', async (req, res) => {
  try {
    const payload = await answerWithLocalRag({
      database: req.body?.database,
      query: req.body?.query,
      topK: req.body?.topK,
      sourceTables: req.body?.sourceTables,
      sourceScopes: req.body?.sourceScopes,
      queryBudget: req.body?.queryBudget,
      filterProfile: req.body?.filterProfile,
      includeRelationLayer: req.body?.includeRelationLayer,
      mode: req.body?.mode,
      model: req.body?.model || LOCAL_RAG_ANSWER_MODEL,
      systemPrompt: req.body?.systemPrompt,
      temperature: req.body?.temperature,
      numCtx: req.body?.numCtx,
      responseMaxChars: req.body?.responseMaxChars,
      numPredict: req.body?.numPredict,
    });
    res.json({
      success: true,
      data: payload,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error?.message || 'Failed to generate local RAG answer',
    });
  }
});

app.get('/api/mmss-invariants/status', async (req, res) => {
  try {
    const database = normalizeLocalRagDatabase(req.query.database);
    const stats = await gatherMmssInvariantsStats(database);
    res.json({
      success: true,
      data: {
        ...stats,
        table: MMSS_INVARIANTS_TABLE,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error?.message || 'Failed to load MMSS invariant status',
    });
  }
});

app.post('/api/mmss-invariants/seed/sync', async (req, res) => {
  try {
    const database = normalizeLocalRagDatabase(req.body?.database || req.query?.database);
    const summary = await syncMmssOntologySeed(database);
    res.json({
      success: true,
      data: {
        database,
        ...summary,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error?.message || 'Failed to sync MMSS ontology seed',
    });
  }
});

app.post('/api/mmss-invariants/extract', async (req, res) => {
  try {
    const job = await startMmssInvariantsExtractionJob({
      database: req.body?.database,
      sourceTables: req.body?.sourceTables,
      batchSize: req.body?.batchSize,
      syncSeed: req.body?.syncSeed,
    });
    res.json({
      success: true,
      data: job,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error?.message || 'Failed to start MMSS invariant extraction job',
    });
  }
});

app.get('/api/mmss-invariants/job/:jobId', async (req, res) => {
  const job = getMmssInvariantsJobStatus(req.params.jobId);
  if (!job) {
    return res.status(404).json({
      success: false,
      error: 'MMSS invariant job not found',
    });
  }

  res.json({
    success: true,
    data: job,
  });
});

app.post('/api/mmss-invariants/job/:jobId/cancel', async (req, res) => {
  const job = cancelMmssInvariantsJob(req.params.jobId);
  if (!job) {
    return res.status(404).json({
      success: false,
      error: 'MMSS invariant job not found',
    });
  }

  res.json({
    success: true,
    data: job,
  });
});

app.post('/api/mmss/skill-tree/design', async (req, res) => {
  try {
    const payload = await designMmssSkillTree({
      database: req.body?.database,
      goal: req.body?.goal,
      sourceTables: req.body?.sourceTables,
      sourceScopes: req.body?.sourceScopes,
      topK: req.body?.topK,
      queryBudget: req.body?.queryBudget,
      filterProfile: req.body?.filterProfile,
      includeRelationLayer: req.body?.includeRelationLayer,
      model: req.body?.model || LOCAL_RAG_ANSWER_MODEL,
      ownerScope: req.body?.ownerScope,
      contextHint: req.body?.contextHint,
      responseMaxChars: req.body?.responseMaxChars,
      mode: req.body?.mode,
    });
    res.json({
      success: true,
      data: payload,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error?.message || 'Failed to design MMSS skill tree',
    });
  }
});

app.post('/api/mmss/skill-tree/design/async', async (req, res) => {
  try {
    const job = await startDesignSkillTreeJob({
      database: req.body?.database,
      goal: req.body?.goal,
      sourceTables: req.body?.sourceTables,
      sourceScopes: req.body?.sourceScopes,
      topK: req.body?.topK,
      queryBudget: req.body?.queryBudget,
      filterProfile: req.body?.filterProfile,
      includeRelationLayer: req.body?.includeRelationLayer,
      model: req.body?.model || LOCAL_RAG_ANSWER_MODEL,
      ownerScope: req.body?.ownerScope,
      contextHint: req.body?.contextHint,
      responseMaxChars: req.body?.responseMaxChars,
      mode: req.body?.mode,
    });
    res.json({
      success: true,
      data: job,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error?.message || 'Failed to start async MMSS skill tree design job',
    });
  }
});

app.get('/api/mmss/skill-tree/design/job/:jobId', async (req, res) => {
  const job = getDesignSkillTreeJobStatus(req.params.jobId);
  if (!job) {
    return res.status(404).json({
      success: false,
      error: 'MMSS skill tree design job not found',
    });
  }

  res.json({
    success: true,
    data: job,
  });
});

app.post('/api/mmss/skill-tree/design/job/:jobId/cancel', async (req, res) => {
  const job = cancelDesignSkillTreeJob(req.params.jobId);
  if (!job) {
    return res.status(404).json({
      success: false,
      error: 'MMSS skill tree design job not found',
    });
  }

  res.json({
    success: true,
    data: job,
  });
});

app.get('/api/mmss/runtime/health', async (req, res) => {
  try {
    const database = normalizeLocalRagDatabase(req.query.database);
    const payload = await getMmssRuntimeHealth(database);
    res.json({
      success: true,
      data: payload,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error?.message || 'Failed to load MMSS runtime health',
    });
  }
});

app.get('/api/mmss/custom-instructions', async (req, res) => {
  try {
    const database = normalizeLocalRagDatabase(req.query.database);
    const payload = await listCustomInstructions(database, {
      limit: req.query.limit,
    });
    res.json({
      success: true,
      data: {
        database,
        items: payload,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error?.message || 'Failed to list MMSS custom instructions',
    });
  }
});

app.post('/api/mmss/custom-instructions', async (req, res) => {
  try {
    const database = normalizeLocalRagDatabase(req.body?.database || req.query?.database);
    const payload = await saveCustomInstruction(database, {
      instructionId: req.body?.instructionId,
      title: req.body?.title,
      category: req.body?.category,
      instructionText: req.body?.instructionText,
      sourceLabel: req.body?.sourceLabel,
      metadata: req.body?.metadata,
    });
    res.json({
      success: true,
      data: {
        database,
        item: payload,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error?.message || 'Failed to save MMSS custom instruction',
    });
  }
});

app.post('/api/mmss/albums/save-generated', async (req, res) => {
  try {
    const database = normalizeLocalRagDatabase(req.body?.database || req.query?.database);
    const payload = await saveGeneratedAlbum(database, {
      answerResult: req.body?.answerResult,
      answer: req.body?.answer,
      query: req.body?.query,
      mode: req.body?.mode,
      retrievedSources: req.body?.retrievedSources,
      score: req.body?.score,
      albumId: req.body?.albumId,
      collectionEntryId: req.body?.collectionEntryId,
    });
    res.json({
      success: true,
      data: {
        database,
        ...payload,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error?.message || 'Failed to save generated MMSS album draft',
    });
  }
});

app.post('/api/mmss/albums/build-flowmusic-payload', async (req, res) => {
  try {
    const database = normalizeLocalRagDatabase(req.body?.database || req.query?.database);
    const payload = await buildGeneratedAlbumFlowmusicPayload(database, {
      answerResult: req.body?.answerResult,
      answer: req.body?.answer,
      query: req.body?.query,
      mode: req.body?.mode,
      retrievedSources: req.body?.retrievedSources,
    });
    res.json({
      success: true,
      data: {
        database,
        ...payload,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error?.message || 'Failed to build Flowmusic album payload',
    });
  }
});

app.post('/api/rag-chunks/refresh', async (_req, res) => {
  try {
    const job = await startRagChunkRefreshJob();
    res.json({
      success: true,
      data: job,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error?.message || 'Failed to start rag_chunks refresh job',
    });
  }
});

app.post('/api/rag_chunks/refresh', async (_req, res) => {
  try {
    const job = await startRagChunkRefreshJob();
    res.json({
      success: true,
      data: job,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error?.message || 'Failed to start rag_chunks refresh job',
    });
  }
});

app.get('/api/rag-chunks/refresh/:jobId', async (req, res) => {
  const job = getRagChunkRefreshJob(req.params.jobId);
  if (!job) {
    return res.status(404).json({
      success: false,
      error: 'rag_chunks refresh job not found',
    });
  }

  res.json({
    success: true,
    data: {
      ...job,
      child: undefined,
    },
  });
});

app.post('/api/rag-chunks/refresh/:jobId/cancel', async (req, res) => {
  const job = cancelRagChunkRefreshJob(req.params.jobId);
  if (!job) {
    return res.status(404).json({
      success: false,
      error: 'rag_chunks refresh job not found',
    });
  }

  res.json({
    success: true,
    data: {
      ...job,
      child: undefined,
    },
  });
});

app.post('/api/mmss/tracks-prompts/sync', async (req, res) => {
  try {
    const database = normalizeLocalRagDatabase(req.body?.database || req.query?.database);
    const payload = await syncTrackPrompts(database);
    res.json({
      success: true,
      data: {
        database,
        ...payload,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error?.message || 'Failed to sync MMSS track prompts',
    });
  }
});

app.post('/api/mmss/filtered/sync', async (req, res) => {
  try {
    const database = normalizeLocalRagDatabase(req.body?.database || req.query?.database);
    const payload = await syncMmssFiltered(database, {
      sessionLimit: req.body?.sessionLimit || req.query?.sessionLimit,
      trackLimit: req.body?.trackLimit || req.query?.trackLimit,
    });
    res.json({
      success: true,
      data: {
        database,
        ...payload,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error?.message || 'Failed to sync MMSS filtered data',
    });
  }
});

app.post('/api/mmss/collection/sync-from-filtered', async (req, res) => {
  try {
    const database = normalizeLocalRagDatabase(req.body?.database || req.query?.database);
    const payload = await syncCollectionFromFiltered(database, {
      rowLimit: req.body?.rowLimit || req.query?.rowLimit,
      minScore: req.body?.minScore || req.query?.minScore,
      maxRows: req.body?.maxRows || req.query?.maxRows,
    });
    res.json({
      success: true,
      data: {
        database,
        ...payload,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error?.message || 'Failed to sync MMSS collection from filtered data',
    });
  }
});

app.post('/api/mmss/skill-tree/run/dummy', async (req, res) => {
  try {
    const payload = await runDummySkillTreeExecution({
      database: req.body?.database,
      treeId: req.body?.treeId,
      skillSetId: req.body?.skillSetId,
      skillId: req.body?.skillId,
      mode: req.body?.mode,
      inputPayload: req.body?.inputPayload,
    });
    res.json({
      success: true,
      data: payload,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error?.message || 'Failed to run dummy MMSS skill tree execution',
    });
  }
});

app.get('/api/persistence/settings/:scope', async (req, res) => {
  try {
    const values = await listSettings(req.params.scope);
    res.json({ scope: req.params.scope, values });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/persistence/settings/:scope/:settingKey', async (req, res) => {
  try {
    const stored = await getSetting(req.params.scope, req.params.settingKey);
    res.json({
      scope: req.params.scope,
      key: req.params.settingKey,
      value: stored?.value ?? null,
      updatedAt: stored?.updatedAt ?? null,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/persistence/settings/:scope', async (req, res) => {
  try {
    const values = req.body?.values && typeof req.body.values === 'object' ? req.body.values : {};
    const updated = await setSettings(req.params.scope, values);
    res.json({ ok: true, scope: req.params.scope, values: updated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/persistence/settings/:scope/:settingKey', async (req, res) => {
  try {
    const stored = await setSetting(req.params.scope, req.params.settingKey, req.body?.value ?? null);
    res.json({
      ok: true,
      scope: req.params.scope,
      key: req.params.settingKey,
      value: stored.value,
      updatedAt: stored.updatedAt,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/persistence/settings/:scope/:settingKey', async (req, res) => {
  try {
    await deleteSetting(req.params.scope, req.params.settingKey);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/persistence/settings/:scope', async (req, res) => {
  try {
    await clearSettings(req.params.scope);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/persistence/entities/:scope', async (req, res) => {
  try {
    const items = await listEntities(req.params.scope);
    res.json({
      scope: req.params.scope,
      items: items.map((item) => item.payload),
      total: items.length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/persistence/entities/:scope/:entityKey', async (req, res) => {
  try {
    const entity = await getEntity(req.params.scope, req.params.entityKey);
    if (!entity) {
      res.status(404).json({ error: 'Entity not found' });
      return;
    }
    res.json(entity.payload);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/persistence/entities/:scope/batch', async (req, res) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const keyField = req.body?.keyField || 'id';
    const stored = await upsertEntities(req.params.scope, items, keyField);
    res.json({
      ok: true,
      total: stored.length,
      items: stored.map((item) => item.payload),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/persistence/entities/:scope/:entityKey', async (req, res) => {
  try {
    const stored = await upsertEntity(req.params.scope, req.params.entityKey, req.body?.item ?? req.body ?? {});
    res.json({
      ok: true,
      item: stored.payload,
      updatedAt: stored.updatedAt,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/persistence/entities/:scope/:entityKey', async (req, res) => {
  try {
    await deleteEntity(req.params.scope, req.params.entityKey);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/persistence/entities/:scope', async (req, res) => {
  try {
    await clearEntities(req.params.scope);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/persistence/stats', async (_req, res) => {
  try {
    const scopes = ['tracks', 'sessions', 'fragments', 'raw_prompts', 'prompt_blocks', 'prompt_sequences', 'accounts'];
    const counts = {};
    for (const scope of scopes) {
      counts[scope] = await countEntities(scope);
    }
    res.json(counts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

async function readJsonFileSafe(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (_error) {
    return fallback;
  }
}

async function writeJsonFileSafe(filePath, payload) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8');
}

async function readDbSettingWithFallback(scope, settingKey, fallback, filePath) {
  try {
    const stored = await getSetting(scope, settingKey);
    if (stored && typeof stored.value !== 'undefined') {
      return stored.value;
    }
  } catch (_error) {
    // fall through to file fallback
  }

  if (filePath) {
    const fileValue = await readJsonFileSafe(filePath, fallback);
    try {
      await setSetting(scope, settingKey, fileValue);
    } catch (_error) {
      // noop
    }
    return fileValue;
  }

  return fallback;
}

async function writeDbSettingWithMirror(scope, settingKey, payload, filePath) {
  await setSetting(scope, settingKey, payload);
  if (filePath) {
    await writeJsonFileSafe(filePath, payload);
  }
}

app.get('/api/mistral/status', (_req, res) => {
  const hasKey = Boolean(process.env.MISTRAL_API_KEY && process.env.MISTRAL_API_KEY.length > 10);
  res.json({
    configured: hasKey,
    available: hasKey,
    source: hasKey ? 'server_env' : 'missing',
    defaultModel: MISTRAL_MODEL,
    supportedModes: Object.keys(MISTRAL_MODE_PROFILES),
  });
});

app.post('/api/mistral/chat', async (req, res) => {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: 'Mistral API key is not configured on server' });
    return;
  }

  try {
    const mode = normalizeMistralMode(req.body?.mode);
    const profile = MISTRAL_MODE_PROFILES[mode];
    const messages = normalizeMistralMessages(req.body);

    if (!messages.length) {
      res.status(400).json({
        error: `Mistral proxy requires either messages[] or prompt for mode "${mode}"`,
      });
      return;
    }

    const outboundPayload = {
      model: req.body?.model || MISTRAL_MODEL,
      messages,
      temperature: req.body?.temperature ?? profile.temperature,
      max_tokens: req.body?.max_tokens ?? profile.max_tokens,
      response_format: req.body?.response_format || profile.response_format,
    };

    console.log(
      `[MISTRAL] mode=${mode} model=${outboundPayload.model} messages=${messages.length} temp=${outboundPayload.temperature} max_tokens=${outboundPayload.max_tokens}`,
    );

    const response = await fetch(`${MISTRAL_API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(outboundPayload),
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

app.get('/api/ollama/status', async (_req, res) => {
  try {
    const response = await fetch(`${OLLAMA_API_BASE}/tags`);
    const payload = await response.json();
    if (!response.ok) {
      res.status(response.status).json({ error: payload });
      return;
    }

    const models = Array.isArray(payload?.models) ? payload.models : [];
    const modelNames = models
      .map((item) => item?.model || item?.name)
      .filter(Boolean);
    res.json({
      configured: true,
      available: true,
      source: 'local_ollama',
      defaultModel: OLLAMA_MODEL,
      recommendedModel: 'gemma3:4b',
      models: modelNames,
      hasGemma: modelNames.some((name) => String(name).startsWith('gemma')),
      note: 'Local Ollama endpoint detected. The current wired Gemma family target is gemma3.',
    });
  } catch (error) {
    res.status(503).json({
      configured: false,
      available: false,
      source: 'missing',
      defaultModel: OLLAMA_MODEL,
      error: error.message || 'Ollama status request failed',
    });
  }
});

app.post('/api/ollama/generate', async (req, res) => {
  try {
    const traceId = createTraceId('ollama');
    const { model, prompt, stream, options, context } = req.body || {};
    const targetModel = await resolveOllamaModelName(model || OLLAMA_MODEL);
    const dbEnabled = Boolean(context?.enableDB);
    
    debugLog('OLLAMA', traceId, 'Incoming /api/ollama/generate', {
      requestedModel: model || OLLAMA_MODEL,
      targetModel,
      stream,
      dbEnabled,
      promptChars: String(prompt || '').length,
      promptPreview: toPreview(prompt, 300),
      options: options || {},
    });
    const firstPass = await fetchOllamaJson('/generate', {
      model: targetModel,
      prompt,
      stream: stream || false,
      options: options || {},
      traceId,
    });

    if (!firstPass.ok) {
      console.error('[OLLAMA] Error response:', firstPass.text);
      res.status(firstPass.status).json({
        error: firstPass.text,
        targetUrl: firstPass.url,
        model: targetModel,
        traceId,
      });
      return;
    }

    const payload = firstPass.text ? JSON.parse(firstPass.text) : {};
    const detectedSql = dbEnabled ? extractSqlBlock(payload?.response) : null;

    if (!detectedSql) {
      debugLog('OLLAMA', traceId, 'Returning first-pass response without SQL tool call', {
        responsePreview: toPreview(payload?.response || '', 300),
      });
      res.json({
        ...payload,
        targetModel,
        traceId,
      });
      return;
    }

    debugLog('OLLAMA', traceId, 'SQL bridge activated', {
      sql: detectedSql.slice(0, 400),
    });

    const dbRows = await executeReadOnlyQuery(detectedSql);
    debugLog('DB', traceId, 'SQL query result ready', {
      rowCount: dbRows.length,
      preview: toPreview(dbRows, 300),
    });
    const followUp = await fetchOllamaJson('/generate', {
      model: targetModel,
      prompt: buildOllamaDatabaseFollowUpPrompt(prompt, detectedSql, dbRows),
      stream: false,
      options: options || {},
      traceId,
    });

    if (!followUp.ok) {
      console.error('[OLLAMA] Follow-up error response:', followUp.text);
      res.status(followUp.status).json({
        error: followUp.text,
        targetUrl: followUp.url,
        model: targetModel,
        traceId,
      });
      return;
    }

    const followUpPayload = followUp.text ? JSON.parse(followUp.text) : {};
    debugLog('OLLAMA', traceId, 'Returning follow-up response after SQL tool call', {
      responsePreview: toPreview(followUpPayload?.response || '', 300),
      rowCount: dbRows.length,
    });
    res.json({
      ...followUpPayload,
      toolCall: {
        used: true,
        sql: detectedSql,
        rowCount: dbRows.length,
      },
      targetModel,
      traceId,
    });
  } catch (error) {
    console.error('[OLLAMA] Request failed:', error);
    console.error('[OLLAMA] Error details:', error.message);
    console.error('[OLLAMA] OLLAMA_API_BASE:', OLLAMA_API_BASE);
    res.status(500).json({ 
      error: error.message || 'Ollama proxy request failed',
      targetCandidates: getOllamaApiCandidates(),
      requestedModel: req.body?.model || OLLAMA_MODEL,
      promptChars: String(req.body?.prompt || '').length,
      details: 'Make sure Ollama is running on the configured endpoint'
    });
  }
});

app.get('/api/agents/status', async (_req, res) => {
  try {
    const response = await fetch(`${FLOWMUSIC_AGENT_API_BASE}/health`);
    const payload = await response.json();
    if (!response.ok) {
      res.status(response.status).json(payload);
      return;
    }
    res.json(payload);
  } catch (error) {
    res.status(503).json({
      available: false,
      provider: 'ollama',
      default_model: OLLAMA_MODEL,
      error: error.message || 'Flowmusic agent service unavailable',
    });
  }
});

app.post('/api/agents/generate-flowmusic', async (req, res) => {
  try {
    const response = await fetch(`${FLOWMUSIC_AGENT_API_BASE}/generate-flowmusic`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body || {}),
    });
    const raw = await response.text();
    if (!response.ok) {
      res.status(response.status).type('application/json').send(raw);
      return;
    }
    res.type('application/json').send(raw);
  } catch (error) {
    res.status(503).json({
      error: error.message || 'Flowmusic agent service unavailable',
    });
  }
});

app.get('/api/mmss/library-state', async (_req, res) => {
  const payload = await readDbSettingWithFallback('mmss', 'library-state', {
    promptLibrary: null,
    updatedAt: null,
  }, MMSS_LIBRARY_STATE_PATH);
  res.json(payload);
});

app.get('/api/mmss/ontology', async (_req, res) => {
  try {
    const raw = await fs.readFile(MMSS_ONTOLOGY_SEED_PATH, 'utf8');
    const data = JSON.parse(raw);
    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Failed to read MMSS ontology seed', error);
    res.status(500).json({
      success: false,
      error: error?.message || 'Failed to read MMSS ontology seed',
    });
  }
});

app.get('/api/prompt-library/blocks', async (_req, res) => {
  const payload = await readJsonFileSafe(MMSS_LIBRARY_STATE_PATH, {
    promptLibrary: { blocks: [], sequences: [] },
    updatedAt: null,
  });
  const promptLibrary = payload?.promptLibrary || { blocks: [], sequences: [] };
  res.json({
    blocks: Array.isArray(promptLibrary.blocks) ? promptLibrary.blocks : [],
    sequences: Array.isArray(promptLibrary.sequences) ? promptLibrary.sequences : [],
    updatedAt: payload?.updatedAt || null,
  });
});

app.post('/api/mmss/library-state', async (req, res) => {
  try {
    const payload = {
      promptLibrary: req.body?.promptLibrary || null,
      updatedAt: new Date().toISOString(),
    };
    await writeDbSettingWithMirror('mmss', 'library-state', payload, MMSS_LIBRARY_STATE_PATH);
    await writeJsonFileSafe(PROMPT_DB_LOCAL_LIBRARY_MIRROR_PATH, payload);
    const blockCount = Array.isArray(payload.promptLibrary?.blocks) ? payload.promptLibrary.blocks.length : 0;
    const sequenceCount = Array.isArray(payload.promptLibrary?.sequences) ? payload.promptLibrary.sequences.length : 0;
    console.log(`[MMSS] library-state updated: ${blockCount} block(s), ${sequenceCount} sequence(s) at ${payload.updatedAt}`);
    res.json({ ok: true, updatedAt: payload.updatedAt });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/mmss/genesis-handoff', async (_req, res) => {
  const payload = await readDbSettingWithFallback('mmss', 'genesis-handoff', {
    json: null,
    source: null,
    updatedAt: null,
  }, MMSS_GENESIS_HANDOFF_PATH);
  res.json(payload);
});

app.post('/api/mmss/genesis-handoff', async (req, res) => {
  try {
    const payload = {
      json: req.body?.json ?? null,
      source: req.body?.source ?? 'my-app',
      updatedAt: new Date().toISOString(),
    };
    await writeDbSettingWithMirror('mmss', 'genesis-handoff', payload, MMSS_GENESIS_HANDOFF_PATH);
    console.log(`[MMSS] genesis-handoff updated from ${payload.source} at ${payload.updatedAt}`);
    res.json({ ok: true, updatedAt: payload.updatedAt });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/mmss/import-queue', async (_req, res) => {
  const queue = await readDbSettingWithFallback('mmss', 'import-queue', [], MMSS_IMPORT_QUEUE_PATH);
  res.json({ items: queue });
});

app.post('/api/mmss/import-queue', async (req, res) => {
  try {
    const queue = await readDbSettingWithFallback('mmss', 'import-queue', [], MMSS_IMPORT_QUEUE_PATH);
    const nextItem = {
      id: `import_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      json: req.body?.json ?? null,
      source: req.body?.source ?? 'json-genesis',
      createdAt: new Date().toISOString(),
    };
    queue.push(nextItem);
    await writeDbSettingWithMirror('mmss', 'import-queue', queue, MMSS_IMPORT_QUEUE_PATH);
    console.log(`[MMSS] import queued from ${nextItem.source}: ${nextItem.id}`);
    res.json({ ok: true, item: nextItem });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/mmss/import-queue/ack', async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const queue = await readDbSettingWithFallback('mmss', 'import-queue', [], MMSS_IMPORT_QUEUE_PATH);
    const nextQueue = queue.filter((item) => !ids.includes(item.id));
    await writeDbSettingWithMirror('mmss', 'import-queue', nextQueue, MMSS_IMPORT_QUEUE_PATH);
    res.json({ ok: true, removed: ids.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/mmss/mistral-preset', async (_req, res) => {
  const payload = await readDbSettingWithFallback('mmss', 'mistral-preset', {
    preset: null,
    updatedAt: null,
  }, MMSS_MISTRAL_PRESET_PATH);
  res.json(payload);
});

app.post('/api/mmss/mistral-preset', async (req, res) => {
  try {
    const payload = {
      preset: req.body?.preset ?? null,
      updatedAt: new Date().toISOString(),
    };
    await writeDbSettingWithMirror('mmss', 'mistral-preset', payload, MMSS_MISTRAL_PRESET_PATH);
    console.log(`[MMSS] mistral-preset updated at ${payload.updatedAt}`);
    res.json({ ok: true, updatedAt: payload.updatedAt });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/mmss/retrieval-candidates', async (req, res) => {
  try {
    const payload = await readDbSettingWithFallback('mmss', 'library-state', {
      promptLibrary: null,
      updatedAt: null,
    }, MMSS_LIBRARY_STATE_PATH);
    const promptLibrary = payload?.promptLibrary || { blocks: [] };
    const query = {
      prompt: req.body?.prompt || '',
      queries: Array.isArray(req.body?.queries) ? req.body.queries : [],
      blockRoles: Array.isArray(req.body?.blockRoles) ? req.body.blockRoles : [],
      limit: Number(req.body?.limit) || 8,
    };
    const pinnedIds = Array.isArray(req.body?.pinnedIds) ? req.body.pinnedIds : [];
    const index = buildRetrievalIndex(promptLibrary);
    const result = searchRetrievalIndex(index, query, { pinnedIds });
    const items = Array.isArray(result?.items) ? result.items : [];
    const meta = result?.meta || {};

    console.log(
      `[MMSS] retrieval-candidates: ${items.length} hit(s) from ${index.length} block(s); tokens=${Array.isArray(meta.tokens) ? meta.tokens.length : 0}; roles=${Array.isArray(meta.blockRoles) ? meta.blockRoles.length : 0}`,
    );
    res.json({
      items,
      total: items.length,
      indexedBlocks: index.length,
      query: meta,
      updatedAt: payload?.updatedAt || null,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/mmss/validate-json', async (req, res) => {
  try {
    const payload = req.body?.json;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      res.status(400).json({ error: 'Validation requires a JSON object payload in body.json' });
      return;
    }

    const contract = {
      ...DEFAULT_MMSS_METRICS_CONTRACT,
      ...(req.body?.contract || {}),
    };
    const report = buildMmssQualityReport(payload, contract);

    console.log(
      `[MMSS] validate-json: valid=${report.valid} score=${report.score} metrics=${report.detectedMetrics.length} operators=${report.detectedOperatorFamilies.length}`,
    );

    res.json({
      ok: true,
      report,
      validatedAt: new Date().toISOString(),
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

function normalizeMistralMode(input) {
  const value = String(input || 'generate').toLowerCase();
  return Object.prototype.hasOwnProperty.call(MISTRAL_MODE_PROFILES, value) ? value : 'generate';
}

function normalizeMistralMessages(body = {}) {
  if (Array.isArray(body?.messages) && body.messages.length) {
    return body.messages;
  }
  if (typeof body?.prompt === 'string' && body.prompt.trim()) {
    return [{ role: 'user', content: body.prompt }];
  }
  return [];
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
    ...buildFreshRuntimeEnv(),
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
