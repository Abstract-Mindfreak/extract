#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';
import { execFile as execFileCallback } from 'node:child_process';

import { chromium } from 'playwright';
import PQueue from 'p-queue';
import pRetry, { AbortError } from 'p-retry';

import {
  AUTH_STATE,
  BASE_URL,
  COMPLETION_PATH,
  CONCURRENCY,
  DATABASE_URL,
  DB_AUTO_INIT,
  DB_ENABLED,
  DB_MODE,
  EMBED_ACCOUNTS,
  EMBED_METADATA,
  EMBED_PYTHON,
  EMBED_SCRIPT,
  LOGIN_READY_FILE,
  MANIFEST_PATH,
  MMSS_MANIFEST_PATH,
  MMSS_SUMMARY_PATH,
  OUTPUT_DIR,
  PROJECT_PATHS,
  SESSION_SUMMARY_PATH,
  SESSIONS_DIR,
  VERIFICATION_SUMMARY_PATH,
} from './config.mjs';
import { buildRelationGraph, buildSessionIndex, enrichLineage, mapTrackToMMSS } from './mmss-mapper.mjs';
import { defaultSchemaPath, PostgresArchiveClient } from './postgres-client.mjs';

const execFile = promisify(execFileCallback);

if (!Number.isFinite(CONCURRENCY) || CONCURRENCY < 1) {
  throw new Error(`Invalid FLOWMUSIC_CONCURRENCY value: ${CONCURRENCY}`);
}

const args = new Set(process.argv.slice(2));
if (args.has('--help')) {
  console.log([
    'Usage: node archiver.mjs [--headful] [--skip-harvest]',
    '',
    'Options:',
    '  --headful      Open browser for login refresh',
    '  --skip-harvest Skip metadata harvest and reuse saved manifest',
    '  --help         Show this help message',
  ].join('\n'));
  process.exit(0);
}

const forceHeadful = args.has('--headful') || args.has('--headfull');
const skipHarvest = args.has('--skip-harvest');

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

function unwrapStatusValue(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  if (Object.prototype.hasOwnProperty.call(value, 'value')) {
    return value.value;
  }
  return value;
}

