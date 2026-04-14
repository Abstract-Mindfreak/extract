/**
 * MetaParser — парсинг meta.json файлов треков Producer.ai
 */

import type { Track, TrackRawData } from '../types/Track';

export interface IMetaParser {
  /** Парсить meta.json в Track */
  parseMetaJson(rawJson: string, accountId: string, metaFilePath: string): Track;
  
  /** Валидировать структуру meta.json */
  validateMetaJson(raw: unknown): asserts raw is MetaJsonStructure;
  
  /** Извлечь длительность из метаданных */
  extractDuration(raw: MetaJsonStructure): number | undefined;
  
  /** Извлечь sound_prompt */
  extractSoundPrompt(raw: MetaJsonStructure): string;
  
  /** Извлечь lyrics */
  extractLyrics(raw: MetaJsonStructure): string;
  
  /** Извлечь conversation_id */
  extractConversationId(raw: MetaJsonStructure): string | undefined;
  
  /** Извлечь source_url */
  extractSourceUrl(raw: MetaJsonStructure): string | undefined;
  
  /** Конвертировать относительный путь в публичный URL */
  toPublicUrl(relativePath: string, baseUrl?: string): string;
}

// Структура meta.json от Producer.ai
interface MetaJsonStructure {
  id: string;
  title?: string;
  created_at?: string;
  operation?: {
    sound_prompt?: string;
    lyrics?: string;
    [key: string]: unknown;
  };
  conversation_id?: string;
  source_url?: string;
  source?: string;
  audio_url?: string;
  image_url?: string;
  image_large_url?: string;
  tags?: string[];
  duration?: number;
  [key: string]: unknown;
}

// Типы
export interface ParseOptions {
  /** Базовый URL для публичных данных (например, '/local-data/') */
  basePublicUrl?: string;
  /** Сохранить raw_data для отладки */
  preserveRawData?: boolean;
}

class MetaParser implements IMetaParser {
  private options: ParseOptions;

  constructor(options: ParseOptions = {}) {
    this.options = {
      basePublicUrl: '/local-data/',
      preserveRawData: true,
      ...options
    };
  }

  /**
   * Парсить meta.json в объект Track
   */
  parseMetaJson(
    rawJson: string,
    accountId: string,
    metaFilePath: string
  ): Track {
    let raw: unknown;
    
    try {
      raw = JSON.parse(rawJson);
    } catch (err) {
      throw new Error(`Невалидный JSON: ${(err as Error).message}`);
    }

    // Валидируем структуру
    this.validateMetaJson(raw);

    const meta = raw as MetaJsonStructure;

    // Определяем пути к медиафайлам
    const dirPath = metaFilePath.replace(/\/meta\.json$/, '').replace(/\\meta\.json$/, '');
    const audioPath = this.findAudioPath(dirPath, meta);
    const imagePath = this.findImagePath(dirPath, meta);

    const track: Track = {
      id: meta.id,
      title: meta.title || 'Untitled',
      accountId: parseInt(accountId, 10) || 0,
      
      // Медиа
      coverUrl: imagePath ? this.toPublicUrl(imagePath) : '',
      audioUrl: audioPath ? this.toPublicUrl(audioPath) : (meta.audio_url || ''),
      
      // Метаданные
      durationSeconds: this.extractDuration(meta),
      soundPrompt: this.extractSoundPrompt(meta),
      lyrics: this.extractLyrics(meta),
      
      // Связи
      conversationId: this.extractConversationId(meta),
      sourceUrl: this.extractSourceUrl(meta),
      
      // Даты
      createdAt: meta.created_at || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      
      // Статистика
      playCount: 0,
      rating: 0,
      tags: meta.tags || [],
      
      // Raw data для отладки
      rawData: this.options.preserveRawData ? (raw as TrackRawData) : undefined
    };

    return track;
  }

  /**
   * Валидировать структуру meta.json
   */
  validateMetaJson(raw: unknown): asserts raw is MetaJsonStructure {
    if (typeof raw !== 'object' || raw === null) {
      throw new Error('meta.json должен быть объектом');
    }

    const obj = raw as Record<string, unknown>;

    // Обязательное поле: id
    if (!obj.id || typeof obj.id !== 'string') {
      throw new Error('meta.json должен содержать поле "id" типа string');
    }

    // Проверяем operation если есть
    if (obj.operation !== undefined) {
      if (typeof obj.operation !== 'object' || obj.operation === null) {
        throw new Error('Поле "operation" должно быть объектом');
      }
    }
  }

