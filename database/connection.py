import os
import json
from sqlmodel import create_engine, SQLModel, Session

# Updated to use abstract-mind-lab as primary database
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://mind_user:mindfreak@localhost:5432/abstract-mind-lab")

# Legacy database connection for read-only access to old data
LEGACY_DATABASE_URL = os.getenv("LEGACY_DATABASE_URL", "postgresql://mind_user:mindfreak@localhost:5432/abstract_mind_db")

engine = create_engine(
    DATABASE_URL,
    echo=False,
    json_serializer=lambda obj: json.dumps(obj, ensure_ascii=False)
)

legacy_engine = create_engine(
    LEGACY_DATABASE_URL,
    echo=False,
    json_serializer=lambda obj: json.dumps(obj, ensure_ascii=False)
)

def init_db():
    import database.models
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        return session

def get_legacy_session():
    """Get session for legacy database access (read-only)"""
    with Session(legacy_engine) as session:
        return session
