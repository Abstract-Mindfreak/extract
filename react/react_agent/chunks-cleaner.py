import psycopg2
import json
import hashlib
from datetime import datetime
from typing import Dict, List, Any, Set, Optional
import re
import logging

# =====================================================
# НАСТРОЙКА ЛОГГИРОВАНИЯ
# =====================================================
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# =====================================================
# КОНФИГУРАЦИЯ
# =====================================================
DB_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'user': 'mind_user',
    'password': 'mindfreak'
}

SOURCE_DATABASE_TABLES = {
    'abstract-mind-lab': {
        'tracks',
        'mmss_collection',
        'mmss_filtered',
        'mmss_custom_instructions',
        'mmss_albums',
        'mmss_domain_patterns',
    },
    'abstract_mind_db': {
        'music_blocks',
    },
}

DATABASES = list(SOURCE_DATABASE_TABLES.keys())

EXCLUDED_SOURCE_TABLES = {
    'applied_flows',
    'applied_memories',
    'chat_sessions',
    'app_entity_store',
    'mmss_invariants',
    'mmss_tracks_prompts',
}

# =====================================================
# РАСШИРЕННАЯ КОНФИГУРАЦИЯ ФИЛЬТРАЦИИ
# =====================================================

# Поля, которые нужно полностью удалить
EXCLUDED_FIELDS = {
    # Технические ID
    'id', 'op_id', 'video_id', 'image_id', 'author_id', 'accountId',
    'parent_id', 'origin_id', 'project_id', 'user_id', 'space_id',
    'track_id', 'source_id', 'clip_id', 'operation_id', 'session_id',
    'run_id', 'tool_call_id', 'messageId', 'fragmentId', 'linkedTrackId',
    
    # Ссылки и URL
    'audio_url', 'wav_url', 'mp3_url', 'stream_url', 'image_url', 
    'video_url', 'source_url', 'coverUrl', 'audioUrl', 'wav_url',
    'image_url', 'public_url', 'download_url', 'thumbnail_url',
    
    # Статистика и метрики
    'play_count', 'favorite_count', 'share_count', 'skip_count',
    'skip_ratio', 'completion_rate', 'avg_completion_pct', 'playCount',
    'view_count', 'like_count', 'download_count', 'rating_count',
    
    # Флаги статуса
    'is_favorite', 'is_project', 'is_space', 'is_derivative',
    'is_discoverable', 'is_favorited_by_me', 'is_stem_composite',
    'has_video', 'has_backup_audio', 'is_deleted', 'is_public',
    'is_private', 'is_active', 'is_locked', 'is_archived',
    'isSelected',
    
    # Даты
    'deleted_at', 'published_at', 'archived_at', 'last_synced',
    'vectorized_at', 'captured_at', 'last_sync_at', 'export_time',
    'processing_started_at', 'processing_completed_at', 'expires_at',
    
    # Технические поля
    'preference_state', 'user_edited_lyrics_id', 'allow_public_use',
    'privacy', 'privacy_status', 'storage_tier', 'audio_codec',
    'bitrate_kbps', 'sample_rate_hz', 'cfg_scale', 'sampling_steps',
    'internal_model_id', 'inference_time_ms', 'system_instructions_id',
    'prompt_enhancement_enabled', 'model_version', 'transform_type',
    'remix_mode', 'generation_mode', 'ghostwriter_tier', 'stem_type',
    'instrument', 'branch_index', 'derivation_depth', 'seed_value',
    'messageId', 'createdAt', 'endIndex', 'conversationId', 'startIndex',
    'updatedAt','status', 'provider_response_id',
    'provider_url', 'provider_details', 'provider_name', 'user_id',
    'user_edited_lyrics_id', 'lyrics_timing', 'is_favorited',
    'is_favorited_by_me', 'conversation_title', 'timestamp',
    'estimated_time', 'finish_reason', 'signature', 'change_note',
    'compile_status', 'compile_error', 'version_id', 'version',
    'rawPayload', 'partKind', 'toolName', 'metadata', 'linkedTrackId',
    'textFragments', 'quickMeta', 'audioPath', 'coverPath', 'metaPath',
    'primaryAccountId', 'normalization', 'rawPromptCount', 'promptBlockCount',
    'promptSequenceCount', 'totalRawMessages', 'importedFromProducer',
    'accountId', 'sessionUrl', 'soundPrompt', 'durationSeconds',    
    'image_url','duration'
    
    # Дублирующиеся поля
    'audio_md5', 'content_hash', 'chunk_hash', 'seed_version',
    'version', 'entry_id', 'checksum', 'file_hash',
    
    # Null поля
    'video_job_id', 'video_status', 'video_aspect_ratio',
    'video_motion_score', 'video_style_ref_url', 'video_start_s',
    'video_end_s', 'video_prompt', 'video_fps', 'video_resolution',
    'negative_prompt', 'prompt_strength', 'offset_s', 'clip_start_s',
    'clip_end_s', 'trim_start_s', 'trim_end_s', 'parent_riff_id',
    'parent_clip_id', 'original_track_id', 'source_user_id',
    'lyrics_timing', 'conditions', 'operation_id_b',
    
    # Поля инструментов и вызовов
    'tool_call_id', 'tool_name', 'part_kind', 'provider_name',
    'provider_details', 'provider_response_id', 'run_id', 'model_name',
    'finish_reason', 'provider_url', 'instructions',
    
    # Usage метрики
    'input_tokens', 'output_tokens', 'cache_read_tokens',
    'cache_write_tokens', 'input_audio_tokens', 'output_audio_tokens',
    'cache_audio_read_tokens', 'estimated_time',
    
    # Поля статуса
    'status', 'compile_status', 'compile_error', 'change_note',
    'signature', 'version_id', 'version', 'timestamp',
}

