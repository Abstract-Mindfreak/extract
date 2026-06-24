import psycopg2
import pandas as pd
import os
import json
from datetime import datetime
import hashlib

# =====================================================
# НАСТРОЙКИ ПОДКЛЮЧЕНИЯ
# =====================================================
DB_CONFIG = {
    'host': 'localhost',        # Ваш хост
    'port': 5432,               # Порт PostgreSQL
    'user': 'mind_user',         # Ваше имя пользователя
    'password': 'mindfreak' # Ваш пароль
}

# Базы данных
DATABASES = ['rag_chunks_db']

# Параметры файла
OUTPUT_FILE = 'exported_data_cards-rag_chunks.html'
MAX_FILE_SIZE_KB = 4600
MAX_RETRIES = 5

# =====================================================
# ФУНКЦИИ
# =====================================================

def get_tables(conn):
    """Получить список всех таблиц в схеме public"""
    query = """
        SELECT table_schema, table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
        ORDER BY table_name
    """
    return pd.read_sql(query, conn)

def get_random_rows(conn, schema, table, limit=40):
    """Получить 5 случайных записей из таблицы"""
    query = f"""
        SELECT * 
        FROM {schema}.{table} 
        ORDER BY RANDOM() 
        LIMIT {limit}
    """
    try:
        df = pd.read_sql(query, conn)
        return df
    except Exception as e:
        print(f"  ⚠️ Ошибка в таблице {table}: {e}")
        return pd.DataFrame()

def dict_to_html_card(data_dict, table_name, db_name, card_id):
    """Преобразовать запись в HTML карточку (без обрезания данных)"""
    
    safe_id = hashlib.md5(f"{db_name}_{table_name}_{card_id}".encode()).hexdigest()[:8]
    
    html = f"""
    <div class="card" id="card-{safe_id}">
        <div class="card-header">
            <span class="card-badge">{db_name}</span>
            <span class="card-table">{table_name}</span>
            <span class="card-id">#{card_id}</span>
        </div>
        <div class="card-body">
            <table class="card-table-data">
    """
    
    for key, value in data_dict.items():
        # Обрабатываем разные типы данных - НЕ ОБРЕЗАЕМ!
        if isinstance(value, (dict, list)):
            # Преобразуем в JSON строку без обрезания
            value_str = json.dumps(value, ensure_ascii=False)
        elif value is None:
            value_str = 'NULL'
        else:
            # Преобразуем в строку без обрезания
            value_str = str(value)
        
        # Экранируем HTML специальные символы для безопасного отображения
        value_str = value_str.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
        
        html += f"""
            <tr>
                <td class="card-key">{key}</td>
                <td class="card-value">{value_str}</td>
            </tr>
        """
    
    html += """
            </table>
        </div>
    </div>
    """
    return html

def generate_html(all_data, total_records):
    """Сгенерировать полный HTML документ с карточками"""
    
    html_template = f"""<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Экспорт данных из PostgreSQL</title>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            background: #f0f2f5;
            padding: 20px;
        }}
        
        .container {{
            max-width: 1400px;
            margin: 0 auto;
        }}
        
        .header {{
            background: white;
            padding: 20px;
            border-radius: 12px;
            margin-bottom: 30px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }}
        
        .header h1 {{
            color: #1a1a2e;
            font-size: 28px;
            margin-bottom: 10px;
        }}
        
        .header .stats {{
            color: #666;
            font-size: 14px;
        }}
        
        .header .stats span {{
            background: #e8f0fe;
            padding: 4px 12px;
            border-radius: 20px;
            margin-right: 10px;
        }}
        
        .grid {{
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
            gap: 20px;
        }}
        
        .card {{
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            transition: transform 0.2s, box-shadow 0.2s;
            display: flex;
            flex-direction: column;
        }}
        
        .card:hover {{
            transform: translateY(-4px);
            box-shadow: 0 8px 24px rgba(0,0,0,0.12);
        }}
        
        .card-header {{
            padding: 12px 16px;
            background: #f8f9fa;
            border-bottom: 1px solid #e9ecef;
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            align-items: center;
        }}
        
        .card-badge {{
            background: #4a90d9;
            color: white;
            padding: 2px 10px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 600;
        }}
        
        .card-table {{
            background: #e9ecef;
            color: #495057;
            padding: 2px 10px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 500;
        }}
        
        .card-id {{
            color: #868e96;
            font-size: 11px;
            margin-left: auto;
        }}
        
        .card-body {{
            padding: 12px 16px;
            overflow: auto;
            flex: 1;
        }}
        
        .card-table-data {{
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
        }}
        
        .card-table-data tr {{
            border-bottom: 1px solid #f1f3f5;
        }}
        
        .card-table-data tr:last-child {{
            border-bottom: none;
        }}
        
        .card-key {{
            color: #495057;
            font-weight: 500;
            padding: 6px 8px 6px 0;
            width: 35%;
            vertical-align: top;
            word-break: break-word;
        }}
        
        .card-value {{
            color: #212529;
            padding: 6px 0 6px 8px;
            width: 65%;
            vertical-align: top;
            word-break: break-word;
            font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', monospace;
            font-size: 12px;
            white-space: pre-wrap;
        }}
        
        .footer {{
            text-align: center;
            padding: 30px 0 10px;
            color: #868e96;
            font-size: 13px;
        }}
        
        @media (max-width: 768px) {{
            .grid {{
                grid-template-columns: 1fr;
            }}
            
            .header h1 {{
                font-size: 20px;
            }}
        }}
        
        /* Стиль для длинных JSON данных */
        .card-value {{
            max-height: 300px;
            overflow-y: auto;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 Экспорт данных из PostgreSQL</h1>
            <div class="stats">
                <span>📝 Всего записей: {total_records}</span>
                <span>📁 Базы данных: {', '.join(DATABASES)}</span>
                <span>🕐 Создано: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</span>
            </div>
        </div>
        <div class="grid">
    """
    
    # Добавляем все карточки
    for record in all_data:
        html_template += dict_to_html_card(
            record['data'],
            record['table_name'],
            record['database_name'],
            record['record_id']
        )
    
    html_template += f"""
        </div>
        <div class="footer">
            Generated by PostgreSQL Export Tool | {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
        </div>
    </div>
</body>
</html>
    """
    
    return html_template

