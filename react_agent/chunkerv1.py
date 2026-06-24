import psycopg2
import json
import hashlib
from datetime import datetime
from typing import Dict, List, Any

# =====================================================
# НАСТРОЙКИ ПОДКЛЮЧЕНИЯ
# =====================================================
DB_CONFIG = {
    'host': 'localhost',        # Ваш хост
    'port': 5432,               # Порт PostgreSQL
    'user': 'mind_user',         # Ваше имя пользователя
    'password': 'mindfreak' # Ваш пароль
}

DATABASES = ['abstract-mind-lab', 'abstract_mind_db']

# Определяем поля для извлечения контента из каждой таблицы
TABLE_CHUNK_MAPPING = {
    'app_entity_store': {
        'content_field': 'payload',  # JSON поле
        'content_extractor': lambda row: json.dumps(row['payload']),
        'tags': ['scope'],
        'title': 'entity_key'
    },
    'app_setting_store': {
        'content_field': 'value',
        'content_extractor': lambda row: str(row['value']),
        'tags': ['scope', 'setting_key'],
        'title': 'setting_key'
    },
    'applied_flows': {
        'content_field': 'flow_name',
        'content_extractor': lambda row: str(row['flow_name']),
        'tags': [],
        'title': 'flow_name'
    },
    'applied_memories': {
        'content_field': 'memory_text',
        'content_extractor': lambda row: str(row['memory_text']),
        'tags': [],
        'title': 'memory_text'
    },
    'mmss_albums': {
        'content_field': 'description',
        'content_extractor': lambda row: f"{row['title']}\n{row['description']}\nDomain: {row['domain']}",
        'tags': ['domain'],
        'title': 'title'
    },
    'mmss_collection': {
        'content_field': 'content',
        'content_extractor': lambda row: f"{row['title']}\n{row['content']}\nCategory: {row['category']}",
        'tags': ['category'],
        'title': 'title'
    },
    'mmss_custom_instructions': {
        'content_field': 'instruction_text',
        'content_extractor': lambda row: str(row['instruction_text']),
        'tags': ['category'],
        'title': 'instruction_id'
    },
    'mmss_domain_patterns': {
        'content_field': 'notes',
        'content_extractor': lambda row: f"{row['display_name']}\n{row['notes']}\nKeywords: {row['keywords']}",
        'tags': ['domain_id'],
        'title': 'display_name'
    },
    'mmss_filtered': {
        'content_field': 'generation_insights',
        'content_extractor': lambda row: ' '.join(filter(None, [
            str(row['generation_insights']),
            str(row['creative_choices']),
            str(row['emergence_moments']),
            str(row['operator_trajectory'])
        ])),
        'tags': ['domain', 'stability_flag'],
        'title': 'filtered_id'
    },
    'mmss_invariants': {
        'content_field': 'source_text',
        'content_extractor': lambda row: str(row['source_text']),
        'tags': ['domain'],
        'title': 'source_title'
    },
    'mmss_tracks_prompts': {
        'content_field': 'prompt_text',
        'content_extractor': lambda row: str(row['prompt_text']),
        'tags': [],
        'title': 'track_id'
    },
    'sessions': {
        'content_field': 'ai_snapshot',
        'content_extractor': lambda row: json.dumps(row['ai_snapshot']),
        'tags': [],
        'title': 'title'
    },
    'tracks': {
        'content_field': 'prompt',
        'content_extractor': lambda row: f"{row['title']}\n{row['prompt']}",
        'tags': ['generation_mode'],
        'title': 'title'
    },
}

# =====================================================
# ЧАНКЕР
# =====================================================

