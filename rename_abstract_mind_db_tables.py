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

DATABASE_NAME = 'abstract_mind_db'

# Tables to rename with their new names
RENAME_MAPPING = {
    'app_entity_store': 'amd_app_entity_store',
    'app_setting_store': 'amd_app_setting_store', 
    'applied_flows': 'amd_applied_flows',
    'applied_memories': 'amd_applied_memories',
    'internal_tags': 'amd_internal_tags',
    'mmss_domain_patterns': 'amd_mmss_domain_patterns',
    'mmss_invariants': 'amd_mmss_invariants',
    'mmss_phase_patterns': 'amd_mmss_phase_patterns',
    'projects': 'amd_projects',
    'rag_document_embeddings': 'amd_rag_document_embeddings',
    'sessions': 'amd_sessions',
    'stems': 'amd_stems',
    'tracks': 'amd_tracks'
}

# Tables that don't need renaming (unique tables)
UNIQUE_TABLES = [
    'chat_sessions',
    'lyrics_timing_markers', 
    'media_assets',
    'music_blocks',
    'session_song_links',
    'song_lyrics',
    'songs'
]

def get_connection(database_name: str) -> psycopg2.extensions.connection:
    """Create database connection with UTF-8 encoding"""
    return psycopg2.connect(
        database=database_name, 
        **DB_CONFIG,
        client_encoding='UTF8'
    )

def table_exists(conn, table_name: str) -> bool:
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

def get_table_dependencies(conn, table_name: str) -> list:
    """Get foreign key dependencies for a table"""
    cursor = conn.cursor()
    cursor.execute("""
        SELECT
            tc.table_name, 
            kcu.column_name, 
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name 
        FROM information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND tc.table_name = %s
    """, (table_name,))
    
    dependencies = []
    for row in cursor.fetchall():
        dependencies.append({
            'table': row[0],
            'column': row[1],
            'foreign_table': row[2],
            'foreign_column': row[3]
        })
    
    return dependencies

def rename_table(conn, old_name: str, new_name: str) -> bool:
    """Rename a table and update its dependencies"""
    cursor = conn.cursor()
    
    try:
        # Check if old table exists
        if not table_exists(conn, old_name):
            print(f"  Warning: Table {old_name} does not exist, skipping")
            return True
        
        # Check if new name already exists
        if table_exists(conn, new_name):
            print(f"  Error: Target table {new_name} already exists")
            return False
        
        # Get dependencies
        deps = get_table_dependencies(conn, old_name)
        if deps:
            print(f"  Found {len(deps)} foreign key dependencies")
        
        # Drop foreign key constraints
        for dep in deps:
            try:
                cursor.execute(f"""
                    ALTER TABLE public.{dep['table']} 
                    DROP CONSTRAINT IF EXISTS {dep['table']}_{dep['column']}_fkey
                """)
                print(f"  Dropped constraint: {dep['table']}.{dep['column']} -> {dep['foreign_table']}.{dep['foreign_column']}")
            except Exception as e:
                print(f"  Warning: Could not drop constraint: {e}")
        
        # Rename the table
        cursor.execute(f"ALTER TABLE public.{old_name} RENAME TO {new_name}")
        print(f"  Renamed: {old_name} -> {new_name}")
        
        # Recreate foreign key constraints with new names
        for dep in deps:
            try:
                # Update foreign table name if it was renamed
                foreign_table = dep['foreign_table']
                if foreign_table in RENAME_MAPPING:
                    foreign_table = RENAME_MAPPING[foreign_table]
                
                cursor.execute(f"""
                    ALTER TABLE public.{dep['table']} 
                    ADD CONSTRAINT {dep['table']}_{dep['column']}_fkey 
                    FOREIGN KEY ({dep['column']}) 
                    REFERENCES public.{foreign_table}({dep['foreign_column']})
                """)
                print(f"  Recreated constraint: {dep['table']}.{dep['column']} -> {foreign_table}.{dep['foreign_column']}")
            except Exception as e:
                print(f"  Warning: Could not recreate constraint: {e}")
        
        conn.commit()
        return True
        
    except Exception as e:
        print(f"  Error renaming table {old_name}: {e}")
        conn.rollback()
        return False

def main():
    print(f"=== Renaming conflicting tables in {DATABASE_NAME} ===\n")
    
    conn = get_connection(DATABASE_NAME)
    cursor = conn.cursor()
    
    # Get current tables
    cursor.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name
    """)
    current_tables = [row[0] for row in cursor.fetchall()]
    
    print(f"Current tables in {DATABASE_NAME}: {len(current_tables)}")
    print(f"Tables to rename: {len(RENAME_MAPPING)}")
    print(f"Unique tables (no rename): {len(UNIQUE_TABLES)}")
    
    print("\n=== Rename Operations ===\n")
    
    success_count = 0
    fail_count = 0
    
    for old_name, new_name in RENAME_MAPPING.items():
        print(f"\nProcessing: {old_name} -> {new_name}")
        
        if rename_table(conn, old_name, new_name):
            success_count += 1
        else:
            fail_count += 1
    
    print("\n=== Summary ===")
    print(f"Successfully renamed: {success_count}/{len(RENAME_MAPPING)}")
    print(f"Failed: {fail_count}/{len(RENAME_MAPPING)}")
    
    print("\n=== Unique Tables (no rename needed) ===")
    for table in UNIQUE_TABLES:
        exists = table_exists(conn, table)
        status = "✓" if exists else "✗"
        print(f"  {status} {table}")
    
    print("\n=== Final Table List ===")
    cursor.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name
    """)
    final_tables = [row[0] for row in cursor.fetchall()]
    
    for table in final_tables:
        print(f"  • {table}")
    
    conn.close()
    
    print(f"\n=== Rename process complete ===")
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