/**
 * ProducerSessionParser — преобразует conversation payload из FlowMusic.app
 * в формат сессий приложения.
 */

class ProducerSessionParser {
  parseBatch(conversations, tracks, accountId) {
    if (!Array.isArray(conversations) || conversations.length === 0) {
      return [];
    }

    const trackIndex = this.buildTrackIndex(tracks);

    return conversations
      .map((conversation) => this.parseConversation(conversation, trackIndex, accountId))
      .filter(Boolean);
  }

  buildTrackIndex(tracks) {
    const trackById = new Map();
    const trackByOperationId = new Map();
    const trackByConversationAndTitle = new Map();

    for (const track of tracks || []) {
      if (!track?.id) continue;

      trackById.set(track.id, track);

      const operationId = track.rawData?.raw_data?.op_id;
      if (operationId) {
        trackByOperationId.set(operationId, track);
      }

      if (track.conversationId && track.title) {
        trackByConversationAndTitle.set(
          this.makeConversationTitleKey(track.conversationId, track.title),
          track
        );
      }
    }

    return {
      trackById,
      trackByOperationId,
      trackByConversationAndTitle
    };
  }

  parseConversation(conversation, trackIndex, accountId) {
    if (!conversation?.id) return null;

    const linkedTrackIds = new Set();
    const messages = [];
    const pendingAudioMessages = [];

    const pushMessage = (message) => {
      if (!message?.content) return;
      if (String(message.content).includes('<ui-hidden>Conversation started</ui-hidden>')) return;

      messages.push(message);

      if (message.linkedTrackId) {
        linkedTrackIds.add(message.linkedTrackId);
      }
    };

    for (const rawMessage of conversation.messages || []) {
      for (const part of rawMessage.parts || []) {
        const timestamp = rawMessage.timestamp || conversation.created_at || new Date().toISOString();

        if (part.part_kind === 'user-prompt') {
          pushMessage({
            id: this.makeMessageId(conversation.id, messages.length, 'user'),
            role: 'user',
            content: this.normalizeText(part.content),
            timestamp,
            createdAt: timestamp,
            metadata: {
              partKind: part.part_kind,
              toolName: null
            }
          });
          continue;
        }

        if (part.part_kind === 'thinking') {
          pushMessage({
            id: this.makeMessageId(conversation.id, messages.length, 'thinking'),
            role: 'assistant',
            content: this.formatSection('THOUGHTS', part.content),
            timestamp,
            createdAt: timestamp,
            metadata: {
              partKind: part.part_kind,
              toolName: null
            }
          });
          continue;
        }

        if (part.part_kind === 'text') {
          pushMessage({
            id: this.makeMessageId(conversation.id, messages.length, 'text'),
            role: 'assistant',
            content: this.normalizeText(part.content),
            timestamp,
            createdAt: timestamp,
            metadata: {
              partKind: part.part_kind,
              toolName: null
            }
          });
          continue;
        }

        if (part.part_kind === 'tool-call' && part.tool_name === 'audio__create_song') {
          const linkedTrack = this.findTrackForAudioPart(
            conversation.id,
            part.args,
            trackIndex
          );

          const message = {
            id: this.makeMessageId(conversation.id, messages.length, 'audio-call'),
            role: 'assistant',
            content: this.formatAudioCall(part.args),
            timestamp,
            createdAt: timestamp,
            linkedTrackId: linkedTrack?.id,
            metadata: {
              partKind: part.part_kind,
              toolName: part.tool_name,
              rawPayload: part.args || null
            },
            textFragments: this.createPromptFragments(
              conversation.id,
              part.args?.sound_prompt,
              linkedTrack?.id,
              timestamp
            )
          };

          pendingAudioMessages.push({ message, args: part.args || {} });
          pushMessage(message);
          continue;
        }

        if (part.part_kind === 'tool-return' && part.tool_name === 'audio__create_song') {
          const payload = part.content || {};
          const pending = pendingAudioMessages.shift();
          const linkedTrack = this.findTrackForAudioPart(
            conversation.id,
            {
              clip_id: payload.clip_id,
              operation_id: payload.operation_id,
              title: pending?.args?.title
            },
            trackIndex
          );

          if (pending?.message && linkedTrack?.id) {
            pending.message.linkedTrackId = linkedTrack.id;
            pending.message.textFragments = this.createPromptFragments(
              conversation.id,
              pending.args?.sound_prompt,
              linkedTrack.id,
              pending.message.timestamp
            );
          }

          pushMessage({
            id: this.makeMessageId(conversation.id, messages.length, 'audio-return'),
            role: 'assistant',
            content: this.formatAudioReturn(payload),
            timestamp,
            createdAt: timestamp,
            linkedTrackId: linkedTrack?.id,
            metadata: {
              partKind: part.part_kind,
              toolName: part.tool_name,
              rawPayload: payload
            }
          });
          continue;
        }

        if (part.part_kind === 'tool-return' && part.tool_name === 'lyrics__create') {
          pushMessage({
            id: this.makeMessageId(conversation.id, messages.length, 'lyrics'),
            role: 'assistant',
            content: this.formatLyricsReturn(part.content),
            timestamp,
            createdAt: timestamp,
            metadata: {
              partKind: part.part_kind,
              toolName: part.tool_name,
              rawPayload: part.content || null
            }
          });
          continue;
        }

        if (part.part_kind === 'tool-call' && part.tool_name === 'synthetic__suggest_actions') {
          pushMessage({
            id: this.makeMessageId(conversation.id, messages.length, 'suggest-actions'),
            role: 'assistant',
            content: this.formatSuggestedActions(part.args),
            timestamp,
            createdAt: timestamp,
            metadata: {
              partKind: part.part_kind,
              toolName: part.tool_name,
              rawPayload: part.args || null
            }
          });
        }
      }
    }

    const linkedTracks = Array.from(linkedTrackIds)
      .map((trackId) => trackIndex.trackById.get(trackId))
      .filter(Boolean)
      .map((track) => this.toLinkedTrack(track));

    return {
      conversationId: conversation.id,
      accountId,
      primaryAccountId: accountId,
      title: conversation.title || this.generateSessionTitle(linkedTracks),
      messages,
      linkedTrackIds: linkedTracks.map((track) => track.trackId),
      linkedTracks,
      createdAt: conversation.created_at,
      updatedAt: conversation.last_message_at || conversation.created_at,
      metadata: {
        source: 'flowmusic.app',
        importedFromProducer: true,
        totalRawMessages: (conversation.messages || []).length
      }
    };
  }