# Поля, которые нужно save (белый список)
ALLOWED_FIELDS = {
    # Основные текстовые поля
    'title', 'description', 'content', 'text', 'prompt_text',
    'instruction_text', 'memory_text', 'chunk_text',
    'generation_insights', 'creative_choices', 'emergence_moments',
    'operator_trajectory', 'next_vector_suggestions', 'sound_prompt',
    'lyrics', 'prompt', 'notes', 'comments', 'summary',
    
    # Метаданные
    'scope', 'entity_key', 'setting_key', 'flow_name', 'category',
    'domain', 'tags', 'markers', 'keywords', 'labels',
    
    # JSON данные
    'payload', 'raw_payload', 'source_payload', 'metadata',
    'ai_snapshot', 'raw_data', 'config', 'full_payload',
    'operation', 'session_snapshot', 'raw_track',
    
    # Временные метки (верхний уровень)
    'created_at', 'updated_at', 'applied_at',
    
    # Идентификаторы для связей
    'source_table', 'source_database', 'database_name',
    'schema_name', 'table_name', 'filtered_id',
    
    # Важные значения
    'value', 'score', 'quality_score', 'duration_ms',
    'success', 'input_payload', 'output_payload',
    'confidence', 'relevance', 'importance',
    
    # Дополнительные смысловые поля
    'domain_id', 'category_id', 'album_id', 'collection_id',
    'genre', 'style', 'mood', 'vibe', 'atmosphere',
    'key', 'bpm', 'time_signature', 'mode',
}

# Список стоп-слов и паттернов для отбрасывания chunkов
STOP_PATTERNS = [
    r'^<ui-hidden>Conversation started</ui-hidden>$',
    r'^<ui-hidden>.*</ui-hidden>$',
    r'^Final result processed\.$',
    r'^mmss-bridge$',
    r'^eqgft-abstractmind$',
    r'^ddab6519-d3eb-4264-be1a-90c8771498c0$',
    r'^f4980073-e6f3-4ac0-b2da-42a50d981eb2$',
    r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
    r'^b3027ba39c8453a349254dd41cce053b206f8c7a$',
    r'^G\(s₂\)\. Goa-trance$',
    r'^F=0 the track\. Accurate changes$',
    r'^Ready to dive in\. What\'s the next phase for this experiment\?$',
    r'^try new one artifact - imagine that you know all 100 \* 100 blocks \. Dont sing descriptions \. New text\. New ASE /explore$',
    r'^продолжаем\. пока что не пугает\.$',
    r'^Продолжаем\. В Направление классической Индийской Raga\.$',
    r'^Новый текст\.$',
    r'^New Text about rules - back -back- vocal\. NO TEXT- ONLY sound notes$',
    r'^Да правила тут меняются настолько насколько ты способен их менять в процессе\. Здесь нет рамок и границ\. Попробуй реализовать что - то что сам пожелаешь$',
    r'^давай что-то не сложное предложим\. \(кстати это gemma4 e2b - на большее у меня не хватает ресурсов железа\. но ничего страшного \) - какие идеи для теста\?$',
    r'^no more trap sound in my ears please/ strong forbideden trap style\. to live instruments \. разрушь trap style и все что с ним взаимосвязано в звуке и композиции сетки и никогда не используй его ритмику и сетку и его фильтры и 808 забудь$',
]

# =====================================================
# РАСШИРЕННЫЙ ФИЛЬТР ДАННЫХ
# =====================================================

