import psycopg2
import sys
import io

# Set UTF-8 encoding for Windows console
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# =====================================================
# CONFIGURATION
# =====================================================
DB_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'user': 'mind_user',
    'password': 'mindfreak'
}

SOURCE_DB = 'rag_chunks_db'
TARGET_DB = 'abstract-mind-lab'
TABLE_NAME = 'rag_chunks'

def get_connection(database_name: str) -> psycopg2.extensions.connection:
    """Create database connection with UTF-8 encoding"""
    return psycopg2.connect(
        database=database_name, 
        **DB_CONFIG,
        client_encoding='UTF8'
    )

def check_table_exists(conn, table_name: str) -> bool:
    """Check if table exists"""
    cursor = conn.cursor()
    cursor.execute("""
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = %s
        )
    """, (table_name,))
    return cursor.fetchone()[0]

def get_table_structure(conn, table_name: str) -> dict:
    """Get table structure"""
    cursor = conn.cursor()
    cursor.execute("""
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = %s
        ORDER BY ordinal_position
    """, (table_name,))
    
    columns = []
    for row in cursor.fetchall():
        col_name, data_type, is_nullable, col_default = row
        columns.append({
            'name': col_name,
            'type': data_type,
            'nullable': is_nullable == 'YES',
            'default': col_default
        })
    
    return {'columns': columns}

def copy_table_data(source_conn, target_conn, table_name: str, batch_size: int = 1000) -> dict:
    """Copy data from source to target table"""
    source_cursor = source_conn.cursor()
    target_cursor = target_conn.cursor()
    
    # Get row count
    source_cursor.execute(f"SELECT COUNT(*) FROM public.{table_name}")
    total_rows = source_cursor.fetchone()[0]
    
    print(f"  Total rows to copy: {total_rows}")
    
    if total_rows == 0:
        return {'copied': 0, 'total': 0}
    
    # Get column names
    source_cursor.execute(f"""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = '{table_name}'
        ORDER BY ordinal_position
    """)
    columns = [row[0] for row in source_cursor.fetchall()]
    column_list = ', '.join(columns)
    placeholders = ', '.join(['%s'] * len(columns))
    
    # Copy data in batches
    copied_rows = 0
    offset = 0
    
    while offset < total_rows:
        source_cursor.execute(f"""
            SELECT {column_list} 
            FROM public.{table_name} 
            ORDER BY id 
            LIMIT {batch_size} OFFSET {offset}
        """)
        
        batch = source_cursor.fetchall()
        
        # Insert batch
        for row in batch:
            try:
                target_cursor.execute(f"""
                    INSERT INTO public.{table_name} ({column_list})
                    VALUES ({placeholders})
                    ON CONFLICT DO NOTHING
                """, row)
            except Exception as e:
                print(f"  Warning: Failed to insert row: {str(e)[:100]}")
                continue
        
        target_conn.commit()
        copied_rows += len(batch)
        offset += batch_size
        
        print(f"  Progress: {copied_rows}/{total_rows} rows copied ({copied_rows/total_rows*100:.1f}%)")
    
    return {'copied': copied_rows, 'total': total_rows}

def recreate_table_from_source(source_conn, target_conn, table_name: str) -> bool:
    """Recreate table in target database based on source structure"""
    try:
        # Get source table structure
        structure = get_table_structure(source_conn, table_name)
        
        # Drop existing table in target if exists
        target_cursor = target_conn.cursor()
        if check_table_exists(target_conn, table_name):
            print(f"  Dropping existing table {table_name} in target database")
            target_cursor.execute(f"DROP TABLE IF EXISTS public.{table_name} CASCADE")
            target_conn.commit()
        
        # Create table in target
        create_sql = f"CREATE TABLE public.{table_name} (\n"
        column_definitions = []
        
        for col in structure['columns']:
            col_def = f"  {col['name']} {col['type']}"
            if not col['nullable']:
                col_def += " NOT NULL"
            if col['default']:
                col_def += f" DEFAULT {col['default']}"
            column_definitions.append(col_def)
        
        create_sql += ",\n".join(column_definitions)
        create_sql += "\n)"
        
        target_cursor.execute(create_sql)
        target_conn.commit()
        
        print(f"  Created table {table_name} in target database")
        return True
        
    except Exception as e:
        print(f"  Error creating table: {e}")
        target_conn.rollback()
        return False

def main():
    print("=== Migration: rag_chunks from rag_chunks_db to abstract-mind-lab ===\n")
    
    # Check source table exists and has data
    print(f"Step 1: Checking source table in {SOURCE_DB}...")
    source_conn = get_connection(SOURCE_DB)
    
    if not check_table_exists(source_conn, TABLE_NAME):
        print(f"  Error: Table {TABLE_NAME} does not exist in {SOURCE_DB}")
        source_conn.close()
        return False
    
    source_cursor = source_conn.cursor()
    source_cursor.execute(f"SELECT COUNT(*) FROM public.{TABLE_NAME}")
    source_count = source_cursor.fetchone()[0]
    print(f"  Source table has {source_count} rows")
    
    if source_count == 0:
        print("  Warning: Source table is empty, nothing to migrate")
        source_conn.close()
        return True
    
    # Check target database
    print(f"\nStep 2: Checking target database {TARGET_DB}...")
    target_conn = get_connection(TARGET_DB)
    
    if check_table_exists(target_conn, TABLE_NAME):
        target_cursor = target_conn.cursor()
        target_cursor.execute(f"SELECT COUNT(*) FROM public.{TABLE_NAME}")
        target_count = target_cursor.fetchone()[0]
        print(f"  Target table already exists with {target_count} rows")
        
        response = input(f"  Overwrite existing table? (yes/no): ")
        if response.lower() != 'yes':
            print("  Migration cancelled")
            source_conn.close()
            target_conn.close()
            return False
    else:
        print(f"  Target table does not exist, will be created")
    
    # Recreate table structure
    print(f"\nStep 3: Creating table structure in {TARGET_DB}...")
    if not recreate_table_from_source(source_conn, target_conn, TABLE_NAME):
        print("  Failed to create table structure")
        source_conn.close()
        target_conn.close()
        return False
    
    # Copy data
    print(f"\nStep 4: Copying data from {SOURCE_DB} to {TARGET_DB}...")
    result = copy_table_data(source_conn, target_conn, TABLE_NAME)
    
    # Verify
    print(f"\nStep 5: Verifying migration...")
    target_cursor = target_conn.cursor()
    target_cursor.execute(f"SELECT COUNT(*) FROM public.{TABLE_NAME}")
    final_count = target_cursor.fetchone()[0]
    
    print(f"  Source: {result['total']} rows")
    print(f"  Target: {final_count} rows")
    print(f"  Copied: {result['copied']} rows")
    
    if final_count == result['total']:
        print(f"\n  SUCCESS: All data migrated successfully!")
    else:
        print(f"\n  WARNING: Row count mismatch")
    
    # Cleanup
    source_conn.close()
    target_conn.close()
    
    print(f"\n=== Migration complete ===")
    return True

if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)