def get_file_size_kb(filepath):
    """Получить размер файла в КБ"""
    if os.path.exists(filepath):
        return os.path.getsize(filepath) / 1024
    return 0

def save_html_file(content, filepath):
    """Сохранить HTML файл"""
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

# =====================================================
# ОСНОВНАЯ ЛОГИКА
# =====================================================

def main():
    print("=" * 70)
    print("🚀 ЭКСПОРТ ДАННЫХ В HTML С КАРТОЧКАМИ")
    print("=" * 70)
    print(f"📁 Выходной файл: {OUTPUT_FILE}")
    print(f"📏 Максимальный размер: {MAX_FILE_SIZE_KB} КБ")
    print(f"🔄 Максимум попыток: {MAX_RETRIES}")
    print("=" * 70)
    
    all_records = []
    attempt = 0
    
    while attempt < MAX_RETRIES:
        attempt += 1
        print(f"\n🔄 Попытка {attempt}/{MAX_RETRIES}")
        print("-" * 40)
        
        all_records = []
        total_tables = 0
        total_records = 0
        empty_tables = []
        
        for db_name in DATABASES:
            print(f"\n📁 Обработка базы: {db_name}")
            
            try:
                conn = psycopg2.connect(database=db_name, **DB_CONFIG)
                tables_df = get_tables(conn)
                
                for _, row in tables_df.iterrows():
                    schema = row['table_schema']
                    table = row['table_name']
                    
                    print(f"  📊 {table}")
                    df = get_random_rows(conn, schema, table)
                    
                    if df.empty:
                        empty_tables.append(f"{db_name}.{table}")
                        continue
                    
                    for idx, record in df.iterrows():
                        record_dict = record.to_dict()
                        all_records.append({
                            'database_name': db_name,
                            'table_name': table,
                            'record_id': idx + 1,
                            'data': record_dict
                        })
                    
                    total_tables += 1
                    total_records += len(df)
                
                conn.close()
                print(f"  ✅ База {db_name} обработана")
                
            except Exception as e:
                print(f"  ❌ Ошибка {db_name}: {e}")
                continue
        
        print(f"\n📝 Генерация HTML...")
        html_content = generate_html(all_records, total_records)
        save_html_file(html_content, OUTPUT_FILE)
        
        file_size = get_file_size_kb(OUTPUT_FILE)
        print(f"📏 Размер файла: {file_size:.2f} КБ")
        
        if file_size <= MAX_FILE_SIZE_KB:
            print(f"✅ Файл успешно создан! Размер {file_size:.2f} КБ (меньше {MAX_FILE_SIZE_KB} КБ)")
            break
        else:
            print(f"⚠️ Файл слишком большой: {file_size:.2f} КБ > {MAX_FILE_SIZE_KB} КБ")
            if attempt < MAX_RETRIES:
                print("🔄 Будет выполнена повторная генерация с новыми случайными данными...")
            else:
                print("❌ Достигнуто максимальное количество попыток")
    
    print("\n" + "=" * 70)
    print("📊 ИТОГОВАЯ СТАТИСТИКА")
    print("=" * 70)
    print(f"✅ Обработано таблиц: {total_tables}")
    print(f"📝 Всего записей: {total_records}")
    
    if empty_tables:
        print(f"⚠️ Пустых таблиц: {len(empty_tables)}")
        for t in empty_tables[:5]:
            print(f"   - {t}")
        if len(empty_tables) > 5:
            print(f"   ... и еще {len(empty_tables) - 5}")
    
    file_size = get_file_size_kb(OUTPUT_FILE)
    print(f"\n📂 Файл: {OUTPUT_FILE}")
    print(f"📏 Размер: {file_size:.2f} КБ")
    print(f"🔄 Попыток: {attempt}")
    print("=" * 70)

if __name__ == "__main__":
    main()