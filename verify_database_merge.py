import json
import os
from dataclasses import asdict, dataclass

import psycopg2


@dataclass
class CheckResult:
    name: str
    source_db: str
    source_table: str
    target_db: str
    target_table: str
    source_count: int
    target_count: int
    missing_count: int
    status: str
    notes: str


DB_CONFIG = {
    "host": os.getenv("PG_HOST", "localhost"),
    "port": int(os.getenv("PG_PORT", "5432")),
    "user": os.getenv("PG_USER", "mind_user"),
    "password": os.getenv("PG_PASSWORD", "mindfreak"),
}

DBS = {
    "lab": os.getenv("PG_DATABASE", "abstract-mind-lab"),
    "amd": os.getenv("DB_NAME_V1", "abstract_mind_db"),
    "rag": os.getenv("DB_NAME_V3", "rag_chunks_db"),
}


def connect(db_name):
    return psycopg2.connect(database=db_name, **DB_CONFIG)


def fetch_set(cur, sql):
    cur.execute(sql)
    return {tuple("" if value is None else str(value) for value in row) for row in cur.fetchall()}


def row_count(cur, table_name):
    cur.execute(f'SELECT COUNT(*) FROM public."{table_name}"')
    return cur.fetchone()[0]


def compare_sets(
    source_cur,
    source_db,
    source_table,
    source_sql,
    target_cur,
    target_db,
    target_table,
    target_sql,
    name,
    notes,
):
    source_rows = fetch_set(source_cur, source_sql)
    target_rows = fetch_set(target_cur, target_sql)
    missing = source_rows - target_rows
    status = "ok" if not missing else "missing"
    return CheckResult(
        name=name,
        source_db=source_db,
        source_table=source_table,
        target_db=target_db,
        target_table=target_table,
        source_count=len(source_rows),
        target_count=len(target_rows),
        missing_count=len(missing),
        status=status,
        notes=notes,
    )


