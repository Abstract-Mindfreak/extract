// Φ_total(session) — менеджер состояний Producer AI сессий
// Хранит историю по аккаунтам Chrome, анализирует через Mistral, предлагает следующие шаги

export interface SessionMessage {
  id: string;
  content: string;
  timestamp: string;
  elementIds: string[]; // Ссылки на DBElement из prompt-db-local
  metadata: {
    intent?: string;
    keywords: string[];
    complexity: number; // 0-1
    domain?: string;
  };
}

export interface ProducerSession {
  id: string;
  accountId: string; // Chrome account ID
  accountName: string; // Для отображения
  name: string; // Название сессии (извлекается из первого сообщения или задаётся юзером)
  createdAt: string;
  updatedAt: string;
  messages: SessionMessage[];
  summary?: string; // Краткое описание сессии от Mistral
  suggestedNextSteps?: string[]; // Предложения от Mistral
  tags: string[]; // Авто-теги сессии
  contextWindow: number; // Сколько последних сообщений учитывать (по умолчанию 10)
}

export interface SessionContext {
  accountId: string;
  accountName: string;
  sessionName: string;
  messageIndex: number;
  totalMessages: number;
  sessionSummary?: string;
  recentContext: string; // Последние N сообщений в текстовом виде
}

// Autobatch настройки для автоматической обработки
export interface AutobatchConfig {
  id: string;
  accountId: string; // 'all' для всех аккаунтов или конкретный ID
  patternName: string;
  enabled: boolean;
  triggerConditions: {
    messageCount?: number; // Триггер каждые N сообщений
    timeIntervalMinutes?: number; // Триггер по времени
    intentKeywords?: string[]; // Триггер по ключевым словам
    minComplexity?: number; // Минимальная сложность для триггера
  };
  mistralPrompt: string; // Промпт для Mistral
  autoApplySuggestions: boolean; // Автоматически применять предложения
  maxSuggestions: number; // Сколько предложений генерировать
}

const STORAGE_KEY = 'mmss:producer_sessions';
const AUTOBATCH_KEY = 'mmss:autobatch_configs';

// Φ_total(sessions) — сессии эволюционируют с данными
class SessionStateManager {
  private sessions: Map<string, ProducerSession> = new Map();
  private autobatchConfigs: Map<string, AutobatchConfig> = new Map();
  private listeners: Set<(sessions: ProducerSession[]) => void> = new Set();

  constructor() {
    this.loadFromStorage();
  }

