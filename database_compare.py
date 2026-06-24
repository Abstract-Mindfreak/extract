import psycopg2
import pandas as pd
import json
import hashlib
from datetime import datetime
from typing import Dict, List, Any, Tuple
import re
import sys
import io

# Set UTF-8 encoding for Windows console
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# =====================================================
# КОНФИГУРАЦИЯ
# =====================================================
DB_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'user': 'mind_user',
    'password': 'mindfreak'
}

DATABASES = {
    'abstract-mind-lab': '#4a90d9',  # синий
    'abstract_mind_db': '#e24a4a',   # красный
    'rag_chunks_db': '#4a9e4a'       # зеленый
}

TABLE_ICONS = {
    'video': '🎥',
    'track': '🎵', 
    'session': '📝',
    'song': '🎶',
    'mmss': '🧠',
    'rag': '🔍',
    'app': '⚙️',
    'project': '📁',
    'stem': '🎛️',
    'internal': '🔒',
    'default': '📊'
}

OUTPUT_FILE = 'database_comparison.html'
SAMPLE_SIZE = 50  # количество записей для выборки

# =====================================================
# ФУНКЦИИ
# =====================================================

def get_connection(database_name: str) -> psycopg2.extensions.connection:
    """Create database connection with UTF-8 encoding"""
    return psycopg2.connect(
        database=database_name, 
        **DB_CONFIG,
        client_encoding='UTF8'
    )

def get_table_stats(conn: psycopg2.extensions.connection) -> Dict[str, Dict]:
    """Get statistics for all tables"""
    cursor = conn.cursor()
    
    # Get table sizes in MB
    cursor.execute("""
        SELECT 
            t.table_name,
            pg_size_pretty(pg_total_relation_size('public.'||t.table_name)) as size,
            pg_total_relation_size('public.'||t.table_name) as size_bytes,
            COALESCE(s.n_live_tup, 0) as row_count
        FROM information_schema.tables t
        LEFT JOIN pg_stat_user_tables s ON s.schemaname = 'public' AND s.relname = t.table_name
        WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
        ORDER BY pg_total_relation_size('public.'||t.table_name) DESC
    """)
    
    stats = {}
    for row in cursor.fetchall():
        table_name, size_pretty, size_bytes, row_count = row
        stats[table_name] = {
            'size_pretty': size_pretty,
            'size_mb': round((size_bytes or 0) / (1024 * 1024), 2),
            'row_count': row_count or 0
        }
    
    return stats

def get_sample_data(conn: psycopg2.extensions.connection, table_name: str, limit: int = SAMPLE_SIZE) -> List[Dict]:
    """Get sample data from table with consistent sorting"""
    cursor = conn.cursor()
    
    try:
        # Get first column name for sorting
        cursor.execute(f"""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = '{table_name}' 
            ORDER BY ordinal_position ASC 
            LIMIT 1
        """)
        first_column = cursor.fetchone()
        
        if not first_column:
            print(f"  Warning: No columns found in {table_name}")
            return []
        
        sort_column = first_column[0]
        
        # Sort by first column for consistency
        query = f"""
            SELECT * 
            FROM public.{table_name} 
            ORDER BY {sort_column} 
            LIMIT {limit}
        """
        cursor.execute(query)
        columns = [desc[0] for desc in cursor.description]
        rows = cursor.fetchall()
        
        return [dict(zip(columns, row)) for row in rows]
    except Exception as e:
        conn.rollback()  # Rollback on error
        print(f"  Warning: Error sampling {table_name}: {str(e)[:100]}")
        return []

def get_table_icon(table_name: str) -> str:
    """Получить иконку для таблицы"""
    table_lower = table_name.lower()
    
    if 'video' in table_lower:
        return TABLE_ICONS['video']
    elif 'track' in table_lower:
        return TABLE_ICONS['track']
    elif 'session' in table_lower:
        return TABLE_ICONS['session']
    elif 'song' in table_lower or 'lyric' in table_lower:
        return TABLE_ICONS['song']
    elif 'mmss' in table_lower:
        return TABLE_ICONS['mmss']
    elif 'rag' in table_lower:
        return TABLE_ICONS['rag']
    elif 'app' in table_lower:
        return TABLE_ICONS['app']
    elif 'project' in table_lower:
        return TABLE_ICONS['project']
    elif 'stem' in table_lower:
        return TABLE_ICONS['stem']
    elif 'internal' in table_lower:
        return TABLE_ICONS['internal']
    else:
        return TABLE_ICONS['default']