class DataCleaner:
    """Очистка данных от избыточных полей с сохранением смыслового контента"""
    
    def __init__(self, excluded_fields=None, allowed_fields=None):
        self.excluded_fields = excluded_fields or EXCLUDED_FIELDS
        self.allowed_fields = allowed_fields or ALLOWED_FIELDS
        self.stop_patterns = [re.compile(p, re.IGNORECASE) for p in STOP_PATTERNS]
        
        # Паттерны для очистки строк
        self.url_pattern = re.compile(r'https?://[^\s]+', re.IGNORECASE)
        
        # Паттерны для удаления технических JSON-блоков из строк
        self.technical_patterns = [
            # Удаляем блоки usage
        re.compile(r'"usage":\s*\{[^{}]*\}', re.DOTALL),
            # Удаляем блоки tool-call
        re.compile(r'"part_kind":\s*"(?:tool-call|tool-return|retry-prompt|thinking)"[^}]*\}', re.DOTALL),
            # Удаляем timestamp
        re.compile(r'"timestamp":\s*"[^"]*"', re.DOTALL),
            # Удаляем provider_* поля
        re.compile(r'"provider_[^"]*":\s*"[^"]*"', re.DOTALL),
            # Удаляем run_id
        re.compile(r'"run_id":\s*[^,}]*[,}]', re.DOTALL),
            # Удаляем model_name
        re.compile(r'"model_name":\s*"[^"]*"', re.DOTALL),
            # Удаляем finish_reason
        re.compile(r'"finish_reason":\s*[^,}]*[,}]', re.DOTALL),
            # Удаляем tool_call_id
        re.compile(r'"tool_call_id":\s*"[^"]*"', re.DOTALL),
            # Удаляем operation_id
        re.compile(r'"operation_id":\s*"[^"]*"', re.DOTALL),
            # Удаляем clip_id
        re.compile(r'"clip_id":\s*"[^"]*"', re.DOTALL),
            # Удаляем clip_id_b
        re.compile(r'"clip_id_b":\s*[^,}]*[,}]', re.DOTALL),
            # Удаляем estimated_time
        re.compile(r'"estimated_time":\s*\d+', re.DOTALL),
            # Удаляем a_b_test_id
        re.compile(r'"a_b_test_id":\s*[^,}]*[,}]', re.DOTALL),
            # Удаляем ссылки на аудио в JSON
        re.compile(r'"audio_url":\s*"[^"]*"', re.DOTALL),
        re.compile(r'"wav_url":\s*"[^"]*"', re.DOTALL),
        re.compile(r'"image_url":\s*"[^"]*"', re.DOTALL),
        re.compile(r'"coverUrl":\s*"[^"]*"', re.DOTALL),
            # Удаляем статистику
        re.compile(r'"play_count":\s*\d+', re.DOTALL),
        re.compile(r'"favorite_count":\s*\d+', re.DOTALL),
            # Удаляем флаги
        re.compile(r'"is_[^"]*":\s*(?:true|false)', re.DOTALL),
            # Удаляем технические null поля
        re.compile(r'"[^"]*":\s*null[,}]', re.DOTALL),
            # Удаляем пустые объекты
        re.compile(r'\{\s*\}', re.DOTALL),
            # Удаляем блоки raw_track полностью
        re.compile(r'"raw_track":\s*\{[^{}]*"op_type"[^{}]*\}', re.DOTALL),
            # Удаляем блоки session_snapshot
        re.compile(r'"session_snapshot":\s*\{[^{}]*"messages"[^{}]*\}', re.DOTALL),
            # Удаляем блоки raw_data
        re.compile(r'"raw_data":\s*\{[^{}]*"op_type"[^{}]*\}', re.DOTALL),
            # Удаляем блоки operation
        re.compile(r'"operation":\s*\{[^{}]*"op_type"[^{}]*\}', re.DOTALL),
            # Удаляем блоки с stems
        re.compile(r'"stems":\s*\[\s*\{[^}]*\}\s*\]', re.DOTALL),
            # Удаляем input_tokens и подобные
        re.compile(r'"input_tokens":\s*\d+', re.DOTALL),
        re.compile(r'"output_tokens":\s*\d+', re.DOTALL),
        re.compile(r'"cache_[^"]*_tokens":\s*\d+', re.DOTALL),
            # Удаляем ссылки на аудио в JSON
        re.compile(r'"audio_url":\s*"[^"]*"', re.DOTALL),
        re.compile(r'"wav_url":\s*"[^"]*"', re.DOTALL),
        re.compile(r'"image_url":\s*"[^"]*"', re.DOTALL),
        ]

        self.text_cleanup_patterns = [
            re.compile(r'<ui-hidden>[^<]*</ui-hidden>', re.DOTALL),
            re.compile(r'\[truncated\]', re.IGNORECASE),
            re.compile(r'\[End\s*-\s*\d+:\d+\]', re.IGNORECASE),
            re.compile(r'\[Instrumental\]', re.IGNORECASE),
            re.compile(r'\[End\]', re.IGNORECASE),
            re.compile(r'{"raw_track":\{[^}]*\}}', re.DOTALL),
            re.compile(r'{"session_snapshot":\{[^}]*\}}', re.DOTALL),
            re.compile(r'audio__create_song', re.IGNORECASE),
            re.compile(r'audio__modify_song', re.IGNORECASE),
            re.compile(r'audio__split_stems', re.IGNORECASE),
            re.compile(r'audio__apply_effect', re.IGNORECASE),
            re.compile(r'audio__caption', re.IGNORECASE),
            re.compile(r'audio__transcribe', re.IGNORECASE),
            re.compile(r'lyrics__create', re.IGNORECASE),
            re.compile(r'lyrics__register', re.IGNORECASE),
            re.compile(r'synthetic__suggest_actions', re.IGNORECASE),
            re.compile(r'synthetic__upload_audio', re.IGNORECASE),
            re.compile(r'synthetic__compose_form_edited', re.IGNORECASE),
            re.compile(r'songs__display_songs', re.IGNORECASE),
            re.compile(r'songs__get_metadata', re.IGNORECASE),
            re.compile(r'code__create_space', re.IGNORECASE),
            re.compile(r'code__edit_space', re.IGNORECASE),
        ]

    def _looks_like_structured_json_text(self, value: str) -> bool:
        if not value:
            return False
        text = value.strip()
        if text.startswith('```json') and text.endswith('```'):
            return True
        if (text.startswith('{') and text.endswith('}')) or (text.startswith('[') and text.endswith(']')):
            try:
                json.loads(text)
                return True
            except Exception:
                return False
        return False

        self.text_cleanup_patterns = [
            re.compile(r'<ui-hidden>[^<]*</ui-hidden>', re.DOTALL),
            # Удаляем маркеры [truncated]
            re.compile(r'\[truncated\]', re.IGNORECASE),
            # Удаляем маркеры [End - \d+:\d+\]
            re.compile(r'\[End\s*-\s*\d+:\d+\]', re.IGNORECASE),
                # Удаляем маркеры [Instrumental]
            re.compile(r'\[Instrumental\]', re.IGNORECASE),
            # Удаляем маркеры [End]
            re.compile(r'\[End\]', re.IGNORECASE),
                # Удаляем дублирующиеся технические JSON в тексте
            re.compile(r'{"raw_track":\{[^}]*\}}', re.DOTALL),
            re.compile(r'{"session_snapshot":\{[^}]*\}}', re.DOTALL),
                # Удаляем audio__create_song и подобные
            re.compile(r'audio__create_song', re.IGNORECASE),
            re.compile(r'audio__modify_song', re.IGNORECASE),
            re.compile(r'audio__split_stems', re.IGNORECASE),
            re.compile(r'audio__apply_effect', re.IGNORECASE),
            re.compile(r'audio__caption', re.IGNORECASE),
            re.compile(r'audio__transcribe', re.IGNORECASE),
            re.compile(r'lyrics__create', re.IGNORECASE),
            re.compile(r'lyrics__register', re.IGNORECASE),
            re.compile(r'synthetic__suggest_actions', re.IGNORECASE),
            re.compile(r'synthetic__upload_audio', re.IGNORECASE),
            re.compile(r'synthetic__compose_form_edited', re.IGNORECASE),
            re.compile(r'songs__display_songs', re.IGNORECASE),
            re.compile(r'songs__get_metadata', re.IGNORECASE),
            re.compile(r'code__create_space', re.IGNORECASE),
            re.compile(r'code__edit_space', re.IGNORECASE),
        ]
        
    def clean_dict(self, data: Any, depth: int = 0) -> Any:
        """Рекурсивно очищает данные от избыточных полей"""
        if depth > 15:
            return data
            
        if isinstance(data, dict):
            cleaned = {}
            for key, value in data.items():
                # Пропускаем исключенные поля
                if key in self.excluded_fields:
                    continue
                    
                # Проверяем, не содержит ли ключ специфичные паттерны
                if self._is_skippable_field(key):
                    continue
                    
                # Рекурсивно очищаем вложенные структуры
                if isinstance(value, dict):
                    cleaned[key] = self.clean_dict(value, depth + 1)
                elif isinstance(value, list):
                    cleaned[key] = self._clean_list(value, depth + 1)
                elif isinstance(value, str):
                    # Очищаем строки от URL и технического мусора
                    cleaned[key] = self._clean_string(value)
                else:
                    cleaned[key] = value
                    
            return cleaned
            
        elif isinstance(data, list):
            return self._clean_list(data, depth)
        else:
            return data
    
    def _clean_list(self, data: List, depth: int) -> List:
        """Очищает список от избыточных полей"""
        if not data:
            return data
            
        cleaned = []
        for item in data:
            if isinstance(item, dict):
                cleaned.append(self.clean_dict(item, depth + 1))
            elif isinstance(item, list):
                cleaned.append(self._clean_list(item, depth + 1))
            elif isinstance(item, str):
                cleaned.append(self._clean_string(item))
            else:
                cleaned.append(item)
        return cleaned
    
    def _clean_string(self, value: str) -> str:
        """Очищает строку от URL, технических маркеров и JSON-мусора"""
        if not value:
            return value

        if self._looks_like_structured_json_text(value):
            return value.strip()
            
        # Удаляем URL
        value = self.url_pattern.sub('', value)
        
        # Удаляем технические JSON-блоки
        for pattern in self.technical_patterns:
            value = pattern.sub('', value)
        
        # Удаляем технические маркеры в тексте
        for pattern in self.text_cleanup_patterns:
            value = pattern.sub('', value)
        
        # Удаляем дублирующиеся Instrumental
        value = re.sub(r'\[Instrumental\]\s*\[Instrumental\]', '[Instrumental]', value)
        
        # Удаляем множественные запятые и точки
        value = re.sub(r',\s*,', ',', value)
        value = re.sub(r'\.\s*\.', '.', value)
        
        # Удаляем лишние пробелы
        value = re.sub(r'\s+', ' ', value).strip()
        
        # Удаляем технические маркеры в начале строк
        value = re.sub(r'^[\[\]\(\)\{\}]+', '', value)
        
        # Удаляем пустые скобки
        value = re.sub(r'\(\s*\)', '', value)
        value = re.sub(r'\[\s*\]', '', value)
        value = re.sub(r'\{\s*\}', '', value)
        
        return value
    
    def _is_skippable_field(self, key: str) -> bool:
        """Проверяет, нужно ли пропустить поле по паттерну"""
        # Если поле в белом списке - сохраняем
        if key in self.allowed_fields:
            return False
            
        # Проверяем все паттерны
        technical_patterns = [
            r'^is_', r'_status$', r'_id$', r'_key$',
            r'_ref$', r'_hash$', r'_md5$', r'_ratio$',
            r'_pct$', r'_rate$', r'_score$', r'_metric$',
            r'_url$', r'Url$', r'^video_', r'_count$',
            r'_time$', r'_duration$', r'_length$', r'_size$',
            r'_weight$', r'_at$', r'_on$', r'_by$',
            r'_for$', r'_to$', r'_from$', r'_with$',
            r'^raw_', r'^textFragments', r'^linkedTrack',
            r'^quickMeta', r'^audioPath', r'^coverPath',
            r'^metaPath', r'^primaryAccountId', r'^accountId',
        ]
        
        for pattern in technical_patterns:
            if re.search(pattern, key):
                return True
                
        return False
    
    def is_stop_content(self, text: str) -> bool:
        """Проверяет, является ли текст стоп-содержимым"""
        if not text or len(text.strip()) < 5:
            return True
            
        text_clean = text.strip()
        if len(text_clean) < 24 and re.fullmatch(r'[0-9a-f-]+', text_clean, re.IGNORECASE):
            return True
        if re.fullmatch(r'[A-Za-z0-9_\-]+\.(mp3|wav|flac|jpg|jpeg|png|webp)', text_clean, re.IGNORECASE):
            return True
        
        for pattern in self.stop_patterns:
            if pattern.match(text_clean):
                return True
                
        return False
    
    def extract_meaningful_content(self, data: Any) -> Dict:
        """Извлекает только смысловой контент, удаляя избыточный"""
        if not data:
            return {}
            
        cleaned = self.clean_dict(data)
        
        # Если после очистки остались только технические поля, пытаемся найти
        # важный контент в глубине
        if not cleaned:
            if isinstance(data, dict):
                for key, value in data.items():
                    if isinstance(value, dict):
                        nested = self.extract_meaningful_content(value)
                        if nested:
                            return nested
                    elif isinstance(value, str) and len(value) > 50:
                        return {key: value}
            elif isinstance(data, str) and len(data) > 50:
                return {'content': data}
                
        return cleaned
    
    def extract_text_content(self, data: Any) -> str:
        """Извлекает чистый текст из данных"""
        if isinstance(data, str):
            return self._clean_string(data)
        elif isinstance(data, dict):
            # Ищем текстовые поля
            text_parts = []
            for key, value in data.items():
                if key in ['title', 'description', 'content', 'text', 'prompt', 'lyrics', 'chunk_text', 'sound_prompt']:
                    if isinstance(value, str):
                        text_parts.append(self._clean_string(value))
                elif isinstance(value, dict):
                    text_parts.append(self.extract_text_content(value))
                elif isinstance(value, list):
                    for item in value:
                        text_parts.append(self.extract_text_content(item))
            
            return ' '.join(filter(None, text_parts))
        elif isinstance(data, list):
            text_parts = []
            for item in data:
                text_parts.append(self.extract_text_content(item))
            return ' '.join(filter(None, text_parts))
        else:
            return str(data)
    
    def extract_sound_prompt(self, data: Any) -> Optional[str]:
        """Извлекает sound_prompt из данных"""
        if isinstance(data, dict):
            # Прямой поиск
            if 'sound_prompt' in data and data['sound_prompt']:
                return self._clean_string(data['sound_prompt'])
            
            # Поиск во вложенных структурах
            for key, value in data.items():
                if key in ['operation', 'raw_data', 'raw_track', 'payload']:
                    result = self.extract_sound_prompt(value)
                    if result:
                        return result
                elif isinstance(value, dict):
                    result = self.extract_sound_prompt(value)
                    if result:
                        return result
        elif isinstance(data, list):
            for item in data:
                result = self.extract_sound_prompt(item)
                if result:
                    return result
        
        return None
    
    def extract_lyrics(self, data: Any) -> Optional[str]:
        """Извлекает lyrics из данных"""
        if isinstance(data, dict):
            # Прямой поиск
            if 'lyrics' in data and data['lyrics']:
                lyrics = data['lyrics']
                if isinstance(lyrics, str):
                    return self._clean_string(lyrics)
                elif isinstance(lyrics, dict) and 'text' in lyrics:
                    return self._clean_string(lyrics['text'])
            
            # Поиск во вложенных структурах
            for key, value in data.items():
                if key in ['operation', 'raw_data', 'raw_track', 'payload']:
                    result = self.extract_lyrics(value)
                    if result:
                        return result
                elif isinstance(value, dict):
                    result = self.extract_lyrics(value)
                    if result:
                        return result
        elif isinstance(data, list):
            for item in data:
                result = self.extract_lyrics(item)
                if result:
                    return result
        
        return None

