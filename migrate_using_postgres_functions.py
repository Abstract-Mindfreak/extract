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

SOURCE_DB = 'abstract_mind_db'
TARGET_DB = 'abstract-mind-lab'

def get_connection(database_name: str):
    return psycopg2.connect(database=database_name, **DB_CONFIG, client_encoding='UTF8')

def main():
    print(f"=== Migration: {SOURCE_DB} -> {TARGET_DB} ===\n")
    
    target_conn = get_connection(TARGET_DB)
    target_cursor = target_conn.cursor()
    
    # Enable dblink extension
    print("Enabling dblink extension...")
    try:
        target_cursor.execute("CREATE EXTENSION IF NOT EXISTS dblink")
        target_conn.commit()
        print("✓ dblink enabled")
    except Exception as e:
        print(f"✗ Could not enable dblink: {e}")
        print("Trying alternative approach...")
        return False
    
    # Get tables from source
    source_conn = get_connection(SOURCE_DB)
    source_cursor = source_conn.cursor()
    source_cursor.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name
    """)
    tables = [row[0] for row in source_cursor.fetchall()]
    
    print(f"Found {len(tables)} tables to migrate")
    print("\nTables:")
    for table in tables:
        print(f"  • {table}")
    
    # Migrate each table using dblink
    success_count = 0
    fail_count = 0
    
    for table_name in tables:
        print(f"\nProcessing: {table_name}")
        
        try:
            # Drop table if exists
            target_cursor.execute(f"DROP TABLE IF EXISTS public.{table_name} CASCADE")
            
            # Create table using dblink to copy structure and data
            # First get the CREATE TABLE statement from source
            source_cursor.execute(f"""
                SELECT 'CREATE TABLE ' || table_name || ' (' || 
                string_agg(column_name || ' ' || data_type || 
                CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END, ', ') ||
                ')' as create_stmt
                FROM information_schema.columns 
                WHERE table_schema = 'public' AND table_name = '{table_name}'
                GROUP BY table_name
            """)
            create_stmt = source_cursor.fetchone()[0]
            
            # Simplify types for compatibility
            create_stmt = create_stmt.replace('ARRAY', 'TEXT[]')
            create_stmt = create_stmt.replace('USER-DEFINED', 'JSONB')
            
            print(f"  Creating table...")
            target_cursor.execute(create_stmt)
            
            # Copy data using dblink
            print(f"  Copying data...")
            target_cursor.execute(f"""
                INSERT INTO public.{table_name}
                SELECT * FROM dblink(
                    'postgresql://mind_user:mindfreak@localhost:5432/{SOURCE_DB}',
                    'SELECT * FROM public.{table_name}'
                ) AS t({table_name}_temp)
            """)
            
            target_conn.commit()
            
            # Verify
            target_cursor.execute(f"SELECT COUNT(*) FROM public.{table_name}")
            count = target_cursor.fetchone()[0]
            
            print(f"  ✓ Success: {count} rows copied")
            success_count += 1
            
        except Exception as e:
            print(f"  ✗ Error: {e}")
            target_conn.rollback()
            fail_count += 1
    
    # Summary
    print(f"\n=== Migration Summary ===")
    print(f"Successfully migrated: {success_count}/{len(tables)}")
    print(f"Failed: {fail_count}/{len(tables)}")
    
    # Show final tables
    target_cursor.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name
    """)
    final_tables = [row[0] for row in target_cursor.fetchall()]
    
    print(f"\n=== Final {TARGET_DB} tables ({len(final_tables)}) ===")
    for table in sorted(final_tables):
        print(f"  • {table}")
    
    source_conn.close()
    target_conn.close()
    
    print(f"\n=== Migration complete ===")
    return fail_count == 0

if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)