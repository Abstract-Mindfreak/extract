import sys
from pathlib import Path
from sqlalchemy import text

sys.path.insert(0, str(Path(__file__).parent.parent))

from database.connection import engine

def apply_indexes():
    with engine.connect() as connection:
        with connection.begin():
            print("Applying database indexes...")
            
            connection.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_songs_raw_data_gin ON songs USING gin (raw_data)
            """))
            print("Created idx_songs_raw_data_gin")
            
            connection.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_songs_metrics ON songs (play_count DESC, favorite_count DESC)
            """))
            print("Created idx_songs_metrics")
            
            connection.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_songs_sound_prompt_trgm ON songs USING gin (sound_prompt gin_trgm_ops)
            """))
            print("Created idx_songs_sound_prompt_trgm")
            
            connection.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_chat_sessions_full_payload_gin ON chat_sessions USING gin (full_payload)
            """))
            print("Created idx_chat_sessions_full_payload_gin")
            
            connection.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions (user_id)
            """))
            print("Created idx_chat_sessions_user_id")
            
            print("All indexes applied successfully!")

if __name__ == "__main__":
    apply_indexes()
