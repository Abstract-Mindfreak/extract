Предыстория и задача:
Мы интегрируем логи сессий нейросети (LLM-диалогов) из JSON-файлов архива в нашу реляционную базу данных PostgreSQL. Файлы сессий находятся по пути `flowmusic-archiver/**/sessions/*.json`. 
Нам нужно реализовать гибридный подход: метаданные сессии вынести в индексируемые колонки, весь массив переписки сохранить «как есть» в бинарное поле JSONB, а связь между сессиями и существующими музыкальными треками реализовать через таблицу-мост (многие-ко-многим), используя поле `linked_clip_ids` из JSON.

Используемый стек: Python 3.11+, SQLModel (SQLAlchemy), PostgreSQL.

Твоя задача — пошагово выполнить следующие изменения в проекте:

1. ОБНОВЛЕНИЕ МОДЕЛЕЙ ДАННЫХ
В файле `database/models.py` добавь две новые модели и обнови существующую модель `Song`:
- Модель `SessionSongLink` (таблица `session_song_links`): связующая таблица для связи многие-ко-многим между `chat_sessions` и `songs`. Поля `session_id` и `song_id` являются первичными и внешними ключами с `ondelete="CASCADE"`.
- Модель `ChatSession` (таблица `chat_sessions`):
    * `id`: uuid.UUID (primary_key=True, index=True, мапится на `conversation_id` из JSON).
    * `title`: Optional[str] (index=True)
    * `user_id`: Optional[uuid.UUID] (index=True)
    * `project_id`: Optional[uuid.UUID]
    * `created_at`: datetime (index=True)
    * `captured_at`: datetime (index=True)
    * `full_payload`: Dict[str, Any] — должно использовать тип `Column(JSONB)` из `sqlalchemy.dialects.postgresql`.
    * `songs`: связь `Relationship` к модели `Song` через `link_model=SessionSongLink`.
- В существующую модель `Song` добавь обратную связь:
    * `sessions: List["ChatSession"] = Relationship(back_populates="songs", link_model=SessionSongLink)`

2. СОЗДАНИЕ ETL-СКРИПТА ДЛЯ ИМПОРТА
Создай новый файл `scripts/import_sessions.py`. Скрипт должен:
- Рекурсивно обходить директорию `flowmusic-archiver` (путь брать из переменной окружения `FLOWMUSIC_ARCHIVER_PATH` с дефолтом `flowmusic-archiver`) и искать все файлы внутри папок `sessions/*.json`.
- Парсить JSON. Использовать `conversation_id` как ID сессии.
- Быть идемпотентным: если сессия с таким ID уже есть в БД, старую запись нужно удалить (или обновить), чтобы избежать конфликтов primary key при повторных запусках.
- Корректно парсить даты ISO 8601 (строки вида `2025-11-20T15:30:00Z` должны безопасно преобразовываться в `datetime` с таймзоной UTC).
- Связывать сессию с треками из `linked.linked_clip_ids`. **Важно:** связь в `SessionSongLink` записывать только в том случае, если `clip_id` физически существует в таблице `songs` (проверять через `select(Song)`), иначе пропускать этот конкретный линк и выводить предупреждение в лог, чтобы не падать по Foreign Key Error.
- Пакетировать коммиты (делать `db_session.commit()` каждые 50-100 обработанных файлов для оптимизации скорости).

3. ДОБАВЛЕНИЕ ПОСТГРЕС-ИНДЕКСОВ
Добавь генерацию индексов в базу данных. Если вы используете миграции Alembic, сгенерируй миграцию. Если БД инициализируется через `init_db()`, убедись, что выполняются следующие SQL-команды или настройки индексов SQLModel:
- GIN-индекс на поле `full_payload` таблицы `chat_sessions` для быстрого поиска по внутренностям JSON.
- Стандартный B-tree индекс на `user_id`.

План действий для тебя:
1. Проанализируй текущую структуру файлов `database/models.py` и `database/connection.py`.
2. Напиши код изменений в `database/models.py`.
3. Создай скрипт `scripts/import_sessions.py`.
4. Запусти скрипт или предоставь инструкции по его тестированию.

Действуй аккуратно, пиши чистый код, обрабатывай исключения `ValueError` при конвертации UUID и логируй процесс выполнения.