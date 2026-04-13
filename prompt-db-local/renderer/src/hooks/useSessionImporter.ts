// Φ_total(session:hook) — хук для автоматической обработки сессий при импорте
// Создаёт/обновляет ProducerSession при получении данных от Chrome Extension

import { useEffect, useCallback } from 'react';
import { sessionManager } from '@/services/SessionStateManager';
import { applyPhiTotal, summarizeSessionWithMistral } from '@/services/MistralService';
import type { ImportEnvelope } from '../../../shared/electron';

export function useSessionImporter() {
  // Обработка входящего импорта с sessionContext
  const handleImport = useCallback((payload: ImportEnvelope) => {
    if (!payload.sessionContext) {
      console.log('Φ_total(session:no_context) — import without session context');
      return;
    }

    const { sessionContext } = payload;
    const { 
      accountId, 
      accountName = 'Unknown Account', 
      sessionName,
      messageIndex = 0 
    } = sessionContext;

    // Получаем или создаём сессию
    const session = sessionManager.getOrCreateSession(
      accountId,
      accountName,
      sessionName
    );

    // Парсим JSON контент
    let content = '';
    let elementIds: string[] = [];
    try {
      const parsed = JSON.parse(payload.rawJson);
      content = parsed.name || parsed.prompt || JSON.stringify(parsed).slice(0, 500);
      elementIds = parsed.elementIds || [payload.id];
    } catch {
      content = payload.rawJson.slice(0, 500);
      elementIds = [payload.id];
    }

    // Добавляем сообщение в сессию
    const message = sessionManager.addMessage(session.id, content, elementIds, {
      intent: sessionName,
    });

    console.log(`Φ_total(session:message_added) — ${session.name} #${messageIndex + 1}`);

    // Проверяем autobatch триггеры
    const triggeredConfigs = sessionManager.checkAutobatchTriggers(
      accountId,
      message,
      session.messages.length
    );

    if (triggeredConfigs.length > 0) {
      console.log(`Φ_total(session:autobatch_triggered) — ${triggeredConfigs.length} patterns`);
      
      // Запускаем Mistral анализ для первого сработавшего конфига
      triggeredConfigs.forEach(async (config) => {
        if (!config.autoApplySuggestions) return;
        
        const context = sessionManager.getSessionContext(session.id);
        if (!context) return;

        const structuredResponse = await summarizeSessionWithMistral({
          sessionName: session.name,
          accountId: session.accountId,
          accountName: session.accountName,
          totalMessages: context.totalMessages,
          recentContext: context.recentContext,
          previousSummary: session.summary,
          customPrompt: config.mistralPrompt,
          model: 'mistral-large-latest',
        });

        const structuredSummary =
          structuredResponse.data?.summary ?? `Session "${session.name}" summary is unavailable.`;
        const structuredSuggestions =
          structuredResponse.data?.suggestedNextSteps.slice(0, config.maxSuggestions) ??
          [structuredResponse.error ?? 'Review recent context and retry analysis.'];

        sessionManager.updateSessionAnalysis(session.id, structuredSummary, structuredSuggestions);

        console.log(`О¦_total(session:analyzed) вЂ” ${structuredSuggestions.length} suggestions`);
        return;

        const response = await applyPhiTotal(
          config.patternName,
          `${context?.recentContext ?? ''}\n\n${config.mistralPrompt}`,
          'mistral-large-latest'
        );

        if (response.ok && response.data) {
          const content = response.data?.choices[0]?.message?.content || '';
          const suggestions = content
            .split('\n')
            .filter((line) => line.trim().startsWith('-'))
            .slice(0, config.maxSuggestions);

          sessionManager.updateSessionAnalysis(session.id, content.slice(0, 500), suggestions);
          
          console.log(`Φ_total(session:analyzed) — ${suggestions.length} suggestions`);
        }
      });
    }
  }, []);

  // Подписка на импорты
  useEffect(() => {
    if (!window.electronAPI?.onImportedJson) {
      return;
    }

    const unsubscribe = window.electronAPI.onImportedJson((payload) => {
      handleImport(payload);
    });

    return unsubscribe;
  }, [handleImport]);

  return { handleImport };
}

// Хук для получения статистики по аккаунтам
export function useAccountStats() {
  const getStats = useCallback((accountId: string) => {
    return sessionManager.getAccountStats(accountId);
  }, []);

  return { getStats };
}

// Утилита для ручного создания сессии из импорта
export function createSessionFromImport(
  payload: ImportEnvelope,
  customName?: string
): string | null {
  if (!payload.sessionContext) {
    console.warn('Φ_total(session:create_error) — no session context');
    return null;
  }

  const session = sessionManager.getOrCreateSession(
    payload.sessionContext.accountId,
    payload.sessionContext.accountName || 'Manual Import',
    customName || payload.sessionContext.sessionName
  );

  return session.id;
}