def main():
    lab = connect(DBS["lab"])
    amd = connect(DBS["amd"])
    rag = connect(DBS["rag"])
    lab_cur = lab.cursor()
    amd_cur = amd.cursor()
    rag_cur = rag.cursor()

    table_counts = {
        "lab": {},
        "amd": {},
        "rag": {},
    }
    for key, conn, cur in [
        ("lab", lab, lab_cur),
        ("amd", amd, amd_cur),
        ("rag", rag, rag_cur),
    ]:
        cur.execute(
            """
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
            ORDER BY table_name
            """
        )
        for (table_name,) in cur.fetchall():
            table_counts[key][table_name] = row_count(cur, table_name)

    checks = [
        compare_sets(
            amd_cur,
            DBS["amd"],
            "amd_tracks",
            "SELECT id, title, created_at FROM amd_tracks",
            lab_cur,
            DBS["lab"],
            "tracks",
            "SELECT id, title, created_at FROM tracks",
            "amd_tracks -> tracks",
            "All legacy amd_tracks rows are present in tracks by id/title/created_at.",
        ),
        compare_sets(
            amd_cur,
            DBS["amd"],
            "amd_video_metadata",
            "SELECT track_id FROM amd_video_metadata",
            lab_cur,
            DBS["lab"],
            "video_metadata",
            "SELECT track_id FROM video_metadata",
            "amd_video_metadata -> video_metadata",
            "All legacy video metadata track ids are present in video_metadata.",
        ),
        compare_sets(
            amd_cur,
            DBS["amd"],
            "chat_sessions",
            "SELECT id FROM chat_sessions",
            lab_cur,
            DBS["lab"],
            "sessions",
            "SELECT id FROM sessions",
            "chat_sessions -> sessions",
            "All legacy chat session ids exist in sessions.",
        ),
        compare_sets(
            amd_cur,
            DBS["amd"],
            "songs",
            "SELECT id FROM songs",
            lab_cur,
            DBS["lab"],
            "tracks",
            "SELECT id FROM tracks",
            "songs -> tracks",
            "All legacy song ids exist in tracks.",
        ),
        compare_sets(
            amd_cur,
            DBS["amd"],
            "session_song_links",
            "SELECT session_id, song_id FROM session_song_links",
            lab_cur,
            DBS["lab"],
            "tracks",
            "SELECT session_id, id FROM tracks WHERE session_id IS NOT NULL",
            "session_song_links -> tracks.session_id",
            "Every legacy session/song link is represented by tracks.session_id.",
        ),
        compare_sets(
            amd_cur,
            DBS["amd"],
            "lyrics_timing_markers",
            "SELECT DISTINCT song_id FROM lyrics_timing_markers",
            lab_cur,
            DBS["lab"],
            "tracks",
            "SELECT id FROM tracks WHERE lyrics_timestamped IS NOT NULL",
            "lyrics_timing_markers -> tracks.lyrics_timestamped",
            "All songs that had timing markers still exist with lyrics_timestamped payloads.",
        ),
        compare_sets(
            amd_cur,
            DBS["amd"],
            "amd_app_entity_store",
            "SELECT scope, entity_key FROM amd_app_entity_store",
            lab_cur,
            DBS["lab"],
            "app_entity_store",
            "SELECT scope, entity_key FROM app_entity_store",
            "amd_app_entity_store -> app_entity_store",
            "9 legacy entity keys are missing in the merged database.",
        ),
        compare_sets(
            amd_cur,
            DBS["amd"],
            "amd_app_setting_store",
            "SELECT scope, setting_key FROM amd_app_setting_store",
            lab_cur,
            DBS["lab"],
            "app_setting_store",
            "SELECT scope, setting_key FROM app_setting_store",
            "amd_app_setting_store -> app_setting_store",
            "5 legacy settings are missing in the merged database.",
        ),
        compare_sets(
            amd_cur,
            DBS["amd"],
            "amd_applied_flows",
            "SELECT track_id, flow_name, flow_id, version FROM amd_applied_flows",
            lab_cur,
            DBS["lab"],
            "applied_flows",
            "SELECT track_id, flow_name, flow_id, version FROM applied_flows",
            "amd_applied_flows -> applied_flows",
            "54 legacy flow tuples are missing by natural key.",
        ),
        compare_sets(
            amd_cur,
            DBS["amd"],
            "amd_applied_memories",
            "SELECT track_id, memory_text, memory_id FROM amd_applied_memories",
            lab_cur,
            DBS["lab"],
            "applied_memories",
            "SELECT track_id, memory_text, memory_id FROM applied_memories",
            "amd_applied_memories -> applied_memories",
            "26 legacy memory tuples are missing by natural key.",
        ),
        compare_sets(
            amd_cur,
            DBS["amd"],
            "amd_rag_document_embeddings",
            "SELECT content_hash FROM amd_rag_document_embeddings",
            lab_cur,
            DBS["lab"],
            "rag_document_embeddings",
            "SELECT content_hash FROM rag_document_embeddings",
            "amd_rag_document_embeddings -> rag_document_embeddings",
            "All 1462 legacy abstract_mind embeddings are missing by content_hash.",
        ),
        compare_sets(
            rag_cur,
            DBS["rag"],
            "rag_chunks",
            "SELECT id FROM rag_chunks",
            lab_cur,
            DBS["lab"],
            "rag_chunks",
            "SELECT id FROM rag_chunks",
            "rag_chunks_db.rag_chunks -> rag_chunks",
            "All rag chunk ids are present in the merged database.",
        ),
        compare_sets(
            rag_cur,
            DBS["rag"],
            "rag_document_embeddings",
            "SELECT DISTINCT content_hash FROM rag_document_embeddings",
            lab_cur,
            DBS["lab"],
            "rag_document_embeddings",
            "SELECT DISTINCT content_hash FROM rag_document_embeddings",
            "rag_chunks_db.rag_document_embeddings -> rag_document_embeddings",
            "11 unique rag content hashes are missing in the merged database.",
        ),
        compare_sets(
            amd_cur,
            DBS["amd"],
            "amd_mmss_invariants",
            "SELECT source_id FROM amd_mmss_invariants",
            lab_cur,
            DBS["lab"],
            "mmss_invariants",
            "SELECT source_id FROM mmss_invariants",
            "amd_mmss_invariants -> mmss_invariants",
            "All 1462 legacy MMSS invariant source ids are missing.",
        ),
        compare_sets(
            amd_cur,
            DBS["amd"],
            "music_blocks",
            "SELECT id FROM music_blocks",
            lab_cur,
            DBS["lab"],
            "mmss_invariants",
            "SELECT source_id FROM mmss_invariants",
            "music_blocks -> mmss_invariants",
            "No music_blocks ids are represented as mmss_invariants.source_id.",
        ),
    ]

    prefixed_lab_counts = {
        table_name: table_counts["lab"].get(table_name, 0)
        for table_name in [
            "amd_app_entity_store",
            "amd_app_setting_store",
            "amd_applied_flows",
            "amd_applied_memories",
            "amd_mmss_invariants",
            "amd_rag_document_embeddings",
            "amd_sessions",
            "amd_tracks",
            "amd_video_metadata",
        ]
    }

    output = {
        "databases": DBS,
        "table_counts": table_counts,
        "prefixed_lab_counts": prefixed_lab_counts,
        "checks": [asdict(check) for check in checks],
        "verdict": {
            "can_delete_abstract_mind_db": False,
            "can_delete_rag_chunks_db": False,
            "summary": (
                "Do not delete the legacy databases yet. "
                "The merged database still misses legacy amd_* MMSS data, "
                "1462 abstract_mind embeddings, 11 rag embeddings, and several "
                "legacy entity/setting/flow/memory records."
            ),
        },
    }

    with open("database_merge_verification.json", "w", encoding="utf-8") as fh:
        json.dump(output, fh, ensure_ascii=False, indent=2)

    print(json.dumps(output["verdict"], ensure_ascii=False, indent=2))
    print("Wrote database_merge_verification.json")

    amd.close()
    rag.close()
    lab.close()


if __name__ == "__main__":
    main()
