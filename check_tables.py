import psycopg2
import json

def get_tables(database_name):
    try:
        conn = psycopg2.connect(
            host='localhost',
            port=5432,
            user='mind_user',
            password='mindfreak',
            database=database_name
        )
        cursor = conn.cursor()
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE' 
            ORDER BY table_name
        """)
        tables = [row[0] for row in cursor.fetchall()]
        conn.close()
        return tables
    except Exception as e:
        print(f"Error connecting to {database_name}: {e}")
        return []

if __name__ == "__main__":
    databases = ['abstract-mind-lab', 'abstract_mind_db', 'rag_chunks_db']
    
    result = {}
    for db in databases:
        print(f"Checking {db}...")
        tables = get_tables(db)
        result[db] = tables
        print(f"  Found {len(tables)} tables")
    
    print("\n=== SUMMARY ===")
    print(json.dumps(result, indent=2))