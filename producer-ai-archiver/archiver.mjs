#!/usr/bin/env node

/**
 * FlowMusic.app archival utility — downloads all songs, covers, and metadata.
 *
 * Architecture:
 *   Uses Playwright to run a real Chromium browser. All API calls are made via
 *   page.evaluate(fetch(...)) inside the browser tab. This bypasses Cloudflare
 *   bot detection and ensures proper cookie/CORS handling.
 *
 * Auth:
 *   FlowMusic.app uses Supabase Auth with chunked cookies (sb-api-auth-token.0,
 *   sb-api-auth-token.1). The access_token JWT is extracted and used as a
 *   Bearer token. Session is persisted to producer_auth.json via Playwright's
 *   storageState. All fetch() calls include credentials:'include' to send
 *   cookies alongside the Bearer header.
 *
 * Persistence:
 *   - producer_manifest.json: streamed item-by-item (avoids V8 string limit)
 *   - completion.json: set of downloaded IDs for resume capability
 *   - Both use atomic writes (temp file + rename) to prevent corruption
 *
 * Usage:
 *   1) First run or expired session:
 *      pnpm producer:archive --headful
 *   2) Subsequent runs:
 *      pnpm producer:archive
 *   3) Skip re-harvesting metadata (just download missing files):
 *      pnpm producer:archive --skip-harvest
 *
 * Environment variables:
 *   PRODUCER_BASE_URL    (default: https://www.flowmusic.app)
 *   PRODUCER_OUTPUT_DIR  (default: ./producer_backup)
 *   PRODUCER_AUTH_STATE  (default: ./producer_auth.json)
 *   PRODUCER_CONCURRENCY (default: 8)
 *
 * See docs/PRODUCER_ARCHIVER.md for full technical reference.
 */

import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';
import PQueue from 'p-queue';
import pRetry, { AbortError } from 'p-retry';

const BASE_URL = process.env.PRODUCER_BASE_URL ?? 'https://www.flowmusic.app';
const OUTPUT_DIR = process.env.PRODUCER_OUTPUT_DIR ?? './producer_backup';
const AUTH_STATE = process.env.PRODUCER_AUTH_STATE ?? './producer_auth.json';
const CONCURRENCY = Number(process.env.PRODUCER_CONCURRENCY ?? 8);
const MANIFEST_PATH = path.join(OUTPUT_DIR, 'producer_manifest.json');
const COMPLETION_PATH = path.join(OUTPUT_DIR, 'completion.json');
const LOGIN_READY_FILE = path.resolve('./producer_login_ready');
const SESSIONS_DIR = path.join(OUTPUT_DIR, 'sessions');
const SESSION_SUMMARY_PATH = path.join(OUTPUT_DIR, 'session_capture_summary.json');

if (!Number.isFinite(CONCURRENCY) || CONCURRENCY < 1) {
  throw new Error(`Invalid PRODUCER_CONCURRENCY: ${process.env.PRODUCER_CONCURRENCY}`);
}

const args = new Set(process.argv.slice(2));
if (args.has('--help')) {
  console.log([
    'Usage: pnpm producer:archive [--headful] [--skip-harvest]',
    '',
    'Options:',
    '  --headful      Open browser to log in (required on first run or when session expires)',
    '  --skip-harvest Skip harvest and go straight to downloading from existing manifest',
    '  --help         Show this help message',
  ].join('\n'));
  process.exit(0);
}

const forceHeadful = args.has('--headful') || args.has('--headfull');
const skipHarvest = args.has('--skip-harvest');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safeName(input) {
  return String(input || 'untitled')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 90);
}

function inferExtension(url, fallback) {
  if (!url) return fallback;
  const withoutQuery = url.split('?')[0].toLowerCase();
  if (withoutQuery.endsWith('.wav')) return 'wav';
  if (withoutQuery.endsWith('.m4a')) return 'm4a';
  if (withoutQuery.endsWith('.mp3')) return 'mp3';
  if (withoutQuery.endsWith('.mp4')) return 'mp4';
  if (withoutQuery.endsWith('.jpg') || withoutQuery.endsWith('.jpeg')) return 'jpg';
  if (withoutQuery.endsWith('.png')) return 'png';
  if (withoutQuery.endsWith('.webp')) return 'webp';
  return fallback;
}

