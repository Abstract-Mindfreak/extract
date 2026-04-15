/**
 * SessionExtractor — извлечение сессий из треков по conversation_id
 */

class SessionExtractor {
  /**
   * Извлечь сессии из треков
   * Группирует треки по conversation_id
   * @param {Array} tracks
   * @returns {Array} sessions
   */
  extractSessions(tracks) {
    // Группируем треки по conversation_id
    const conversationGroups = new Map();
    
    for (const track of tracks) {
      if (!track.conversationId) continue;
      
      if (!conversationGroups.has(track.conversationId)) {
        conversationGroups.set(track.conversationId, []);
      }
      conversationGroups.get(track.conversationId).push(track);
    }

    // Создаем сессии из групп
    const sessions = [];
    
    for (const [conversationId, groupTracks] of conversationGroups) {
      // Сортируем по дате создания
      groupTracks.sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      // Реконструируем сообщения из всех треков группы
      const allMessages = [];
      const linkedTrackIds = [];

      for (const track of groupTracks) {
        const messages = this.reconstructMessagesFromTrack(track);
        allMessages.push(...messages);
        linkedTrackIds.push(track.id);
      }

      // Дедупликация сообщений по контенту и времени
      const uniqueMessages = this.deduplicateMessages(allMessages);

      const session = {
        conversationId,
        accountId: groupTracks[0]?.accountId,
        title: this.generateSessionTitle(groupTracks),
        messages: uniqueMessages,
        linkedTrackIds,
        createdAt: groupTracks[0]?.createdAt,
        updatedAt: new Date().toISOString(),
        metadata: {
          trackCount: groupTracks.length,
          totalDuration: groupTracks.reduce((sum, t) => sum + (t.durationSeconds || 0), 0)
        }
      };

      sessions.push(session);
    }

    return this.mergeDuplicateSessions(sessions);
  }

  /**
   * Реконструировать сообщения из трека
   * Создает пару сообщений: user (prompt) и assistant (результат)
   * @param {Object} track
   * @returns {Array} messages
   */
  reconstructMessagesFromTrack(track) {
    const messages = [];
    const timestamp = track.createdAt || new Date().toISOString();

    // Сообщение пользователя — sound_prompt
    if (track.soundPrompt) {
      messages.push({
        id: `msg-${track.id}-user`,
        role: 'user',
        content: track.soundPrompt,
        createdAt: timestamp,
        linkedTrackId: track.id
      });
    }

    // Сообщение ассистента — результат генерации
    const assistantContent = this.buildAssistantContent(track);
    if (assistantContent) {
      messages.push({
        id: `msg-${track.id}-assistant`,
        role: 'assistant',
        content: assistantContent,
        createdAt: timestamp,
        linkedTrackId: track.id,
        textFragments: this.extractTextFragments(track)
      });
    }

    return messages;
  }

  /**
   * Построить контент сообщения ассистента
   * @param {Object} track
   * @returns {string}
   */
  buildAssistantContent(track) {
    const parts = [];

    if (track.title && track.title !== 'Untitled') {
      parts.push(`**Название:** ${track.title}`);
    }

    if (track.durationSeconds) {
      const mins = Math.floor(track.durationSeconds / 60);
      const secs = track.durationSeconds % 60;
      parts.push(`**Длительность:** ${mins}:${secs.toString().padStart(2, '0')}`);
    }

    if (track.lyrics && track.lyrics !== '[Instrumental]') {
      parts.push(`**Текст:**\n${track.lyrics}`);
    }

    if (track.sourceUrl) {
      parts.push(`**Источник:** ${track.sourceUrl}`);
    }

    return parts.join('\n\n');
  }

  /**
   * Извлечь текстовые фрагменты для привязки
   * @param {Object} track
   * @returns {Array}
   */
  extractTextFragments(track) {
    const fragments = [];

    // Фрагмент из sound_prompt
    if (track.soundPrompt) {
      const fragmentId = crypto.randomUUID();
      fragments.push({
        id: fragmentId,
        fragmentId,
        conversationId: track.conversationId,
        messageId: `msg-${track.id}-user`,
        text: track.soundPrompt,
        content: track.soundPrompt,
        startIndex: 0,
        endIndex: track.soundPrompt.length,
        linkedTrackId: track.id,
        isSelected: true,
        createdAt: track.createdAt
      });
    }

    return fragments;
  }

