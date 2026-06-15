const API_BASE = 'http://localhost:3456/api/persistence';

const STORES = {
  TRACKS: 'tracks',
  SESSIONS: 'sessions',
  FRAGMENTS: 'fragments',
  RAW_PROMPTS: 'raw_prompts',
  PROMPT_BLOCKS: 'prompt_blocks',
  PROMPT_SEQUENCES: 'prompt_sequences',
  METADATA: 'metadata',
  ACCOUNTS: 'accounts'
};

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function encodeSegment(value) {
  return encodeURIComponent(String(value));
}

function nowIso() {
  return new Date().toISOString();
}

class StorageService {
  constructor() {
    this.initialized = false;
  }

  async init() {
    this.initialized = true;
    return true;
  }

  async ensureDB() {
    if (!this.initialized) {
      await this.init();
    }
    return true;
  }

  async putEntity(store, key, item) {
    await this.ensureDB();
    const payload = await fetchJson(`${API_BASE}/entities/${encodeSegment(store)}/${encodeSegment(key)}`, {
      method: 'PUT',
      body: JSON.stringify({ item }),
    });
    return payload?.item ?? item;
  }

  async putBatch(store, items, keyField = 'id') {
    await this.ensureDB();
    const payload = await fetchJson(`${API_BASE}/entities/${encodeSegment(store)}/batch`, {
      method: 'POST',
      body: JSON.stringify({ items, keyField }),
    });
    return payload?.items || [];
  }

  async getAllFromStore(store) {
    await this.ensureDB();
    const payload = await fetchJson(`${API_BASE}/entities/${encodeSegment(store)}`);
    return Array.isArray(payload?.items) ? payload.items : [];
  }

  async getEntity(store, key) {
    await this.ensureDB();
    try {
      return await fetchJson(`${API_BASE}/entities/${encodeSegment(store)}/${encodeSegment(key)}`);
    } catch (_error) {
      return null;
    }
  }

  async deleteEntity(store, key) {
    await this.ensureDB();
    await fetchJson(`${API_BASE}/entities/${encodeSegment(store)}/${encodeSegment(key)}`, {
      method: 'DELETE',
    });
  }

  async clearStore(store) {
    await this.ensureDB();
    await fetchJson(`${API_BASE}/entities/${encodeSegment(store)}`, {
      method: 'DELETE',
    });
  }

