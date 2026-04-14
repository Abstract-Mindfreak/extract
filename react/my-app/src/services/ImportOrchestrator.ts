/**
 * ImportOrchestrator — пайплайн полного импорта архива в IndexedDB
 * Объединяет FileSystemService, MetaParser, SessionExtractor
 */

import type { Track, Session, ImportStats, ImportError } from '../types/Track';
import fileSystemService, { FileSystemDirectoryHandle } from './FileSystemService';
import metaParser from './MetaParser';
import sessionExtractor from './SessionExtractor';
import storageService from './StorageService';

export interface IImportOrchestrator {
  /** Полный импорт архива */
  runFullImport(
    dirHandle: FileSystemDirectoryHandle,
    accountIds: string[],
    onProgress?: ImportProgressCallback
  ): Promise<ImportResult>;

  /** Импорт через file input (fallback) */
  runFileListImport(
    files: FileList,
    onProgress?: ImportProgressCallback
  ): Promise<ImportResult>;

  /** Валидация перед импортом */
  validateBeforeImport(
    dirHandle: FileSystemDirectoryHandle
  ): Promise<ValidationResult>;
}

export type ImportProgressCallback = (
  stage: ImportStage,
  current: number,
  total: number,
  message: string
) => void;

export type ImportStage =
  | 'scanning'
  | 'parsing'
  | 'extracting-sessions'
  | 'saving-tracks'
  | 'saving-sessions'
  | 'saving-fragments'
  | 'complete';