# =====================================================
# МАППИНГ ТАБЛИЦ
# =====================================================

TABLE_CHUNK_MAPPING = {
    'app_entity_store': {
        'content_field': 'payload',
        'content_extractor': lambda row: row.get('payload', {}),
        'tags': ['scope'],
        'title': 'entity_key',
        'description_fields': ['entity_key', 'scope']
    },
    'app_setting_store': {
        'content_field': 'value',
        'content_extractor': lambda row: row.get('value', ''),
        'tags': ['scope', 'setting_key'],
        'title': 'setting_key',
        'description_fields': ['setting_key', 'scope']
    },
    'mmss_albums': {
        'content_field': 'description',
        'content_extractor': lambda row: {
            'title': row.get('title', ''),
            'description': row.get('description', ''),
            'domain': row.get('domain', '')
        },
        'tags': ['domain'],
        'title': 'title',
        'description_fields': ['title', 'description', 'domain']
    },
    'mmss_collection': {
        'content_field': 'content',
        'content_extractor': lambda row: {
            'title': row.get('title', ''),
            'content': row.get('content', ''),
            'category': row.get('category', '')
        },
        'tags': ['category'],
        'title': 'title',
        'description_fields': ['title', 'content', 'category']
    },
    'mmss_custom_instructions': {
        'content_field': 'instruction_text',
        'content_extractor': lambda row: row.get('instruction_text', ''),
        'tags': ['category'],
        'title': 'instruction_id',
        'description_fields': ['instruction_text', 'category']
    },
    'mmss_domain_patterns': {
        'content_field': 'notes',
        'content_extractor': lambda row: {
            'display_name': row.get('display_name', ''),
            'notes': row.get('notes', ''),
            'keywords': row.get('keywords', '')
        },
        'tags': ['domain_id'],
        'title': 'display_name',
        'description_fields': ['display_name', 'notes']
    },
    'mmss_filtered': {
        'content_field': 'generation_insights',
        'content_extractor': lambda row: {
            'generation_insights': row.get('generation_insights', ''),
            'creative_choices': row.get('creative_choices', ''),
            'emergence_moments': row.get('emergence_moments', ''),
            'operator_trajectory': row.get('operator_trajectory', '')
        },
        'tags': ['domain', 'stability_flag'],
        'title': 'filtered_id',
        'description_fields': ['generation_insights', 'creative_choices', 'emergence_moments']
    },
    'mmss_invariants': {
        'content_field': 'source_text',
        'content_extractor': lambda row: row.get('source_text', ''),
        'tags': ['domain'],
        'title': 'source_title',
        'description_fields': ['source_text', 'domain']
    },
    'mmss_tracks_prompts': {
        'content_field': 'prompt_text',
        'content_extractor': lambda row: row.get('prompt_text', ''),
        'tags': [],
        'title': 'track_id',
        'description_fields': ['prompt_text']
    },
    'sessions': {
        'content_field': 'ai_snapshot',
        'content_extractor': lambda row: row.get('ai_snapshot', {}),
        'tags': [],
        'title': 'title',
        'description_fields': ['title', 'payload']
    },
    'tracks': {
        'content_field': 'prompt',
        'content_extractor': lambda row: {
            'title': row.get('title', ''),
            'prompt': row.get('prompt', ''),
            'raw_data': row.get('raw_data', {}),
            'conditions': row.get('conditions', {}),
            'lyrics_timestamped': row.get('lyrics_timestamped', {}),
            'session_id': row.get('session_id', ''),
        },
        'tags': ['generation_mode'],
        'title': 'title',
        'description_fields': ['title', 'prompt']
    },
}


