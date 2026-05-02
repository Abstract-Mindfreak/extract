const ARCHIVE_PATH = '/library';

class ArchiveDataService {
  constructor() {
    this.cache = new Map();
    this.tracks = [];
    this.loaded = false;
  }

  async loadArchives() {
    if (this.loaded) return this.tracks;

    try {
      // Try to load from backend API first
      const response = await fetch('/api/archives/tracks');
      if (response.ok) {
        const data = await response.json();
        this.tracks = data.tracks || [];
        this.loaded = true;
        return this.tracks;
      }
    } catch (error) {
      console.warn('Failed to load from API, trying direct file access:', error);
    }

    // Fallback: try to load from local archive file
    try {
      const response = await fetch(`${ARCHIVE_PATH}/archive3.json`);
      if (response.ok) {
        const data = await response.json();
        // Parse the text format - this is a custom format that needs parsing
        // For now, return empty since the format is non-standard JSON
        console.warn('Archive file is in custom text format, needs parser');
        this.loaded = true;
        return [];
      }
    } catch (error) {
      console.error('Failed to load archive data:', error);
    }

    this.loaded = true;
    return [];
  }

  async getAllTracks() {
    if (!this.loaded) {
      await this.loadArchives();
    }
    return this.tracks;
  }

  async getTrackById(trackId) {
    const tracks = await this.getAllTracks();
    return tracks.find(track => track.id === trackId);
  }

  async searchTracks(query) {
    const tracks = await this.getAllTracks();
    const lowerQuery = query.toLowerCase();

    return tracks.filter(track =>
      track.title?.toLowerCase().includes(lowerQuery) ||
      track.soundPrompt?.toLowerCase().includes(lowerQuery) ||
      track.id?.toLowerCase().includes(lowerQuery)
    );
  }

  async getTrackSuggestions(partialTitle) {
    const tracks = await this.getAllTracks();
    const lowerPartial = partialTitle.toLowerCase();

    return tracks
      .filter(track => track.title?.toLowerCase().includes(lowerPartial))
      .slice(0, 20)
      .map(track => ({
        id: track.id,
        title: track.title,
        audioUrl: track.audioUrl,
        imageUrl: track.imageUrl,
        prompt: track.soundPrompt
      }));
  }

  async getStats() {
    const tracks = await this.getAllTracks();
    
    return {
      totalTracks: tracks.length,
      totalBackups: 1
    };
  }

  clearCache() {
    this.cache.clear();
    this.tracks = [];
    this.loaded = false;
  }
}

// Singleton instance
const archiveDataService = new ArchiveDataService();

export default archiveDataService;