export interface ImportResult {
  success: boolean;
  stats: ImportStats;
  tracks: Track[];
  sessions: Session[];
  duration: number;
  errors: ImportError[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  estimatedTracks: number;
}

class ImportOrchestrator implements IImportOrchestrator {
  /**
   * Полный пайплайн импорта
   */
  async runFullImport(
    dirHandle: FileSystemDirectoryHandle,
    accountIds: string[] = ['1', '2', '3', '4'],
    onProgress?: ImportProgressCallback
  ): Promise<ImportResult> {
    const startTime = Date.now();
    const errors: ImportError[] = [];

    try {
      // Stage 1: Сканирование архива
      onProgress?.('scanning', 0, 100, 'Сканирование архива...');
      const scanResult = await fileSystemService.scanArchive(dirHandle, accountIds);
      
      const totalTracks = scanResult.accounts.reduce((sum, a) => sum + a.tracks.length, 0);
      onProgress?.('scanning', 100, 100, `Найдено ${totalTracks} треков`);

      // Stage 2: Парсинг meta.json
      onProgress?.('parsing', 0, totalTracks, 'Парсинг метаданных...');
      const tracks: Track[] = [];
      
      for (let i = 0; i < scanResult.accounts.length; i++) {
        const account = scanResult.accounts[i];
        
        for (const trackInfo of account.tracks) {
          try {
            // Получаем handle на meta.json
            const accountHandle = await dirHandle.getDirectoryHandle(`account_${account.accountId}`);
            const trackHandle = await accountHandle.getDirectoryHandle(trackInfo.id);
            const metaHandle = await trackHandle.getFileHandle('meta.json');
            
            // Читаем и парсим
            const metaContent = await fileSystemService.readFile(metaHandle);
            const track = metaParser.parseMetaJson(
              metaContent,
              account.accountId,
              trackInfo.metaPath
            );
            
            // Дополняем информацию о файлах
            if (trackInfo.audioPath) {
              try {
                const audioHandle = await trackHandle.getFileHandle(
                  trackInfo.audioPath.split('/').pop()!
                );
                const audioFile = await audioHandle.getFile();
                track.audioUrl = fileSystemService.pathToBlobUrl(audioFile, 'audio/mp4');
              } catch {
                // Аудио не критично
              }
            }
            
            if (trackInfo.imagePath) {
              try {
                const imageHandle = await trackHandle.getFileHandle(
                  trackInfo.imagePath.split('/').pop()!
                );
                const imageFile = await imageHandle.getFile();
                track.coverUrl = fileSystemService.pathToBlobUrl(imageFile, 'image/jpeg');
              } catch {
                // Изображение не критично
              }
            }
            
            tracks.push(track);
          } catch (err) {
            errors.push({
              path: trackInfo.metaPath,
              error: (err as Error).message,
              type: 'parse'
            });
          }
          
          onProgress?.('parsing', tracks.length, totalTracks, `Обработано ${tracks.length}/${totalTracks}`);
        }
      }

      // Stage 3: Извлечение сессий
      onProgress?.('extracting-sessions', 0, 100, 'Извлечение сессий...');
      const extractionResult = sessionExtractor.extract(tracks);
      const { sessions } = extractionResult;
      onProgress?.('extracting-sessions', 100, 100, `Извлечено ${sessions.length} сессий`);

      // Stage 4: Сохранение в IndexedDB (batch)
      onProgress?.('saving-tracks', 0, tracks.length, 'Сохранение треков...');
      await storageService.saveTracksBatch(tracks);
      onProgress?.('saving-tracks', tracks.length, tracks.length, 'Треки сохранены');

      onProgress?.('saving-sessions', 0, sessions.length, 'Сохранение сессий...');
      await storageService.saveSessionsBatch(sessions);
      onProgress?.('saving-sessions', sessions.length, sessions.length, 'Сессии сохранены');

      // Stage 5: Сохранение фрагментов
      const allFragments = sessions.flatMap(s => 
        s.messages.flatMap(m => m.textFragments || [])
      );
      
      if (allFragments.length > 0) {
        onProgress?.('saving-fragments', 0, allFragments.length, 'Сохранение фрагментов...');
        await storageService.saveFragmentsBatch(allFragments);
        onProgress?.('saving-fragments', allFragments.length, allFragments.length, 'Фрагменты сохранены');
      }

      // Метаданные импорта
      await storageService.setMetadataBatch({
        'lastImportAt': new Date().toISOString(),
        'lastImportTracks': tracks.length,
        'lastImportSessions': sessions.length,
        'importVersion': '1.0'
      });

      onProgress?.('complete', 100, 100, 'Импорт завершен!');

      return {
        success: true,
        stats: {
          tracks: tracks.length,
          sessions: sessions.length,
          fragments: allFragments.length,
          errors,
          duration: Date.now() - startTime
        },
        tracks,
        sessions,
        duration: Date.now() - startTime,
        errors
      };

    } catch (err) {
      return {
        success: false,
        stats: {
          tracks: 0,
          sessions: 0,
          fragments: 0,
          errors: [...errors, {
            path: 'orchestrator',
            error: (err as Error).message,
            type: 'unknown'
          }],
          duration: Date.now() - startTime
        },
        tracks: [],
        sessions: [],
        duration: Date.now() - startTime,
        errors
      };
    }
  }

  /**
   * Импорт через file input (webkitdirectory fallback)
   */
  async runFileListImport(
    files: FileList,
    onProgress?: ImportProgressCallback
  ): Promise<ImportResult> {
    const startTime = Date.now();

    // Сканируем через fallback
    onProgress?.('scanning', 0, 100, 'Сканирование файлов...');
    const scanResult = await fileSystemService.processFileList(files);
    
    const totalTracks = scanResult.totalTracks;
    onProgress?.('scanning', 100, 100, `Найдено ${totalTracks} треков`);

    // Парсинг — упрощенная версия без handles
    onProgress?.('parsing', 0, totalTracks, 'Парсинг метаданных...');
    const tracks: Track[] = [];
    const errors: ImportError[] = [];

    // Группируем файлы по трекам
    const trackFiles = new Map<string, { meta?: File; audio?: File; image?: File }>();

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const path = file.webkitRelativePath || file.name;
      
      // account_N/track_id/meta.json
      const match = path.match(/account_(\d+)\/([^/]+)\/(meta\.json|.*\.m4a|.*\.mp3|.*\.jpg|.*\.png)/);
      if (!match) continue;

      const [, accountId, trackId, filename] = match;
      const key = `${accountId}/${trackId}`;

      if (!trackFiles.has(key)) {
        trackFiles.set(key, {});
      }

      const entry = trackFiles.get(key)!;
      
      if (filename === 'meta.json') {
        entry.meta = file;
      } else if (filename.endsWith('.m4a') || filename.endsWith('.mp3')) {
        entry.audio = file;
      } else if (filename.endsWith('.jpg') || filename.endsWith('.png')) {
        entry.image = file;
      }
    }

