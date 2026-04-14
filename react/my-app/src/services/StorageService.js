import { openDB } from 'idb';

const DB_NAME = 'producer-ai-archives';
const DB_VERSION = 1;

const STORES = {
  TRACKS: 'tracks',
  SESSIONS: 'sessions',
  FRAGMENTS: 'fragments',
  METADATA: 'metadata',
  ACCOUNTS: 'accounts'
};

class StorageService {
  constructor() {
    this.db = null;
    this.dbPromise = null;
  }

  /**
   * Initialize the IndexedDB database
   * @returns {Promise<IDBDatabase>}
   */
  async init() {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        // Tracks store
        if (!db.objectStoreNames.contains(STORES.TRACKS)) {
          const trackStore = db.createObjectStore(STORES.TRACKS, { keyPath: 'id' });
          trackStore.createIndex('accountId', 'accountId', { unique: false });
          trackStore.createIndex('conversationId', 'conversationId', { unique: false });
          trackStore.createIndex('createdAt', 'createdAt', { unique: false });
          trackStore.createIndex('rating', 'rating', { unique: false });
          trackStore.createIndex('title', 'title', { unique: false });
        }

        // Sessions store
        if (!db.objectStoreNames.contains(STORES.SESSIONS)) {
          const sessionStore = db.createObjectStore(STORES.SESSIONS, { keyPath: 'conversationId' });
          sessionStore.createIndex('primaryAccountId', 'primaryAccountId', { unique: false });
          sessionStore.createIndex('updatedAt', 'updatedAt', { unique: false });
          sessionStore.createIndex('sourceAccounts', 'sourceAccounts', { unique: false, multiEntry: true });
        }

        // Fragments store
        if (!db.objectStoreNames.contains(STORES.FRAGMENTS)) {
          const fragmentStore = db.createObjectStore(STORES.FRAGMENTS, { keyPath: 'fragmentId' });
          fragmentStore.createIndex('conversationId', 'conversationId', { unique: false });
          fragmentStore.createIndex('linkedTrackId', 'linkedTrackId', { unique: false });
          fragmentStore.createIndex('isSelected', 'isSelected', { unique: false });
        }

        // Metadata store (for app settings, last sync, etc.)
        if (!db.objectStoreNames.contains(STORES.METADATA)) {
          db.createObjectStore(STORES.METADATA, { keyPath: 'key' });
        }

        // Accounts store
        if (!db.objectStoreNames.contains(STORES.ACCOUNTS)) {
          db.createObjectStore(STORES.ACCOUNTS, { keyPath: 'id' });
        }
      }
    });

    this.db = await this.dbPromise;
    return this.db;
  }

  /**
   * Ensure database is initialized
   * @private
   */
  async ensureDB() {
    if (!this.db) {
      await this.init();
    }
    return this.db;
  }

  // ==================== TRACK OPERATIONS ====================

  /**
   * Save a single track
   * @param {Object} track - Track object
   * @returns {Promise<string>} - Track ID
   */
  async saveTrack(track) {
    const db = await this.ensureDB();
    await db.put(STORES.TRACKS, {
      ...track,
      updatedAt: new Date().toISOString()
    });
    return track.id;
  }

  /**
   * Save multiple tracks
   * @param {Array<Object>} tracks - Array of track objects
   * @returns {Promise<number>} - Number of saved tracks
   */
  async saveTracks(tracks) {
    const db = await this.ensureDB();
    const tx = db.transaction(STORES.TRACKS, 'readwrite');
    const store = tx.store;
    
    const now = new Date().toISOString();
    for (const track of tracks) {
      await store.put({
        ...track,
        updatedAt: now
      });
    }
    
    await tx.done;
    return tracks.length;
  }

  /**
   * Batch save tracks in single transaction (optimized)
   * @param {Array<Object>} tracks - Array of track objects
   * @returns {Promise<number>}
   */
  async saveTracksBatch(tracks) {
    const db = await this.ensureDB();
    const tx = db.transaction(STORES.TRACKS, 'readwrite');
    
    // Fire all puts concurrently within single transaction
    const promises = tracks.map(track => tx.store.put(track));
    await Promise.all(promises);
    await tx.done;
    
    return tracks.length;
  }

  /**
   * Batch save sessions in single transaction
   * @param {Array<Object>} sessions - Array of session objects
   * @returns {Promise<number>}
   */
  async saveSessionsBatch(sessions) {
    const db = await this.ensureDB();
    const tx = db.transaction(STORES.SESSIONS, 'readwrite');
    
    const promises = sessions.map(session => tx.store.put(session));
    await Promise.all(promises);
    await tx.done;
    
    return sessions.length;
  }

  /**
   * Batch save fragments in single transaction
   * @param {Array<Object>} fragments - Array of fragment objects
   * @returns {Promise<number>}
   */
  async saveFragmentsBatch(fragments) {
    const db = await this.ensureDB();
    const tx = db.transaction(STORES.FRAGMENTS, 'readwrite');
    
    const promises = fragments.map(fragment => tx.store.put(fragment));
    await Promise.all(promises);
    await tx.done;
    
    return fragments.length;
  }

  /**
   * Batch set metadata in single transaction
   * @param {Object} metadata - Object with key-value pairs
   * @returns {Promise<void>}
   */
  async setMetadataBatch(metadata) {
    const db = await this.ensureDB();
    const tx = db.transaction(STORES.METADATA, 'readwrite');
    
    const now = new Date().toISOString();
    const promises = Object.entries(metadata).map(([key, value]) => 
      tx.store.put({ key, value, updatedAt: now })
    );
    await Promise.all(promises);
    await tx.done;
  }

  /**
   * Get a track by ID
   * @param {string} id - Track ID
   * @returns {Promise<Object|null>}
   */
  async getTrack(id) {
    const db = await this.ensureDB();
    return db.get(STORES.TRACKS, id);
  }

  /**
   * Get all tracks
   * @returns {Promise<Array<Object>>}
   */
  async getAllTracks() {
    const db = await this.ensureDB();
    return db.getAll(STORES.TRACKS);
  }

  /**
   * Get tracks by account ID
   * @param {number} accountId - Account ID
   * @returns {Promise<Array<Object>>}
   */
  async getTracksByAccount(accountId) {
    const db = await this.ensureDB();
    return db.getAllFromIndex(STORES.TRACKS, 'accountId', accountId);
  }

  /**
   * Get tracks by conversation ID
   * @param {string} conversationId - Conversation ID
   * @returns {Promise<Array<Object>>}
   */
  async getTracksByConversation(conversationId) {
    const db = await this.ensureDB();
    return db.getAllFromIndex(STORES.TRACKS, 'conversationId', conversationId);
  }

  /**
   * Delete a track
   * @param {string} id - Track ID
   * @returns {Promise<void>}
   */
  async deleteTrack(id) {
    const db = await this.ensureDB();
    await db.delete(STORES.TRACKS, id);
  }

  /**
   * Clear all tracks
   * @returns {Promise<void>}
   */
  async clearTracks() {
    const db = await this.ensureDB();
    await db.clear(STORES.TRACKS);
  }

  // ==================== SESSION OPERATIONS ====================

  /**
   * Save a session
   * @param {Object} session - Session object
   * @returns {Promise<string>} - Conversation ID
   */
  async saveSession(session) {
    const db = await this.ensureDB();
    await db.put(STORES.SESSIONS, {
      ...session,
      updatedAt: new Date().toISOString()
    });
    return session.conversationId;
  }

  /**
   * Save multiple sessions
   * @param {Array<Object>} sessions - Array of session objects
   * @returns {Promise<number>}
   */
  async saveSessions(sessions) {
    const db = await this.ensureDB();
    const tx = db.transaction(STORES.SESSIONS, 'readwrite');
    const store = tx.store;
    
    const now = new Date().toISOString();
    for (const session of sessions) {
      await store.put({
        ...session,
        updatedAt: now
      });
    }
    
    await tx.done;
    return sessions.length;
  }

  /**
   * Get a session by conversation ID
   * @param {string} conversationId - Conversation ID
   * @returns {Promise<Object|null>}
   */
  async getSession(conversationId) {
    const db = await this.ensureDB();
    return db.get(STORES.SESSIONS, conversationId);
  }

  /**
   * Get all sessions
   * @returns {Promise<Array<Object>>}
   */
  async getAllSessions() {
    const db = await this.ensureDB();
    return db.getAll(STORES.SESSIONS);
  }

  /**
   * Get sessions by account ID
   * @param {number} accountId - Account ID
   * @returns {Promise<Array<Object>>}
   */
  async getSessionsByAccount(accountId) {
    const db = await this.ensureDB();
    return db.getAllFromIndex(STORES.SESSIONS, 'primaryAccountId', accountId);
  }

  /**
   * Delete a session
   * @param {string} conversationId - Conversation ID
   * @returns {Promise<void>}
   */
  async deleteSession(conversationId) {
    const db = await this.ensureDB();
    await db.delete(STORES.SESSIONS, conversationId);
  }

  /**
   * Clear all sessions
   * @returns {Promise<void>}
   */
  async clearSessions() {
    const db = await this.ensureDB();
    await db.clear(STORES.SESSIONS);
  }

  // ==================== FRAGMENT OPERATIONS ====================

  /**
   * Save a text fragment
   * @param {Object} fragment - Fragment object
   * @returns {Promise<string>} - Fragment ID
   */
  async saveFragment(fragment) {
    const db = await this.ensureDB();
    await db.put(STORES.FRAGMENTS, {
      ...fragment,
      updatedAt: new Date().toISOString()
    });
    return fragment.fragmentId;
  }

  /**
   * Get fragments by conversation ID
   * @param {string} conversationId - Conversation ID
   * @returns {Promise<Array<Object>>}
   */
  async getFragmentsByConversation(conversationId) {
    const db = await this.ensureDB();
    return db.getAllFromIndex(STORES.FRAGMENTS, 'conversationId', conversationId);
  }

  /**
   * Get fragments by track ID
   * @param {string} trackId - Track ID
   * @returns {Promise<Array<Object>>}
   */
  async getFragmentsByTrack(trackId) {
    const db = await this.ensureDB();
    return db.getAllFromIndex(STORES.FRAGMENTS, 'linkedTrackId', trackId);
  }

  // ==================== METADATA OPERATIONS ====================

  /**
   * Set a metadata value
   * @param {string} key - Metadata key
   * @param {*} value - Metadata value
   * @returns {Promise<void>}
   */
  async setMetadata(key, value) {
    const db = await this.ensureDB();
    await db.put(STORES.METADATA, { key, value, updatedAt: new Date().toISOString() });
  }

  /**
   * Get a metadata value
   * @param {string} key - Metadata key
   * @returns {Promise<*>}
   */
  async getMetadata(key) {
    const db = await this.ensureDB();
    const result = await db.get(STORES.METADATA, key);
    return result ? result.value : null;
  }

  /**
   * Delete metadata
   * @param {string} key - Metadata key
   * @returns {Promise<void>}
   */
  async deleteMetadata(key) {
    const db = await this.ensureDB();
    await db.delete(STORES.METADATA, key);
  }

  // ==================== ACCOUNT OPERATIONS ====================

  /**
   * Save account info
   * @param {Object} account - Account object with id, name, email, etc.
   * @returns {Promise<number>} - Account ID
   */
  async saveAccount(account) {
    const db = await this.ensureDB();
    await db.put(STORES.ACCOUNTS, {
      ...account,
      updatedAt: new Date().toISOString()
    });
    return account.id;
  }

  /**
   * Get all accounts
   * @returns {Promise<Array<Object>>}
   */
  async getAllAccounts() {
    const db = await this.ensureDB();
    return db.getAll(STORES.ACCOUNTS);
  }

  /**
   * Get account by ID
   * @param {number} id - Account ID
   * @returns {Promise<Object|null>}
   */
  async getAccount(id) {
    const db = await this.ensureDB();
    return db.get(STORES.ACCOUNTS, id);
  }

  // ==================== BULK OPERATIONS ====================

  /**
   * Clear all data
   * @returns {Promise<void>}
   */
  async clearAll() {
    const db = await this.ensureDB();
    await Promise.all([
      db.clear(STORES.TRACKS),
      db.clear(STORES.SESSIONS),
      db.clear(STORES.FRAGMENTS),
      db.clear(STORES.METADATA),
      db.clear(STORES.ACCOUNTS)
    ]);
  }

  /**
   * Get database statistics
   * @returns {Promise<Object>}
   */
  async getStats() {
    const db = await this.ensureDB();
    const [tracks, sessions, fragments, accounts] = await Promise.all([
      db.count(STORES.TRACKS),
      db.count(STORES.SESSIONS),
      db.count(STORES.FRAGMENTS),
      db.count(STORES.ACCOUNTS)
    ]);

    return {
      tracks,
      sessions,
      fragments,
      accounts,
      totalSize: tracks + sessions + fragments + accounts
    };
  }

  /**
   * Export all data as JSON
   * @returns {Promise<Object>}
   */
  async exportAll() {
    const db = await this.ensureDB();
    const [tracks, sessions, fragments, metadata, accounts] = await Promise.all([
      db.getAll(STORES.TRACKS),
      db.getAll(STORES.SESSIONS),
      db.getAll(STORES.FRAGMENTS),
      db.getAll(STORES.METADATA),
      db.getAll(STORES.ACCOUNTS)
    ]);

    return {
      version: DB_VERSION,
      exportedAt: new Date().toISOString(),
      data: {
        tracks,
        sessions,
        fragments,
        metadata,
        accounts
      }
    };
  }

  /**
   * Import data from JSON
   * @param {Object} exportData - Data to import
   * @param {Object} options - Import options
   * @param {boolean} options.merge - Whether to merge or replace existing data
   * @returns {Promise<Object>} - Import statistics
   */
  async importAll(exportData, { merge = false } = {}) {
    const db = await this.ensureDB();
    
    if (!merge) {
      await this.clearAll();
    }

    const stats = { tracks: 0, sessions: 0, fragments: 0, accounts: 0 };

    if (exportData.data) {
      const { tracks, sessions, fragments, accounts } = exportData.data;

      if (tracks?.length) {
        await this.saveTracks(tracks);
        stats.tracks = tracks.length;
      }
      if (sessions?.length) {
        await this.saveSessions(sessions);
        stats.sessions = sessions.length;
      }
      if (fragments?.length) {
        const tx = db.transaction(STORES.FRAGMENTS, 'readwrite');
        for (const fragment of fragments) {
          await tx.store.put(fragment);
        }
        await tx.done;
        stats.fragments = fragments.length;
      }
      if (accounts?.length) {
        const tx = db.transaction(STORES.ACCOUNTS, 'readwrite');
        for (const account of accounts) {
          await tx.store.put(account);
        }
        await tx.done;
        stats.accounts = accounts.length;
      }
    }

    return stats;
  }
}

// Create singleton instance
const storageService = new StorageService();

export default storageService;
export { StorageService, STORES };
