import { create } from 'zustand';
import mockDataService from '../services/MockDataService';
import localDataImporter from '../services/LocalDataImporter';
import { APP_CONFIG } from '../constants/app';

export const useTrackStore = create((set, get) => ({
  // State
  tracks: [],
  filteredTracks: [],
  selectedTracks: new Set(),
  currentTrack: null,
  isLoading: false,
  error: null,
  
  // Filter state
  filters: {
    search: '',
    accounts: [],
    rating: null,
    dateFrom: null,
    dateTo: null,
    hasLyrics: null
  },
  
  // Sort state
  sortConfig: {
    key: 'createdAt',
    direction: 'desc'
  },
  
  // Pagination
  pagination: {
    page: 1,
    pageSize: APP_CONFIG.pageSize,
    total: 0
  },

  // ==================== ACTIONS ====================
  
  /**
   * Load all tracks from database
   */
  loadTracks: async () => {
    set({ isLoading: true, error: null });
    
    try {
      const tracks = await mockDataService.getAllTracks();
      
      // Apply filters immediately with new tracks
      const { filters, sortConfig } = get();
      let filtered = [...tracks];
      
      if (filters.search) {
        const query = filters.search.toLowerCase();
        filtered = filtered.filter(track =>
          track.title?.toLowerCase().includes(query) ||
          track.soundPrompt?.toLowerCase().includes(query) ||
          track.lyrics?.toLowerCase().includes(query) ||
          track.conversationId?.toLowerCase().includes(query)
        );
      }
      
      if (filters.accounts.length > 0) {
        filtered = filtered.filter(track => 
          filters.accounts.includes(track.accountId)
        );
      }
      
      if (filters.rating !== null) {
        filtered = filtered.filter(track => track.rating >= filters.rating);
      }
      
      filtered.sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];
        if (sortConfig.key === 'date') {
          aVal = new Date(a.createdAt);
          bVal = new Date(b.createdAt);
        }
        if (aVal === null || aVal === undefined) aVal = '';
        if (bVal === null || bVal === undefined) bVal = '';
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
      
      set({ 
        tracks,
        filteredTracks: filtered,
        pagination: { ...get().pagination, total: filtered.length, page: 1 },
        isLoading: false
      });
    } catch (error) {
      console.error('Failed to load tracks:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  /**
   * Initialize mock data
   */
  initMockData: async (onProgress) => {
    set({ isLoading: true, error: null });
    
    try {
      const stats = await mockDataService.importToDatabase({ onProgress });
      await get().loadTracks();
      return stats;
    } catch (error) {
      set({ error: error.message });
      console.error('Failed to init mock data:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },
  
  /**
   * Set search filter
   */
  setSearchFilter: (search) => {
    set(state => ({ 
      filters: { ...state.filters, search },
      pagination: { ...state.pagination, page: 1 }
    }));
    get().applyFilters();
  },
  
  /**
   * Set account filter
   */
  setAccountFilter: (accounts) => {
    set(state => ({ 
      filters: { ...state.filters, accounts },
      pagination: { ...state.pagination, page: 1 }
    }));
    get().applyFilters();
  },
  
  /**
   * Set rating filter
   */
  setRatingFilter: (rating) => {
    set(state => ({ 
      filters: { ...state.filters, rating },
      pagination: { ...state.pagination, page: 1 }
    }));
    get().applyFilters();
  },
  
  /**
   * Clear all filters
   */
  clearFilters: () => {
    set({ 
      filters: {
        search: '',
        accounts: [],
        rating: null,
        dateFrom: null,
        dateTo: null,
        hasLyrics: null
      },
      pagination: { ...get().pagination, page: 1 }
    });
    get().applyFilters();
  },
  
  /**
   * Apply filters and sorting
   */
  applyFilters: () => {
    const { tracks, filters, sortConfig } = get();
    
    let filtered = [...tracks];
    
    // Search filter
    if (filters.search) {
      const query = filters.search.toLowerCase();
      filtered = filtered.filter(track =>
        track.title?.toLowerCase().includes(query) ||
        track.soundPrompt?.toLowerCase().includes(query) ||
        track.lyrics?.toLowerCase().includes(query) ||
        track.conversationId?.toLowerCase().includes(query)
      );
    }
    
    // Account filter
    if (filters.accounts.length > 0) {
      filtered = filtered.filter(track => 
        filters.accounts.includes(track.accountId)
      );
    }
    
    // Rating filter
    if (filters.rating !== null) {
      filtered = filtered.filter(track => 
        track.rating >= filters.rating
      );
    }
    
    // Date filters
    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      filtered = filtered.filter(track => 
        new Date(track.createdAt) >= fromDate
      );
    }
    
    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo);
      toDate.setHours(23, 59, 59);
      filtered = filtered.filter(track => 
        new Date(track.createdAt) <= toDate
      );
    }
    
    // Lyrics filter
    if (filters.hasLyrics !== null) {
      filtered = filtered.filter(track => {
        const hasLyrics = track.lyrics && track.lyrics !== '[Instrumental]';
        return filters.hasLyrics ? hasLyrics : !hasLyrics;
      });
    }
    
    // Sorting
    filtered.sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];
      
      if (sortConfig.key === 'date') {
        aVal = new Date(a.createdAt);
        bVal = new Date(b.createdAt);
      }
      
      if (aVal === null || aVal === undefined) aVal = '';
      if (bVal === null || bVal === undefined) bVal = '';
      
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    
    set({ 
      filteredTracks: filtered,
      pagination: { ...get().pagination, total: filtered.length }
    });
  },
  
  /**
   * Set sort configuration
   */
  setSortConfig: (key) => {
    set(state => {
      const direction = state.sortConfig.key === key && state.sortConfig.direction === 'asc' 
        ? 'desc' 
        : 'asc';
      return { sortConfig: { key, direction } };
    });
    get().applyFilters();
  },
  
  /**
   * Set page
   */
  setPage: (page) => {
    set(state => ({
      pagination: { ...state.pagination, page }
    }));
  },
  
  /**
   * Set page size
   */
  setPageSize: (pageSize) => {
    set(state => ({
      pagination: { page: 1, pageSize, total: state.pagination.total }
    }));
  },
  
  /**
   * Toggle track selection
   */
  toggleTrackSelection: (trackId) => {
    set(state => {
      const newSelection = new Set(state.selectedTracks);
      if (newSelection.has(trackId)) {
        newSelection.delete(trackId);
      } else {
        newSelection.add(trackId);
      }
      return { selectedTracks: newSelection };
    });
  },
  
  /**
   * Select all visible tracks
   */
  selectAllVisible: () => {
    const { filteredTracks, pagination } = get();
    const start = (pagination.page - 1) * pagination.pageSize;
    const end = start + pagination.pageSize;
    const visibleTracks = filteredTracks.slice(start, end);
    
    set(state => {
      const newSelection = new Set(state.selectedTracks);
      visibleTracks.forEach(track => newSelection.add(track.id));
      return { selectedTracks: newSelection };
    });
  },
  
  /**
   * Deselect all
   */
  deselectAll: () => {
    set({ selectedTracks: new Set() });
  },
  
  /**
   * Set current track (for playback)
   */
  setCurrentTrack: (track) => {
    set({ currentTrack: track });
  },
  
  /**
   * Update track rating
   */
  updateTrackRating: async (trackId, rating) => {
    try {
      await mockDataService.updateTrackRating(trackId, rating);
      
      set(state => {
        const updateTrack = (track) => 
          track.id === trackId ? { ...track, rating } : track;
        
        return {
          tracks: state.tracks.map(updateTrack),
          filteredTracks: state.filteredTracks.map(updateTrack)
        };
      });
    } catch (error) {
      console.error('Failed to update rating:', error);
    }
  },
  
  /**
   * Increment play count
   */
  incrementPlayCount: async (trackId) => {
    try {
      await mockDataService.incrementPlayCount(trackId);
      
      set(state => {
        const updateTrack = (track) => 
          track.id === trackId 
            ? { ...track, playCount: (track.playCount || 0) + 1 } 
            : track;
        
        return {
          tracks: state.tracks.map(updateTrack),
          filteredTracks: state.filteredTracks.map(updateTrack)
        };
      });
    } catch (error) {
      console.error('Failed to increment play count:', error);
    }
  },
  
  /**
   * Get paginated tracks
   */
  getPaginatedTracks: () => {
    const { filteredTracks, pagination } = get();
    const start = (pagination.page - 1) * pagination.pageSize;
    return filteredTracks.slice(start, start + pagination.pageSize);
  },
  
  /**
   * Get total pages
   */
  getTotalPages: () => {
    const { pagination } = get();
    return Math.ceil(pagination.total / pagination.pageSize);
  },

  /**
   * Import data from local-data (real archive)
   */
  importLocalData: async (onProgress) => {
    set({ isLoading: true, error: null });
    
    try {
      const result = await localDataImporter.importFromLocalData(onProgress);
      
      if (!result.success) {
        throw new Error(result.errors.join(', '));
      }
      
      // Reload tracks after import
      await get().loadTracks();
      
      return result;
    } catch (error) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  /**
   * Check if local data has been imported
   */
  hasLocalData: async () => {
    return await localDataImporter.hasImportedData();
  }
}));