  /**
   * Извлечь длительность из метаданных
   */
  extractDuration(raw: MetaJsonStructure): number | undefined {
    // Прямое поле duration
    if (typeof raw.duration === 'number' && raw.duration > 0) {
      return Math.floor(raw.duration);
    }

    // Ищем в operation
    if (raw.operation) {
      const op = raw.operation;
      
      // Пробуем разные варианты названий полей
      const durationFields = ['duration', 'audio_duration', 'track_duration', 'length'];
      for (const field of durationFields) {
        const val = op[field];
        if (typeof val === 'number' && val > 0) {
          return Math.floor(val);
        }
      }
    }

    return undefined;
  }

  /**
   * Извлечь sound_prompt из operation
   */
  extractSoundPrompt(raw: MetaJsonStructure): string {
    const prompt = raw.operation?.sound_prompt;
    
    if (typeof prompt === 'string') {
      return prompt.trim();
    }
    
    // Если нет sound_prompt, пробуем другие поля
    const altFields = ['prompt', 'description', 'text'];
    for (const field of altFields) {
      const val = raw.operation?.[field];
      if (typeof val === 'string') {
        return val.trim();
      }
    }

    return '';
  }

  /**
   * Извлечь lyrics
   */
  extractLyrics(raw: MetaJsonStructure): string {
    const lyrics = raw.operation?.lyrics;
    
    if (typeof lyrics === 'string') {
      const trimmed = lyrics.trim();
      return trimmed || '[Instrumental]';
    }

    return '[Instrumental]';
  }

  /**
   * Извлечь conversation_id
   */
  extractConversationId(raw: MetaJsonStructure): string | undefined {
    // Прямое поле
    if (raw.conversation_id) {
      return String(raw.conversation_id);
    }

    // Ищем в operation
    if (raw.operation?.conversation_id) {
      return String(raw.operation.conversation_id);
    }

    // Пробуем извлечь из source_url
    if (raw.source_url || raw.source) {
      const url = raw.source_url || raw.source;
      const match = url?.match(/conversation[=/]([a-zA-Z0-9_-]+)/);
      if (match) {
        return match[1];
      }
    }

    return undefined;
  }

  /**
   * Извлечь source_url
   */
  extractSourceUrl(raw: MetaJsonStructure): string | undefined {
    return raw.source_url || raw.source || undefined;
  }

  /**
   * Конвертировать относительный путь в публичный URL
   */
  toPublicUrl(relativePath: string, baseUrl?: string): string {
    const base = baseUrl || this.options.basePublicUrl || '/local-data/';
    
    // Нормализуем путь
    const cleanPath = relativePath
      .replace(/\\/g, '/')
      .replace(/^\/+/, '');

    // Убираем префикс producer-ai-archiver если есть
    const withoutPrefix = cleanPath.replace(/^producer-ai-archiver\//, '');

    return `${base}${withoutPrefix}`;
  }

  /**
   * Найти путь к аудио файлу
   */
  private findAudioPath(dirPath: string, meta: MetaJsonStructure): string | undefined {
    // Если есть прямой URL
    if (meta.audio_url) {
      return undefined; // Используем audio_url напрямую
    }

    // Ищем в директории трека
    const audioExtensions = ['.m4a', '.mp3', '.wav', '.ogg'];
    
    // Предполагаемые имена файлов
    const possibleNames = ['audio', 'track', 'song', meta.id, '01'];

    for (const name of possibleNames) {
      for (const ext of audioExtensions) {
        const path = `${dirPath}/${name}${ext}`;
        // Проверка существования файла требует FS access
        // Возвращаем первый возможный вариант
        return path;
      }
    }

    return undefined;
  }

  /**
   * Найти путь к изображению
   */
  private findImagePath(dirPath: string, meta: MetaJsonStructure): string | undefined {
    // Если есть прямой URL
    if (meta.image_url || meta.image_large_url) {
      return undefined;
    }

    // Ищем в директории трека
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
    const possibleNames = ['image', 'cover', 'art', 'thumbnail', meta.id];

    for (const name of possibleNames) {
      for (const ext of imageExtensions) {
        const path = `${dirPath}/${name}${ext}`;
        return path;
      }
    }

    return undefined;
  }

  /**
   * Обновить опции парсера
   */
  setOptions(options: ParseOptions): void {
    this.options = { ...this.options, ...options };
  }
}

// Singleton instance с дефолтными настройками
const metaParser = new MetaParser();

export default metaParser;
export { MetaParser };
