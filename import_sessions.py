import os
import sys
import json
import uuid
from pathlib import Path
from datetime import datetime, timezone
from typing import List, Dict, Any
from sqlmodel import Session, select

sys.path.insert(0, str(Path(__file__).parent.parent))

from database.connection import engine, init_db
from database.models import ChatSession, SessionSongLink, Song

def parse_iso_datetime(date_string: str) -> datetime:
    if not date_string:
        return datetime.now(timezone.utc)
    
    try:
        if date_string.endswith('Z'):
            date_string = date_string[:-1] + '+00:00'
        return datetime.fromisoformat(date_string)
    except (ValueError, AttributeError):
        print(f"Warning: Could not parse datetime '{date_string}', using current time")
        return datetime.now(timezone.utc)

class SessionsETLPipeline:
    def __init__(self, root_dir_path: str):
        self.root_dir = Path(root_dir_path)
        if not self.root_dir.exists():
            raise FileNotFoundError(f"Корневая директория архива не найдена: {root_dir_path}")

    def run_import(self):
        print(f"Старт импорта сессий из директории: {self.root_dir}")
        init_db()
        
        session_files = list(self.root_dir.rglob("sessions/*.json"))
        print(f"Найдено файлов сессий для импорта: {len(session_files)}")
        
        with Session(engine) as session:
            for index, session_file_path in enumerate(session_files, start=1):
                try:
                    self._process_single_session(session_file_path, session)
                    if index % 50 == 0:
                        session.commit()
                        print(f"Обработано и зафиксировано в БД сессий: {index}")
                except Exception as error:
                    session.rollback()
                    print(f"Критическая ошибка при обработке файла {session_file_path}: {str(error)}")
            
            session.commit()
        print("Импорт сессий успешно завершен.")

    def _process_single_session(self, session_file_path: Path, session: Session):
        with open(session_file_path, "r", encoding="utf-8") as file_descriptor:
            json_data = json.load(file_descriptor)
        
        conversation_id_str = json_data.get("conversation_id")
        if not conversation_id_str:
            print(f"Пропуск файла {session_file_path}: отсутствует conversation_id")
            return
        
        try:
            conversation_id = uuid.UUID(conversation_id_str)
        except ValueError:
            print(f"Пропуск файла {session_file_path}: некорректный формат conversation_id")
            return
        
        existing_session = session.get(ChatSession, conversation_id)
        if existing_session:
            print(f"Сессия {conversation_id} уже существует. Удаление старой записи.")
            session.delete(existing_session)
            session.flush()
        
        title = json_data.get("title")
        user_id_str = json_data.get("user_id")
        project_id_str = json_data.get("project_id")
        created_at_str = json_data.get("created_at")
        captured_at_str = json_data.get("captured_at")
        
        user_id = uuid.UUID(user_id_str) if user_id_str else None
        project_id = uuid.UUID(project_id_str) if project_id_str else None
        created_at = parse_iso_datetime(created_at_str)
        captured_at = parse_iso_datetime(captured_at_str)
        
        new_session = ChatSession(
            id=conversation_id,
            title=title,
            user_id=user_id,
            project_id=project_id,
            created_at=created_at,
            captured_at=captured_at,
            full_payload=json_data
        )
        session.add(new_session)
        
        linked_data = json_data.get("linked", {})
        linked_clip_ids = linked_data.get("linked_clip_ids", [])
        
        if linked_clip_ids:
            for clip_id_str in linked_clip_ids:
                try:
                    clip_id = uuid.UUID(clip_id_str)
                    song_exists = session.exec(select(Song).where(Song.id == clip_id)).first()
                    
                    if song_exists:
                        link = SessionSongLink(
                            session_id=new_session.id,
                            song_id=clip_id
                        )
                        session.add(link)
                    else:
                        print(f"Предупреждение: Песень с ID {clip_id} не найдена в БД, линк пропущен")
                except ValueError:
                    print(f"Предупреждение: Некорректный формат clip_id '{clip_id_str}', линк пропущен")
                except Exception as error:
                    print(f"Предупреждение: Ошибка при обработке линка для clip_id '{clip_id_str}': {str(error)}")

if __name__ == "__main__":
    target_archive_path = os.getenv("FLOWMUSIC_ARCHIVER_PATH", "flowmusic-archiver")
    pipeline = SessionsETLPipeline(root_dir_path=target_archive_path)
    pipeline.run_import()