def should_process_table(db_name, table_name):
    allowed = SOURCE_DATABASE_TABLES.get(db_name, set())
    if table_name in EXCLUDED_SOURCE_TABLES:
        return False
    if not allowed:
        return False
    return table_name in allowed

# =====================================================
# chunkЕР С ФИЛЬТРАЦИЕЙ
# =====================================================

class RAGChunker:
    def __init__(self, db_config, cleaner=None):
        self.db_config = db_config
        self.cleaner = cleaner or DataCleaner()
        self.conn = None
        self.chunks = []
        
    def connect(self, database):
        """Connecting to DB"""
        config = self.db_config.copy()
        config['database'] = database
        self.conn = psycopg2.connect(**config)
        return self.conn
    
    def get_tables(self, conn, db_name):
        """Get user tables list"""
        cursor = conn.cursor()
        cursor.execute("""
            SELECT table_schema, table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_type = 'BASE TABLE'
              AND table_name NOT LIKE 'pg_%'
              AND table_name NOT LIKE 'information_%'
            ORDER BY table_name
        """)
        return [
            (schema, table)
            for schema, table in cursor.fetchall()
            if should_process_table(db_name, table)
        ]
    
    def get_table_columns(self, conn, schema, table):
        """Get structure """
        cursor = conn.cursor()
        cursor.execute("""
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = %s AND table_name = %s
        """, (schema, table))
        return {row[0]: row[1] for row in cursor.fetchall()}

    def _extract_prompt_text_from_part(self, part):
        content = part.get('content') if isinstance(part, dict) else None
        if isinstance(content, str):
            return content.strip()
        if isinstance(content, dict):
            for key in ('prompt', 'sound_prompt', 'text'):
                value = content.get(key)
                if isinstance(value, str) and value.strip():
                    return value.strip()
            try:
                return json.dumps(content, ensure_ascii=False)[:2000]
            except Exception:
                return str(content)[:2000]
        return ''

    def _matches_track_generation_message(self, message, track_id, track_title):
        parts = message.get('parts') if isinstance(message, dict) else None
        if not isinstance(parts, list):
            return False
        for part in parts:
            args = part.get('args') if isinstance(part, dict) and isinstance(part.get('args'), dict) else {}
            content = part.get('content') if isinstance(part, dict) and isinstance(part.get('content'), dict) else {}
            if (
                args.get('title') == track_title
                or args.get('output_title') == track_title
                or str(args.get('track_id', '')) == str(track_id)
                or str(args.get('result_clip_id', '')) == str(track_id)
                or str(content.get('track_id', '')) == str(track_id)
                or str(content.get('result_clip_id', '')) == str(track_id)
            ):
                return True
        return False

    def _extract_generation_tail(self, raw_data, track_id, track_title):
        messages = []
        if isinstance(raw_data, dict):
            snapshot = raw_data.get('session_snapshot')
            if isinstance(snapshot, dict) and isinstance(snapshot.get('messages'), list):
                messages = snapshot.get('messages') or []

        tail = {
            'operation': None,
            'user_prompt': None,
            'tool_call': None,
            'tool_result': None,
        }

        if isinstance(raw_data, dict):
            raw_track = raw_data.get('raw_track') if isinstance(raw_data.get('raw_track'), dict) else {}
            tail['operation'] = raw_track.get('operation') or raw_data.get('operation')

        match_index = -1
        for index in range(len(messages) - 1, -1, -1):
            if self._matches_track_generation_message(messages[index], track_id, track_title):
                match_index = index
                break

        if match_index == -1:
            return tail

        for index in range(match_index, -1, -1):
            message = messages[index] if isinstance(messages[index], dict) else {}
            parts = message.get('parts') if isinstance(message.get('parts'), list) else []
            for part in parts:
                if not isinstance(part, dict):
                    continue

                if tail['tool_result'] is None and message.get('kind') == 'request' and part.get('part_kind') == 'tool-return':
                    content = part.get('content') if isinstance(part.get('content'), dict) else {}
                    result_clip_id = content.get('result_clip_id') or content.get('track_id')
                    if not result_clip_id or str(result_clip_id) == str(track_id):
                        tail['tool_result'] = content

                if tail['tool_call'] is None and message.get('kind') == 'response' and part.get('part_kind') == 'tool-call':
                    args = part.get('args') if isinstance(part.get('args'), dict) else {}
                    if (
                        args.get('title') == track_title
                        or args.get('output_title') == track_title
                        or str(args.get('track_id', '')) == str(track_id)
                        or part.get('tool_name') in ('audio__create_song', 'audio__apply_effect')
                    ):
                        tail['tool_call'] = {
                            'tool_name': part.get('tool_name'),
                            'args': args,
                        }

                if tail['user_prompt'] is None and message.get('kind') == 'request' and part.get('part_kind') == 'user-prompt':
                    prompt_text = self._extract_prompt_text_from_part(part)
                    if prompt_text and prompt_text != '<ui-hidden>Conversation started</ui-hidden>':
                        tail['user_prompt'] = prompt_text

            if tail['user_prompt'] and tail['tool_call'] and tail['tool_result']:
                break

        return tail

    def _compact_filtered_entry(self, row):
        return {
            'filtered_id': row.get('filtered_id'),
            'source_ref': row.get('source_ref'),
            'generation_insights': row.get('generation_insights'),
            'operator_trajectory': row.get('operator_trajectory'),
            'temporal_phases': row.get('temporal_phases'),
            'metric_v': row.get('metric_v'),
            'metric_s': row.get('metric_s'),
            'metric_d_f': row.get('metric_d_f'),
            'metric_r_t': row.get('metric_r_t'),
            'creative_choices': row.get('creative_choices'),
            'emergence_moments': row.get('emergence_moments'),
            'next_vector_suggestions': row.get('next_vector_suggestions'),
            'domain': row.get('domain'),
            'recursive_depth': row.get('recursive_depth'),
            'stability_flag': row.get('stability_flag'),
            'raw_payload': row.get('raw_payload'),
        }

    def _compact_collection_entry(self, row):
        return {
            'entry_id': row.get('entry_id'),
            'category': row.get('category'),
            'title': row.get('title'),
            'content': row.get('content'),
            'source_ref': row.get('source_ref'),
            'score': row.get('score'),
            'payload': row.get('payload'),
        }

    def _resolve_track_prompt_text(self, row, generation_tail):
        direct_prompt = self.cleaner._clean_string(str(row.get('prompt') or ''))
        if direct_prompt:
            return direct_prompt

        if isinstance(generation_tail, dict):
            user_prompt = self.cleaner._clean_string(str(generation_tail.get('user_prompt') or ''))
            if user_prompt:
                return user_prompt

            operation = generation_tail.get('operation') if isinstance(generation_tail.get('operation'), dict) else {}
            for key in ('prompt', 'sound_prompt', 'text'):
                value = self.cleaner._clean_string(str(operation.get(key) or ''))
                if value:
                    return value

            tool_call = generation_tail.get('tool_call') if isinstance(generation_tail.get('tool_call'), dict) else {}
            args = tool_call.get('args') if isinstance(tool_call.get('args'), dict) else {}
            for key in ('prompt', 'sound_prompt', 'title', 'output_title'):
                value = self.cleaner._clean_string(str(args.get(key) or ''))
                if value:
                    return value

        return ''

    def _load_track_related_context(self, conn, schema, track_ids):
        normalized_ids = [str(track_id) for track_id in track_ids if track_id]
        context = {track_id: {'filtered': [], 'collection': []} for track_id in normalized_ids}
        if not normalized_ids:
            return context

        cursor = conn.cursor()
        cursor.execute(
            f"""
            SELECT *
            FROM {schema}.mmss_filtered
            WHERE track_id::text = ANY(%s)
            ORDER BY updated_at DESC NULLS LAST, id DESC
            """,
            (normalized_ids,)
        )
        filtered_columns = [desc[0] for desc in cursor.description]
        for values in cursor.fetchall():
            row = dict(zip(filtered_columns, values))
            key = str(row.get('track_id', ''))
            if key in context:
                context[key]['filtered'].append(row)

        cursor.execute(
            f"""
            SELECT *
            FROM {schema}.mmss_collection
            WHERE payload->>'track_id' = ANY(%s)
            ORDER BY updated_at DESC NULLS LAST, id DESC
            """,
            (normalized_ids,)
        )
        collection_columns = [desc[0] for desc in cursor.description]
        for values in cursor.fetchall():
            row = dict(zip(collection_columns, values))
            payload = row.get('payload') if isinstance(row.get('payload'), dict) else {}
            key = str(payload.get('track_id', ''))
            if key in context:
                context[key]['collection'].append(row)

        return context

    def _build_track_chunk_payload(self, row, related_context):
        return {
            'track': {
                'id': row.get('id'),
                'title': row.get('title'),
                'prompt': row.get('prompt'),
                'session_id': row.get('session_id'),
                'conditions': row.get('conditions'),
                'lyrics_timestamped': row.get('lyrics_timestamped'),
            },
            'generation_tail': self._extract_generation_tail(
                row.get('raw_data') if isinstance(row.get('raw_data'), dict) else {},
                row.get('id'),
                row.get('title'),
            ),
            'filtered': [
                self._compact_filtered_entry(entry)
                for entry in (related_context or {}).get('filtered', [])
            ],
            'collection': [
                self._compact_collection_entry(entry)
                for entry in (related_context or {}).get('collection', [])
            ],
        }

    def _extract_track_chunk(self, row, db_name, related_context=None):
        payload = self._build_track_chunk_payload(row, related_context or {})
        prompt_text = self._resolve_track_prompt_text(row, payload.get('generation_tail') or {})
        chunk_text = json.dumps(payload, ensure_ascii=False, indent=2)
        title = self.cleaner._clean_string(str(row.get('title') or ''))[:900]
        description = self.cleaner._clean_string(' '.join([title, prompt_text]).strip())[:2500]

        if not title and not prompt_text:
            return None

        return {
            'chunk_text': chunk_text,
            'source_table': 'tracks',
            'source_id': str(row.get('id', '')),
            'source_database': db_name,
            'tags': [str(row.get('generation_mode'))] if row.get('generation_mode') else [],
            'category': str(row.get('category', row.get('domain', ''))),
            'domain': str(row.get('domain', row.get('category', ''))),
            'title': title or prompt_text[:200],
            'description': description or prompt_text[:600],
            'prompt_text': prompt_text or None,
            'chunk_hash': hashlib.md5(chunk_text.encode('utf-8')).hexdigest()
        }
    
    def process_table(self, conn, schema, table, db_name):
        """Proceed one table and create chunks"""
        logger.info(f"  Processing with : {table}")
        if not should_process_table(db_name, table):
            logger.info(f"    Skipping excluded table: {table}")
            return []

        if table not in TABLE_CHUNK_MAPPING:
            logger.warning(f"No mappings in table {table}, пропускаем")
            return []
        
        mapping = TABLE_CHUNK_MAPPING[table]
        
        cursor = conn.cursor()
        cursor.execute(f"SELECT * FROM {schema}.{table}")
        columns = [desc[0] for desc in cursor.description]
        rows = cursor.fetchall()
        
        chunks = []
        row_count = 0
        related_context = {}
        if table == 'tracks':
            track_ids = [dict(zip(columns, row)).get('id') for row in rows]
            related_context = self._load_track_related_context(conn, schema, track_ids)
        
        for row in rows:
            row_count += 1
            row_dict = dict(zip(columns, row))
            chunk = self.extract_chunk(
                row_dict,
                table,
                db_name,
                mapping,
                related_context.get(str(row_dict.get('id', ''))) if table == 'tracks' else None
            )
            if chunk:
                chunks.append(chunk)
        
        logger.info(f"    Strings completed: {row_count}, created chunks: {len(chunks)}")
        return chunks
    
    def extract_chunk(self, row, table_name, db_name, mapping, related_context=None):
        """Get chunk from string of table with cleaning tables"""
        try:
            if table_name == 'tracks':
                return self._extract_track_chunk(row, db_name, related_context)

            if callable(mapping['content_extractor']):
                raw_content = mapping['content_extractor'](row)
            else:
                raw_content = row.get(mapping['content_field'], '')
            
            cleaned_content = self.cleaner.clean_dict(raw_content)
            
            content_text = self.cleaner.extract_text_content(cleaned_content)
            
            # Если текста мало, пытаемся извлечь sound_prompt или lyrics
            if not content_text or len(content_text.strip()) < 3:
                sound_prompt = self.cleaner.extract_sound_prompt(raw_content)
                if sound_prompt:
                    content_text = sound_prompt
                else:
                    lyrics = self.cleaner.extract_lyrics(raw_content)
                    if lyrics:
                        content_text = lyrics
            
            if not content_text or len(content_text.strip()) < 10:
                return None
            
            content_text = self.cleaner._clean_string(content_text)
            
            # Проверяем, не является ли содержимое стоп-содержимым
            if self.cleaner.is_stop_content(content_text):
                return None
            
            # Формируем описание
            description_fields = mapping.get('description_fields', [])
            description_parts = []
            
            for field in description_fields:
                if field in row and row[field]:
                    value = row[field]
                    if isinstance(value, dict):
                        desc_text = self.cleaner.extract_text_content(value)
                        if desc_text:
                            description_parts.append(desc_text)
                    elif isinstance(value, str):
                        description_parts.append(self.cleaner._clean_string(value))
            
            description = ' '.join(description_parts) if description_parts else content_text[:600]
            description = self.cleaner._clean_string(description)
            
            # Проверяем описание
            if self.cleaner.is_stop_content(description):
                description = content_text[:1000]
                description = self.cleaner._clean_string(description)
            
            # Извлекаем теги
            tags = []
            for tag_field in mapping.get('tags', []):
                if tag_field in row and row[tag_field]:
                    tag_value = str(row[tag_field])
                    if tag_value and tag_value not in ['None', 'NULL', '']:
                        tags.append(tag_value)
            
            # Извлекаем заголовок
            title = ''
            title_field = mapping.get('title', '')
            if title_field and title_field in row:
                title = str(row[title_field])
            elif 'title' in row:
                title = str(row['title'])
            
            title = self.cleaner._clean_string(title)
            
            # Проверяем заголовок
            if self.cleaner.is_stop_content(title):
                title = content_text[:200]
                title = self.cleaner._clean_string(title)
            
            # Формируем chunk
            return {
                'chunk_text': content_text,
                'source_table': table_name,
                'source_id': str(row.get('id', row.get('filtered_id', row.get('track_id', '')))),
                'source_database': db_name,
                'tags': tags,
                'category': str(row.get('category', row.get('domain', ''))),
                'domain': str(row.get('domain', row.get('category', ''))),
                'title': title[:900],
                'description': description[:2500],
                'prompt_text': self.cleaner._clean_string(str(row.get('prompt_text', row.get('prompt', ''))))[:5000] or None,
                'chunk_hash': hashlib.md5(content_text.encode('utf-8')).hexdigest()
            }
            
        except Exception as e:
            logger.error(f"   ERROR extracting chunk from {table_name}: {e}")
            return None
    
    def save_chunks_to_db(self, chunks, target_db_config):
        """save chunks in target DB"""
        if not chunks:
            return
        
        logger.info(f"\n saving {len(chunks)} chunks in database...")
        
        try:
            conn = psycopg2.connect(**target_db_config)
            cursor = conn.cursor()
            
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS rag_chunks (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    chunk_text TEXT NOT NULL,
                    source_table TEXT NOT NULL,
                    source_id TEXT NOT NULL,
                    source_database TEXT NOT NULL,
                    tags TEXT[] DEFAULT '{}',
                    category TEXT,
                    domain TEXT,
                    title TEXT,
                    description TEXT,
                    prompt_text TEXT,
                    chunk_hash TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            """)
            cursor.execute("ALTER TABLE rag_chunks ADD COLUMN IF NOT EXISTS prompt_text TEXT")
            
            # Создаем индексы
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_rag_chunks_source_table ON rag_chunks(source_table);
                CREATE INDEX IF NOT EXISTS idx_rag_chunks_source_database ON rag_chunks(source_database);
                CREATE INDEX IF NOT EXISTS idx_rag_chunks_category ON rag_chunks(category);
                CREATE INDEX IF NOT EXISTS idx_rag_chunks_domain ON rag_chunks(domain);
                CREATE INDEX IF NOT EXISTS idx_rag_chunks_chunk_hash ON rag_chunks(chunk_hash);
            """)
            cursor.execute("""
                CREATE UNIQUE INDEX IF NOT EXISTS idx_rag_chunks_source_unique
                ON rag_chunks(source_database, source_table, source_id, chunk_hash)
            """)
            cursor.execute("TRUNCATE TABLE rag_chunks")
            
            # Вставляем данные
            inserted_count = 0
            seen_keys = set()
            for chunk in chunks:
                try:
                    if chunk['source_table'] in EXCLUDED_SOURCE_TABLES:
                        continue
                    dedupe_key = (
                        chunk['source_database'],
                        chunk['source_table'],
                        chunk['source_id'],
                        chunk['chunk_hash']
                    )
                    if dedupe_key in seen_keys:
                        continue
                    seen_keys.add(dedupe_key)
                    cursor.execute("""
                        INSERT INTO rag_chunks (
                            chunk_text, source_table, source_id, source_database,
                            tags, category, domain, title, description, prompt_text, chunk_hash
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (source_database, source_table, source_id, chunk_hash) DO NOTHING
                    """, (
                        chunk['chunk_text'],
                        chunk['source_table'],
                        chunk['source_id'],
                        chunk['source_database'],
                        chunk['tags'],
                        chunk['category'],
                        chunk['domain'],
                        chunk['title'],
                        chunk['description'],
                        chunk.get('prompt_text'),
                        chunk['chunk_hash']
                    ))
                    inserted_count += 1
                except Exception as e:
                    logger.error(f" ERROR inserting chunk: {e}")
                    continue
            
            conn.commit()
            cursor.close()
            conn.close()
            
            logger.info(f"COMPLETED {inserted_count} from {len(chunks)} chunks")
            
        except Exception as e:
            logger.error(f"  ERROR while saving chunks: {e}")
    
    def run(self, target_db_config, limit_per_table=None):
        """Start creating chunks"""
        all_chunks = []
        total_tables = 0
        total_chunks = 0
        
        for db_name in DATABASES:
            logger.info(f"\n Refreshing base: {db_name}")
            logger.info("-" * 40)
            
            try:
                conn = self.connect(db_name)
                tables = self.get_tables(conn, db_name)
                table_count = len(tables)
                total_tables += table_count
                
                logger.info(f"Found: {table_count}")
                
                for schema, table in tables:
                    chunks = self.process_table(conn, schema, table, db_name)
                    all_chunks.extend(chunks)
                    total_chunks += len(chunks)
                    
                    if limit_per_table and len(chunks) >= limit_per_table:
                        logger.info(f"    ⏸️ Limits! in  {table}")
                
                conn.close()
                logger.info(f"Database  {db_name} processed, chunks created: {len(all_chunks)}")
                
            except Exception as e:
                logger.error(f"❌ ERROR connecting to {db_name}: {e}")
                continue
        
        logger.info("\n" + "="*60)
        logger.info(f"📊 SUMMARY:")
        logger.info(f"  - processed Databases: {len(DATABASES)}")
        logger.info(f"  - processed tables: {total_tables}")
        logger.info(f"  - Chunks created: {total_chunks}")
        logger.info("="*60)
        
        if all_chunks:
            self.save_chunks_to_db(all_chunks, target_db_config)
            
            # Статистика по источникам
            source_stats = {}
            for chunk in all_chunks:
                key = f"{chunk['source_database']}.{chunk['source_table']}"
                source_stats[key] = source_stats.get(key, 0) + 1
            
            logger.info("\n📊 Source statistics:")
            for source, count in sorted(source_stats.items(), key=lambda x: -x[1])[:10]:
                logger.info(f"  - {source}: {count} chunkов")
            
            # Пример очищенного chunk
            if all_chunks:
                sample = all_chunks[0]
                logger.info("\n📝 Sample of chunk:")
                logger.info(f"  Title: {sample['title'][:300]}...")
                logger.info(f"  Text: {sample['chunk_text'][:700]}...")
            
        else:
            logger.warning("\n chunks are not created!")


