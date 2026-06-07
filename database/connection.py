import os
import json
from sqlmodel import create_engine, SQLModel, Session

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://mind_user:mindfreak@localhost:5432/abstract_mind_db")

engine = create_engine(
    DATABASE_URL,
    echo=False,
    json_serializer=lambda obj: json.dumps(obj, ensure_ascii=False)
)

def init_db():
    import database.models
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        return session
