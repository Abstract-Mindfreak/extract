/**
 * FileSystemService — сканирование архива producer-ai-archiver
 * Поддерживает File System Access API + fallback на file input
 */

// Типы для File System Access API
declare global {
  interface Window {
    showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
  }
}

interface FileSystemDirectoryHandle {
  entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
  getDirectoryHandle(name: string): Promise<FileSystemDirectoryHandle>;
  getFileHandle(name: string): Promise<FileSystemFileHandle>;
}

interface FileSystemFileHandle {
  getFile(): Promise<File>;
}

type FileSystemHandle = FileSystemDirectoryHandle | FileSystemFileHandle;

// Результат сканирования
export interface ScanResult {
  accounts: AccountScanResult[];
  totalTracks: number;
  totalSessions: number;
  errors: ScanError[];
}

interface AccountScanResult {
  accountId: string;
  accountPath: string;
  tracks: TrackFileInfo[];
  sessions: SessionFileInfo[];
}

interface TrackFileInfo {
  id: string;
  metaPath: string;
  audioPath?: string;
  imagePath?: string;
  conversationId?: string;
}

interface SessionFileInfo {
  conversationId: string;
  jsonPath: string;
}

interface ScanError {
  path: string;
  error: string;
}

// Интерфейс сервиса
export interface IFileSystemService {
  /** Выбрать директорию через File System Access API */
  selectDirectory(): Promise<FileSystemDirectoryHandle | null>;
  
  /** Fallback: обработка файлов из file input */
  processFileList(files: FileList): Promise<ScanResult>;
  
  /** Сканировать архив по пути */
  scanArchive(
    dirHandle: FileSystemDirectoryHandle, 
    accountIds?: string[]
  ): Promise<ScanResult>;
  
  /** Прочитать файл как текст */
  readFile(handle: FileSystemFileHandle): Promise<string>;
  
  /** Прочитать JSON файл */
  readJsonFile<T = unknown>(handle: FileSystemFileHandle): Promise<T>;
  
  /** Создать Blob URL для локального файла */
  pathToBlobUrl(file: File, mimeType?: string): string;
}

class FileSystemService implements IFileSystemService {
  /**
   * Проверка поддержки File System Access API
   */
  isFileSystemAccessSupported(): boolean {
    return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
  }

  /**
   * Выбрать директорию через File System Access API
   */
  async selectDirectory(): Promise<FileSystemDirectoryHandle | null> {
    if (!this.isFileSystemAccessSupported()) {
      throw new Error('File System Access API не поддерживается в этом браузере');
    }

    try {
      const dirHandle = await window.showDirectoryPicker!();
      return dirHandle;
    } catch (err) {
      // Пользователь отменил выбор
      if ((err as Error).name === 'AbortError') {
        return null;
      }
      throw err;
    }
  }

  /**
   * Сканировать архив producer-ai-archiver
   * Структура: producer-ai-archiver/account_1/, account_2/, etc.
   */
  async scanArchive(
    dirHandle: FileSystemDirectoryHandle,
    accountIds: string[] = ['1', '2', '3', '4']
  ): Promise<ScanResult> {
    const result: ScanResult = {
      accounts: [],
      totalTracks: 0,
      totalSessions: 0,
      errors: []
    };

    for (const accountId of accountIds) {
      const accountDirName = `account_${accountId}`;
      
      try {
        const accountHandle = await dirHandle.getDirectoryHandle(accountDirName);
        const accountResult = await this.scanAccount(accountHandle, accountId);
        result.accounts.push(accountResult);
        result.totalTracks += accountResult.tracks.length;
        result.totalSessions += accountResult.sessions.length;
      } catch (err) {
        // Директория аккаунта не найдена — не критичная ошибка
        if ((err as Error).name === 'NotFoundError') {
          console.warn(`Директория ${accountDirName} не найдена`);
          continue;
        }
        result.errors.push({
          path: accountDirName,
          error: (err as Error).message
        });
      }
    }

    return result;
  }

  /**
   * Сканировать директорию одного аккаунта
   */
  private async scanAccount(
    accountHandle: FileSystemDirectoryHandle,
    accountId: string
  ): Promise<AccountScanResult> {
    const result: AccountScanResult = {
      accountId,
      accountPath: '', // Недоступно в File System Access API
      tracks: [],
      sessions: []
    };

    const trackDirs = new Map<string, TrackFileInfo>();

    // Сканируем все entries в директории аккаунта
    for await (const [name, handle] of accountHandle.entries()) {
      if (handle.kind !== 'directory') continue;

      const trackDirHandle = handle as FileSystemDirectoryHandle;
      const trackInfo = await this.scanTrackDirectory(trackDirHandle, name);
      
      if (trackInfo) {
        trackDirs.set(trackInfo.id, trackInfo);
      }
    }

    result.tracks = Array.from(trackDirs.values());
    return result;
  }

