/**
 * LocalDataImporter — импорт реальных данных из public/local-data/
 * Сканирует скопированные файлы и загружает их в IndexedDB
 */

import metaParser from './MetaParser';
import sessionExtractor from './SessionExtractor';
import storageService from './StorageService';
import producerSessionParser from './ProducerSessionParser';
import producerPromptNormalizer from './ProducerPromptNormalizer';
import { archiverManager } from './ProducerArchiverService';

/**
 * @typedef {Object} ImportProgress
 * @property {'scanning'|'parsing'|'extracting'|'saving'} stage
 * @property {number} current
 * @property {number} total
 * @property {string} message
 */

/**
 * @typedef {Object} ImportResult
 * @property {boolean} success
 * @property {number} tracksImported
 * @property {number} sessionsImported
 * @property {string[]} errors
 * @property {number} duration
 */

class LocalDataImporter {
  /**
   * Импортировать данные из public/local-data/
   * @param {(progress: ImportProgress) => void} [onProgress]
   * @returns {Promise<ImportResult>}
   */
  async importFromLocalData(onProgress) {
    const startTime = Date.now();
    const errors = [];

    try {
      // Stage 1: Discover available tracks
      if (onProgress) {
        onProgress({
          stage: 'scanning',
          current: 0,
          total: 100,
          message: 'Сканирование local-data...'
        });
      }

      const trackDirs = await this.discoverTrackDirectories();
      
      if (onProgress) {
        onProgress({
          stage: 'scanning',
          current: trackDirs.length,
          total: trackDirs.length,
          message: `Найдено ${trackDirs.length} треков`
        });
      }

      // Stage 2: Parse meta.json files
      if (onProgress) {
        onProgress({
          stage: 'parsing',
          current: 0,
          total: trackDirs.length,
          message: 'Парсинг метаданных...'
        });
      }

      const tracks = [];
      
      for (let i = 0; i < trackDirs.length; i++) {
        const { accountId, trackId } = trackDirs[i];
        
        try {
          const metaUrl = `/local-data/account_${accountId}/${trackId}/meta.json`;
          const response = await fetch(metaUrl);
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          
          const metaJson = await response.text();
          const track = metaParser.parseMetaJson(
            metaJson,
            accountId,
            `account_${accountId}/${trackId}/meta.json`
          );
          
          // Update URLs to point to local-data
          const basePath = `/local-data/account_${accountId}/${trackId}`;
          
          // Try to determine audio file extension
          const audioExt = await this.discoverAudioExtension(basePath);
          if (audioExt) {
            track.audioUrl = `${basePath}/audio.${audioExt}`;
          }
          
          // Try to determine image file extension
          const imageExt = await this.discoverImageExtension(basePath);
          if (imageExt) {
            track.coverUrl = `${basePath}/image.${imageExt}`;
          }
          
          tracks.push(track);
        } catch (err) {
          errors.push(`Ошибка парсинга ${trackId}: ${err?.message || err}`);
        }
        
        if (onProgress) {
          onProgress({
            stage: 'parsing',
            current: i + 1,
            total: trackDirs.length,
            message: `Обработано ${i + 1}/${trackDirs.length}`
          });
        }
      }

      // Stage 3: Extract sessions
      if (onProgress) {
        onProgress({
          stage: 'extracting',
          current: 0,
          total: 100,
          message: 'Извлечение сессий...'
        });
      }

      const extractionResult = sessionExtractor.extract(tracks);
      let sessions = extractionResult.sessions;

      try {
        const enrichedSessions = await this.enrichSessionsFromProducer(tracks, onProgress);
        sessions = this.mergeSessions(sessions, enrichedSessions);
      } catch (err) {
        errors.push(`Session enrichment skipped: ${err?.message || err}`);
      }

      const normalizationResult = producerPromptNormalizer.normalizeSessions(sessions, tracks);
      sessions = producerPromptNormalizer.attachNormalizationSummary(
        sessions,
        normalizationResult.summaryByConversation
      );

      if (onProgress) {
        onProgress({
          stage: 'extracting',
          current: 55,
          total: 100,
          message: `Извлечено ${sessions.length} сессий`
        });
      }

      // Stage 4: Save to IndexedDB
      if (onProgress) {
        onProgress({
          stage: 'saving',
          current: 0,
          total: 100,
          message: 'Сохранение в базу данных...'
        });
      }

      await storageService.saveTracksBatch(tracks);
      await storageService.saveSessionsBatch(sessions);
      
      const allFragments = sessions.flatMap(s =>
        s.messages.flatMap(m => m.textFragments || [])
      );
      
      if (allFragments.length > 0) {
        await storageService.saveFragmentsBatch(allFragments);
      }

      if (normalizationResult.rawPrompts.length > 0) {
        await storageService.saveRawPromptsBatch(normalizationResult.rawPrompts);
      }

      if (normalizationResult.promptBlocks.length > 0) {
        await storageService.savePromptBlocksBatch(normalizationResult.promptBlocks);
      }

      if (normalizationResult.promptSequences.length > 0) {
        await storageService.savePromptSequencesBatch(normalizationResult.promptSequences);
      }

      // Update metadata
      await storageService.setMetadataBatch({
        'dataImportedAt': new Date().toISOString(),
        'importedTracks': tracks.length,
        'importedSessions': sessions.length,
        'importedRawPrompts': normalizationResult.rawPrompts.length,
        'importedPromptBlocks': normalizationResult.promptBlocks.length,
        'importedPromptSequences': normalizationResult.promptSequences.length,
        'dataSource': 'local-data'
      });

      if (onProgress) {
        onProgress({
          stage: 'saving',
          current: 100,
          total: 100,
          message: 'Сохранение завершено'
        });
      }

      return {
        success: true,
        tracksImported: tracks.length,
        sessionsImported: sessions.length,
        errors,
        duration: Date.now() - startTime
      };

    } catch (err) {
      return {
        success: false,
        tracksImported: 0,
        sessionsImported: 0,
        errors: [...errors, err?.message || String(err)],
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Discover track directories in public/local-data/
   * @returns {Promise<Array<{accountId: string, trackId: string}>>}
   */
  async discoverTrackDirectories() {
    const tracks = [];
    const seen = new Set(); // Track unique combinations
    
    const addTrack = (accountId, trackId) => {
      const key = `${accountId}/${trackId}`;
      if (!seen.has(key)) {
        seen.add(key);
        tracks.push({ accountId, trackId });
      }
    };

    // Preferred source: lightweight catalog generated by import CLI
    try {
      const catalogResponse = await fetch('/local-data/catalog.json');
      if (catalogResponse.ok) {
        const catalog = await catalogResponse.json();

        for (const account of catalog.accounts || []) {
          for (const trackId of account.trackIds || []) {
            addTrack(String(account.accountId), trackId);
          }
        }
      }
    } catch {
      // Catalog not available, continue with other sources
    }
    
    // Try to load import report for discovery (merge with all accounts)
    try {
      const reportResponse = await fetch('/local-data/import-report.json');
      if (reportResponse.ok) {
        const report = await reportResponse.json();
        
        for (const file of report.result?.files || []) {
          const match = file.relativePath.match(/account_(\d+)\/([^/]+)/);
          if (match && file.type === 'meta') {
            addTrack(match[1], match[2]);
          }
        }
      }
    } catch {
      // Import report not available, will scan directories
    }

    if (tracks.length > 0) {
      return tracks;
    }
    
    // Fallback: try common account IDs and test paths
    const accountIds = ['1', '2', '3', '4'];
    
    for (const accountId of accountIds) {
      try {
        const response = await fetch(`/local-data/account_${accountId}/`);
        if (!response.ok) continue;
        
        const html = await response.text();
        const trackIds = this.parseDirectoryListing(html);
        
        for (const trackId of trackIds) {
          addTrack(accountId, trackId);
        }
      } catch {
        // Continue to next account
      }
    }
    
    return tracks;
  }

  /**
   * Parse HTML directory listing
   * @param {string} html
   * @returns {string[]}
   */
  parseDirectoryListing(html) {
    const trackIds = [];
    
    // Look for directory links in HTML
    const regex = /href="([^"]+)\/"/g;
    let match;
    
    while ((match = regex.exec(html)) !== null) {
      const name = match[1];
      // Filter out parent directory and non-UUID entries
      if (name !== '..' && name.length === 36) {
        trackIds.push(name);
      }
    }
    
    return trackIds;
  }

  /**
   * Discover audio file extension
   * @param {string} basePath
   * @returns {Promise<string|null>}
   */
  async discoverAudioExtension(basePath) {
    const extensions = ['m4a', 'mp3', 'wav'];
    
    for (const ext of extensions) {
      try {
        const response = await fetch(`${basePath}/audio.${ext}`, { method: 'HEAD' });
        if (response.ok) {
          return ext;
        }
      } catch {
        // Continue to next extension
      }
    }
    
    return null;
  }

  /**
   * Discover image file extension
   * @param {string} basePath
   * @returns {Promise<string|null>}
   */
  async discoverImageExtension(basePath) {
    const extensions = ['jpg', 'jpeg', 'png', 'webp'];
    
    for (const ext of extensions) {
      try {
        const response = await fetch(`${basePath}/image.${ext}`, { method: 'HEAD' });
        if (response.ok) {
          return ext;
        }
      } catch {
        // Continue to next extension
      }
    }
    
    return null;
  }

  /**
   * Check if local-data has been imported
   * @returns {Promise<boolean>}
   */
  async hasImportedData() {
    const importedAt = await storageService.getMetadata('dataImportedAt');
    return importedAt !== null;
  }

  /**
   * Get import statistics
   * @returns {Promise<{tracks: number, sessions: number}>}
   */
  async getImportStats() {
    const tracks = (await storageService.getMetadata('importedTracks')) || 0;
    const sessions = (await storageService.getMetadata('importedSessions')) || 0;
    return { tracks, sessions };
  }

  async enrichSessionsFromProducer(tracks, onProgress) {
    const accountConversationMap = new Map();

    for (const track of tracks) {
      if (!track?.accountId || !track?.conversationId) continue;

      const accountKey = `account_${track.accountId}`;
      if (!accountConversationMap.has(accountKey)) {
        accountConversationMap.set(accountKey, new Set());
      }

      accountConversationMap.get(accountKey).add(track.conversationId);
    }

    if (accountConversationMap.size === 0) {
      return [];
    }

    const enrichedSessions = [];
    let processedAccounts = 0;
    const totalAccounts = accountConversationMap.size;
    const enrichmentErrors = [];

    for (const [accountId, conversationIdsSet] of accountConversationMap.entries()) {
      const conversationIds = Array.from(conversationIdsSet);

      if (onProgress) {
        onProgress({
          stage: 'extracting',
          current: 60 + Math.round((processedAccounts / totalAccounts) * 35),
          total: 100,
          message: `FlowMusic.app enrichment: ${accountId}, ${conversationIds.length} conversation(s)`
        });
      }

      try {
        const localResponse = await this.loadLocalConversationBatch(accountId, conversationIds);
        const missingConversationIds = conversationIds.filter(
          (conversationId) => !localResponse.loadedIds.includes(conversationId)
        );

        let response = {
          conversations: [...localResponse.conversations],
          failed: [...localResponse.failed]
        };

        if (missingConversationIds.length > 0) {
          try {
            const remoteResponse = await archiverManager.fetchConversationBatch(accountId, missingConversationIds);
            response = {
              conversations: [
                ...response.conversations,
                ...(remoteResponse.conversations || [])
              ],
              failed: [
                ...response.failed,
                ...(remoteResponse.failed || [])
              ]
            };
          } catch (error) {
            enrichmentErrors.push(`${accountId}: remote session fetch skipped (${error?.message || error})`);
          }
        }

        const parsedSessions = producerSessionParser.parseBatch(
          response.conversations || [],
          tracks.filter((track) => `account_${track.accountId}` === accountId),
          Number(accountId.replace('account_', ''))
        );

        enrichedSessions.push(...parsedSessions);

        if (Array.isArray(response.failed) && response.failed.length > 0) {
          enrichmentErrors.push(
            `${accountId}: ${response.failed.length} conversation fetch failure(s)`
          );
        }
      } catch (error) {
        enrichmentErrors.push(`${accountId}: ${error?.message || error}`);
      }

      processedAccounts += 1;
    }

    if (enrichmentErrors.length > 0) {
      console.warn('FlowMusic.app session enrichment warnings:', enrichmentErrors);
    }

    return enrichedSessions;
  }

  async loadLocalConversationBatch(accountId, conversationIds = []) {
    const conversations = [];
    const failed = [];
    const loadedIds = [];

    for (const conversationId of conversationIds) {
      try {
        const response = await fetch(`/local-data/${accountId}/sessions/session_${conversationId}.json`);

        if (!response.ok) {
          failed.push({ conversationId, error: `HTTP ${response.status}` });
          continue;
        }

        const payload = await response.json();
        const conversation = payload?.payload || payload;

        if (!conversation?.id) {
          failed.push({ conversationId, error: 'Malformed session payload' });
          continue;
        }

        conversations.push(conversation);
        loadedIds.push(conversationId);
      } catch (error) {
        failed.push({ conversationId, error: error?.message || String(error) });
      }
    }

    return {
      conversations,
      failed,
      loadedIds
    };
  }

  mergeSessions(fallbackSessions = [], enrichedSessions = []) {
    const merged = new Map();

    for (const session of fallbackSessions) {
      if (session?.conversationId) {
        merged.set(session.conversationId, session);
      }
    }

    for (const session of enrichedSessions) {
      if (session?.conversationId) {
        merged.set(session.conversationId, session);
      }
    }

    return Array.from(merged.values());
  }
}

// Singleton instance
const localDataImporter = new LocalDataImporter();

export default localDataImporter;
export { LocalDataImporter };
