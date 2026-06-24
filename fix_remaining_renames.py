import psycopg2
import sys
import io

if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

DB_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'user': 'mind_user',
    'password': 'mindfreak'
}

def get_connection(database_name: str):
    return psycopg2.connect(database=database_name, **DB_CONFIG, client_encoding='UTF8')

def main():
    conn = get_connection('abstract_mind_db')
    cursor = conn.cursor()
    
    # Tables that still need to be renamed
    remaining_renames = {
        'applied_flows': 'amd_applied_flows',
        'applied_memories': 'amd_applied_memories',
        'internal_tags': 'amd_internal_tags',
        'stems': 'amd_stems',
        'video_metadata': 'amd_video_metadata'  # Add this one too
    }
    
    print("=== Fixing remaining table renames ===\n")
    
    for old_name, new_name in remaining_renames.items():
        try:
            cursor.execute(f"ALTER TABLE public.{old_name} RENAME TO {new_name}")
            conn.commit()
            print(f"✓ Renamed: {old_name} -> {new_name}")
        except Exception as e:
            print(f"✗ Error renaming {old_name}: {e}")
            conn.rollback()
    
    print("\n=== Final table list ===")
    cursor.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name
    """)
    tables = [row[0] for row in cursor.fetchall()]
    
    for table in tables:
        print(f"  • {table}")
    
    conn.close()
    print("\n=== Fix complete ===")

if __name__ == "__main__":
    main()