  /**
   * Дедупликация сообщений
   * @param {Array} messages
   * @returns {Array}
   */
  deduplicateMessages(messages) {
    const seen = new Set();
    const unique = [];

    for (const msg of messages) {
      // Ключ: роль + первые 100 символов контента
      const key = `${msg.role}:${msg.content.slice(0, 100)}`;
      
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(msg);
      }
    }

    return unique;
  }

  /**
   * Объединить дублирующиеся сессии
   * Сессии считаются дубликатами, если имеют одинаковый conversationId
   * @param {Array} sessions
   * @returns {Array}
   */
  mergeDuplicateSessions(sessions) {
    const merged = new Map();

    for (const session of sessions) {
      const existing = merged.get(session.conversationId);
      
      if (existing) {
        // Объединяем сообщения
        const allMessages = [...existing.messages, ...session.messages];
        existing.messages = this.deduplicateMessages(allMessages);
        
        // Объединяем linkedTrackIds
        const allTrackIds = new Set([...existing.linkedTrackIds, ...session.linkedTrackIds]);
        existing.linkedTrackIds = Array.from(allTrackIds);
        
        // Обновляем метаданные
        existing.metadata = {
          ...existing.metadata,
          trackCount: existing.linkedTrackIds.length,
          merged: true
        };
      } else {
        merged.set(session.conversationId, { ...session });
      }
    }

    return Array.from(merged.values());
  }

  /**
   * Авто-привязка треков к сообщениям в сессии
   * Ищет совпадения sound_prompt с контентом сообщений
   * @param {Object} session
   * @param {Array} tracks
   * @returns {Object} updatedSession
   */
  autoLinkTracksToMessages(session, tracks) {
    const updatedSession = { ...session };

    for (const track of tracks) {
      if (!track.conversationId || track.conversationId !== session.conversationId) {
        continue;
      }

      // Ищем совпадение sound_prompt в сообщениях
      if (track.soundPrompt) {
        for (const message of updatedSession.messages) {
          if (message.role === 'user' && message.content.includes(track.soundPrompt)) {
            message.linkedTrackId = track.id;
            
            // Добавляем фрагмент
            if (!message.textFragments) {
              message.textFragments = [];
            }
            
            const startIndex = message.content.indexOf(track.soundPrompt);
            message.textFragments.push({
              id: crypto.randomUUID(),
              messageId: message.id,
              content: track.soundPrompt,
              startIndex,
              endIndex: startIndex + track.soundPrompt.length,
              linkedTrackId: track.id,
              isSelected: true,
              createdAt: track.createdAt
            });
            
            break;
          }
        }
      }
    }

    return updatedSession;
  }

  /**
   * Найти треки по conversation_id
   * @param {Array} tracks
   * @param {string} conversationId
   * @returns {Array}
   */
  findTracksByConversationId(tracks, conversationId) {
    return tracks.filter(t => t.conversationId === conversationId);
  }

  /**
   * Сгенерировать заголовок сессии
   * @param {Array} tracks
   * @returns {string}
   */
  generateSessionTitle(tracks) {
    if (tracks.length === 0) return 'Без названия';
    
    if (tracks.length === 1) {
      return tracks[0].title || 'Сессия без названия';
    }
    
    return `${tracks[0].title || 'Сессия'} (+${tracks.length - 1} треков)`;
  }

  /**
   * Полный пайплайн извлечения
   * @param {Array} tracks
   * @returns {Object} ExtractionResult
   */
  extract(tracks) {
    const sessions = this.extractSessions(tracks);
    
    // Считаем статистику
    const linkedTracks = new Set();
    for (const session of sessions) {
      for (const trackId of session.linkedTrackIds) {
        linkedTracks.add(trackId);
      }
    }
    
    return {
      sessions,
      linkedTracks: linkedTracks.size,
      unlinkedTracks: tracks.length - linkedTracks.size,
      duplicatesMerged: 0 // TODO: считать реальное количество
    };
  }
}

// Singleton instance
const sessionExtractor = new SessionExtractor();

export default sessionExtractor;
export { SessionExtractor };