  async setMetadataValue(key, value) {
    await this.ensureDB();
    await fetchJson(`${API_BASE}/settings/${encodeSegment(STORES.METADATA)}/${encodeSegment(key)}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    });
  }

  async getMetadataValue(key) {
    await this.ensureDB();
    const payload = await fetchJson(`${API_BASE}/settings/${encodeSegment(STORES.METADATA)}/${encodeSegment(key)}`);
    return payload?.value ?? null;
  }

  async deleteMetadataValue(key) {
    await this.ensureDB();
    await fetchJson(`${API_BASE}/settings/${encodeSegment(STORES.METADATA)}/${encodeSegment(key)}`, {
      method: 'DELETE',
    });
  }

  async saveTrack(track) {
    await this.putEntity(STORES.TRACKS, track.id, {
      ...track,
      updatedAt: nowIso(),
    });
    return track.id;
  }

  async saveTracks(tracks) {
    const normalized = tracks.map((track) => ({
      ...track,
      updatedAt: nowIso(),
    }));
    await this.putBatch(STORES.TRACKS, normalized, 'id');
    return normalized.length;
  }

  async saveTracksBatch(tracks) {
    await this.putBatch(STORES.TRACKS, tracks, 'id');
    return tracks.length;
  }

  async saveSessionsBatch(sessions) {
    await this.putBatch(STORES.SESSIONS, sessions, 'conversationId');
    return sessions.length;
  }

  async saveFragmentsBatch(fragments) {
    const normalizedFragments = (fragments || [])
      .filter(Boolean)
      .map((fragment, index) => {
        const fragmentId =
          fragment.fragmentId ||
          fragment.id ||
          `fragment-${fragment.messageId || 'msg'}-${index}-${Date.now()}`;
        const text = fragment.text || fragment.content || '';
        return {
          ...fragment,
          fragmentId,
          id: fragment.id || fragmentId,
          text,
          content: fragment.content || text,
          createdAt: fragment.createdAt || nowIso(),
          updatedAt: fragment.updatedAt || nowIso(),
        };
      });
    await this.putBatch(STORES.FRAGMENTS, normalizedFragments, 'fragmentId');
    return normalizedFragments.length;
  }

  async saveRawPromptsBatch(rawPrompts) {
    const normalized = (rawPrompts || [])
      .filter(Boolean)
      .map((entry, index) => ({
        ...entry,
        id: entry.id || `raw-prompt-${entry.conversationId || 'conversation'}-${entry.messageId || index}-${Date.now()}`,
        createdAt: entry.createdAt || nowIso(),
        updatedAt: entry.updatedAt || nowIso(),
      }));
    await this.putBatch(STORES.RAW_PROMPTS, normalized, 'id');
    return normalized.length;
  }

  async savePromptBlocksBatch(blocks) {
    const normalized = (blocks || [])
      .filter(Boolean)
      .map((block, index) => ({
        ...block,
        id: block.id || `prompt-block-${block.conversationId || 'conversation'}-${index}-${Date.now()}`,
        createdAt: block.createdAt || nowIso(),
        updatedAt: block.updatedAt || nowIso(),
      }));
    await this.putBatch(STORES.PROMPT_BLOCKS, normalized, 'id');
    return normalized.length;
  }

  async savePromptSequencesBatch(sequences) {
    const normalized = (sequences || [])
      .filter(Boolean)
      .map((sequence, index) => ({
        ...sequence,
        id: sequence.id || `prompt-sequence-${sequence.conversationId || index}`,
        createdAt: sequence.createdAt || nowIso(),
        updatedAt: sequence.updatedAt || nowIso(),
      }));
    await this.putBatch(STORES.PROMPT_SEQUENCES, normalized, 'id');
    return normalized.length;
  }

  async setMetadataBatch(metadata) {
    await this.ensureDB();
    await fetchJson(`${API_BASE}/settings/${encodeSegment(STORES.METADATA)}`, {
      method: 'PUT',
      body: JSON.stringify({ values: metadata }),
    });
  }

  async getTrack(id) {
    return this.getEntity(STORES.TRACKS, id);
  }

  async updateTrack(track) {
    await this.putEntity(STORES.TRACKS, track.id, track);
  }

  async getAllTracks() {
    return this.getAllFromStore(STORES.TRACKS);
  }

  async getTracksByAccount(accountId) {
    const tracks = await this.getAllTracks();
    return tracks.filter((track) => String(track.accountId) === String(accountId));
  }

  async getTracksByConversation(conversationId) {
    const tracks = await this.getAllTracks();
    return tracks.filter((track) => String(track.conversationId) === String(conversationId));
  }

  async deleteTrack(id) {
    await this.deleteEntity(STORES.TRACKS, id);
  }

  async clearTracks() {
    await this.clearStore(STORES.TRACKS);
  }

  async saveSession(session) {
    await this.putEntity(STORES.SESSIONS, session.conversationId, {
      ...session,
      updatedAt: nowIso(),
    });
    return session.conversationId;
  }

  async saveSessions(sessions) {
    const normalized = sessions.map((session) => ({
      ...session,
      updatedAt: nowIso(),
    }));
    await this.putBatch(STORES.SESSIONS, normalized, 'conversationId');
    return normalized.length;
  }

  async getSession(conversationId) {
    return this.getEntity(STORES.SESSIONS, conversationId);
  }

  async getAllSessions() {
    return this.getAllFromStore(STORES.SESSIONS);
  }

  async getSessionsByAccount(accountId) {
    const sessions = await this.getAllSessions();
    return sessions.filter((session) => String(session.primaryAccountId) === String(accountId));
  }

  async deleteSession(conversationId) {
    await this.deleteEntity(STORES.SESSIONS, conversationId);
  }

  async clearSessions() {
    await this.clearStore(STORES.SESSIONS);
  }

  async saveFragment(fragment) {
    const fragmentId = fragment.fragmentId || fragment.id;
    await this.putEntity(STORES.FRAGMENTS, fragmentId, {
      ...fragment,
      fragmentId,
      updatedAt: nowIso(),
    });
    return fragmentId;
  }

  async getFragmentsByConversation(conversationId) {
    const fragments = await this.getAllFromStore(STORES.FRAGMENTS);
    return fragments.filter((fragment) => String(fragment.conversationId) === String(conversationId));
  }

  async getFragmentsByTrack(trackId) {
    const fragments = await this.getAllFromStore(STORES.FRAGMENTS);
    return fragments.filter((fragment) => String(fragment.linkedTrackId) === String(trackId));
  }

  async getRawPromptsByConversation(conversationId) {
    const items = await this.getAllFromStore(STORES.RAW_PROMPTS);
    return items.filter((item) => String(item.conversationId) === String(conversationId));
  }

  async getPromptBlocksByConversation(conversationId) {
    const items = await this.getAllFromStore(STORES.PROMPT_BLOCKS);
    return items.filter((item) => String(item.conversationId) === String(conversationId));
  }

  async getAllPromptBlocks() {
    return this.getAllFromStore(STORES.PROMPT_BLOCKS);
  }

  async getPromptSequencesByConversation(conversationId) {
    const items = await this.getAllFromStore(STORES.PROMPT_SEQUENCES);
    return items.filter((item) => String(item.conversationId) === String(conversationId));
  }

  async getAllPromptSequences() {
    return this.getAllFromStore(STORES.PROMPT_SEQUENCES);
  }

  async setMetadata(key, value) {
    await this.setMetadataValue(key, value);
  }

  async getMetadata(key) {
    return this.getMetadataValue(key);
  }

  async deleteMetadata(key) {
    await this.deleteMetadataValue(key);
  }

  async saveAccount(account) {
    await this.putEntity(STORES.ACCOUNTS, account.id, {
      ...account,
      updatedAt: nowIso(),
    });
    return account.id;
  }

  async getAllAccounts() {
    return this.getAllFromStore(STORES.ACCOUNTS);
  }

  async getAccount(id) {
    return this.getEntity(STORES.ACCOUNTS, id);
  }

  async clearAll() {
    await Promise.all([
      this.clearStore(STORES.TRACKS),
      this.clearStore(STORES.SESSIONS),
      this.clearStore(STORES.FRAGMENTS),
      this.clearStore(STORES.RAW_PROMPTS),
      this.clearStore(STORES.PROMPT_BLOCKS),
      this.clearStore(STORES.PROMPT_SEQUENCES),
      fetchJson(`${API_BASE}/settings/${encodeSegment(STORES.METADATA)}`, { method: 'DELETE' }).catch(() => null),
      this.clearStore(STORES.ACCOUNTS),
    ]);
  }

  async getStats() {
    await this.ensureDB();
    const payload = await fetchJson(`${API_BASE}/stats`);
    const tracks = payload?.tracks || 0;
    const sessions = payload?.sessions || 0;
    const fragments = payload?.fragments || 0;
    const rawPrompts = payload?.raw_prompts || 0;
    const promptBlocks = payload?.prompt_blocks || 0;
    const promptSequences = payload?.prompt_sequences || 0;
    const accounts = payload?.accounts || 0;
    return {
      tracks,
      sessions,
      fragments,
      rawPrompts,
      promptBlocks,
      promptSequences,
      accounts,
      totalSize: tracks + sessions + fragments + rawPrompts + promptBlocks + promptSequences + accounts,
    };
  }

  async exportAll() {
    const [tracks, sessions, fragments, rawPrompts, promptBlocks, promptSequences, metadataValues, accounts] =
      await Promise.all([
        this.getAllTracks(),
        this.getAllSessions(),
        this.getAllFromStore(STORES.FRAGMENTS),
        this.getAllFromStore(STORES.RAW_PROMPTS),
        this.getAllFromStore(STORES.PROMPT_BLOCKS),
        this.getAllFromStore(STORES.PROMPT_SEQUENCES),
        fetchJson(`${API_BASE}/settings/${encodeSegment(STORES.METADATA)}`),
        this.getAllAccounts(),
      ]);

    const metadata = Object.entries(metadataValues?.values || {}).map(([key, value]) => ({ key, value }));

    return {
      version: 3,
      exportedAt: nowIso(),
      data: {
        tracks,
        sessions,
        fragments,
        rawPrompts,
        promptBlocks,
        promptSequences,
        metadata,
        accounts,
      },
    };
  }

  async importAll(exportData, { merge = false } = {}) {
    if (!merge) {
      await this.clearAll();
    }

    const stats = { tracks: 0, sessions: 0, fragments: 0, rawPrompts: 0, promptBlocks: 0, promptSequences: 0, accounts: 0 };

    if (exportData.data) {
      const { tracks, sessions, fragments, rawPrompts, promptBlocks, promptSequences, metadata, accounts } = exportData.data;

      if (tracks?.length) {
        await this.saveTracksBatch(tracks);
        stats.tracks = tracks.length;
      }
      if (sessions?.length) {
        await this.saveSessionsBatch(sessions);
        stats.sessions = sessions.length;
      }
      if (fragments?.length) {
        await this.saveFragmentsBatch(fragments);
        stats.fragments = fragments.length;
      }
      if (rawPrompts?.length) {
        await this.saveRawPromptsBatch(rawPrompts);
        stats.rawPrompts = rawPrompts.length;
      }
      if (promptBlocks?.length) {
        await this.savePromptBlocksBatch(promptBlocks);
        stats.promptBlocks = promptBlocks.length;
      }
      if (promptSequences?.length) {
        await this.savePromptSequencesBatch(promptSequences);
        stats.promptSequences = promptSequences.length;
      }
      if (accounts?.length) {
        await this.putBatch(STORES.ACCOUNTS, accounts, 'id');
        stats.accounts = accounts.length;
      }
      if (metadata?.length) {
        const values = metadata.reduce((accumulator, entry) => {
          accumulator[entry.key] = entry.value;
          return accumulator;
        }, {});
        await this.setMetadataBatch(values);
      }
    }

    return stats;
  }
}

const storageService = new StorageService();

export default storageService;
export { StorageService, STORES };
