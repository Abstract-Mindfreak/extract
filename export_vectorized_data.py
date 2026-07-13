"""
Export vectorized data from PostgreSQL for GraphRAG ingestion.
Exports rag_chunks and rag_document_embeddings to JSON files.
"""
import os
import json
from datetime import datetime
from database.connection import engine
from sqlalchemy import text

def export_data(limit=None, output_dir="exported_data"):
    """Export vectorized data to JSON files."""
    os.makedirs(output_dir, exist_ok=True)
    
    with engine.connect() as conn:
        # Export rag_chunks
        limit_clause = f"LIMIT {limit}" if limit else ""
        chunks_query = text(f"""
            SELECT id, chunk_text, source_table, source_id, source_database, 
                   tags, category, domain, title, description, created_at
            FROM rag_chunks
            ORDER BY created_at DESC
            {limit_clause}
        """)
        
        chunks_result = conn.execute(chunks_query)
        chunks = []
        for row in chunks_result:
            chunks.append({
                "id": str(row.id),
                "chunk_text": row.chunk_text,
                "source_table": row.source_table,
                "source_id": row.source_id,
                "source_database": row.source_database,
                "tags": list(row.tags) if row.tags else [],
                "category": row.category,
                "domain": row.domain,
                "title": row.title,
                "description": row.description,
                "created_at": row.created_at.isoformat() if row.created_at else None
            })
        
        chunks_file = os.path.join(output_dir, "rag_chunks.json")
        with open(chunks_file, 'w', encoding='utf-8') as f:
            json.dump(chunks, f, ensure_ascii=False, indent=2)
        print(f"Exported {len(chunks)} chunks to {chunks_file}")
        
        # Export rag_document_embeddings
        embeddings_query = text(f"""
            SELECT source_table, source_id, source_title, chunk_text, 
                   source_payload, metadata, content_hash, vectorized_at, created_at
            FROM rag_document_embeddings
            ORDER BY created_at DESC
            {limit_clause}
        """)
        
        embeddings_result = conn.execute(embeddings_query)
        embeddings = []
        for row in embeddings_result:
            embeddings.append({
                "source_table": row.source_table,
                "source_id": row.source_id,
                "source_title": row.source_title,
                "chunk_text": row.chunk_text,
                "source_payload": dict(row.source_payload) if row.source_payload else {},
                "metadata": dict(row.metadata) if row.metadata else {},
                "content_hash": row.content_hash,
                "vectorized_at": row.vectorized_at.isoformat() if row.vectorized_at else None,
                "created_at": row.created_at.isoformat() if row.created_at else None
            })
        
        embeddings_file = os.path.join(output_dir, "rag_document_embeddings.json")
        with open(embeddings_file, 'w', encoding='utf-8') as f:
            json.dump(embeddings, f, ensure_ascii=False, indent=2)
        print(f"Exported {len(embeddings)} embeddings to {embeddings_file}")
        
        # Create combined export for GraphRAG
        combined_file = os.path.join(output_dir, "graphrag_input.json")
        combined_data = {
            "exported_at": datetime.now().isoformat(),
            "total_chunks": len(chunks),
            "total_embeddings": len(embeddings),
            "documents": []
        }
        
        # Group chunks by source for document-level processing
        docs_by_source = {}
        for chunk in chunks:
            key = f"{chunk['source_table']}_{chunk['source_id']}"
            if key not in docs_by_source:
                docs_by_source[key] = {
                    "source_table": chunk["source_table"],
                    "source_id": chunk["source_id"],
                    "title": chunk["title"] or f"Document {key}",
                    "category": chunk["category"],
                    "domain": chunk["domain"],
                    "chunks": []
                }
            docs_by_source[key]["chunks"].append(chunk["chunk_text"])
        
        combined_data["documents"] = list(docs_by_source.values())
        
        with open(combined_file, 'w', encoding='utf-8') as f:
            json.dump(combined_data, f, ensure_ascii=False, indent=2)
        print(f"Exported {len(combined_data['documents'])} documents to {combined_file}")
        
        return {
            "chunks": len(chunks),
            "embeddings": len(embeddings),
            "documents": len(combined_data["documents"]),
            "output_dir": output_dir
        }

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Export vectorized data from PostgreSQL")
    parser.add_argument("--limit", type=int, help="Limit number of records to export")
    parser.add_argument("--output", default="exported_data", help="Output directory")
    args = parser.parse_args()
    
    result = export_data(limit=args.limit, output_dir=args.output)
    print(f"\nExport complete: {result}")