def compute_record_hash(record: Dict) -> str:
    """Вычислить хеш записи для нахождения дубликатов"""
    # Удаляем технические поля и нормализуем данные
    filtered = {k: v for k, v in record.items() 
                 if k not in ['id', 'created_at', 'updated_at', 'captured_at']}
    
    # Сортируем ключи для consistency
    sorted_dict = dict(sorted(filtered.items()))
    
    # Преобразуем в строку
    record_str = json.dumps(sorted_dict, sort_keys=True, default=str)
    
    return hashlib.md5(record_str.encode()).hexdigest()

def generate_html_report(comparison_data: Dict) -> str:
    """Сгенерировать HTML отчет с сравнением"""
    
    html = f"""<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Сравнение баз данных PostgreSQL</title>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f7fa;
            padding: 20px;
        }}
        
        .container {{
            max-width: 1800px;
            margin: 0 auto;
        }}
        
        .header {{
            background: white;
            padding: 30px;
            border-radius: 12px;
            margin-bottom: 30px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }}
        
        .header h1 {{
            color: #1a1a2e;
            font-size: 32px;
            margin-bottom: 15px;
        }}
        
        .stats-overview {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }}
        
        .stat-card {{
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #ddd;
        }}
        
        .stat-card.aml {{ border-left-color: {DATABASES['abstract-mind-lab']}; }}
        .stat-card.amd {{ border-left-color: {DATABASES['abstract_mind_db']}; }}
        .stat-card.rcdb {{ border-left-color: {DATABASES['rag_chunks_db']}; }}
        
        .stat-card h3 {{
            font-size: 14px;
            color: #666;
            margin-bottom: 10px;
        }}
        
        .stat-card .value {{
            font-size: 24px;
            font-weight: bold;
            color: #1a1a2e;
        }}
        
        .table-section {{
            background: white;
            padding: 25px;
            border-radius: 12px;
            margin-bottom: 25px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }}
        
        .table-header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 2px solid #f0f0f0;
        }}
        
        .table-title {{
            font-size: 22px;
            font-weight: bold;
            color: #1a1a2e;
        }}
        
        .table-icon {{
            font-size: 28px;
            margin-right: 10px;
        }}
        
        .db-comparison {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
            gap: 20px;
            margin-bottom: 20px;
        }}
        
        .db-column {{
            border-radius: 8px;
            overflow: hidden;
        }}
        
        .db-column-header {{
            padding: 12px 16px;
            color: white;
            font-weight: bold;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }}
        
        .db-column-aml {{ background: {DATABASES['abstract-mind-lab']}; }}
        .db-column-amd {{ background: {DATABASES['abstract_mind_db']}; }}
        .db-column-rcdb {{ background: {DATABASES['rag_chunks_db']}; }}
        
        .db-stats {{
            padding: 12px 16px;
            background: #f8f9fa;
            border-bottom: 1px solid #e9ecef;
            font-size: 13px;
            color: #666;
        }}
        
        .record-grid {{
            display: grid;
            gap: 15px;
            padding: 15px;
            max-height: 600px;
            overflow-y: auto;
        }}
        
        .record-card {{
            background: #fafbfc;
            border: 1px solid #e1e4e8;
            border-radius: 6px;
            padding: 12px;
            font-size: 12px;
        }}
        
        .record-card.highlight {{
            background: #fff3cd;
            border-color: #ffc107;
        }}
        
        .record-header {{
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
            font-weight: bold;
            color: #495057;
        }}
        
        .record-id {{
            color: #6c757d;
            font-size: 11px;
        }}
        
        .record-fields {{
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
        }}
        
        .field {{
            display: flex;
        }}
        
        .field-name {{
            font-weight: 500;
            color: #495057;
            min-width: 120px;
        }}
        
        .field-value {{
            color: #212529;
            word-break: break-word;
            font-family: 'SF Mono', Monaco, monospace;
            font-size: 11px;
        }}
        
        .diff-marker {{
            display: inline-block;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            margin-right: 5px;
        }}
        
        .diff-same {{ background: #28a745; }}
        .diff-different {{ background: #dc3545; }}
        .diff-missing {{ background: #6c757d; }}
        
        .footer {{
            text-align: center;
            padding: 30px 0 10px;
            color: #868e96;
            font-size: 13px;
        }}
        
        .no-data {{
            padding: 20px;
            text-align: center;
            color: #6c757d;
            font-style: italic;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔍 Сравнение баз данных PostgreSQL</h1>
            <p style="color: #666; margin-bottom: 20px;">
                Сгенерировано: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | 
                Выборка: {SAMPLE_SIZE} записей на таблицу
            </p>
            
            <div class="stats-overview">
"""

    # Добавляем общую статистику
    for db_name, db_color in DATABASES.items():
        total_tables = len(comparison_data[db_name]['tables'])
        total_records = sum(comparison_data[db_name]['tables'][t]['row_count'] 
                          for t in comparison_data[db_name]['tables'])
        total_size_mb = sum(comparison_data[db_name]['tables'][t]['size_mb'] 
                           for t in comparison_data[db_name]['tables'])
        
        db_class = 'aml' if db_name == 'abstract-mind-lab' else 'amd' if db_name == 'abstract_mind_db' else 'rcdb'
        
        html += f"""
                <div class="stat-card {db_class}">
                    <h3>{db_name}</h3>
                    <div class="value">{total_tables} таблиц</div>
                    <div style="font-size: 14px; color: #666; margin-top: 5px;">
                        {total_records:,} записей<br>
                        {total_size_mb:.1f} МБ
                    </div>
                </div>"""

    html += """
            </div>
        </div>
"""

    # Добавляем сравнение по таблицам
    all_tables = set()
    for db_data in comparison_data.values():
        all_tables.update(db_data['tables'].keys())
    
    for table_name in sorted(all_tables):
        icon = get_table_icon(table_name)
        html += f"""
        <div class="table-section">
            <div class="table-header">
                <div>
                    <span class="table-icon">{icon}</span>
                    <span class="table-title">{table_name}</span>
                </div>
            </div>
            
            <div class="db-comparison">
"""

        for db_name, db_color in DATABASES.items():
            db_class = 'aml' if db_name == 'abstract-mind-lab' else 'amd' if db_name == 'abstract_mind_db' else 'rcdb'
            
            if table_name in comparison_data[db_name]['tables']:
                table_info = comparison_data[db_name]['tables'][table_name]
                sample_data = comparison_data[db_name]['samples'].get(table_name, [])
                
                html += f"""
                <div class="db-column">
                    <div class="db-column-header db-column-{db_class}">
                        <span>{db_name}</span>
                    </div>
                    <div class="db-stats">
                        📊 {table_info['row_count']:,} записей | 💾 {table_info['size_mb']:.2f} МБ
                    </div>
                    <div class="record-grid">
"""

                if sample_data:
                    for i, record in enumerate(sample_data[:min(10, len(sample_data))]):
                        record_id = record.get('id', record.get('track_id', f'#{i}'))
                        
                        # Показываем только первые несколько полей
                        fields_to_show = list(record.keys())[:4]
                        fields_html = ""
                        for field in fields_to_show:
                            value = record[field]
                            if isinstance(value, (dict, list)):
                                value = json.dumps(value, ensure_ascii=False)[:50] + "..."
                            elif value and len(str(value)) > 30:
                                value = str(value)[:30] + "..."
                            
                            fields_html += f"""
                                <div class="field">
                                    <span class="field-name">{field}:</span>
                                    <span class="field-value">{value}</span>
                                </div>"""
                        
                        html += f"""
                        <div class="record-card">
                            <div class="record-header">
                                <span>Запись #{i+1}</span>
                                <span class="record-id">ID: {record_id}</span>
                            </div>
                            <div class="record-fields">
                                {fields_html}
                            </div>
                        </div>"""
                else:
                    html += '<div class="no-data">Нет данных</div>'
                
                html += """
                    </div>
                </div>"""
            else:
                html += f"""
                <div class="db-column">
                    <div class="db-column-header db-column-{db_class}" style="opacity: 0.5;">
                        <span>{db_name} (отсутствует)</span>
                    </div>
                    <div class="db-stats">
                        ❌ Таблица не существует
                    </div>
                    <div class="record-grid">
                        <div class="no-data">Таблица отсутствует в этой базе данных</div>
                    </div>
                </div>"""

        html += """
            </div>
        </div>"""

    html += """
        <div class="footer">
            <p>🤖 Сгенерировано автоматическим скриптом сравнения баз данных</p>
        </div>
    </div>
</body>
</html>"""

    return html