  // Загрузка из localStorage
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as ProducerSession[];
        parsed.forEach((session) => {
          this.sessions.set(session.id, session);
        });
      }

      const autobatchStored = localStorage.getItem(AUTOBATCH_KEY);
      if (autobatchStored) {
        const parsed = JSON.parse(autobatchStored) as AutobatchConfig[];
        parsed.forEach((config) => {
          this.autobatchConfigs.set(config.id, config);
        });
      }
    } catch (error) {
      console.error('Φ_total(session:load_error)', error);
    }
  }

  // Сохранение в localStorage
  private saveToStorage(): void {
    try {
      const sessionsArray = Array.from(this.sessions.values());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionsArray));

      const configsArray = Array.from(this.autobatchConfigs.values());
      localStorage.setItem(AUTOBATCH_KEY, JSON.stringify(configsArray));

      this.notifyListeners();
    } catch (error) {
      console.error('Φ_total(session:save_error)', error);
    }
  }

  // Уведомление подписчиков
  private notifyListeners(): void {
    const sessions = this.getAllSessions();
    this.listeners.forEach((callback) => callback(sessions));
  }

  // Подписка на изменения
  subscribe(callback: (sessions: ProducerSession[]) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  // Получить все сессии
  getAllSessions(): ProducerSession[] {
    return Array.from(this.sessions.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  // Получить сессии по аккаунту
  getSessionsByAccount(accountId: string): ProducerSession[] {
    return this.getAllSessions().filter((s) => s.accountId === accountId);
  }

  // Получить сессию по ID
  getSession(id: string): ProducerSession | undefined {
    return this.sessions.get(id);
  }

  // Создать или получить существующую сессию
  getOrCreateSession(
    accountId: string,
    accountName: string,
    sessionName?: string
  ): ProducerSession {
    // Ищем существующую активную сессию (обновлялась менее 30 минут назад)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const existingSession = this.getAllSessions().find(
      (s) => s.accountId === accountId && s.updatedAt > thirtyMinutesAgo
    );

    if (existingSession) {
      return existingSession;
    }

    // Создаём новую
    const newSession: ProducerSession = {
      id: this.generateId(),
      accountId,
      accountName,
      name: sessionName || `Session ${new Date().toLocaleString()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
      tags: [],
      contextWindow: 10,
    };

    this.sessions.set(newSession.id, newSession);
    this.saveToStorage();

    return newSession;
  }

  // Добавить сообщение в сессию
  addMessage(
    sessionId: string,
    content: string,
    elementIds: string[],
    metadata?: Partial<SessionMessage['metadata']>
  ): SessionMessage {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const message: SessionMessage = {
      id: this.generateId(),
      content,
      timestamp: new Date().toISOString(),
      elementIds,
      metadata: {
        keywords: metadata?.keywords || this.extractKeywords(content),
        complexity: metadata?.complexity || this.calculateComplexity(content),
        intent: metadata?.intent,
        domain: metadata?.domain,
      },
    };

    session.messages.push(message);
    session.updatedAt = new Date().toISOString();

    // Обновляем имя сессии если это первое сообщение
    if (session.messages.length === 1 && !session.name.includes('Session')) {
      session.name = this.generateSessionName(content);
    }

    this.saveToStorage();

    return message;
  }

  // Получить контекст для Mistral
  getSessionContext(sessionId: string, messageIndex?: number): SessionContext | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const recentMessages = session.messages.slice(-session.contextWindow);
    const recentContext = recentMessages
      .map((m, idx) => `[${idx + 1}] ${m.content.slice(0, 200)}...`)
      .join('\n\n');

    return {
      accountId: session.accountId,
      accountName: session.accountName,
      sessionName: session.name,
      messageIndex: messageIndex ?? session.messages.length,
      totalMessages: session.messages.length,
      sessionSummary: session.summary,
      recentContext,
    };
  }

  // Обновить summary и предложения от Mistral
  updateSessionAnalysis(
    sessionId: string,
    summary: string,
    suggestedNextSteps: string[]
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.summary = summary;
    session.suggestedNextSteps = suggestedNextSteps;
    session.updatedAt = new Date().toISOString();

    this.saveToStorage();
  }

  // Удалить сессию
  deleteSession(sessionId: string): void {
    this.sessions.delete(sessionId);
    this.saveToStorage();
  }

  // Получить статистику по аккаунту
  getAccountStats(accountId: string): {
    totalSessions: number;
    totalMessages: number;
    averageComplexity: number;
    topTags: string[];
    lastActivity: string | null;
  } {
    const sessions = this.getSessionsByAccount(accountId);
    const allMessages = sessions.flatMap((s) => s.messages);
    const allTags = sessions.flatMap((s) => s.tags);

    // Топ тегов
    const tagCounts = new Map<string, number>();
    allTags.forEach((tag) => {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    });
    const topTags = Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag]) => tag);

    // Средняя сложность
    const avgComplexity =
      allMessages.length > 0
        ? allMessages.reduce((sum, m) => sum + m.metadata.complexity, 0) / allMessages.length
        : 0;

    return {
      totalSessions: sessions.length,
      totalMessages: allMessages.length,
      averageComplexity: avgComplexity,
      topTags,
      lastActivity: sessions[0]?.updatedAt || null,
    };
  }

  // ========== Autobatch Configs ==========

  getAutobatchConfigs(): AutobatchConfig[] {
    return Array.from(this.autobatchConfigs.values());
  }

  getAutobatchConfig(id: string): AutobatchConfig | undefined {
    return this.autobatchConfigs.get(id);
  }

  saveAutobatchConfig(config: AutobatchConfig): void {
    this.autobatchConfigs.set(config.id, config);
    this.saveToStorage();
  }

  deleteAutobatchConfig(id: string): void {
    this.autobatchConfigs.delete(id);
    this.saveToStorage();
  }

  // Проверить триггеры autobatch для сообщения
  checkAutobatchTriggers(
    accountId: string,
    message: SessionMessage,
    sessionMessageCount: number
  ): AutobatchConfig[] {
    return this.getAutobatchConfigs().filter((config) => {
      if (!config.enabled) return false;
      if (config.accountId !== 'all' && config.accountId !== accountId) return false;

      const conditions = config.triggerConditions;

      // Проверка по количеству сообщений
      if (conditions.messageCount && sessionMessageCount % conditions.messageCount === 0) {
        return true;
      }

      // Проверка по ключевым словам
      if (conditions.intentKeywords) {
        const hasKeyword = conditions.intentKeywords.some(
          (kw) =>
            message.content.toLowerCase().includes(kw.toLowerCase()) ||
            message.metadata.keywords.some((mk) => mk.toLowerCase().includes(kw.toLowerCase()))
        );
        if (hasKeyword) return true;
      }

      // Проверка по сложности
      if (conditions.minComplexity && message.metadata.complexity >= conditions.minComplexity) {
        return true;
      }

      return false;
    });
  }

  // ========== Helpers ==========

  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  private extractKeywords(content: string): string[] {
    // Простая экстракция ключевых слов
    const words = content
      .toLowerCase()
      .replace(/[^a-zа-я0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 4);

    const frequency = new Map<string, number>();
    words.forEach((w) => {
      frequency.set(w, (frequency.get(w) || 0) + 1);
    });

    return Array.from(frequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);
  }

  private calculateComplexity(content: string): number {
    // Эвристика сложности
    const length = content.length;
    const sentenceCount = content.split(/[.!?]+/).filter((s) => s.trim().length > 0).length;
    const wordCount = content.split(/\s+/).filter((w) => w.length > 0).length;
    const avgWordLength = wordCount > 0 ? length / wordCount : 0;

    // Нормализуем 0-1
    const complexity = Math.min(
      1,
      (sentenceCount * 0.1 + avgWordLength * 0.05 + wordCount * 0.01) / 3
    );

    return complexity;
  }

  private generateSessionName(firstMessage: string): string {
    // Генерация имени из первых слов
    const words = firstMessage.split(/\s+/).slice(0, 5);
    const name = words.join(' ').replace(/[^a-zA-Zа-яА-Я0-9\s]/g, '').slice(0, 40);
    return name || 'New Session';
  }
}

// Singleton
export const sessionManager = new SessionStateManager();

// Хук для React
export function useSessionManager() {
  return sessionManager;
}
