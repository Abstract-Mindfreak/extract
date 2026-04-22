/**
 * MetaParser — парсинг meta.json файлов треков FlowMusic.app
 */

class MetaParser {
  constructor(options = {}) {
    this.options = {
      basePublicUrl: '/local-data/',
      preserveRawData: true,
      ...options
    };
  }

  /**
   * Парсить meta.json в объект Track
   * @param {string} rawJson
   * @param {string} accountId
   * @param {string} metaFilePath
   * @returns {Object} Track
   */
  parseMetaJson(rawJson, accountId, metaFilePath) {
    let raw;
    
    try {
      raw = JSON.parse(rawJson);
    } catch (err) {
      throw new Error(`Невалидный JSON: ${err?.message || err}`);
    }

    // Валидируем структуру
    this.validateMetaJson(raw);

    const meta = raw;

    // Определяем пути к медиафайлам
    const dirPath = metaFilePath.replace(/\/meta\.json$/, '').replace(/\\meta\.json$/, '');
    const audioPath = this.findAudioPath(dirPath, meta);
    const imagePath = this.findImagePath(dirPath, meta);

    const conversationId = this.extractConversationId(meta);
    const sourceUrl = this.extractSourceUrl(meta);

    const track = {
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
      conversationId,
      sourceUrl,
      sessionUrl: conversationId
        ? `https://www.flowmusic.app/session/${conversationId}#song-${meta.id}`
        : undefined,
      
      // Даты
      createdAt: meta.created_at || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      
      // Статистика
      playCount: 0,
      rating: 0,
      tags: meta.tags || [],
      
      // Raw data для отладки
      rawData: this.options.preserveRawData ? raw : undefined
    };

    return track;
  }

  /**
   * Валидировать структуру meta.json
   * @param {*} raw
   */
  validateMetaJson(raw) {
    if (typeof raw !== 'object' || raw === null) {
      throw new Error('meta.json должен быть объектом');
    }

    // Обязательное поле: id
    if (!raw.id || typeof raw.id !== 'string') {
      throw new Error('meta.json должен содержать поле "id" типа string');
    }

    // Проверяем operation если есть
    if (raw.operation !== undefined) {
      if (typeof raw.operation !== 'object' || raw.operation === null) {
        throw new Error('Поле "operation" должно быть объектом');
      }
    }
  }

  /**
   * Извлечь длительность из метаданных
   * @param {Object} raw
   * @returns {number|undefined}
   */
  extractDuration(raw) {
    // Прямое поле duration (число)
    if (typeof raw.duration === 'number' && raw.duration > 0) {
      return Math.floor(raw.duration);
    }

    // Ищем в raw_data (где duration обычно хранится как объект со status/value)
    if (raw.raw_data?.duration?.value) {
      const val = parseFloat(raw.raw_data.duration.value);
      if (!isNaN(val) && val > 0) {
        return Math.floor(val);
      }
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
        // Пробуем парсить строку
        if (typeof val === 'string') {
          const parsed = parseFloat(val);
          if (!isNaN(parsed) && parsed > 0) {
            return Math.floor(parsed);
          }
        }
      }
    }

    return undefined;
  }

  /**
   * Извлечь sound_prompt из operation
   * @param {Object} raw
   * @returns {string}
   */
  extractSoundPrompt(raw) {
    const prompt = raw.operation?.sound_prompt || raw.raw_data?.operation?.sound_prompt;
    
    if (typeof prompt === 'string') {
      return prompt.trim();
    }
    
    // Если нет sound_prompt, пробуем другие поля
    const altFields = ['prompt', 'description', 'text'];
    for (const field of altFields) {
      const val = raw.operation?.[field] ?? raw.raw_data?.operation?.[field];
      if (typeof val === 'string') {
        return val.trim();
      }
    }

    return '';
  }

  /**
   * Извлечь lyrics
   * @param {Object} raw
   * @returns {string}
   */
  extractLyrics(raw) {
    // Пробуем разные пути к lyrics
    let lyrics = null;
    
    // 1. Прямое поле lyrics (строка или объект)
    if (raw.lyrics) {
      lyrics = raw.lyrics;
    }
    // 2. В operation.lyrics (строка или объект)
    else if (raw.operation?.lyrics) {
      lyrics = raw.operation.lyrics;
    }
    // 3. В raw_data.lyrics.value
    else if (raw.raw_data?.lyrics?.value) {
      const val = raw.raw_data.lyrics.value;
      if (typeof val === 'string') {
        lyrics = val;
      } else if (val?.text) {
        lyrics = val.text;
      }
    }
    
    // Если lyrics - объект с value/text
    if (typeof lyrics === 'object' && lyrics !== null) {
      if (lyrics.text) lyrics = lyrics.text;
      else if (lyrics.value) lyrics = lyrics.value;
    }
    
    if (typeof lyrics === 'string') {
      const trimmed = lyrics.trim();
      return trimmed || '[Instrumental]';
    }

    return '[Instrumental]';
  }

  /**
   * Извлечь conversation_id
   * @param {Object} raw
   * @returns {string|undefined}
   */
  extractConversationId(raw) {
    // Прямое поле
    if (raw.conversation_id) {
      return String(raw.conversation_id);
    }

    // Ищем в operation
    if (raw.operation?.conversation_id) {
      return String(raw.operation.conversation_id);
    }

    // Реальный архив producer-ai-archiver хранит значение здесь
    if (raw.raw_data?.operation?.conversation_id) {
      return String(raw.raw_data.operation.conversation_id);
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
   * @param {Object} raw
   * @returns {string|undefined}
   */
  extractSourceUrl(raw) {
    return raw.source_url || raw.source || undefined;
  }

  /**
   * Конвертировать относительный путь в публичный URL
   * @param {string} relativePath
   * @param {string} [baseUrl]
   * @returns {string}
   */
  toPublicUrl(relativePath, baseUrl) {
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
   * @param {string} dirPath
   * @param {Object} meta
   * @returns {string|undefined}
   */
  findAudioPath(dirPath, meta) {
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
   * @param {string} dirPath
   * @param {Object} meta
   * @returns {string|undefined}
   */
  findImagePath(dirPath, meta) {
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
   * @param {Object} options
   */
  setOptions(options) {
    this.options = { ...this.options, ...options };
  }
}

// Singleton instance с дефолтными настройками
const metaParser = new MetaParser();

export default metaParser;
export { MetaParser };