class RAGChunker:
    def __init__(self, db_config):
        self.db_config = db_config
        self.conn = None
        
    def connect(self, database):
        """Подключение к базе данных"""
        self.conn = psycopg2.connect(database=database, **self.db_config)
        return self.conn
    
    def get_tables(self, conn):
        """Получить список пользовательских таблиц"""
        cursor = conn.cursor()
        cursor.execute("""
            SELECT table_schema, table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_type = 'BASE TABLE'
            ORDER BY table_name
        """)
        return cursor.fetchall()
    
    def get_table_columns(self, conn, schema, table):
        """Получить структуру таблицы"""
        cursor = conn.cursor()
        cursor.execute("""
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = %s AND table_name = %s
        """, (schema, table))
        return {row[0]: row[1] for row in cursor.fetchall()}
    
    def extract_chunk(self, row, table_name, db_name, mapping):
        """Извлечь чанк из строки таблицы"""
        try:
            # Извлекаем основной контент
            if callable(mapping['content_extractor']):
                content = mapping['content_extractor'](row)
            else:
                content = str(row.get(mapping['content_field'], ''))
            
            if not content or len(content.strip()) < 10:
                return None
            
            # Извлекаем теги
            tags = []
            for tag_field in mapping.get('tags', []):
                if tag_field in row and row[tag_field]:
                    tags.append(str(row[tag_field]))
            
            # Извлекаем заголовок
            title = str(row.get(mapping.get('title', ''), ''))
            
            return {
                'chunk_text': content,
                'source_table': table_name,
                'source_id': str(row.get('id', row.get('track_id', row.get('filtered_id', '')))),
                'source_database': db_name,
                'tags': tags,
                'category': row.get('category', row.get('domain', '')),
                'domain': row.get('domain', row.get('category', '')),
                'title': title,
                'description': content[:2200] if len(content) > 2200 else content,
                'chunk_hash': hashlib.md5(content.encode()).hexdigest()
            }
        except Exception as e:
            print(f"  ⚠️ Ошибка при извлечении чанка из {table_name}: {e}")
            return None
    
    def process_table(self, conn, schema, table, db_name):
        """Обработать одну таблицу и создать чанки"""
        print(f"  📊 Обработка таблицы: {table}")
        
        if table not in TABLE_CHUNK_MAPPING:
            print(f"    ⚠️ Нет маппинга для таблицы {table}, пропускаем")
            return []
        
        mapping = TABLE_CHUNK_MAPPING[table]
        
        # Получаем все строки из таблицы
        cursor = conn.cursor()
        cursor.execute(f"SELECT * FROM {schema}.{table} LIMIT 500")  # Ограничение для теста
        columns = [desc[0] for desc in cursor.description]
        
        chunks = []
        for row in cursor.fetchall():
            row_dict = dict(zip(columns, row))
            chunk = self.extract_chunk(row_dict, table, db_name, mapping)
            if chunk:
                chunks.append(chunk)
        
        print(f"    ✅ Создано чанков: {len(chunks)}")
        return chunks
    
    def save_chunks_to_db(self, chunks, target_db_config):
        """Сохранить чанки в целевую базу данных"""
        if not chunks:
            return
        
        try:
            conn = psycopg2.connect(**target_db_config)
            cursor = conn.cursor()
            
            # Создаем таблицу если не существует
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS rag_chunks (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    chunk_text TEXT NOT NULL,
                    source_table TEXT NOT NULL,
                    source_id TEXT NOT NULL,
                    source_database TEXT NOT NULL,
                    tags TEXT[],
                    category TEXT,
                    domain TEXT,
                    title TEXT,
                    description TEXT,
                    chunk_hash TEXT,
                    created_at TIMESTAMP DEFAULT NOW()
                )
            """)
            
            # Вставляем чанки
            for chunk in chunks:
                cursor.execute("""
                    INSERT INTO rag_chunks (
                        chunk_text, source_table, source_id, source_database,
                        tags, category, domain, title, description, chunk_hash
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
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
                    chunk['chunk_hash']
                ))
            
            conn.commit()
            cursor.close()
            conn.close()
            print(f"  ✅ Сохранено {len(chunks)} чанков в RAG базу")
            
        except Exception as e:
            print(f"  ❌ Ошибка при сохранении чанков: {e}")
    
    def run(self, target_db_config):
        """Запустить процесс создания чанков"""
        all_chunks = []
        
        for db_name in DATABASES:
            print(f"\n📁 Обработка базы: {db_name}")
            print("-" * 40)
            
            try:
                conn = self.connect(db_name)
                tables = self.get_tables(conn)
                
                for schema, table in tables:
                    chunks = self.process_table(conn, schema, table, db_name)
                    all_chunks.extend(chunks)
                
                conn.close()
                print(f"✅ База {db_name} обработана")
                
            except Exception as e:
                print(f"❌ Ошибка при подключении к {db_name}: {e}")
                continue
        
        # Сохраняем все чанки в целевую базу
        if all_chunks:
            print(f"\n📝 Всего создано чанков: {len(all_chunks)}")
            self.save_chunks_to_db(all_chunks, target_db_config)
        else:
            print("\n⚠️ Чанки не созданы")

# =====================================================
# ЗАПУСК
# =====================================================

if __name__ == "__main__":
    # Конфигурация целевой базы данных для хранения чанков
    TARGET_DB_CONFIG = {
        'host': 'localhost',
        'port': 5432,
        'user': 'mind_user',
        'password': 'mindfreak',
        'database': 'rag_chunks_db'  # Отдельная база для чанков
    }
    
    chunker = RAGChunker(DB_CONFIG)
    chunker.run(TARGET_DB_CONFIG)