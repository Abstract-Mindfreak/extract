class ProducerPromptNormalizer {
  normalizeSessions(sessions, tracks = []) {
    const rawPrompts = [];
    const promptBlocks = [];
    const promptSequences = [];
    const summaryByConversation = {};
    const trackById = new Map((tracks || []).filter(Boolean).map((track) => [track.id, track]));

    for (const session of sessions || []) {
      if (!session?.conversationId) continue;

      const conversationAssets = [];
      const conversationBlocks = [];

      (session.messages || []).forEach((message, messageIndex) => {
        const assets = this.extractAssetsFromMessage(session, message, messageIndex, trackById);
        conversationAssets.push(...assets);

        assets.forEach((asset, assetIndex) => {
          const block = this.createPromptBlockFromAsset(session, asset, conversationBlocks.length + assetIndex);
          if (block) {
            conversationBlocks.push(block);
          }
        });
      });

      rawPrompts.push(...conversationAssets);
      promptBlocks.push(...conversationBlocks);

      const sequence = this.createSequenceFromConversation(session, conversationBlocks);
      if (sequence) {
        promptSequences.push(sequence);
      }

      summaryByConversation[session.conversationId] = {
        rawPromptCount: conversationAssets.length,
        promptBlockCount: conversationBlocks.length,
        promptSequenceCount: sequence ? 1 : 0
      };
    }

    return {
      rawPrompts,
      promptBlocks,
      promptSequences,
      summaryByConversation
    };
  }

  attachNormalizationSummary(sessions, summaryByConversation) {
    return (sessions || []).map((session) => ({
      ...session,
      metadata: {
        ...(session.metadata || {}),
        normalization: summaryByConversation?.[session.conversationId] || {
          rawPromptCount: 0,
          promptBlockCount: 0,
          promptSequenceCount: 0
        }
      }
    }));
  }

  extractAssetsFromMessage(session, message, messageIndex, trackById) {
    const fragments = [];
    const baseTimestamp = message?.createdAt || message?.timestamp || session.updatedAt || new Date().toISOString();
    const metadata = message?.metadata || {};

    const payloadCandidates = [];

    if (metadata.rawPayload && (this.isPlainObject(metadata.rawPayload) || Array.isArray(metadata.rawPayload))) {
      payloadCandidates.push({
        kind: 'structured_payload',
        payload: metadata.rawPayload
      });
    }

    const textFragments = this.extractJsonFragments(String(message?.content || ''));
    textFragments.forEach((payload) => {
      payloadCandidates.push({
        kind: 'content_fragment',
        payload
      });
    });

    const seen = new Set();

    payloadCandidates.forEach((candidate, candidateIndex) => {
      const fingerprint = JSON.stringify(candidate.payload);
      if (!fingerprint || seen.has(fingerprint)) return;
      seen.add(fingerprint);

      const linkedTrack = message?.linkedTrackId ? trackById.get(message.linkedTrackId) : null;
      const id = `raw-${session.conversationId}-${messageIndex}-${candidateIndex}`;

      fragments.push({
        id,
        conversationId: session.conversationId,
        messageId: message?.id || `${session.conversationId}-message-${messageIndex}`,
        linkedTrackId: message?.linkedTrackId || null,
        accountId: session.primaryAccountId || session.accountId || null,
        sourceRole: message?.role || 'assistant',
        sourceType: metadata.partKind || candidate.kind,
        toolName: metadata.toolName || null,
        promptType: this.detectPromptType(candidate.payload),
        title: this.inferBlockName(candidate.payload, candidateIndex),
        payload: candidate.payload,
        rawText: this.truncate(String(message?.content || ''), 1200),
        tags: this.inferTags(candidate.payload),
        category: this.inferCategory(candidate.payload),
        sourceTrackTitle: linkedTrack?.title || null,
        createdAt: baseTimestamp,
        updatedAt: baseTimestamp
      });
    });

    return fragments;
  }

  createPromptBlockFromAsset(session, asset, index) {
    if (!asset?.payload) return null;

    return {
      id: `block-${asset.id}`,
      conversationId: session.conversationId,
      sourceAssetId: asset.id,
      linkedTrackId: asset.linkedTrackId || null,
      accountId: asset.accountId || null,
      name: asset.title || this.inferBlockName(asset.payload, index),
      description: `Imported from Producer session ${session.conversationId}`,
      category: asset.category || this.inferCategory(asset.payload),
      tags: asset.tags || this.inferTags(asset.payload),
      payload: {
        type: 'producer.ai_prompt',
        version: '1.0',
        data: asset.payload
      },
      ui: {
        color: this.pickColor(asset.category),
        icon: this.pickIcon(asset.promptType),
        boundButtonId: null
      },
      sourceMeta: {
        source: 'producer.ai',
        sourceType: asset.sourceType,
        toolName: asset.toolName,
        messageId: asset.messageId
      },
      createdAt: asset.createdAt,
      updatedAt: asset.updatedAt
    };
  }

  createSequenceFromConversation(session, blocks) {
    if (!Array.isArray(blocks) || blocks.length === 0) return null;

    return {
      id: `sequence-${session.conversationId}`,
      conversationId: session.conversationId,
      accountId: session.primaryAccountId || session.accountId || null,
      linkedTrackIds: Array.isArray(session.linkedTrackIds) ? session.linkedTrackIds : [],
      name: session.title || `Session ${session.conversationId}`,
      description: `Normalized from Producer session ${session.conversationId}`,
      blocks: blocks.map((block, index) => ({
        blockId: block.id,
        order: index
      })),
      mergeStrategy: 'merge_deep',
      ui: {
        color: '#9be0ff',
        icon: 'stack',
        boundButtonId: null
      },
      sourceMeta: {
        source: 'producer.ai',
        generatedFromConversation: true
      },
      createdAt: session.createdAt || session.updatedAt || new Date().toISOString(),
      updatedAt: session.updatedAt || new Date().toISOString()
    };
  }

  detectPromptType(payload) {
    if (Array.isArray(payload)) return 'array';
    if (!this.isPlainObject(payload)) return 'value';

    if (payload.type === 'producer.ai_prompt') return 'producer_prompt';
    if ('blockIds' in payload && 'data' in payload) return 'composition';
    return 'json_object';
  }

  inferBlockName(fragment, index) {
    if (this.isPlainObject(fragment)) {
      const keys = Object.keys(fragment);
      if (keys.length) {
        return keys[0].replace(/_/g, ' ');
      }
    }

    if (Array.isArray(fragment)) {
      return `Imported Array ${index + 1}`;
    }

    return `Imported Block ${index + 1}`;
  }

  inferCategory(fragment) {
    if (Array.isArray(fragment)) return 'array';
    if (this.isPlainObject(fragment)) {
      const keys = Object.keys(fragment).map((key) => key.toLowerCase());
      if (keys.some((key) => key.includes('metadata'))) return 'metadata';
      if (keys.some((key) => key.includes('logic'))) return 'logic';
      if (keys.some((key) => key.includes('archive'))) return 'archive';
      if (keys.some((key) => key.includes('lyrics'))) return 'lyrics';
      if (keys.some((key) => key.includes('mmss'))) return 'mmss';
    }
    return 'imported';
  }

  inferTags(fragment) {
    if (Array.isArray(fragment)) {
      return ['import', 'array', 'list', 'items'].slice(0, 15);
    }

    if (!this.isPlainObject(fragment)) {
      return ['import'];
    }

    const collector = new Set(['import']);
    this.collectKeyTags(fragment, collector, 0);
    return [...collector].slice(0, 15);
  }

  collectKeyTags(value, collector, depth) {
    if (collector.size >= 40 || depth > 6) return;

    if (Array.isArray(value)) {
      value.forEach((item) => this.collectKeyTags(item, collector, depth + 1));
      return;
    }

    if (!this.isPlainObject(value)) return;

    Object.keys(value).forEach((rawKey) => {
      const normalized = this.normalizeTag(rawKey);
      if (normalized) collector.add(normalized);

      rawKey
        .split(/[_\-\s]+/)
        .map((part) => this.normalizeTag(part))
        .filter(Boolean)
        .forEach((part) => collector.add(part));

      this.collectKeyTags(value[rawKey], collector, depth + 1);
    });
  }

  normalizeTag(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 48);
  }

  pickColor(category) {
    if (category === 'logic') return '#c084fc';
    if (category === 'metadata') return '#34d399';
    if (category === 'lyrics') return '#fbbf24';
    if (category === 'mmss') return '#60a5fa';
    return '#9be0ff';
  }

  pickIcon(promptType) {
    if (promptType === 'composition') return 'stack';
    if (promptType === 'producer_prompt') return 'import';
    if (promptType === 'array') return 'list';
    return 'import';
  }

  truncate(value, limit) {
    const text = String(value || '');
    if (text.length <= limit) return text;
    return `${text.slice(0, limit)}...`;
  }

  extractJsonFragments(text) {
    const results = [];
    const seenRanges = new Set();

    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      if (char !== '{' && char !== '[') continue;
      if (!this.looksLikeJsonStart(text, index)) continue;

      const endIndex = this.findBalancedJsonEnd(text, index);
      if (endIndex < 0) continue;

      const rangeKey = `${index}:${endIndex}`;
      if (seenRanges.has(rangeKey)) continue;
      seenRanges.add(rangeKey);

      const candidate = text.slice(index, endIndex + 1);
      try {
        const parsed = JSON.parse(candidate);
        if (this.isPlainObject(parsed) || Array.isArray(parsed)) {
          results.push(parsed);
          index = endIndex;
        }
      } catch (error) {
        // Ignore malformed candidate and continue scanning.
      }
    }

    return results;
  }

  findBalancedJsonEnd(text, start) {
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = start; index < text.length; index += 1) {
      const char = text[index];

      if (inString) {
        if (escaped) {
          escaped = false;
          continue;
        }
        if (char === '\\') {
          escaped = true;
          continue;
        }
        if (char === '"') {
          inString = false;
        }
        continue;
      }

      if (char === '"') {
        inString = true;
        continue;
      }

      if (char === '{' || char === '[') {
        depth += 1;
        continue;
      }

      if (char === '}' || char === ']') {
        depth -= 1;
        if (depth === 0) return index;
        if (depth < 0) return -1;
      }
    }

    return -1;
  }

  looksLikeJsonStart(text, start) {
    const first = text[start];
    if (first !== '{' && first !== '[') return false;

    let index = start + 1;
    while (index < text.length && /\s/.test(text[index])) {
      index += 1;
    }

    if (index >= text.length) return false;
    const next = text[index];
    if (first === '{') {
      return next === '"' || next === '}';
    }
    return next === '{' || next === '[' || next === '"' || next === ']' || next === '-' || /[0-9tfn]/.test(next);
  }

  isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }
}

const producerPromptNormalizer = new ProducerPromptNormalizer();

export default producerPromptNormalizer;
export { ProducerPromptNormalizer };
