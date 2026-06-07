import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from database.connection import init_db

if __name__ == "__main__":
    print("Initializing database schema...")
    init_db()
    print("Database schema initialized successfully!")
