/**
 * FlowMusic.app Archiver Service (Browser Version)
 * Communicates with archiver-server.js via HTTP API and WebSocket
 * Supports 4 accounts with different Google auth
 */

import { EventEmitter } from 'events';

const API_BASE = 'http://localhost:3456/api';
const WS_URL = 'ws://localhost:3456';
const ACCOUNTS_CONFIG_KEY = 'mmss.producer_archiver.accounts';
const ACTIVE_ACCOUNT_KEY = 'mmss.producer_archiver.active_account';

// Account profiles for 5 different Google accounts
export const DEFAULT_ACCOUNTS = [
  {
    id: 'account_1',
    name: 'Account 1',
    color: '#ef4444', // red
    authStateFile: 'producer_auth_1.json',
    outputDir: 'producer_backup_1',
    googleAccount: '',
    isConfigured: false
  },
  {
    id: 'account_2',
    name: 'Account 2',
    color: '#3b82f6', // blue
    authStateFile: 'producer_auth_2.json',
    outputDir: 'producer_backup_2',
    googleAccount: '',
    isConfigured: false
  },
  {
    id: 'account_3',
    name: 'Account 3',
    color: '#22c55e', // green
    authStateFile: 'producer_auth_3.json',
    outputDir: 'producer_backup_3',
    googleAccount: '',
    isConfigured: false
  },
  {
    id: 'account_4',
    name: 'Account 4',
    color: '#a855f7', // purple
    authStateFile: 'producer_auth_4.json',
    outputDir: 'producer_backup_4',
    googleAccount: '',
    isConfigured: false
  },
  {
    id: 'account_5',
    name: 'Account 5',
    color: '#f97316', // orange
    authStateFile: 'producer_auth_5.json',
    outputDir: 'producer_backup_5',
    googleAccount: '',
    isConfigured: false
  }
];

// HTTP API helpers with detailed error handling
async function apiGet(endpoint) {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: { 'Accept': 'application/json' }
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text}`);
    }
    return response.json();
  } catch (err) {
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      throw new Error('Archiver server is not running. Start it with: npm run archiver:server');
    }
    throw err;
  }
}

async function apiPost(endpoint, body = {}) {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text}`);
    }
    return response.json();
  } catch (err) {
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      throw new Error('Archiver server is not running. Start it with: npm run archiver:server');
    }
    throw err;
  }
}

export class ProducerArchiverManager {
  constructor() {
    this.accounts = this.loadAccounts();
    this.eventEmitter = new EventEmitter();
    this.ws = null;
    this.runningAccounts = new Set();
    this.connectWebSocket();
  }

  connectWebSocket() {
    try {
      this.ws = new WebSocket(WS_URL);
      
      this.ws.onopen = () => {
        console.log('WebSocket connected to archiver server');
      };

      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'log') {
          this.eventEmitter.emit('log', {
            accountId: data.accountId,
            type: data.logType,
            line: data.line,
            time: data.time
          });
        } else if (data.type === 'complete') {
          this.runningAccounts.delete(data.accountId);
          this.eventEmitter.emit('complete', {
            accountId: data.accountId,
            code: data.code
          });
        } else if (data.type === 'error') {
          this.runningAccounts.delete(data.accountId);
          this.eventEmitter.emit('error', {
            accountId: data.accountId,
            error: data.error
          });
        }
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected, reconnecting in 5s...');
        setTimeout(() => this.connectWebSocket(), 5000);
      };

      this.ws.onerror = (err) => {
        console.warn('WebSocket error:', err);
      };
    } catch (e) {
      console.warn('Failed to connect WebSocket:', e);
    }
  }

  loadAccounts() {
    try {
      const saved = localStorage.getItem(ACCOUNTS_CONFIG_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to load accounts config:', e);
    }
    return JSON.parse(JSON.stringify(DEFAULT_ACCOUNTS));
  }

  saveAccounts() {
    try {
      localStorage.setItem(ACCOUNTS_CONFIG_KEY, JSON.stringify(this.accounts));
    } catch (e) {
      console.warn('Failed to save accounts config:', e);
    }
  }

  async getAccounts() {
    try {
      const data = await apiGet('/accounts');
      return data.accounts || [];
    } catch (e) {
      console.warn('Failed to fetch accounts from API:', e);
      return this.accounts.map(acc => ({ ...acc, isConfigured: false }));
    }
  }

  updateAccount(accountId, updates) {
    const idx = this.accounts.findIndex(a => a.id === accountId);
    if (idx >= 0) {
      this.accounts[idx] = { ...this.accounts[idx], ...updates };
      this.saveAccounts();
      return this.accounts[idx];
    }
    return null;
  }

  setActiveAccount(accountId) {
    try {
      localStorage.setItem(ACTIVE_ACCOUNT_KEY, accountId);
    } catch (e) {
      console.warn('Failed to set active account:', e);
    }
  }

  getActiveAccount() {
    try {
      return localStorage.getItem(ACTIVE_ACCOUNT_KEY) || 'account_1';
    } catch (e) {
      return 'account_1';
    }
  }

  async startArchiver(accountId, options = {}) {
    const result = await apiPost(`/accounts/${accountId}/start`, options);
    if (result.started) {
      this.runningAccounts.add(accountId);
    }
    return result;
  }

  async stopArchiver(accountId) {
    const result = await apiPost(`/accounts/${accountId}/stop`);
    if (result.stopped) {
      this.runningAccounts.delete(accountId);
    }
    return result;
  }

  stopAllArchivers() {
    this.runningAccounts.forEach(accountId => {
      this.stopArchiver(accountId);
    });
    this.runningAccounts.clear();
  }

  isRunning(accountId) {
    return this.runningAccounts.has(accountId);
  }

  getRunningAccounts() {
    return Array.from(this.runningAccounts);
  }

  on(event, callback) {
    this.eventEmitter.on(event, callback);
  }

  off(event, callback) {
    this.eventEmitter.off(event, callback);
  }

  async getAccountStats(accountId) {
    try {
      return await apiGet(`/accounts/${accountId}`);
    } catch (e) {
      console.warn('Failed to get account stats:', e);
      return null;
    }
  }

  async getAllStats() {
    try {
      const data = await apiGet('/stats');
      return data.stats || [];
    } catch (e) {
      console.warn('Failed to get all stats:', e);
      return [];
    }
  }

  async openOutputDir(accountId) {
    const account = this.accounts.find(a => a.id === accountId);
    if (!account) return;
    
    // Open via browser - can't directly open Explorer from browser
    // This would need a custom protocol or Electron
    const outputDir = `d:\\WORK\\CLIENTS\\extract\\producer-ai-archiver\\${account.outputDir}`;
    console.log('Would open:', outputDir);
    // In a real implementation, this could use a custom URL scheme
    // or the server could handle this via an endpoint
  }

  async triggerLoginReady() {
    const result = await apiPost('/login-ready');
    return result.triggered;
  }

  async cleanupAccount(accountId) {
    const result = await apiPost(`/accounts/${accountId}/cleanup`);
    return result.cleaned;
  }

  async fetchConversationBatch(accountId, conversationIds = []) {
    if (!Array.isArray(conversationIds) || conversationIds.length === 0) {
      return { conversations: [], failed: [] };
    }

    return apiPost(`/accounts/${accountId}/conversations/batch`, {
      conversationIds
    });
  }
}

// Singleton instance
export const archiverManager = new ProducerArchiverManager();
export default archiverManager;