    // Парсим каждый трек
    let processed = 0;
    for (const [key, files] of trackFiles) {
      const [accountId, trackId] = key.split('/');
      
      if (!files.meta) {
        errors.push({ path: key, error: 'meta.json не найден', type: 'file' });
        continue;
      }

      try {
        const metaContent = await files.meta.text();
        const track = metaParser.parseMetaJson(metaContent, accountId, `${key}/meta.json`);

        // Создаем blob URLs для медиа
        if (files.audio) {
          track.audioUrl = fileSystemService.pathToBlobUrl(files.audio, 'audio/mp4');
        }
        if (files.image) {
          track.coverUrl = fileSystemService.pathToBlobUrl(files.image, 'image/jpeg');
        }

        tracks.push(track);
      } catch (err) {
        errors.push({
          path: key,
          error: (err as Error).message,
          type: 'parse'
        });
      }

      processed++;
      onProgress?.('parsing', processed, trackFiles.size, `Обработано ${processed}/${trackFiles.size}`);
    }

    // Извлечение и сохранение сессий
    onProgress?.('extracting-sessions', 0, 100, 'Извлечение сессий...');
    const extractionResult = sessionExtractor.extract(tracks);
    const { sessions } = extractionResult;

    // Сохранение
    onProgress?.('saving-tracks', 0, tracks.length, 'Сохранение...');
    await storageService.saveTracksBatch(tracks);
    
    onProgress?.('saving-sessions', 0, sessions.length, 'Сохранение сессий...');
    await storageService.saveSessionsBatch(sessions);

    const allFragments = sessions.flatMap(s => 
      s.messages.flatMap(m => m.textFragments || [])
    );
    
    if (allFragments.length > 0) {
      await storageService.saveFragmentsBatch(allFragments);
    }

    onProgress?.('complete', 100, 100, 'Импорт завершен!');

    return {
      success: true,
      stats: {
        tracks: tracks.length,
        sessions: sessions.length,
        fragments: allFragments.length,
        errors,
        duration: Date.now() - startTime
      },
      tracks,
      sessions,
      duration: Date.now() - startTime,
      errors
    };
  }

  /**
   * Валидация перед импортом
   */
  async validateBeforeImport(
    dirHandle: FileSystemDirectoryHandle
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Проверка структуры
    const structureCheck = await fileSystemService.validateArchiveStructure(dirHandle);
    errors.push(...structureCheck.errors);

    if (!structureCheck.isValid) {
      return {
        isValid: false,
        errors,
        warnings,
        estimatedTracks: 0
      };
    }

    // Примерная оценка количества треков
    let estimatedTracks = 0;

    for (let accountId = 1; accountId <= 4; accountId++) {
      try {
        const accountHandle = await dirHandle.getDirectoryHandle(`account_${accountId}`);
        let trackCount = 0;
        
        for await (const [, handle] of accountHandle.entries()) {
          if (handle.kind === 'directory') {
            trackCount++;
          }
        }
        
        estimatedTracks += trackCount;
      } catch {
        // Аккаунт не найден — нормально
      }
    }

    if (estimatedTracks === 0) {
      warnings.push('Не найдено треков для импорта');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      estimatedTracks
    };
  }

  /**
   * Получить статистику последнего импорта
   */
  async getLastImportStats(): Promise<Partial<ImportStats> | null> {
    const lastImport = await storageService.getMetadata('lastImportAt');
    if (!lastImport) return null;

    return {
      tracks: (await storageService.getMetadata('lastImportTracks')) || 0,
      sessions: (await storageService.getMetadata('lastImportSessions')) || 0,
      duration: 0
    };
  }
}

// Singleton instance
const importOrchestrator = new ImportOrchestrator();

export default importOrchestrator;
export { ImportOrchestrator };