async function atomicWriteJson(filePath, data) {
  const tmpPath = `${filePath}.${Math.random().toString(36).slice(2)}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(data, null, 2));
  
  // Retry rename with backoff for Windows EPERM issues
  const maxRetries = 5;
  const retryDelay = 100; // ms
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await fs.rename(tmpPath, filePath);
      return;
    } catch (err) {
      if (err.code === 'EPERM' && attempt < maxRetries - 1) {
        console.warn(`[atomicWriteJson] Rename failed (attempt ${attempt + 1}/${maxRetries}), retrying in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
      } else {
        throw err;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Browser session management
// ---------------------------------------------------------------------------

async function launchBrowser(headless) {
  return chromium.launch({
    headless,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
    ignoreDefaultArgs: ['--enable-automation'],
  });
}

async function doLogin() {
  console.log('Opening browser for login...');
  const browser = await launchBrowser(false);
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 },
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });
  // Capture cookies from OAuth popups
  context.on('page', async (popup) => {
    try { await popup.waitForLoadState('networkidle', { timeout: 30000 }); } catch { /* ignore */ }
  });

  const page = await context.newPage();
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

  try { await fs.unlink(LOGIN_READY_FILE); } catch { /* ignore */ }

  console.log('\n--- LOGIN REQUIRED ---');
  console.log('1. Log in to FlowMusic.app in the browser window.');
  console.log('2. Wait until you see your song library.');
  console.log('3. In a NEW terminal run:  touch producer_login_ready');
  console.log('----------------------\n');
  console.log(`Waiting for ${LOGIN_READY_FILE} ...`);

  await new Promise((resolve) => {
    const interval = setInterval(() => {
      if (existsSync(LOGIN_READY_FILE)) { clearInterval(interval); resolve(); }
    }, 1000);
  });

  try { await page.waitForLoadState('networkidle', { timeout: 10000 }); } catch { /* ignore */ }
  await context.storageState({ path: AUTH_STATE });
  try { await fs.unlink(LOGIN_READY_FILE); } catch { /* ignore */ }
  await browser.close();
  console.log(`Session saved to ${AUTH_STATE}`);
}

// ---------------------------------------------------------------------------
// Archiver — uses page.evaluate(fetch) so all requests run inside the real
// browser tab, carrying cf_clearance and all auth cookies automatically.
// ---------------------------------------------------------------------------

class ProducerArchiver {
  constructor(page, accessToken) {
    this.page = page;
    this.accessToken = accessToken;
    this.manifest = new Map();
    this.completed = new Set();
  }