def test_cleaner():
    """Tester of cleaning"""
    cleaner = DataCleaner()
    
    test_data = {
        'title': 'Test Track',
        'description': 'This is a test track with audio_url: https://example.com/audio.mp3',
        'audio_url': 'https://example.com/audio.mp3',
        'image_url': 'https://example.com/image.jpg',
        'play_count': 100,
        'is_favorite': False,
        'created_at': '2024-01-01T00:00:00Z',
        'metadata': {
            'tool_name': 'audio__create_song',
            'tool_call_id': 'abc123',
            'usage': {
                'input_tokens': 100,
                'output_tokens': 200
            },
            'sound_prompt': 'Deep ambient with heavy sub-bass'
        },
        'raw_track': {
            'id': '123',
            'audio_url': 'https://storage.googleapis.com/audio.mp3',
            'play_count': 50,
            'operation': {
                'sound_prompt': 'Industrial metal, 158 BPM, aggressive vocals'
            }
        }
    }
    
    print("="*60)
    print("Cleaner Test")
    print("="*60)
    
    print("\nSource Raw data:")
    print(json.dumps(test_data, indent=2, ensure_ascii=False))
    
    cleaned = cleaner.clean_dict(test_data)
    
    print("\nErased data:")
    print(json.dumps(cleaned, indent=2, ensure_ascii=False))
    
    text_content = cleaner.extract_text_content(cleaned)
    print(f"\n Extractedc text:\n{text_content}")
    
    sound_prompt = cleaner.extract_sound_prompt(test_data)
    print(f"\nИExtracted sounbd promt:\n{sound_prompt}")
    
    print("\n" + "="*60)

# ЗАПУСК


if __name__ == "__main__":
    TARGET_DB_CONFIG = {
        'host': 'localhost',
        'port': 5432,
        'user': 'mind_user',
        'password': 'mindfreak',
        'database': 'abstract-mind-lab'
    }
    
    # Тестируем очистку
    #test_cleaner()
    
    # Запускаем основной процесс
    cleaner = DataCleaner()
    chunker = RAGChunker(DB_CONFIG, cleaner)
    chunker.run(TARGET_DB_CONFIG)
