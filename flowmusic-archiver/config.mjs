import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const PROJECT_DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')));
const WORKSPACE_DIR = path.resolve(PROJECT_DIR, '..');

function stripWrappingQuotes(value) {
  if (!value) return value;
  const first = value[0];
  const last = value[value.length - 1];
  if ((first === '"' && last === '"') || (first === '\'' && last === '\'')) {
    return value.slice(1, -1);
  }
  return value;
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of text.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    if (!key || Object.prototype.hasOwnProperty.call(process.env, key)) continue;
    const value = stripWrappingQuotes(line.slice(separator + 1).trim());
    process.env[key] = value;
  }
}

loadEnvFile(path.join(WORKSPACE_DIR, '.env'));
loadEnvFile(path.join(PROJECT_DIR, '.env'));

function resolveMaybeRelativePath(inputPath, fallbackPath) {
  const candidate = inputPath ?? fallbackPath;
  if (!candidate) return null;
  return path.isAbsolute(candidate) ? candidate : path.resolve(PROJECT_DIR, candidate);
}

function parseBoolean(value, fallback = false) {
  if (value == null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function buildPgUrl() {
  const user = process.env.PG_USER ?? 'mind_user';
  const password = process.env.PG_PASSWORD ?? 'mindfreak';
  const host = process.env.PG_HOST ?? 'localhost';
  const port = process.env.PG_PORT ?? '5432';
  const mode = process.env.DB_MODE ?? 'v2';
  const modeDatabase =
    mode === 'v1'
      ? process.env.DB_NAME_V1
      : process.env.DB_NAME_V2;
  const database =
    modeDatabase ??
    process.env.PG_DATABASE ??
    null;
  if (database) {
    return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
  }
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/abstract-mind-lab`;
}

export const BASE_URL = process.env.FLOWMUSIC_BASE_URL ?? process.env.PRODUCER_BASE_URL ?? 'https://www.flowmusic.app';
export const OUTPUT_DIR = resolveMaybeRelativePath(
  process.env.FLOWMUSIC_OUTPUT_DIR ?? process.env.PRODUCER_OUTPUT_DIR,
  './flowmusic_backup',
);
export const AUTH_STATE = resolveMaybeRelativePath(
  process.env.FLOWMUSIC_AUTH_STATE ?? process.env.PRODUCER_AUTH_STATE,
  './flowmusic_auth.json',
);
export const CONCURRENCY = Number(process.env.FLOWMUSIC_CONCURRENCY ?? process.env.PRODUCER_CONCURRENCY ?? 8);
export const LOGIN_READY_FILE = resolveMaybeRelativePath(process.env.FLOWMUSIC_LOGIN_READY_FILE, './producer_login_ready');
export const MANIFEST_PATH = path.join(OUTPUT_DIR, 'producer_manifest.json');
export const COMPLETION_PATH = path.join(OUTPUT_DIR, 'completion.json');
export const VERIFICATION_SUMMARY_PATH = path.join(OUTPUT_DIR, 'verification_summary.json');
export const SESSIONS_DIR = path.join(OUTPUT_DIR, 'sessions');
export const SESSION_SUMMARY_PATH = path.join(OUTPUT_DIR, 'session_capture_summary.json');
export const MMSS_MANIFEST_PATH = path.join(OUTPUT_DIR, 'mmss_manifest.json');
export const MMSS_SUMMARY_PATH = path.join(OUTPUT_DIR, 'mmss_summary.json');

export const DB_MODE = process.env.DB_MODE ?? 'v2';
export const DB_ENABLED = parseBoolean(process.env.FLOWMUSIC_DB_ENABLED, true);
export const DB_AUTO_INIT = parseBoolean(process.env.FLOWMUSIC_DB_AUTO_INIT, true);
export const DATABASE_URL = buildPgUrl();

export const EMBED_METADATA = parseBoolean(process.env.FLOWMUSIC_EMBED_METADATA, false);
export const EMBED_ACCOUNTS = process.env.FLOWMUSIC_EMBED_ACCOUNTS ?? '';
export const EMBED_SCRIPT = resolveMaybeRelativePath(
  process.env.FLOWMUSIC_EMBED_SCRIPT,
  './scripts/sync-audio-meta/index.py',
);
export const EMBED_PYTHON = process.env.FLOWMUSIC_EMBED_PYTHON ?? 'python';

export const PROJECT_PATHS = {
  projectDir: PROJECT_DIR,
  workspaceDir: WORKSPACE_DIR,
};