function toNumberOrNull(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function extractLyricsText(value) {
  const unwrapped = unwrapStatusValue(value);
  if (typeof unwrapped === 'string') return unwrapped;
  if (unwrapped && typeof unwrapped === 'object') {
    return unwrapped.text ?? null;
  }
  return null;
}

function extractLyricsTiming(value) {
  const unwrapped = unwrapStatusValue(value);
  if (Array.isArray(unwrapped)) return unwrapped;
  if (unwrapped && typeof unwrapped === 'object') {
    return Array.isArray(unwrapped.markers) ? unwrapped.markers : unwrapped;
  }
  return null;
}

async function atomicWriteJson(filePath, data) {
  const tempPath = `${filePath}.${Math.random().toString(36).slice(2)}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(data, null, 2));
  await fs.rename(tempPath, filePath);
}

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

class FlowMusicArchiver {
  constructor(page, accessToken) {
    this.page = page;
    this.accessToken = accessToken;
    this.manifest = new Map();
    this.completed = new Set();
    this.sessionRecords = [];
    this.mmssEntries = [];
  }

  async get(url) {
    return this.page.evaluate(async ({ targetUrl, token }) => {
      const headers = { Accept: 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const response = await fetch(targetUrl, { headers, credentials: 'include' });
      return { status: response.status, text: await response.text() };
    }, { targetUrl: url, token: this.accessToken });
  }

  async post(url, body) {
    return this.page.evaluate(async ({ targetUrl, payload, token }) => {
      const headers = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      };
      if (token) headers.Authorization = `Bearer ${token}`;
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        credentials: 'include',
      });
      return { status: response.status, text: await response.text() };
    }, { targetUrl: url, payload: body, token: this.accessToken });
  }

  parseResponse(result) {
    try {
      return JSON.parse(result.text);
    } catch {
      return null;
    }
  }

  async loadPersistedState() {
    if (existsSync(MANIFEST_PATH)) {
      const manifest = JSON.parse(await fs.readFile(MANIFEST_PATH, 'utf8'));
      for (const item of manifest.items ?? []) {
        if (item?.id) this.manifest.set(item.id, item);
      }
      console.log(`Loaded ${this.manifest.size} manifest items from disk`);
    }

    if (existsSync(COMPLETION_PATH)) {
      const completion = JSON.parse(await fs.readFile(COMPLETION_PATH, 'utf8'));
      for (const id of completion.completed ?? []) {
        this.completed.add(id);
      }
      console.log(`Loaded ${this.completed.size} completed track IDs`);
    }
  }

  async persistManifest() {
    await atomicWriteJson(MANIFEST_PATH, {
      generated_at: new Date().toISOString(),
      total_items: this.manifest.size,
      items: Array.from(this.manifest.values()),
    });
  }

  async persistCompletion() {
    await atomicWriteJson(COMPLETION_PATH, {
      generated_at: new Date().toISOString(),
      completed: Array.from(this.completed).sort(),
    });
  }

  async harvestMetadata() {
    console.log('Phase 1/4: harvesting track metadata');
    const pageSize = 100;
    let offset = 0;
    let totalFetched = 0;

    while (true) {
      const url = `${BASE_URL}/__api/clips/auth-user?limit=${pageSize}&offset=${offset}&filter=generations&include_disliked=false`;
      const response = await this.get(url);

      if (response.status === 401 || response.status === 403) {
        throw new Error(`Session expired during harvest (HTTP ${response.status})`);
      }
      if (response.status < 200 || response.status >= 300) {
        console.warn(`Harvest stopped at offset ${offset}: HTTP ${response.status}`);
        break;
      }

      const body = this.parseResponse(response);
      const tracks = body?.clips ?? (Array.isArray(body) ? body : []);
      if (!tracks.length) break;

      for (const track of tracks) {
        if (!track?.id) continue;
        const previous = this.manifest.get(track.id) ?? {};
        const rawDuration = track.duration_s ?? unwrapStatusValue(track.duration);
        const rawLyrics = track.lyrics ?? previous.lyrics ?? null;
        const rawLyricsTiming = track.lyrics_timing ?? track.lyrics_timestamped ?? previous.lyrics_timestamped ?? null;
        const rawOperation = track.operation ?? previous.raw_data?.operation ?? null;
        this.manifest.set(track.id, {
          ...previous,
          id: track.id,
          title: track.title ?? track.name ?? previous.title ?? `Track_${track.id.slice(0, 8)}`,
          audio_url: track.audio_url ?? previous.audio_url ?? null,
          wav_url: track.wav_url ?? previous.wav_url ?? null,
          video_url: track.video_url ?? previous.video_url ?? null,
          image_url: track.image_url ?? previous.image_url ?? null,
          created_at: track.created_at ?? previous.created_at ?? null,
          source_url: `${BASE_URL}/song/${track.id}`,
          sound: track.sound ?? rawOperation?.sound_prompt ?? previous.sound ?? null,
          lyrics: extractLyricsText(rawLyrics) ?? previous.lyrics ?? null,
          duration: toNumberOrNull(rawDuration) ?? previous.duration ?? null,
          model_version: track.model_display_name ?? rawOperation?.model_display_name ?? previous.model_version ?? null,
          seed: toNumberOrNull(track.seed ?? rawOperation?.seed) ?? previous.seed ?? null,
          play_count: track.play_count ?? previous.play_count ?? 0,
          favorite_count: track.favorite_count ?? previous.favorite_count ?? 0,
          parent_id: track.parent_riff_id ?? previous.parent_id ?? null,
          parent_riff_id: track.parent_riff_id ?? previous.parent_riff_id ?? null,
          transform_type: track.transform ?? previous.transform_type ?? null,
          transform: track.transform ?? previous.transform ?? null,
          conditions: track.conditions ?? previous.conditions ?? null,
          lyrics_timestamped: extractLyricsTiming(rawLyricsTiming) ?? previous.lyrics_timestamped ?? null,
          raw_data: {
            ...(previous.raw_data ?? {}),
            ...track,
          },
        });
      }

      totalFetched += tracks.length;
      offset += tracks.length;
      process.stdout.write(`\r  harvested ${totalFetched} track(s), ${this.manifest.size} unique   `);

      if (offset % 500 === 0) await this.persistManifest();
      if (tracks.length < pageSize) break;
    }
    console.log(`\nHarvest complete: ${this.manifest.size} unique track(s)`);
    await this.persistManifest();
  }

  getConversationIdsFromManifest() {
    const ids = new Set();
    for (const item of this.manifest.values()) {
      const conversationId =
        item?.raw_data?.operation?.conversation_id ??
        item?.raw_data?.conversation_id ??
        item?.operation?.conversation_id ??
        null;
      if (conversationId) ids.add(conversationId);
    }
    return Array.from(ids);
  }

  async listConversationIds() {
    const ids = new Set();
    const limit = 100;
    let offset = 0;

    while (true) {
      const response = await this.get(`${BASE_URL}/__api/conversations?limit=${limit}&offset=${offset}`);
      if (response.status < 200 || response.status >= 300) {
        console.warn(`Conversation list fetch failed at offset ${offset}: HTTP ${response.status}`);
        break;
      }

      const body = this.parseResponse(response);
      const conversations = Array.isArray(body) ? body : body?.conversations ?? [];
      if (!conversations.length) break;

      for (const conversation of conversations) {
        if (conversation?.id) ids.add(conversation.id);
      }

      if (conversations.length < limit) break;
      offset += conversations.length;
    }

    return Array.from(ids);
  }

  async fetchConversation(conversationId) {
    const response = await this.get(`${BASE_URL}/__api/conversations/${conversationId}`);
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Conversation ${conversationId} returned HTTP ${response.status}`);
    }

    const payload = this.parseResponse(response);
    if (!payload || typeof payload !== 'object') {
      throw new Error(`Conversation ${conversationId} returned invalid JSON`);
    }
    return payload;
  }

  extractConversationLinks(conversation) {
    const linkedClipIds = new Set();
    const linkedOperationIds = new Set();
    const linkedVideoIds = new Set();
    const linkedVideoJobIds = new Set();

    const visit = (payload) => {
      if (!payload) return;
      if (Array.isArray(payload)) {
        for (const item of payload) visit(item);
        return;
      }
      if (typeof payload !== 'object') return;

      if (typeof payload.clip_id === 'string') linkedClipIds.add(payload.clip_id);
      if (typeof payload.clip_id_b === 'string') linkedClipIds.add(payload.clip_id_b);
      if (typeof payload.operation_id === 'string') linkedOperationIds.add(payload.operation_id);
      if (typeof payload.operation_id_b === 'string') linkedOperationIds.add(payload.operation_id_b);
      if (typeof payload.video_id === 'string') linkedVideoIds.add(payload.video_id);
      if (typeof payload.job_id === 'string') linkedVideoJobIds.add(payload.job_id);

      for (const value of Object.values(payload)) {
        visit(value);
      }
    };

    for (const message of conversation?.messages ?? []) {
      for (const part of message?.parts ?? []) {
        visit(part?.args);
        visit(part?.content);
      }
    }

    return {
      linked_clip_ids: Array.from(linkedClipIds),
      linked_operation_ids: Array.from(linkedOperationIds),
      linked_video_ids: Array.from(linkedVideoIds),
      linked_video_job_ids: Array.from(linkedVideoJobIds),
    };
  }

  async captureSessions() {
    const manifestConversationIds = this.getConversationIdsFromManifest();
    const listedConversationIds = await this.listConversationIds().catch((error) => {
      console.warn(`Conversation listing failed: ${error.message}`);
      return [];
    });
    const conversationIds = Array.from(new Set([...manifestConversationIds, ...listedConversationIds]));
    if (!conversationIds.length) {
      console.log('No linked conversations found in manifest');
      return { attempted: 0, captured: 0, failed: 0, failures: [] };
    }

    console.log(`Phase 2/4: capturing ${conversationIds.length} session payload(s)`);
    await fs.mkdir(SESSIONS_DIR, { recursive: true });

    const failures = [];
    const records = [];

    for (let index = 0; index < conversationIds.length; index += 1) {
      const conversationId = conversationIds[index];
      try {
        const payload = await this.fetchConversation(conversationId);
        const record = {
          captured_at: new Date().toISOString(),
          conversation_id: conversationId,
          linked: this.extractConversationLinks(payload),
          payload,
        };
        records.push(record);
        await atomicWriteJson(path.join(SESSIONS_DIR, `session_${conversationId}.json`), record);
      } catch (error) {
        failures.push({ conversation_id: conversationId, error: error.message });
      }
      process.stdout.write(`\r  captured ${records.length}/${conversationIds.length} sessions   `);
    }

    console.log('');
    this.sessionRecords = records;

    const summary = {
      generated_at: new Date().toISOString(),
      attempted: conversationIds.length,
      captured: records.length,
      failed: failures.length,
      failures,
    };
    await atomicWriteJson(SESSION_SUMMARY_PATH, summary);
    return summary;
  }

  async loadCapturedSessionsFromDisk() {
    if (!existsSync(SESSIONS_DIR)) return [];
    const files = await fs.readdir(SESSIONS_DIR);
    const records = [];
    for (const fileName of files) {
      if (!fileName.endsWith('.json')) continue;
      const raw = await fs.readFile(path.join(SESSIONS_DIR, fileName), 'utf8');
      records.push(JSON.parse(raw));
    }
    this.sessionRecords = records;
    return records;
  }

  buildMmssEntries() {
    console.log('Phase 3/4: building MMSS graph and entries');
    const tracks = Array.from(this.manifest.values()).map((item) => ({ ...item }));
    const { byTrackId, byOperationId, bySessionId, videoJobsByTrackId } = buildSessionIndex(this.sessionRecords);

    for (const track of tracks) {
      track.session_id =
        track.session_id ??
        track.raw_data?.operation?.conversation_id ??
        byTrackId.get(track.id) ??
        byOperationId.get(track.raw_data?.op_id) ??
        byOperationId.get(track.raw_data?.operation?.id) ??
        byOperationId.get(track.raw_data?.operation?.operation_id) ??
        null;
    }

    const relationGraph = buildRelationGraph(tracks);
    const enrichedTracks = enrichLineage(tracks, relationGraph);

    this.mmssEntries = enrichedTracks.map((track) =>
      mapTrackToMMSS(track, {
        relationGraph,
        sessionSnapshots: bySessionId,
        videoJobsByTrackId,
      }),
    );

    return {
      sessionCount: bySessionId.size,
      trackCount: this.mmssEntries.length,
      relationEdges: Array.from(relationGraph.childrenByParent.values()).reduce((sum, value) => sum + value.length, 0),
    };
  }

  async persistMmssArtifacts(summary) {
    await atomicWriteJson(MMSS_MANIFEST_PATH, {
      generated_at: new Date().toISOString(),
      total_items: this.mmssEntries.length,
      items: this.mmssEntries,
    });
    await atomicWriteJson(MMSS_SUMMARY_PATH, {
      generated_at: new Date().toISOString(),
      ...summary,
    });
  }

  async refreshAssetUrl(itemId, type) {
    const item = this.manifest.get(itemId);
    if (!item) return null;
    if (type === 'audio') return item.audio_url ?? item.raw_data?.audio_url ?? null;
    if (type === 'video') return item.video_url ?? item.raw_data?.video_url ?? null;
    if (type === 'image') return item.image_url ?? item.raw_data?.image_url ?? null;
    return null;
  }

  async downloadAll() {
    console.log(`Phase 4/4: downloading archive assets (concurrency=${CONCURRENCY})`);
    const queue = new PQueue({ concurrency: CONCURRENCY });
    const items = Array.from(this.manifest.values());
    let processed = 0;

    await Promise.all(items.map((item) =>
      queue.add(async () => {
        await this.downloadItem(item);
        processed += 1;
        process.stdout.write(`\r  downloaded ${this.completed.size}/${items.length} complete (${processed} processed)   `);
      }),
    ));
    console.log('');
  }

  async downloadItem(item) {
    if (this.completed.has(item.id)) return;

    const itemDir = this.resolveTrackDir(item);
    await fs.mkdir(itemDir, { recursive: true });
    await fs.writeFile(path.join(itemDir, 'meta.json'), JSON.stringify(item, null, 2));

    await this.downloadAsset(item, 'audio', item.audio_url, itemDir, 'm4a').catch((error) => {
      console.warn(`Failed audio download for ${item.id}: ${error.message}`);
    });
    await this.downloadAsset(item, 'video', item.video_url, itemDir, 'mp4').catch((error) => {
      console.warn(`Failed video download for ${item.id}: ${error.message}`);
    });
    await this.downloadAsset(item, 'image', item.image_url, itemDir, 'jpg').catch((error) => {
      console.warn(`Failed image download for ${item.id}: ${error.message}`);
    });

    await this.inspectLocalTrackAssets(item, itemDir);
    await fs.writeFile(path.join(itemDir, 'meta.json'), JSON.stringify(item, null, 2));

    this.completed.add(item.id);
    await this.persistCompletion();
  }

  resolveTrackDir(item) {
    return path.join(OUTPUT_DIR, item.id.slice(0, 2), `${item.id}_${safeName(item.title)}`);
  }

  async downloadAsset(item, type, initialUrl, itemDir, fallbackExt) {
    let assetUrl = initialUrl;
    if (!assetUrl) {
      assetUrl = await this.refreshAssetUrl(item.id, type);
      if (!assetUrl) return;
    }

    const ext = inferExtension(assetUrl, fallbackExt);
    const outPath = path.join(itemDir, `${type}.${ext}`);
    if (existsSync(outPath)) return;

    await pRetry(async () => {
      const response = await fetch(assetUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (response.status === 403 || response.status === 410) {
        const refreshed = await this.refreshAssetUrl(item.id, type);
        if (!refreshed) throw new AbortError(`Unable to refresh ${type} URL for ${item.id}`);
        assetUrl = refreshed;
        throw new Error('asset URL refreshed');
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      await fs.writeFile(outPath, buffer);
    }, { retries: 3 });
  }

  async inspectLocalTrackAssets(item, itemDir) {
    const files = await fs.readdir(itemDir);
    const audioFile = files.find((name) => name.startsWith('audio.'));
    if (audioFile) {
      const audioPath = path.join(itemDir, audioFile);
      const buffer = await fs.readFile(audioPath);
      item.audio_md5 = crypto.createHash('md5').update(buffer).digest('hex');
      item.audio_codec = path.extname(audioFile).slice(1) || null;
    }
  }

  async verifyArchive() {
    const items = Array.from(this.manifest.values());
    let expectedAudio = 0;
    let downloadedAudio = 0;

    for (const item of items) {
      if (!item.audio_url) continue;
      expectedAudio += 1;
      const itemDir = this.resolveTrackDir(item);
      if (!existsSync(itemDir)) continue;
      const files = await fs.readdir(itemDir);
      if (files.some((fileName) => fileName.startsWith('audio.'))) {
        downloadedAudio += 1;
      }
    }

    return {
      manifest_items: items.length,
      completed_items: this.completed.size,
      expected_audio: expectedAudio,
      downloaded_audio: downloadedAudio,
      missing_audio: expectedAudio - downloadedAudio,
    };
  }

  async hydrateLocalAssetMetadata() {
    for (const item of this.manifest.values()) {
      const itemDir = this.resolveTrackDir(item);
      if (!existsSync(itemDir)) continue;
      await this.inspectLocalTrackAssets(item, itemDir);
    }
  }

  refreshMmssEntriesFromManifest() {
    const itemById = this.manifest;
    this.mmssEntries = this.mmssEntries.map((entry) => {
      const item = itemById.get(entry.core_audio?.id);
      if (!item) return entry;
      return {
        ...entry,
        analytics_and_meta: {
          ...entry.analytics_and_meta,
          technical_specs: {
            ...entry.analytics_and_meta?.technical_specs,
            audio_md5: item.audio_md5 ?? entry.analytics_and_meta?.technical_specs?.audio_md5 ?? null,
            audio_codec: item.audio_codec ?? entry.analytics_and_meta?.technical_specs?.audio_codec ?? null,
          },
        },
        timestamps: {
          ...entry.timestamps,
          last_synced: new Date().toISOString(),
        },
      };
    });
  }

  async embedMetadataIfEnabled() {
    if (!EMBED_METADATA) return { attempted: false, status: 'disabled' };
    if (!existsSync(EMBED_SCRIPT)) return { attempted: false, status: 'missing-script' };

    const commandArgs = [EMBED_SCRIPT, '--write'];
    if (EMBED_ACCOUNTS) {
      commandArgs.push(`--accounts=${EMBED_ACCOUNTS}`);
    }

    try {
      const result = await execFile(EMBED_PYTHON, commandArgs, {
        cwd: PROJECT_PATHS.projectDir,
        timeout: 10 * 60 * 1000,
      });
      return {
        attempted: true,
        status: 'ok',
        stdout: result.stdout.trim(),
        stderr: result.stderr.trim(),
      };
    } catch (error) {
      return {
        attempted: true,
        status: 'failed',
        error: error.message,
      };
    }
  }
}

async function extractAccessToken(context, page) {
  try {
    const cookies = await context.cookies('https://www.flowmusic.app');
    let rawValue = '';
    for (let index = 0; index < 5; index += 1) {
      const cookie = cookies.find((candidate) => candidate.name === `sb-api-auth-token.${index}` || candidate.name === `sb-sb-auth-token.${index}`);
      if (cookie) rawValue += cookie.value;
    }

    if (rawValue.startsWith('base64-')) {
      let base64Value = rawValue.slice(7);
      try {
        base64Value = decodeURIComponent(base64Value);
      } catch {
        // ignore
      }
      base64Value = base64Value.replace(/-/g, '+').replace(/_/g, '/');
      while (base64Value.length % 4) base64Value += '=';
      const parsed = JSON.parse(Buffer.from(base64Value, 'base64').toString('utf8'));
      return parsed?.access_token ?? parsed?.session?.access_token ?? null;
    }
  } catch {
    // ignore
  }

  return page.evaluate(() => {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || !key.includes('auth-token')) continue;
      try {
        const parsed = JSON.parse(localStorage.getItem(key));
        return parsed?.access_token ?? parsed?.session?.access_token ?? null;
      } catch {
        // ignore
      }
    }
    return null;
  });
}

