import os
import json
from sqlmodel import create_engine, SQLModel, Session


def build_database_url():
    user = os.getenv("PG_USER", "mind_user")
    password = os.getenv("PG_PASSWORD", "mindfreak")
    host = os.getenv("PG_HOST", "localhost")
    port = os.getenv("PG_PORT", "5432")
    database = os.getenv("PG_DATABASE")
    if database:
        return f"postgresql://{user}:{password}@{host}:{port}/{database}"

    database_url = os.getenv("DATABASE_URL")
    if database_url:
        return database_url

    return f"postgresql://{user}:{password}@{host}:{port}/abstract-mind-lab"


DATABASE_URL = build_database_url()

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
