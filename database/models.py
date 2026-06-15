import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column
from sqlalchemy.dialects.postgresql import JSONB

class SongBase(SQLModel):
    id: uuid.UUID = Field(default=None, primary_key=True, index=True)
    title: str = Field(index=True)
    audio_url: Optional[str] = Field(default=None)
    video_url: Optional[str] = Field(default=None)
    image_url: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), index=True)
    source_url: Optional[str] = Field(default=None)
    play_count: int = Field(default=0)
    favorite_count: int = Field(default=0)
    sound_prompt: Optional[str] = Field(default=None)
    phase_transition_logic: Optional[str] = Field(default=None, index=True)

class SessionSongLink(SQLModel, table=True):
    __tablename__ = "session_song_links"

    session_id: uuid.UUID = Field(foreign_key="chat_sessions.id", primary_key=True, ondelete="CASCADE")
    song_id: uuid.UUID = Field(foreign_key="songs.id", primary_key=True, ondelete="CASCADE")

class Song(SongBase, table=True):
    __tablename__ = "songs"

    raw_data: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSONB))
    
    lyrics: Optional["SongLyrics"] = Relationship(back_populates="song", sa_relationship_kwargs={"uselist": False, "cascade": "all, delete-orphan"})
    media_assets: Optional["MediaAsset"] = Relationship(back_populates="song", sa_relationship_kwargs={"uselist": False, "cascade": "all, delete-orphan"})
    timing_markers: List["LyricsTimingMarker"] = Relationship(back_populates="song", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
    sessions: List["ChatSession"] = Relationship(back_populates="songs", link_model=SessionSongLink)

class SongLyrics(SQLModel, table=True):
    __tablename__ = "song_lyrics"

    id: uuid.UUID = Field(default=None, primary_key=True)
    song_id: uuid.UUID = Field(foreign_key="songs.id", index=True, unique=True)
    status: str = Field(default="pending")
    text: str = Field(default="")
    
    song: Optional[Song] = Relationship(back_populates="lyrics")

class LyricsTimingMarker(SQLModel, table=True):
    __tablename__ = "lyrics_timing_markers"

    id: Optional[int] = Field(default=None, primary_key=True)
    song_id: uuid.UUID = Field(foreign_key="songs.id", index=True)
    marker_index: int = Field(description="Порядковый номер маркера")
    character_position: int = Field(description="Позиция символа в тексте")
    timestamp_seconds: float = Field(description="Временная отметка в секундах")

    song: Optional[Song] = Relationship(back_populates="timing_markers")

class MediaAsset(SQLModel, table=True):
    __tablename__ = "media_assets"

    id: Optional[int] = Field(default=None, primary_key=True)
    song_id: uuid.UUID = Field(foreign_key="songs.id", index=True, unique=True)
    local_directory_path: str = Field(description="Абсолютный или относительный путь к директории блока")
    audio_file_name: Optional[str] = Field(default=None)
    image_file_name: Optional[str] = Field(default=None)
    has_backup_audio: bool = Field(default=False, description="Флаг присутствия файла audio.m4a.bak")
    last_sync_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    song: Optional[Song] = Relationship(back_populates="media_assets")

class ChatSession(SQLModel, table=True):
    __tablename__ = "chat_sessions"

    id: uuid.UUID = Field(default=None, primary_key=True, index=True)
    title: Optional[str] = Field(default=None, index=True)
    user_id: Optional[uuid.UUID] = Field(default=None, index=True)
    project_id: Optional[uuid.UUID] = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), index=True)
    captured_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), index=True)
    full_payload: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSONB))
    
    songs: List["Song"] = Relationship(back_populates="sessions", link_model=SessionSongLink)

class MusicBlock(SQLModel, table=True):
    __tablename__ = "music_blocks"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    block_type: str = Field(index=True)
    layer: int = Field(index=True)
    slug: str = Field(index=True, unique=True)
    name: Optional[str] = Field(default=None)
    content: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSONB))
