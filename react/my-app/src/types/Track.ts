/**
 * Типы для треков FlowMusic.app Archive Manager
 */

/** Основной тип трека */
export interface Track {
  id: string;
  title: string;
  accountId: number;
  
  // Медиа
  coverUrl: string;
  audioUrl: string;
  
  // Метаданные
  durationSeconds?: number;
  soundPrompt: string;
  lyrics: string;
  
  // Связи
  conversationId?: string;
  sourceUrl?: string;
  
  // Даты
  createdAt: string;
  updatedAt: string;
  
  // Статистика
  playCount: number;
  rating: number;
  tags: string[];
  
  // Дополнительно
  isFavorite?: boolean;
  notes?: string;
  
  // Raw data для отладки
  rawData?: TrackRawData;
}

/** Raw данные из meta.json */
export interface TrackRawData {
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

/** Тип сессии (conversation) */
export interface Session {
  conversationId: string;
  accountId?: number;
  title?: string;
  messages: SessionMessage[];
  linkedTrackIds: string[];
  createdAt?: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

/** Сообщение в сессии */
export interface SessionMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt?: string;
  textFragments?: TextFragment[];
  linkedTrackId?: string;
}

/** Текстовый фрагмент для привязки к треку */
export interface TextFragment {
  id: string;
  messageId: string;
  content: string;
  startIndex: number;
  endIndex: number;
  linkedTrackId?: string;
  isSelected: boolean;
  createdAt: string;
}

/** Фильтры для треков */
export interface TrackFilters {
  search: string;
  accounts: number[];
  rating: number | null;
  dateFrom: string | null;
  dateTo: string | null;
  hasLyrics: boolean | null;
  hasConversation: boolean | null;
  tags: string[];
}

/** Сортировка */
export interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

/** Пагинация */
export interface PaginationConfig {
  page: number;
  pageSize: number;
  total: number;
}

/** Настройки отображения */
export interface DisplaySettings {
  visibleColumns: string[];
  itemsPerPage: number;
  hoverPreview: boolean;
  theme: 'light' | 'dark' | 'auto';
}

/** Статистика импорта */
export interface ImportStats {
  tracks: number;
  sessions: number;
  fragments: number;
  errors: ImportError[];
  duration: number;
}

/** Ошибка импорта */
export interface ImportError {
  path: string;
  error: string;
  type: 'parse' | 'file' | 'validation' | 'unknown';
}

/** Результат экспорта */
export interface ExportResult {
  format: 'json' | 'csv' | 'markdown';
  blob: Blob;
  filename: string;
  count: number;
}

/** Аккаунт */
export interface Account {
  id: number;
  name: string;
  email: string;
  color: string;
  isActive: boolean;
}