def generate_duplicate_report(comparison_data: Dict) -> Dict:
    """Сгенерировать JSON отчет с потенциальными дубликатами"""
    duplicates = {}
    
    # Сравниваем только таблицы которые существуют в нескольких базах
    all_tables = set()
    for db_data in comparison_data.values():
        all_tables.update(db_data['tables'].keys())
    
    for table_name in all_tables:
        # Проверяем в скольких базах существует таблица
        db_with_table = [db for db in DATABASES.keys() 
                        if table_name in comparison_data[db]['tables']]
        
        if len(db_with_table) > 1:
            table_hashes = {}
            
            for db_name in db_with_table:
                sample_data = comparison_data[db_name]['samples'].get(table_name, [])
                hashes = [compute_record_hash(record) for record in sample_data]
                table_hashes[db_name] = set(hashes)
            
            # Находим пересечения
            common_hashes = set.intersection(*table_hashes.values()) if table_hashes else set()
            
            if common_hashes:
                duplicates[table_name] = {
                    'found_in_databases': db_with_table,
                    'potential_duplicates': len(common_hashes),
                    'sample_hashes': list(common_hashes)[:10]  # только пример
                }
    
    return duplicates

def main():
    print("Starting database comparison...")
    
    comparison_data = {}
    
    for db_name, db_color in DATABASES.items():
        print(f"\nAnalyzing {db_name}...")
        
        try:
            conn = get_connection(db_name)
            print(f"  Connected to {db_name}")
            
            # Получаем статистику
            stats = get_table_stats(conn)
            print(f"  Found {len(stats)} tables")
            
            # Получаем выборки данных
            samples = {}
            for table_name in stats.keys():
                if stats[table_name]['row_count'] > 0:
                    samples[table_name] = get_sample_data(conn, table_name)
                    print(f"  Sample from {table_name}: {len(samples[table_name])} records")
            
            comparison_data[db_name] = {
                'color': db_color,
                'tables': stats,
                'samples': samples
            }
            
            conn.close()
            
        except Exception as e:
            import traceback
            print(f"  Error connecting to {db_name}: {e}")
            traceback.print_exc()
            comparison_data[db_name] = {
                'color': db_color,
                'tables': {},
                'samples': {},
                'error': str(e)
            }
    
    print("\nGenerating HTML report...")
    html_content = generate_html_report(comparison_data)
    
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write(html_content)
    
    print(f"HTML report saved: {OUTPUT_FILE}")
    
    print("\nAnalyzing potential duplicates...")
    duplicate_report = generate_duplicate_report(comparison_data)
    
    json_output = OUTPUT_FILE.replace('.html', '_duplicates.json')
    with open(json_output, 'w', encoding='utf-8') as f:
        json.dump(duplicate_report, f, indent=2, ensure_ascii=False)
    
    print(f"JSON duplicate report saved: {json_output}")
    print(f"Found potential duplicates in {len(duplicate_report)} tables")
    
    print(f"\nDone! Open {OUTPUT_FILE} in browser to view results")

if __name__ == "__main__":
    main()