  // Runs fetch() inside the browser page with Bearer token auth.
  async get(url) {
    const result = await this.page.evaluate(async ({ url, token }) => {
      const headers = { 'Accept': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(url, { headers, credentials: 'include' });
      const text = await res.text();
      return { status: res.status, text };
    }, { url, token: this.accessToken });
    return result;
  }

  async post(url, body) {
    const result = await this.page.evaluate(async ({ url, body, token }) => {
      const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        credentials: 'include',
      });
      const text = await res.text();
      return { status: res.status, text };
    }, { url, body, token: this.accessToken });
    return result;
  }

  parseResponse(result) {
    try { return JSON.parse(result.text); } catch { return null; }
  }

  async loadPersistedState() {
    if (existsSync(MANIFEST_PATH)) {
      try {
        const text = await fs.readFile(MANIFEST_PATH, 'utf8');
        const parsed = JSON.parse(text);
        for (const item of parsed.items ?? []) this.manifest.set(item.id, item);
        console.log(`Loaded ${this.manifest.size} manifest items from disk`);
      } catch (e) {
        console.warn(`Failed to parse manifest at ${MANIFEST_PATH}: ${e.message}`);
      }
    }
    if (existsSync(COMPLETION_PATH)) {
      try {
        const text = await fs.readFile(COMPLETION_PATH, 'utf8');
        const parsed = JSON.parse(text);
        for (const id of parsed.completed ?? []) this.completed.add(id);
        console.log(`Loaded ${this.completed.size} completed item IDs`);
      } catch (e) {
        console.warn(`Failed to parse completed list at ${COMPLETION_PATH}: ${e.message}`);
      }
    }
  }

  async persistManifest() {
    const tmpPath = `${MANIFEST_PATH}.${Math.random().toString(36).slice(2)}.tmp`;
    const items = Array.from(this.manifest.values());
    const header = `{\n  "generated_at": ${JSON.stringify(new Date().toISOString())},\n  "total_items": ${items.length},\n  "items": [\n`;
    const footer = `\n  ]\n}\n`;

    // Stream items one at a time to avoid RangeError on huge manifests
    const { createWriteStream } = await import('fs');
    const ws = createWriteStream(tmpPath);
    await new Promise((resolve, reject) => {
      ws.on('error', reject);
      ws.write(header);
      for (let i = 0; i < items.length; i++) {
        const prefix = i === 0 ? '    ' : ',\n    ';
        ws.write(prefix + JSON.stringify(items[i]));
      }
      ws.write(footer);
      ws.end(resolve);
    });
    await fs.rename(tmpPath, MANIFEST_PATH);
  }

  async persistCompletion() {
    const tmpPath = `${COMPLETION_PATH}.${Math.random().toString(36).slice(2)}.tmp`;
    await fs.writeFile(tmpPath, JSON.stringify({
      completed: Array.from(this.completed).sort(),
    }, null, 2));
    
    // Retry rename with backoff for Windows EPERM issues
    const maxRetries = 5;
    const retryDelay = 100; // ms
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        await fs.rename(tmpPath, COMPLETION_PATH);
        return;
      } catch (err) {
        if (err.code === 'EPERM' && attempt < maxRetries - 1) {
          console.warn(`[persistCompletion] Rename failed (attempt ${attempt + 1}/${maxRetries}), retrying in ${retryDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
        } else {
          throw err;
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Harvest: paginate tracks API
  // -------------------------------------------------------------------------

  async harvestMetadata() {
    console.log('Harvesting all tracks via API...');

    const PAGE_SIZE = 100;
    let offset = 0;
    let totalFetched = 0;
    let newItems = 0;

    while (true) {
      const url = `${BASE_URL}/__api/clips/auth-user?limit=${PAGE_SIZE}&offset=${offset}&filter=generations&include_disliked=false`;
      const response = await this.get(url);

      if (response.status === 401 || response.status === 403) {
        console.error(`\nSession expired (HTTP ${response.status}). Re-run with --headful to log in again.`);
        process.exit(1);
      }
      if (response.status < 200 || response.status >= 300) {
        console.warn(`\nUnexpected ${response.status} at offset ${offset}, stopping harvest.`);
        break;
      }

      const data = this.parseResponse(response);
      // New API returns {clips: [...]}, handle both formats
      const tracks = data?.clips ?? (Array.isArray(data) ? data : null);
      const dataType = data ? (data.clips ? 'object-with-clips' : (Array.isArray(data) ? 'array' : typeof data)) : 'null';
      console.log(`\n[DEBUG] Response type: ${dataType}, tracks count: ${tracks?.length ?? 0}`);
      if (!Array.isArray(tracks) || tracks.length === 0) break;

      for (const track of tracks) {
        if (!track.id) continue;
        const prev = this.manifest.get(track.id);
        if (!prev) newItems++;
        this.manifest.set(track.id, {
          ...prev,
          id: track.id,
          title: track.title ?? track.name ?? `Track_${track.id.slice(0, 8)}`,
          audio_url: track.audio_url ?? prev?.audio_url ?? null,
          video_url: track.video_url ?? prev?.video_url ?? null,
          image_url: track.image_url ?? prev?.image_url ?? null,
          created_at: track.created_at ?? null,
          source_url: `${BASE_URL}/song/${track.id}`,
          sound: track.sound ?? null,
          lyrics: track.lyrics ?? null,
          duration: track.duration_s ?? null,
          
          // Enhanced metadata capture
          model_version: track.model_display_name ?? null,
          seed: track.seed ?? null,
          play_count: track.play_count ?? null,
          favorite_count: track.favorite_count ?? null,
          parent_id: track.parent_riff_id ?? null,
          transform_type: track.transform ?? null,
          conditions: track.conditions ?? null, // Generation metadata (prompts, strength, timing)
          lyrics_timestamped: track.lyrics_timestamped ?? null, // Word-by-word timestamps
          raw_data: track, // Escape hatch for all other undocumented keys
        });
      }

      totalFetched += tracks.length;
      offset += tracks.length;
      process.stdout.write(`\r  Fetched ${totalFetched} tracks (${this.manifest.size} unique)...   `);

      if (offset % 500 === 0) await this.persistManifest();
      if (tracks.length < PAGE_SIZE) break;
    }

    console.log(`\nFetched ${totalFetched} tracks, ${newItems} new. Total: ${this.manifest.size}`);
    await this.persistManifest();
    await this.enrichWithGenerations();
  }

  // -------------------------------------------------------------------------
  // Enrich: fill missing audio_url via generations API
  // -------------------------------------------------------------------------

  async enrichWithGenerations() {
    const missing = Array.from(this.manifest.values()).filter(item => !item.audio_url);
    if (missing.length === 0) { console.log('All items have audio URLs.'); return; }

    console.log(`Enriching ${missing.length} items missing audio URLs...`);

    const BATCH = 50;
    let enriched = 0;

    for (let i = 0; i < missing.length; i += BATCH) {
      const ids = missing.slice(i, i + BATCH).map(item => item.id);
      try {
        const response = await this.post(`${BASE_URL}/__api/v2/generations`, { ids });
        if (response.status < 200 || response.status >= 300) { console.warn(`\nGenerations API ${response.status} at batch ${i}`); continue; }
        const body = this.parseResponse(response);
        const generations = body.generations ?? (Array.isArray(body) ? body : []);
        for (const gen of generations) {
          if (!gen.id) continue;
          const prev = this.manifest.get(gen.id) ?? {};
          this.manifest.set(gen.id, {
            ...prev,
            audio_url: gen.audio_url ?? prev.audio_url ?? null,
            video_url: gen.video_url ?? prev.video_url ?? null,
            image_url: gen.image_url ?? prev.image_url ?? null,
          });
          if (gen.audio_url) enriched++;
        }
      } catch (err) {
        console.warn(`\nEnrichment error batch ${i}: ${err.message}`);
      }
      process.stdout.write(`\r  Enriched ${Math.min(i + BATCH, missing.length)}/${missing.length}, ${enriched} got audio...   `);
      if (i > 0 && i % 500 === 0) await this.persistManifest();
    }

    console.log(`\nEnrichment done. ${enriched}/${missing.length} items now have audio URLs.`);
    await this.persistManifest();
  }

  // -------------------------------------------------------------------------
  // Refresh a single item's URLs (no browser tab — API only)
  // -------------------------------------------------------------------------

  async refreshAssetUrl(itemId, type) {
    try {
      const response = await this.post(`${BASE_URL}/__api/v2/generations`, { ids: [itemId] });
      if (response.status < 200 || response.status >= 300) return null;
      const body = this.parseResponse(response);
      const generations = body.generations ?? (Array.isArray(body) ? body : []);
      const gen = generations.find(g => g.id === itemId);
      if (!gen) return null;
      const item = this.manifest.get(itemId);
      if (item) {
        item.audio_url = gen.audio_url ?? item.audio_url;
        item.video_url = gen.video_url ?? item.video_url;
        item.image_url = gen.image_url ?? item.image_url;
      }
      if (type === 'audio') return gen.audio_url ?? null;
      if (type === 'video') return gen.video_url ?? null;
      if (type === 'image') return gen.image_url ?? null;
    } catch { /* ignore */ }
    return null;
  }

  // -------------------------------------------------------------------------
  // Download
  // -------------------------------------------------------------------------

  async downloadAll() {
    const queue = new PQueue({ concurrency: CONCURRENCY });
    const items = Array.from(this.manifest.values());
    const total = items.length;
    let processed = 0;

    console.log(`Downloading ${total} items (${this.completed.size} already done, concurrency=${CONCURRENCY})`);

    await Promise.all(items.map(item =>
      queue.add(async () => {
        await this.downloadItem(item);
        processed++;
        process.stdout.write(`\r  Progress: ${this.completed.size}/${total} complete (${processed} processed)   `);
      })
    ));

    console.log(`\nDownload complete. ${this.completed.size}/${total} items archived.`);
  }

  async downloadItem(item) {
    if (this.completed.has(item.id)) return;

    const title = safeName(item.title);
    const itemDir = path.join(OUTPUT_DIR, item.id.slice(0, 2), `${item.id}_${title}`);
    await fs.mkdir(itemDir, { recursive: true });
    await fs.writeFile(path.join(itemDir, 'meta.json'), JSON.stringify(item, null, 2));

    await this.downloadAsset(item, 'audio', item.audio_url, itemDir, 'm4a').catch(e => console.warn(`\\nFailed audio ${item.id}: ${e.message}`));
    await this.downloadAsset(item, 'video', item.video_url, itemDir, 'mp4').catch(e => console.warn(`\\nFailed video ${item.id}: ${e.message}`));
    await this.downloadAsset(item, 'image', item.image_url, itemDir, 'jpg').catch(e => console.warn(`\\nFailed image ${item.id}: ${e.message}`));

    this.completed.add(item.id);
    await this.persistCompletion();
  }

  async downloadAsset(item, type, initialUrl, itemDir, fallbackExt) {
    let currentUrl = initialUrl;
    if (!currentUrl) {
      currentUrl = await this.refreshAssetUrl(item.id, type);
      if (!currentUrl) return;
    }

    const ext = inferExtension(currentUrl, fallbackExt);
    const outPath = path.join(itemDir, `${type}.${ext}`);
    if (existsSync(outPath)) return;

    await pRetry(async () => {
      // CDN assets don't need auth — plain fetch is fine and faster
      const response = await fetch(currentUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });

      if (response.status === 403 || response.status === 410) {
        const refreshed = await this.refreshAssetUrl(item.id, type);
        if (!refreshed) throw new AbortError(`No refreshed ${type} URL for ${item.id}`);
        currentUrl = refreshed;
        throw new Error('URL refreshed, retrying');
      }

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const bytes = Buffer.from(await response.arrayBuffer());
      await fs.writeFile(outPath, bytes);
    }, { retries: 3 });
  }

  async verifyArchive() {
    const items = Array.from(this.manifest.values());
    let downloadedAudio = 0;
    let expectedAudio = 0;
    for (const item of items) {
      if (!item.audio_url) continue;
      expectedAudio++;
      const itemDir = path.join(OUTPUT_DIR, item.id.slice(0, 2), `${item.id}_${safeName(item.title)}`);
      if (!existsSync(itemDir)) continue;
      const files = await fs.readdir(itemDir);
      if (files.some(f => f.startsWith('audio.'))) downloadedAudio++;
    }
    return {
      manifest_items: items.length,
      completed_items: this.completed.size,
      expected_audio: expectedAudio,
      downloaded_audio: downloadedAudio,
      missing_audio: expectedAudio - downloadedAudio,
    };
  }

  getConversationIdsFromManifest() {
    const ids = new Set();

    for (const item of this.manifest.values()) {
      const conversationId =
        item?.raw_data?.operation?.conversation_id ??
        item?.operation?.conversation_id ??
        null;

      if (conversationId) {
        ids.add(conversationId);
      }
    }

    return Array.from(ids);
  }

  async fetchConversation(conversationId) {
    const response = await this.get(`${BASE_URL}/__api/conversations/${conversationId}`);

    if (response.status === 401 || response.status === 403) {
      throw new Error(`Unauthorized conversation fetch for ${conversationId}`);
    }

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Conversation ${conversationId} returned HTTP ${response.status}`);
    }

    const body = this.parseResponse(response);
    if (!body || typeof body !== 'object') {
      throw new Error(`Conversation ${conversationId} returned invalid JSON`);
    }

    return body;
  }

  extractConversationLinks(conversation) {
    const linkedClipIds = new Set();
    const linkedOperationIds = new Set();

    for (const message of conversation?.messages ?? []) {
      for (const part of message?.parts ?? []) {
        if (part?.tool_name !== 'audio__create_song') continue;

        const payload = part.content ?? part.args ?? {};
        if (payload.clip_id) linkedClipIds.add(payload.clip_id);
        if (payload.operation_id) linkedOperationIds.add(payload.operation_id);
      }
    }

    return {
      linked_clip_ids: Array.from(linkedClipIds),
      linked_operation_ids: Array.from(linkedOperationIds),
    };
  }

  async captureSessions() {
    const conversationIds = this.getConversationIdsFromManifest();
    if (conversationIds.length === 0) {
      console.log('No conversation IDs found in manifest. Skipping session capture.');
      return {
        attempted: 0,
        captured: 0,
        failed: 0,
        failures: [],
      };
    }

    await fs.mkdir(SESSIONS_DIR, { recursive: true });
    console.log(`Capturing ${conversationIds.length} session payloads...`);

    const failures = [];
    let captured = 0;

    for (let index = 0; index < conversationIds.length; index += 1) {
      const conversationId = conversationIds[index];

      try {
        const conversation = await this.fetchConversation(conversationId);
        const links = this.extractConversationLinks(conversation);
        const outPath = path.join(SESSIONS_DIR, `session_${conversationId}.json`);

        await atomicWriteJson(outPath, {
          captured_at: new Date().toISOString(),
          conversation_id: conversationId,
          linked: links,
          payload: conversation,
        });

        captured += 1;
      } catch (error) {
        failures.push({
          conversation_id: conversationId,
          error: error.message,
        });
      }

      process.stdout.write(`\r  Sessions: ${captured}/${conversationIds.length} captured (${index + 1} processed)   `);
    }

    console.log('');

    const summary = {
      generated_at: new Date().toISOString(),
      attempted: conversationIds.length,
      captured,
      failed: failures.length,
      failures,
    };

    await atomicWriteJson(SESSION_SUMMARY_PATH, summary);
    console.log(`Session capture complete. ${captured}/${conversationIds.length} saved.`);

    return summary;
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  // Always launch a visible browser — Cloudflare blocks headless and
  // context.request even with valid cookies. All API calls run via
  // page.evaluate(fetch) inside the real browser tab.
  const browser = await launchBrowser(false);
  const context = await browser.newContext({
    storageState: existsSync(AUTH_STATE) ? AUTH_STATE : undefined,
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 },
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  // Open the main page — needed for login and for Cloudflare clearance.
  // We keep this page open throughout the entire run so all fetch() calls
  // inside page.evaluate() have a valid origin and cf_clearance cookie.
  context.on('page', async (popup) => {
    try { await popup.waitForLoadState('networkidle', { timeout: 30000 }); } catch { /* ignore */ }
  });
  const page = await context.newPage();
  
  // Capture browser console logs for debugging
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[TokenExtraction]')) {
      console.log(`[Browser] ${text}`);
    }
  });
  
  console.log('Loading flowmusic.app...');
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  try { await page.waitForLoadState('networkidle', { timeout: 20000 }); } catch { /* ignore */ }

  // If we need to log in, wait for the sentinel file.
  if (!existsSync(AUTH_STATE) || forceHeadful) {
    try { await fs.unlink(LOGIN_READY_FILE); } catch { /* ignore */ }

    console.log('\n--- LOGIN REQUIRED ---');
    console.log('1. Log in to FlowMusic.app in the browser window.');
    console.log('2. Wait until you see your song library.');
    console.log('3. In a NEW terminal run:  touch producer_login_ready');
    console.log('----------------------\n');
    console.log(`Waiting for ${LOGIN_READY_FILE} ...`);

    await new Promise((resolve) => {
      const interval = setInterval(() => {
        if (existsSync(LOGIN_READY_FILE)) { clearInterval(interval); resolve(); }
      }, 1000);
    });

    try { await page.waitForLoadState('networkidle', { timeout: 10000 }); } catch { /* ignore */ }
    await context.storageState({ path: AUTH_STATE });
    try { await fs.unlink(LOGIN_READY_FILE); } catch { /* ignore */ }
    console.log(`Session saved to ${AUTH_STATE}`);
    // Wait for cookies to be fully written
    await page.waitForTimeout(2000);
  }

  // Reload so the page JS fully hydrates the session from cookies/localStorage.
  console.log('Reloading page to activate session...');
  await page.waitForTimeout(1000); // Brief pause before reload
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  try { await page.waitForLoadState('networkidle', { timeout: 20000 }); } catch { /* ignore */ }

  // Extract the Bearer token using Playwright cookies API (more reliable than document.cookie)
  let accessToken = null;
  try {
    const cookies = await context.cookies('https://www.flowmusic.app');
    console.log(`[TokenExtraction] Found ${cookies.length} cookies for flowmusic.app`);
    
    // Find auth-token cookies and combine them
    let rawCookieVal = '';
    for (let i = 0; i < 5; i++) {
      const cookieName = cookies.find(c => c.name === `sb-api-auth-token.${i}` || c.name === `sb-sb-auth-token.${i}`);
      if (cookieName) {
        console.log(`[TokenExtraction] Found cookie: ${cookieName.name}, length: ${cookieName.value.length}`);
        rawCookieVal += cookieName.value;
      }
    }
    
    console.log(`[TokenExtraction] Combined raw value length: ${rawCookieVal.length}, startsWith base64: ${rawCookieVal.startsWith('base64-')}`);
    
    if (rawCookieVal.startsWith('base64-')) {
      // Cookie values may be URL-encoded, decode before base64
      let base64Part = rawCookieVal.substring(7);
      try { base64Part = decodeURIComponent(base64Part); } catch { /* not URL-encoded */ }
      
      // Replace URL-safe base64 chars with standard base64
      base64Part = base64Part.replace(/-/g, '+').replace(/_/g, '/');
      
      // Add padding if needed
      while (base64Part.length % 4) base64Part += '=';
      
      const jsonStr = Buffer.from(base64Part, 'base64').toString('utf8');
      console.log(`[TokenExtraction] Decoded JSON length: ${jsonStr.length}`);
      const val = JSON.parse(jsonStr);
      console.log('[TokenExtraction] Parsed JSON keys:', Object.keys(val));
      
      if (val?.access_token) {
        console.log('[TokenExtraction] Found access_token!');
        accessToken = val.access_token;
      } else if (val?.session?.access_token) {
        console.log('[TokenExtraction] Found session.access_token!');
        accessToken = val.session.access_token;
      }
    }
  } catch (e) {
    console.error('[TokenExtraction] Error extracting from cookies:', e.message);
  }
  
  // Fallback to localStorage if cookie extraction failed
  if (!accessToken) {
    console.log('[TokenExtraction] Trying localStorage fallback...');
    accessToken = await page.evaluate(() => {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.includes('auth-token')) {
          try {
            const val = JSON.parse(localStorage.getItem(key));
            if (val?.access_token) return val.access_token;
            if (val?.session?.access_token) return val.session.access_token;
          } catch { /* ignore */ }
        }
      }
      return null;
    });
  }

  if (!accessToken) {
    const lsKeys = await page.evaluate(() => Object.keys(localStorage));
    const allCookies = await page.evaluate(() => document.cookie);
    console.log('Could not find access token. Debug info:');
    console.log('  LocalStorage Keys:', lsKeys.join(', '));
    console.log('  All Cookies (first 200 chars):', allCookies.substring(0, 200));
    console.log('  Looking for sb-*-auth-token cookies...');
    // Try to show any auth-related cookies
    const authCookies = await page.evaluate(() => {
      return document.cookie.split(';')
        .map(c => c.trim())
        .filter(c => c.includes('auth') || c.includes('token') || c.includes('sb-'))
        .map(c => c.split('=')[0]); // just names
    });
    console.log('  Auth-related cookie names:', authCookies.join(', '));
  } else {
    console.log('Got access token successfully.');
  }

  // Session check — try cookie-based auth first, then Bearer token.
  const checkUrl = `${BASE_URL}/__api/clips/auth-user?limit=1&offset=0&filter=generations&include_disliked=false`;
  
  // Try 1: Cookie-based auth (credentials: include)
  let testResult = await page.evaluate(async (url) => {
    const res = await fetch(url, { headers: { 'Accept': 'application/json' }, credentials: 'include' });
    const text = await res.text();
    return { status: res.status, body: text.slice(0, 500) };
  }, checkUrl);
  console.log(`Session check (cookies): HTTP ${testResult.status} — ${testResult.body}`);

  // Try 2: Bearer token if cookies didn't work
  if ((testResult.status === 401 || testResult.status === 403) && accessToken) {
    console.log('Cookie auth failed, retrying with Bearer token...');
    testResult = await page.evaluate(async ({ url, token }) => {
      const res = await fetch(url, { headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${token}` } });
      const text = await res.text();
      return { status: res.status, body: text.slice(0, 500) };
    }, { url: checkUrl, token: accessToken });
    console.log(`Session check (bearer): HTTP ${testResult.status} — ${testResult.body}`);
  }

  if (testResult.status === 401 || testResult.status === 403) {
    // Try 3: Wait a moment for session to settle and retry
    console.log('Both auth methods failed. Waiting 5s for session to settle...');
    await page.waitForTimeout(5000);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
    try { await page.waitForLoadState('networkidle', { timeout: 20000 }); } catch { /* ignore */ }

    // Re-extract access token after second reload using context.cookies()
    let freshToken = null;
    try {
      const cookies = await context.cookies('https://www.flowmusic.app');
      let rawCookieVal = '';
      for (let i = 0; i < 5; i++) {
        const cookieName = cookies.find(c => c.name === `sb-api-auth-token.${i}` || c.name === `sb-sb-auth-token.${i}`);
        if (cookieName) rawCookieVal += cookieName.value;
      }
      if (rawCookieVal.startsWith('base64-')) {
        let base64Part = rawCookieVal.substring(7);
        try { base64Part = decodeURIComponent(base64Part); } catch { }
        base64Part = base64Part.replace(/-/g, '+').replace(/_/g, '/');
        while (base64Part.length % 4) base64Part += '=';
        const val = JSON.parse(Buffer.from(base64Part, 'base64').toString('utf8'));
        if (val?.access_token) freshToken = val.access_token;
        else if (val?.session?.access_token) freshToken = val.session.access_token;
      }
    } catch { /* ignore */ }
    
    // Fallback to localStorage
    if (!freshToken) {
      freshToken = await page.evaluate(() => {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.includes('auth-token')) {
            try {
              const val = JSON.parse(localStorage.getItem(key));
              if (val?.access_token) return val.access_token;
              if (val?.session?.access_token) return val.session.access_token;
            } catch { }
          }
        }
        return null;
      });
    }

    if (freshToken && freshToken !== accessToken) {
      console.log('Got a fresh access token after reload.');
      accessToken = freshToken;
    }

    testResult = await page.evaluate(async ({ url, token }) => {
      const headers = { 'Accept': 'application/json', 'Authorization': `Bearer ${token}` };
      const res = await fetch(url, { headers, credentials: 'include' });
      const text = await res.text();
      return { status: res.status, body: text.slice(0, 500) };
    }, { url: checkUrl, token: accessToken ?? freshToken });
    console.log(`Session check (retry): HTTP ${testResult.status} — ${testResult.body}`);
  }

  if (testResult.status === 401 || testResult.status === 403) {
    await browser.close();
    console.error(`Session check failed (HTTP ${testResult.status}). Re-run with --headful to log in again.`);
    process.exit(1);
  }

  console.log('Session valid. Running archiver (browser window can be minimized)...');

  const archiver = new ProducerArchiver(page, accessToken);
  await archiver.loadPersistedState();

  try {
    if (!skipHarvest || archiver.manifest.size === 0) {
      await archiver.harvestMetadata();
    } else {
      console.log('Skipping harvest (--skip-harvest).');
    }

    await archiver.downloadAll();

    const verification = await archiver.verifyArchive();
    await fs.writeFile(
      path.join(OUTPUT_DIR, 'verification_summary.json'),
      JSON.stringify({ generated_at: new Date().toISOString(), ...verification }, null, 2),
    );

    console.log('Keeping browser context alive for session capture...');
    const sessionCapture = await archiver.captureSessions();

    console.log('\n' + '='.repeat(50));
    console.log('ARCHIVAL COMPLETE');
    console.log('='.repeat(50));
    console.log(`Total songs found:   ${verification.manifest_items}`);
    console.log(`Successfully saved:  ${verification.completed_items}`);
    console.log(`Audio on disk:       ${verification.downloaded_audio} / ${verification.expected_audio}`);
    console.log(`Missing audio:       ${verification.missing_audio}`);
    console.log(`Sessions captured:   ${sessionCapture.captured} / ${sessionCapture.attempted}`);
    console.log(`Session failures:    ${sessionCapture.failed}`);
    console.log(`Output:              ${path.resolve(OUTPUT_DIR)}`);
    console.log('='.repeat(50));
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('Archive failed:');
  console.error(err.stack);
  process.exitCode = 1;
});