async function ensureAuthenticatedPage(page, context) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  try {
    await page.waitForLoadState('networkidle', { timeout: 20000 });
  } catch {
    // ignore
  }

  if (!existsSync(AUTH_STATE) || forceHeadful) {
    try {
      await fs.unlink(LOGIN_READY_FILE);
    } catch {
      // ignore
    }

    console.log('\nLogin required: open FlowMusic in the browser and authenticate.');
    console.log(`Create ${LOGIN_READY_FILE} in another terminal when the library is visible.`);

    await new Promise((resolve) => {
      const interval = setInterval(() => {
        if (existsSync(LOGIN_READY_FILE)) {
          clearInterval(interval);
          resolve();
        }
      }, 1000);
    });

    await context.storageState({ path: AUTH_STATE });
    try {
      await fs.unlink(LOGIN_READY_FILE);
    } catch {
      // ignore
    }
    await page.waitForTimeout(2000);
  }

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  try {
    await page.waitForLoadState('networkidle', { timeout: 20000 });
  } catch {
    // ignore
  }

  const accessToken = await extractAccessToken(context, page);
  const checkUrl = `${BASE_URL}/__api/clips/auth-user?limit=1&offset=0&filter=generations&include_disliked=false`;
  const sessionCheck = await page.evaluate(async ({ targetUrl, token }) => {
    const headers = { Accept: 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(targetUrl, { headers, credentials: 'include' });
    return { status: response.status, body: await response.text() };
  }, { targetUrl: checkUrl, token: accessToken });

  if (sessionCheck.status === 401 || sessionCheck.status === 403) {
    throw new Error(`Session check failed with HTTP ${sessionCheck.status}`);
  }

  return accessToken;
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const browser = await launchBrowser(false);
  const context = await browser.newContext({
    storageState: existsSync(AUTH_STATE) ? AUTH_STATE : undefined,
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 },
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  const page = await context.newPage();
  const accessToken = await ensureAuthenticatedPage(page, context);
  const archiver = new FlowMusicArchiver(page, accessToken);
  const postgresClient =
    DB_ENABLED && DB_MODE === 'v2'
      ? new PostgresArchiveClient({
          connectionString: DATABASE_URL,
          autoInit: DB_AUTO_INIT,
          schemaPath: defaultSchemaPath(),
        })
      : null;

  await archiver.loadPersistedState();

  try {
    if (!skipHarvest || archiver.manifest.size === 0) {
      await archiver.harvestMetadata();
    } else {
      console.log('Skipping harvest and reusing saved manifest');
    }

    const sessionCapture = await archiver.captureSessions();
    if (!archiver.sessionRecords.length) {
      await archiver.loadCapturedSessionsFromDisk();
    }

    const mmssSummary = archiver.buildMmssEntries();
    await archiver.persistMmssArtifacts(mmssSummary);

    await archiver.downloadAll();
    await archiver.hydrateLocalAssetMetadata();
    archiver.refreshMmssEntriesFromManifest();
    await archiver.persistMmssArtifacts(mmssSummary);
    const verification = await archiver.verifyArchive();
    await atomicWriteJson(VERIFICATION_SUMMARY_PATH, {
      generated_at: new Date().toISOString(),
      ...verification,
    });

    const embedSummary = await archiver.embedMetadataIfEnabled();

    if (postgresClient) {
      const sessionSnapshots = buildSessionIndex(archiver.sessionRecords).bySessionId;
      await postgresClient.saveArchive({
        sessions: Array.from(sessionSnapshots.values()),
        entries: archiver.mmssEntries,
      });
    }

    console.log('\n' + '='.repeat(54));
    console.log('FLOWMUSIC ARCHIVER V2 COMPLETE');
    console.log('='.repeat(54));
    console.log(`Tracks in manifest:    ${verification.manifest_items}`);
    console.log(`Tracks completed:      ${verification.completed_items}`);
    console.log(`Audio on disk:         ${verification.downloaded_audio}/${verification.expected_audio}`);
    console.log(`Sessions captured:     ${sessionCapture.captured}/${sessionCapture.attempted}`);
    console.log(`MMSS entries:          ${mmssSummary.trackCount}`);
    console.log(`Relation edges:        ${mmssSummary.relationEdges}`);
    console.log(`DB persistence:        ${postgresClient ? `enabled (${DB_MODE})` : 'disabled'}`);
    console.log(`Metadata embedding:    ${embedSummary.status}`);
    console.log(`Output directory:      ${path.resolve(OUTPUT_DIR)}`);
    console.log('='.repeat(54));
  } finally {
    if (postgresClient) await postgresClient.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error('Archive failed:');
  console.error(error.stack);
  process.exitCode = 1;
});
