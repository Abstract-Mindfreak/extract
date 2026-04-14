import storageService from './StorageService';

/**
 * Service for loading and managing mock data
 */
class MockDataService {
  constructor() {
    this.tracks = null;
    this.sessions = null;
    this.loaded = false;
  }

  /**
   * Check if mock data is already loaded in IndexedDB
   * @returns {Promise<boolean>}
   */
  async isLoaded() {
    const stats = await storageService.getStats();
    return stats.tracks > 0;
  }

  /**
   * Load mock data from JSON files
   * @returns {Promise<{tracks: Array, sessions: Array}>}
   */
  async loadFromFiles() {
    try {
      const [tracksResponse, sessionsResponse] = await Promise.all([
        fetch('/mock-data/tracks.json'),
        fetch('/mock-data/sessions.json')
      ]);

      if (!tracksResponse.ok) {
        throw new Error(`Failed to load tracks: ${tracksResponse.status}`);
      }
      if (!sessionsResponse.ok) {
        throw new Error(`Failed to load sessions: ${sessionsResponse.status}`);
      }

      this.tracks = await tracksResponse.json();
      this.sessions = await sessionsResponse.json();

      return {
        tracks: this.tracks,
        sessions: this.sessions
      };
    } catch (error) {
      console.error('Error loading mock data:', error);
      throw error;
    }
  }

  /**
   * Import mock data into IndexedDB using batch operations
   * @param {Object} options
   * @param {boolean} options.force - Force re-import even if data exists
   * @param {Function} options.onProgress - Progress callback (loaded, total, entity)
   * @returns {Promise<Object>} Import statistics
   */
  async importToDatabase({ force = false, onProgress = null } = {}) {
    // Check if already loaded
    if (!force && await this.isLoaded()) {
      console.log('Mock data already loaded. Use force=true to re-import.');
      const stats = await storageService.getStats();
      return { ...stats, skipped: true };
    }

    // Load from files if not already loaded
    if (!this.tracks || !this.sessions) {
      await this.loadFromFiles();
    }

    const stats = {
      tracks: 0,
      sessions: 0,
      fragments: 0,
      accounts: 0,
      skipped: false
    };

    try {
      // Clear existing data if force mode
      if (force) {
        await storageService.clearAll();
      }

      const now = new Date().toISOString();

      // Batch import tracks in single transaction
      if (this.tracks?.length) {
        const tracksWithTimestamp = this.tracks.map(t => ({ ...t, updatedAt: now }));
        await storageService.saveTracksBatch(tracksWithTimestamp);
        stats.tracks = this.tracks.length;
        if (onProgress) onProgress(stats.tracks, stats.tracks, 'tracks');
      }

      // Collect all fragments and batch save
      const allFragments = [];
      const sessionsWithTimestamp = this.sessions.map(s => {
        // Extract fragments from messages
        if (s.messages) {
          for (const message of s.messages) {
            if (message.textFragments?.length) {
              for (const fragment of message.textFragments) {
                allFragments.push({ ...fragment, updatedAt: now });
              }
            }
          }
        }
        return { ...s, updatedAt: now };
      });

      // Batch save fragments
      if (allFragments.length > 0) {
        await storageService.saveFragmentsBatch(allFragments);
        stats.fragments = allFragments.length;
      }

      // Batch save sessions
      if (sessionsWithTimestamp.length > 0) {
        await storageService.saveSessionsBatch(sessionsWithTimestamp);
        stats.sessions = sessionsWithTimestamp.length;
        if (onProgress) onProgress(stats.sessions, stats.sessions, 'sessions');
      }

      // Set metadata in single batch
      await storageService.setMetadataBatch({
        mockDataLoaded: true,
        mockDataLoadedAt: now,
        mockDataVersion: '1.0'
      });

      console.log('Mock data imported successfully:', stats);
      return stats;
    } catch (error) {
      console.error('Error importing mock data:', error);
      throw error;
    }
  }

  /**
   * Get a single track by ID
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  async getTrack(id) {
    return storageService.getTrack(id);
  }

  /**
   * Get all tracks
   * @returns {Promise<Array>}
   */
  async getAllTracks() {
    return storageService.getAllTracks();
  }

  /**
   * Get tracks by account
   * @param {number} accountId
   * @returns {Promise<Array>}
   */
  async getTracksByAccount(accountId) {
    return storageService.getTracksByAccount(accountId);
  }

  /**
   * Get a session by conversation ID
   * @param {string} conversationId
   * @returns {Promise<Object|null>}
   */
  async getSession(conversationId) {
    return storageService.getSession(conversationId);
  }

  /**
   * Get all sessions
   * @returns {Promise<Array>}
   */
  async getAllSessions() {
    return storageService.getAllSessions();
  }

  /**
   * Get sessions linked to a track
   * @param {string} trackId
   * @returns {Promise<Array>}
   */
  async getSessionsForTrack(trackId) {
    const track = await storageService.getTrack(trackId);
    if (!track?.conversationId) return [];
    
    const session = await storageService.getSession(track.conversationId);
    return session ? [session] : [];
  }

  /**
   * Search tracks by query
   * @param {string} query - Search query
   * @returns {Promise<Array>} Filtered tracks
   */
  async searchTracks(query) {
    const tracks = await storageService.getAllTracks();
    if (!query) return tracks;

    const lowerQuery = query.toLowerCase();
    return tracks.filter(track => 
      track.title?.toLowerCase().includes(lowerQuery) ||
      track.soundPrompt?.toLowerCase().includes(lowerQuery) ||
      track.lyrics?.toLowerCase().includes(lowerQuery) ||
      track.conversationId?.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Update track rating
   * @param {string} trackId
   * @param {number} rating
   * @returns {Promise<void>}
   */
  async updateTrackRating(trackId, rating) {
    const track = await storageService.getTrack(trackId);
    if (track) {
      track.rating = rating;
      track.updatedAt = new Date().toISOString();
      await storageService.saveTrack(track);
    }
  }

  /**
   * Increment play count
   * @param {string} trackId
   * @returns {Promise<void>}
   */
  async incrementPlayCount(trackId) {
    const track = await storageService.getTrack(trackId);
    if (track) {
      track.playCount = (track.playCount || 0) + 1;
      track.updatedAt = new Date().toISOString();
      await storageService.saveTrack(track);
    }
  }

  /**
   * Get database statistics
   * @returns {Promise<Object>}
   */
  async getStats() {
    return storageService.getStats();
  }

  /**
   * Clear all mock data
   * @returns {Promise<void>}
   */
  async clearAll() {
    await storageService.clearAll();
    await storageService.setMetadata('mockDataLoaded', false);
  }

  /**
   * Reload mock data (clear and re-import)
   * @param {Function} onProgress
   * @returns {Promise<Object>}
   */
  async reload(onProgress) {
    this.tracks = null;
    this.sessions = null;
    return this.importToDatabase({ force: true, onProgress });
  }
}

// Create singleton instance
const mockDataService = new MockDataService();

export default mockDataService;
export { MockDataService };
