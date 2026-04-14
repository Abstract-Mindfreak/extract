/**
 * LocalDataImporter — импорт реальных данных из public/local-data/
 * Сканирует скопированные файлы и загружает их в IndexedDB
 */

import type { Track, Session } from '../types/Track';
import metaParser from './MetaParser';
import sessionExtractor from './SessionExtractor';
import storageService from './StorageService';

export interface ImportProgress {
  stage: 'scanning' | 'parsing' | 'extracting' | 'saving';
  current: number;
  total: number;
  message: string;
}

export type ImportProgressCallback = (progress: ImportProgress) => void;

export interface ImportResult {
  success: boolean;
  tracksImported: number;
  sessionsImported: number;
  errors: string[];
  duration: number;
}

class LocalDataImporter {
  /**
   * Импортировать данные из public/local-data/
   */
  async importFromLocalData(
    onProgress?: ImportProgressCallback
  ): Promise<ImportResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      // Stage 1: Discover available tracks
      onProgress?.({
        stage: 'scanning',
        current: 0,
        total: 100,
        message: 'Сканирование local-data...'
      });

      const trackDirs = await this.discoverTrackDirectories();
      
      onProgress?.({
        stage: 'scanning',
        current: trackDirs.length,
        total: trackDirs.length,
        message: `Найдено ${trackDirs.length} треков`
      });

      // Stage 2: Parse meta.json files
      onProgress?.({
        stage: 'parsing',
        current: 0,
        total: trackDirs.length,
        message: 'Парсинг метаданных...'
      });

      const tracks: Track[] = [];
      
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
          errors.push(`Ошибка парсинга ${trackId}: ${(err as Error).message}`);
        }
        
        onProgress?.({
          stage: 'parsing',
          current: i + 1,
          total: trackDirs.length,
          message: `Обработано ${i + 1}/${trackDirs.length}`
        });
      }

      // Stage 3: Extract sessions
      onProgress?.({
        stage: 'extracting',
        current: 0,
        total: 100,
        message: 'Извлечение сессий...'
      });

      const extractionResult = sessionExtractor.extract(tracks);
      const sessions = extractionResult.sessions;

      onProgress?.({
        stage: 'extracting',
        current: 100,
        total: 100,
        message: `Извлечено ${sessions.length} сессий`
      });

      // Stage 4: Save to IndexedDB
      onProgress?.({
        stage: 'saving',
        current: 0,
        total: 100,
        message: 'Сохранение в базу данных...'
      });

      await storageService.saveTracksBatch(tracks);
      await storageService.saveSessionsBatch(sessions);
      
      const allFragments = sessions.flatMap(s =>
        s.messages.flatMap(m => m.textFragments || [])
      );
      
      if (allFragments.length > 0) {
        await storageService.saveFragmentsBatch(allFragments);
      }

      // Update metadata
      await storageService.setMetadataBatch({
        'dataImportedAt': new Date().toISOString(),
        'importedTracks': tracks.length,
        'importedSessions': sessions.length,
        'dataSource': 'local-data'
      });

      onProgress?.({
        stage: 'saving',
        current: 100,
        total: 100,
        message: 'Сохранение завершено'
      });

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
        errors: [...errors, (err as Error).message],
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Discover track directories in public/local-data/
   */
  private async discoverTrackDirectories(): Promise<Array<{ accountId: string; trackId: string }>> {
    const tracks: Array<{ accountId: string; trackId: string }> = [];
    
    // Try to load directory listing via fetch
    // Note: This requires the server to support directory listing or a manifest file
    
    // For now, we'll try common account IDs
    const accountIds = ['1', '2', '3', '4'];
    
    for (const accountId of accountIds) {
      try {
        // Try to fetch a manifest or index
        const response = await fetch(`/local-data/account_${accountId}/`);
        if (!response.ok) continue;
        
        // Parse HTML directory listing (if server provides it)
        const html = await response.text();
        const trackIds = this.parseDirectoryListing(html);
        
        for (const trackId of trackIds) {
          tracks.push({ accountId, trackId });
        }
      } catch {
        // Fallback: try to discover by testing known track IDs from import report
      }
    }
    
    // If no tracks discovered via directory listing, try import report
    if (tracks.length === 0) {
      try {
        const reportResponse = await fetch('/local-data/import-report.json');
        if (reportResponse.ok) {
          const report = await reportResponse.json();
          
          for (const file of report.result?.files || []) {
            const match = file.relativePath.match(/account_(\d+)\/([^/]+)/);
            if (match && file.type === 'meta') {
              tracks.push({ accountId: match[1], trackId: match[2] });
            }
          }
        }
      } catch {
        // Import report not available
      }
    }
    
    return tracks;
  }

  /**
   * Parse HTML directory listing
   */
  private parseDirectoryListing(html: string): string[] {
    const trackIds: string[] = [];
    
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
   */
  private async discoverAudioExtension(basePath: string): Promise<string | null> {
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
   */
  private async discoverImageExtension(basePath: string): Promise<string | null> {
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
   */
  async hasImportedData(): Promise<boolean> {
    const importedAt = await storageService.getMetadata('dataImportedAt');
    return importedAt !== null;
  }

  /**
   * Get import statistics
   */
  async getImportStats(): Promise<{ tracks: number; sessions: number }> {
    const tracks = (await storageService.getMetadata('importedTracks')) || 0;
    const sessions = (await storageService.getMetadata('importedSessions')) || 0;
    return { tracks, sessions };
  }
}

// Singleton instance
const localDataImporter = new LocalDataImporter();

export default localDataImporter;
export { LocalDataImporter };