  /**
   * Сканировать директорию одного трека
   */
  private async scanTrackDirectory(
    trackDirHandle: FileSystemDirectoryHandle,
    dirName: string
  ): Promise<TrackFileInfo | null> {
    const trackInfo: TrackFileInfo = {
      id: dirName,
      metaPath: ''
    };

    let hasMeta = false;

    try {
      for await (const [fileName, handle] of trackDirHandle.entries()) {
        if (handle.kind !== 'file') continue;

        const fileHandle = handle as FileSystemFileHandle;

        if (fileName === 'meta.json') {
          trackInfo.metaPath = `${dirName}/${fileName}`;
          hasMeta = true;
          
          // Пытаемся извлечь conversation_id из meta.json
          try {
            const meta = await this.readJsonFile(fileHandle) as {
              conversation_id?: string;
              source_url?: string;
            };
            trackInfo.conversationId = meta.conversation_id;
          } catch {
            // Игнорируем ошибки парсинга meta
          }
        } else if (fileName.endsWith('.m4a') || fileName.endsWith('.mp3')) {
          trackInfo.audioPath = `${dirName}/${fileName}`;
        } else if (fileName.endsWith('.jpg') || fileName.endsWith('.png') || fileName.endsWith('.webp')) {
          trackInfo.imagePath = `${dirName}/${fileName}`;
        } else if (fileName === 'session.json' || fileName === 'conversation.json') {
          // Сессии обрабатываются отдельно
        }
      }

      return hasMeta ? trackInfo : null;
    } catch (err) {
      console.error(`Ошибка сканирования трека ${dirName}:`, err);
      return null;
    }
  }

  /**
   * Fallback: обработка файлов из file input (webkitdirectory)
   */
  async processFileList(files: FileList): Promise<ScanResult> {
    const result: ScanResult = {
      accounts: [],
      totalTracks: 0,
      totalSessions: 0,
      errors: []
    };

    // Группируем файлы по аккаунтам
    const accountFiles = new Map<string, File[]>();

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const path = file.webkitRelativePath || file.name;
      
      // Извлекаем account_id из пути: producer-ai-archiver/account_1/...
      const match = path.match(/account_(\d+)/);
      if (!match) continue;

      const accountId = match[1];
      if (!accountFiles.has(accountId)) {
        accountFiles.set(accountId, []);
      }
      accountFiles.get(accountId)!.push(file);
    }

    // Обрабатываем каждый аккаунт
    for (const [accountId, files] of accountFiles) {
      const accountResult = this.processAccountFiles(accountId, files);
      result.accounts.push(accountResult);
      result.totalTracks += accountResult.tracks.length;
      result.totalSessions += accountResult.sessions.length;
    }

    return result;
  }

  /**
   * Обработка файлов одного аккаунта (fallback)
   */
  private processAccountFiles(
    accountId: string,
    files: File[]
  ): AccountScanResult {
    const result: AccountScanResult = {
      accountId,
      accountPath: '',
      tracks: [],
      sessions: []
    };

    // Группируем по директориям треков
    const trackFiles = new Map<string, File[]>();

    for (const file of files) {
      const path = file.webkitRelativePath || file.name;
      const parts = path.split('/');
      
      // Находим директорию трека (после account_N/)
      const trackDirIndex = parts.findIndex(p => p.startsWith('account_')) + 1;
      if (trackDirIndex >= parts.length) continue;

      const trackId = parts[trackDirIndex];
      if (!trackFiles.has(trackId)) {
        trackFiles.set(trackId, []);
      }
      trackFiles.get(trackId)!.push(file);
    }

    // Обрабатываем каждый трек
    for (const [trackId, files] of trackFiles) {
      const trackInfo = this.processTrackFiles(trackId, files);
      if (trackInfo) {
        result.tracks.push(trackInfo);
      }
    }

    return result;
  }

  /**
   * Обработка файлов одного трека (fallback)
   */
  private processTrackFiles(
    trackId: string,
    files: File[]
  ): TrackFileInfo | null {
    const trackInfo: TrackFileInfo = {
      id: trackId,
      metaPath: ''
    };

    let hasMeta = false;

    for (const file of files) {
      const name = file.name;

      if (name === 'meta.json') {
        trackInfo.metaPath = name;
        hasMeta = true;

        // Пытаемся извлечь conversation_id
        try {
          const text = file.text ? file.text() : '';
          // Асинхронное чтение не делаем здесь для простоты
        } catch {
          // Игнорируем
        }
      } else if (name.endsWith('.m4a') || name.endsWith('.mp3')) {
        trackInfo.audioPath = name;
      } else if (name.endsWith('.jpg') || name.endsWith('.png')) {
        trackInfo.imagePath = name;
      }
    }

    return hasMeta ? trackInfo : null;
  }

  /**
   * Прочитать файл как текст
   */
  async readFile(handle: FileSystemFileHandle | File): Promise<string> {
    if (handle instanceof File) {
      return handle.text();
    }
    const file = await handle.getFile();
    return file.text();
  }

  /**
   * Прочитать JSON файл
   */
  async readJsonFile<T = unknown>(handle: FileSystemFileHandle | File): Promise<T> {
    const text = await this.readFile(handle);
    return JSON.parse(text) as T;
  }

  /**
   * Создать Blob URL для локального файла
   */
  pathToBlobUrl(file: File, mimeType?: string): string {
    const blob = mimeType 
      ? new Blob([file], { type: mimeType })
      : file;
    return URL.createObjectURL(blob);
  }

  /**
   * Проверить структуру директории producer-ai-archiver
   */
  async validateArchiveStructure(dirHandle: FileSystemDirectoryHandle): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    try {
      let hasAccounts = false;
      
      for await (const [name, handle] of dirHandle.entries()) {
        if (handle.kind === 'directory' && name.startsWith('account_')) {
          hasAccounts = true;
          break;
        }
      }

      if (!hasAccounts) {
        errors.push('Не найдены директории account_1, account_2, etc.');
      }

      return { isValid: errors.length === 0, errors };
    } catch (err) {
      errors.push(`Ошибка доступа к директории: ${(err as Error).message}`);
      return { isValid: false, errors };
    }
  }
}

// Singleton instance
const fileSystemService = new FileSystemService();

export default fileSystemService;
export { FileSystemService };
