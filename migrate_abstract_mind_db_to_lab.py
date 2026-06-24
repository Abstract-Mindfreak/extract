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

SOURCE_DB = 'abstract_mind_db'
TARGET_DB = 'abstract-mind-lab'

def get_connection(database_name: str) -> psycopg2.extensions.connection:
    """Create database connection with UTF-8 encoding"""
    return psycopg2.connect(
        database=database_name, 
        **DB_CONFIG,
        client_encoding='UTF8'
    )

def get_all_tables(conn) -> list:
    """Get all user tables"""
    cursor = conn.cursor()
    cursor.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name
    """)
    return [row[0] for row in cursor.fetchall()]

def table_exists(conn, table_name: str) -> bool:
    """Check if table exists"""
    cursor = conn.cursor()
    cursor.execute(f"""
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = '{table_name}'
        )
    """)
    return cursor.fetchone()[0]

def get_table_structure(conn, table_name: str) -> dict:
    """Get table structure with data types"""
    cursor = conn.cursor()
    cursor.execute(f"""
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = '{table_name}'
        ORDER BY ordinal_position
    """)
    
    columns = []
    for row in cursor.fetchall():
        col_name, data_type, is_nullable, col_default = row
        
        # Fix PostgreSQL data types
        pg_type = data_type
        if data_type == 'ARRAY':
            pg_type = 'TEXT[]'
        elif data_type == 'USER-DEFINED':
            pg_type = 'JSONB'
        
        columns.append({
            'name': col_name,
            'type': pg_type,
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
    
    # Get first column for sorting (fallback to first column if 'id' doesn't exist)
    sort_column = columns[0] if 'id' not in columns else 'id'
    
    # Copy data in batches
    copied_rows = 0
    offset = 0
    
    while offset < total_rows:
        source_cursor.execute(f"""
            SELECT {column_list} 
            FROM public.{table_name} 
            ORDER BY {sort_column} 
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
                # Try without ON CONFLICT if it fails
                try:
                    target_cursor.execute(f"""
                        INSERT INTO public.{table_name} ({column_list})
                        VALUES ({placeholders})
                    """, row)
                except Exception as e2:
                    print(f"    Warning: Failed to insert row: {str(e2)[:80]}")
                    target_conn.rollback()
                    continue
        
        target_conn.commit()
        copied_rows += len(batch)
        offset += batch_size
        
        if offset % (batch_size * 10) == 0:  # Progress every 10 batches
            progress = (copied_rows / total_rows) * 100
            print(f"    Progress: {copied_rows}/{total_rows} rows ({progress:.1f}%)")
    
    return {'copied': copied_rows, 'total': total_rows}

def migrate_table(source_conn, target_conn, table_name: str) -> bool:
    """Migrate a single table from source to target"""
    print(f"\n  Processing: {table_name}")
    
    try:
        # Get source table structure
        structure = get_table_structure(source_conn, table_name)
        
        # Check if table exists in target
        if table_exists(target_conn, table_name):
            target_cursor = target_conn.cursor()
            target_cursor.execute(f"SELECT COUNT(*) FROM public.{table_name}")
            target_count = target_cursor.fetchone()[0]
            print(f"    Target table exists with {target_count} rows - will overwrite")
            
            # Drop existing table
            print(f"    Dropping existing table...")
            target_cursor = target_conn.cursor()
            target_cursor.execute(f"DROP TABLE IF EXISTS public.{table_name} CASCADE")
            target_conn.commit()
        
        # Create table in target
        print(f"    Creating table structure...")
        target_cursor = target_conn.cursor()
        
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
        print(f"    Table created")
        
        # Copy data
        print(f"    Copying data...")
        result = copy_table_data(source_conn, target_conn, table_name)
        
        # Verify
        target_cursor.execute(f"SELECT COUNT(*) FROM public.{table_name}")
        final_count = target_cursor.fetchone()[0]
        
        print(f"    Source: {result['total']} rows")
        print(f"    Target: {final_count} rows")
        print(f"    Copied: {result['copied']} rows")
        
        if final_count == result['total']:
            print(f"    ✓ Success")
        else:
            print(f"    ⚠ Row count mismatch")
        
        return True
        
    except Exception as e:
        print(f"    ✗ Error: {e}")
        import traceback
        traceback.print_exc()
        target_conn.rollback()
        return False

def main():
    print(f"=== Migration: {SOURCE_DB} -> {TARGET_DB} ===\n")
    
    # Connect to databases
    print("Connecting to databases...")
    source_conn = get_connection(SOURCE_DB)
    target_conn = get_connection(TARGET_DB)
    
    # Get all tables from source
    source_tables = get_all_tables(source_conn)
    print(f"Found {len(source_tables)} tables in {SOURCE_DB}")
    
    print("\nTables to migrate:")
    for table in source_tables:
        print(f"  • {table}")
    
    print(f"\nStarting migration (will overwrite existing tables)...")
    
    # Migrate each table
    success_count = 0
    fail_count = 0
    
    for table_name in source_tables:
        if migrate_table(source_conn, target_conn, table_name):
            success_count += 1
        else:
            fail_count += 1
    
    # Summary
    print(f"\n=== Migration Summary ===")
    print(f"Successfully migrated: {success_count}/{len(source_tables)}")
    print(f"Failed: {fail_count}/{len(source_tables)}")
    
    # Show final target tables
    print(f"\n=== Final {TARGET_DB} tables ===")
    target_tables = get_all_tables(target_conn)
    for table in sorted(target_tables):
        print(f"  • {table}")
    
    # Cleanup
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