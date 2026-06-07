import os
import sys
import json
import re
import uuid
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any
from sqlmodel import Session, select

sys.path.insert(0, str(Path(__file__).parent.parent))

from database.connection import engine, init_db
from database.models import Song, SongLyrics, LyricsTimingMarker, MediaAsset

FOLDER_PATTERN = re.compile(r"^([a-f0-9\-]{36})_(.*)$")

class ArchiverETLPipeline:
    def __init__(self, root_dir_path: str):
        self.root_dir = Path(root_dir_path)
        if not self.root_dir.exists():
            raise FileNotFoundError(f"Корневая директория архива не найдена: {root_dir_path}")

    def run_import(self):
        print(f"Старт импорта архива из директории: {self.root_dir}")
        init_db()
        
        meta_files_paths = list(self.root_dir.rglob("meta.json"))
        print(f"Найдено потенциальных блоков для импорта: {len(meta_files_paths)}")
        
        with Session(engine) as session:
            for index, meta_path in enumerate(meta_files_paths, start=1):
                try:
                    self._process_single_block(meta_path, session)
                    if index % 50 == 0:
                        session.commit()
                        print(f"Обработано и зафиксировано в БД блоков: {index}")
                except Exception as error:
                    session.rollback()
                    print(f"Критическая ошибка при обработке файла {meta_path}: {str(error)}")
            
            session.commit()
        print("Импорт успешно завершен.")

    def _process_single_block(self, meta_file_path: Path, session: Session):
        folder_name = meta_file_path.parent.name
        match = FOLDER_PATTERN.match(folder_name)
        
        if not match:
            print(f"Пропуск папки (не соответствует паттерну структуры): {folder_name}")
            return

        extracted_uuid_str = match.group(1)
        phase_logic_info = match.group(2)
        
        try:
            block_uuid = uuid.UUID(extracted_uuid_str)
        except ValueError:
            print(f"Некорректный формат UUID в имени папки: {extracted_uuid_str}")
            return

        with open(meta_file_path, "r", encoding="utf-8") as file_descriptor:
            json_data = json.load(file_descriptor)

        raw_data_block = json_data.get("raw_data", {})
        operation_block = raw_data_block.get("operation", {})
        sound_prompt_extracted = operation_block.get("sound_prompt", None)

        existing_song = session.get(Song, block_uuid)
        if existing_song:
            print(f"Запись {block_uuid} уже существует. Обновление метаданных.")
            session.delete(existing_song)
            session.flush()

        new_song = Song(
            id=block_uuid,
            title=json_data.get("title", "Unknown Title"),
            audio_url=json_data.get("audio_url", None),
            video_url=json_data.get("video_url", None),
            image_url=json_data.get("image_url", None),
            created_at=datetime.strptime(json_data.get("created_at", "2026-01-01T00:00:00.000000Z").replace("Z", ""), "%Y-%m-%dT%H:%M:%S.%f"),
            source_url=json_data.get("source_url", None),
            play_count=json_data.get("play_count", 0),
            favorite_count=json_data.get("favorite_count", 0),
            sound_prompt=sound_prompt_extracted,
            phase_transition_logic=phase_logic_info,
            raw_data=json_data
        )
        session.add(new_song)

        lyrics_node = json_data.get("lyrics", None)
        if lyrics_node and isinstance(lyrics_node, dict):
            lyrics_value = lyrics_node.get("value", {})
            if lyrics_value and isinstance(lyrics_value, dict):
                new_lyrics = SongLyrics(
                    id=uuid.uuid4(),
                    song_id=new_song.id,
                    status=lyrics_node.get("status", "completed"),
                    text=lyrics_value.get("text", "")
                )
                session.add(new_lyrics)

        lyrics_timing_node = raw_data_block.get("lyrics_timing", {})
        if lyrics_timing_node and isinstance(lyrics_timing_node, dict):
            timing_value = lyrics_timing_node.get("value", {})
            if timing_value and isinstance(timing_value, dict):
                markers_list = timing_value.get("markers", [])
                for idx, marker in enumerate(markers_list):
                    if len(marker) == 2:
                        char_pos = int(marker[0])
                        time_sec = float(marker[1])
                        new_marker = LyricsTimingMarker(
                            song_id=new_song.id,
                            marker_index=idx,
                            character_position=char_pos,
                            timestamp_seconds=time_sec
                        )
                        session.add(new_marker)

        parent_directory = meta_file_path.parent
        audio_name = "audio.m4a" if (parent_directory / "audio.m4a").exists() else None
        image_name = "image.jpg" if (parent_directory / "image.jpg").exists() else None
        has_bak = (parent_directory / "audio.m4a.bak").exists()

        new_asset = MediaAsset(
            song_id=new_song.id,
            local_directory_path=str(parent_directory.resolve()),
            audio_file_name=audio_name,
            image_file_name=image_name,
            has_backup_audio=has_bak,
            last_sync_at=datetime.now(datetime.UTC)
        )
        session.add(new_asset)

if __name__ == "__main__":
    target_archive_path = os.getenv("FLOWMUSIC_ARCHIVER_PATH", "flowmusic-archiver")
    pipeline = ArchiverETLPipeline(root_dir_path=target_archive_path)
    pipeline.run_import()
