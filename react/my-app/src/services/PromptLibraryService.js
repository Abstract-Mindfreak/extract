const PROMPT_LIBRARY_PATH = '/library/prompt-library-blocks';

class PromptLibraryService {
  constructor() {
    this.cache = new Map();
    this.blocks = [];
    this.loaded = false;
  }

  async loadLibrary() {
    if (this.loaded) return this.blocks;

    try {
      // Try to load from backend API first
      const response = await fetch('/api/prompt-library/blocks');
      if (response.ok) {
        const data = await response.json();
        this.blocks = data.blocks || [];
        this.loaded = true;
        return this.blocks;
      }
    } catch (error) {
      console.warn('Failed to load from API, trying direct file access:', error);
    }

    // Fallback: try to load from local library directory
    try {
      // For now, we'll return empty array since we can't list directory contents from browser
      // In production, this should be served by a backend API
      console.warn('Direct file access not available in browser. Use backend API.');
      this.loaded = true;
      return [];
    } catch (error) {
      console.error('Failed to load prompt library:', error);
      return [];
    }
  }

  // Load blocks from a specific file (for testing/development)
  async loadBlockFromFile(filename) {
    try {
      const response = await fetch(`${PROMPT_LIBRARY_PATH}/${filename}`);
      if (response.ok) {
        const block = await response.json();
        return block;
      }
    } catch (error) {
      console.error(`Failed to load block ${filename}:`, error);
    }
    return null;
  }

  // Load multiple blocks from known filenames
  async loadBlocksFromFilenames(filenames) {
    const blocks = [];
    for (const filename of filenames) {
      const block = await this.loadBlockFromFile(filename);
      if (block) {
        blocks.push(block);
      }
    }
    return blocks;
  }

  async getBlocks() {
    if (!this.loaded) {
      await this.loadLibrary();
    }
    return this.blocks;
  }

  async getBlockById(blockId) {
    const blocks = await this.getBlocks();
    return blocks.find(block => block.id === blockId);
  }

  async searchBlocks(query) {
    const blocks = await this.getBlocks();
    const lowerQuery = query.toLowerCase();
    
    return blocks.filter(block => 
      block.name?.toLowerCase().includes(lowerQuery) ||
      block.description?.toLowerCase().includes(lowerQuery) ||
      block.tags?.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
      block.category?.toLowerCase().includes(lowerQuery)
    );
  }

  async getBlocksByCategory(category) {
    const blocks = await this.getBlocks();
    return blocks.filter(block => 
      block.category === category || 
      block.name?.toLowerCase().includes(category.toLowerCase())
    );
  }

  async getBlockSuggestions(partialName) {
    const blocks = await this.getBlocks();
    const lowerPartial = partialName.toLowerCase();
    
    return blocks
      .filter(block => block.name?.toLowerCase().includes(lowerPartial))
      .slice(0, 10)
      .map(block => ({
        id: block.id,
        name: block.name,
        description: block.description,
        category: block.category || 'General'
      }));
  }

  getBlockPayload(blockId) {
    return this.blocks.find(block => block.id === blockId)?.payload;
  }

  getBlockData(blockId) {
    const block = this.blocks.find(block => block.id === blockId);
    return block?.payload?.data || null;
  }

  clearCache() {
    this.cache.clear();
    this.blocks = [];
    this.blockIndex = [];
    this.loaded = false;
  }
}

// Singleton instance
const promptLibraryService = new PromptLibraryService();

export default promptLibraryService;