  findTrackForAudioPart(conversationId, payload, trackIndex) {
    if (payload?.clip_id && trackIndex.trackById.has(payload.clip_id)) {
      return trackIndex.trackById.get(payload.clip_id);
    }

    if (payload?.operation_id && trackIndex.trackByOperationId.has(payload.operation_id)) {
      return trackIndex.trackByOperationId.get(payload.operation_id);
    }

    if (conversationId && payload?.title) {
      return trackIndex.trackByConversationAndTitle.get(
        this.makeConversationTitleKey(conversationId, payload.title)
      );
    }

    return null;
  }

  toLinkedTrack(track) {
    return {
      trackId: track.id,
      title: track.title,
      audioPath: track.audioUrl,
      coverPath: track.coverUrl,
      metaPath: '',
      prompt: track.soundPrompt,
      createdAt: track.createdAt,
      rating: track.rating,
      quickMeta: {
        durationSeconds: track.durationSeconds,
        playCount: track.playCount,
        lyrics: track.lyrics,
        coverUrl: track.coverUrl
      }
    };
  }

  createPromptFragments(conversationId, prompt, linkedTrackId, timestamp) {
    const text = this.normalizeText(prompt);
    if (!text) return [];

    const fragmentId = this.makeFragmentId(conversationId, linkedTrackId || 'prompt');

    return [
      {
        id: fragmentId,
        fragmentId,
        conversationId,
        messageId: `${fragmentId}-message`,
        text,
        content: text,
        startIndex: 0,
        endIndex: text.length,
        linkedTrackId,
        isSelected: true,
        createdAt: timestamp
      }
    ];
  }

  formatLyricsReturn(payload) {
    if (!payload) return '';

    const title = this.normalizeText(payload.title);
    const lyrics = this.normalizeText(payload.lyrics);

    return [title ? `LYRICS\n${title}` : 'LYRICS', lyrics].filter(Boolean).join('\n\n');
  }

  formatAudioCall(payload) {
    if (!payload) return '';

    const sections = ['GENERATE SONG'];

    if (payload.title) {
      sections.push(`Title: ${payload.title}`);
    }

    if (payload.sound_prompt) {
      sections.push(`Sound:\n${this.normalizeText(payload.sound_prompt)}`);
    }

    if (payload.lyrics_id) {
      sections.push(`Lyrics ID: ${payload.lyrics_id}`);
    }

    return sections.join('\n\n');
  }

  formatAudioReturn(payload) {
    if (!payload) return '';

    const sections = ['SONG CREATED'];

    if (payload.clip_id) {
      sections.push(`Clip ID: ${payload.clip_id}`);
    }

    if (payload.operation_id) {
      sections.push(`Operation ID: ${payload.operation_id}`);
    }

    if (payload.estimated_time) {
      sections.push(`Estimated time: ${payload.estimated_time}s`);
    }

    return sections.join('\n');
  }

  formatSuggestedActions(payload) {
    if (!payload || typeof payload !== 'object') return '';

    const actions = Object.values(payload)
      .map((value) => this.normalizeText(value))
      .filter(Boolean);

    if (actions.length === 0) return '';

    return `SUGGESTED ACTIONS\n${actions.map((action, index) => `${index + 1}. ${action}`).join('\n')}`;
  }

  formatSection(title, content) {
    const text = this.normalizeText(content);
    if (!text) return '';
    return `${title}\n\n${text}`;
  }

  normalizeText(value) {
    if (typeof value !== 'string') return '';
    return value
      .replace(/\r\n/g, '\n')
      .trim();
  }

  generateSessionTitle(linkedTracks) {
    if (!linkedTracks?.length) return 'Сессия FlowMusic.app';
    if (linkedTracks.length === 1) return linkedTracks[0].title;
    return `${linkedTracks[0].title} (+${linkedTracks.length - 1})`;
  }

  makeConversationTitleKey(conversationId, title) {
    return `${conversationId}::${String(title).trim().toLowerCase()}`;
  }

  makeMessageId(conversationId, index, suffix) {
    return `producer-${conversationId}-${index}-${suffix}`;
  }

  makeFragmentId(conversationId, suffix) {
    return `fragment-${conversationId}-${suffix}`;
  }
}

const producerSessionParser = new ProducerSessionParser();

export default producerSessionParser;
export { ProducerSessionParser };
