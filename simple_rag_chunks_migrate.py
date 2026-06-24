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

def main():
    print(f"=== Simple Migration: {TABLE_NAME} ===")
    print(f"Source: {SOURCE_DB}")
    print(f"Target: {TARGET_DB}")
    
    # Get source data
    print(f"\nStep 1: Connecting to source database...")
    source_conn = get_connection(SOURCE_DB)
    source_cursor = source_conn.cursor()
    
    # Check row count
    source_cursor.execute(f"SELECT COUNT(*) FROM public.{TABLE_NAME}")
    source_count = source_cursor.fetchone()[0]
    print(f"  Source table has {source_count} rows")
    
    if source_count == 0:
        print("  Source table is empty, nothing to migrate")
        source_conn.close()
        return True
    
    # Get table structure
    print(f"\nStep 2: Getting table structure...")
    source_cursor.execute(f"""
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = '{TABLE_NAME}'
        ORDER BY ordinal_position
    """)
    columns_info = source_cursor.fetchall()
    columns = [row[0] for row in columns_info]
    column_list = ', '.join(columns)
    print(f"  Columns: {column_list}")
    
    # Connect to target
    print(f"\nStep 3: Connecting to target database...")
    target_conn = get_connection(TARGET_DB)
    target_cursor = target_conn.cursor()
    
    # Check if table exists in target
    target_cursor.execute("""
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = %s
        )
    """, (TABLE_NAME,))
    table_exists = target_cursor.fetchone()[0]
    
    if table_exists:
        target_cursor.execute(f"SELECT COUNT(*) FROM public.{TABLE_NAME}")
        target_count = target_cursor.fetchone()[0]
        print(f"  Target table exists with {target_count} rows")
        
        response = input(f"  Overwrite existing table? (yes/no): ")
        if response.lower() != 'yes':
            print("  Migration cancelled")
            source_conn.close()
            target_conn.close()
            return False
        
        # Drop existing table
        print(f"  Dropping existing table...")
        target_cursor.execute(f"DROP TABLE IF EXISTS public.{TABLE_NAME} CASCADE")
        target_conn.commit()
    
    # Create table in target using column information
    print(f"\nStep 4: Creating table in target...")
    
    # Build CREATE TABLE statement
    create_sql = f"CREATE TABLE public.{TABLE_NAME} (\n"
    column_definitions = []
    
    for col_name, data_type, is_nullable, col_default in columns_info:
        # Fix PostgreSQL data types
        pg_type = data_type
        if data_type == 'ARRAY':
            pg_type = 'TEXT[]'  # Default to text array for ARRAY type
        elif data_type == 'USER-DEFINED':
            pg_type = 'JSONB'   # Default to JSONB for user-defined types
        
        col_def = f"  {col_name} {pg_type}"
        if is_nullable == 'NO':
            col_def += " NOT NULL"
        if col_default:
            col_def += f" DEFAULT {col_default}"
        column_definitions.append(col_def)
    
    create_sql += ",\n".join(column_definitions)
    create_sql += "\n)"
    
    target_cursor.execute(create_sql)
    target_conn.commit()
    print(f"  Table created successfully")
    
    # Copy data using cursor-to-cursor approach
    print(f"\nStep 5: Copying data using cursor-to-cursor approach...")
    
    try:
        # Get source data in batches
        batch_size = 1000
        offset = 0
        copied = 0
        
        placeholders = ', '.join(['%s'] * len(columns))
        
        while offset < source_count:
            source_cursor.execute(f"""
                SELECT {column_list} 
                FROM public.{TABLE_NAME} 
                ORDER BY id 
                LIMIT {batch_size} OFFSET {offset}
            """)
            
            batch = source_cursor.fetchall()
            
            # Insert batch
            for row in batch:
                try:
                    target_cursor.execute(f"""
                        INSERT INTO public.{TABLE_NAME} ({column_list})
                        VALUES ({placeholders})
                    """, row)
                except Exception as e:
                    print(f"  Warning: Failed to insert row: {str(e)[:100]}")
                    target_conn.rollback()
                    continue
            
            target_conn.commit()
            copied += len(batch)
            offset += batch_size
            
            progress = (copied / source_count) * 100
            print(f"  Progress: {copied}/{source_count} rows copied ({progress:.1f}%)")
        
        print(f"\nStep 6: Verifying migration...")
        target_cursor.execute(f"SELECT COUNT(*) FROM public.{TABLE_NAME}")
        final_count = target_cursor.fetchone()[0]
        
        print(f"  Source: {source_count} rows")
        print(f"  Target: {final_count} rows")
        print(f"  Copied: {copied} rows")
        
        if final_count == source_count:
            print(f"\n  SUCCESS: All data migrated successfully!")
        else:
            print(f"\n  WARNING: Row count mismatch")
        
        # Cleanup
        source_conn.close()
        target_conn.close()
        
        print(f"\n=== Migration complete ===")
        return True
        
    except Exception as e:
        print(f"  Error during migration: {e}")
        target_conn.rollback()
        source_conn.close()
        target_conn.close()
        return False

if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)