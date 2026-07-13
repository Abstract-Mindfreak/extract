from database.connection import engine
from sqlalchemy import inspect

inspector = inspect(engine)

print("=== rag_chunks columns ===")
columns = inspector.get_columns('rag_chunks')
for col in columns:
    print(f'{col["name"]}: {col["type"]}')

print("\n=== rag_document_embeddings columns ===")
columns = inspector.get_columns('rag_document_embeddings')
for col in columns:
    print(f'{col["name"]}: {col["type"]}')
