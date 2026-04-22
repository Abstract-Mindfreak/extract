# TASKS_PLAN_GPT

## Текущий фокус

1. Починить импорт реальных `meta.json` из `flowmusic-archiver`, чтобы не терялись:
   - `raw_data.operation.sound_prompt`
   - `raw_data.operation.conversation_id`
   - session-ссылка вида `https://www.flowmusic.app/session/<conversationId>#song-<trackId>`
2. Добавить enrichment сессий через живой FlowMusic.app API по сохранённым auth state аккаунтов.
3. Сохранять в IndexedDB не только синтетические сессии из `SessionExtractor`, но и реальные conversation payload.

## Что уже сделано

- `MetaParser.js`
  - добавлен разбор `sound_prompt` из `raw_data.operation`
  - добавлен разбор `conversation_id` из `raw_data.operation`
  - добавлен `sessionUrl` для трека
- `archiver-server.js`
  - добавлен batch endpoint `POST /api/accounts/:id/conversations/batch`
  - добавлен Playwright-based fetch conversation payloads через сохранённый auth state
- `ProducerArchiverService.js`
  - добавлен клиентский метод `fetchConversationBatch()`
- `ProducerSessionParser.js`
  - добавлен парсер FlowMusic.app conversation payload → session model приложения
- `LocalDataImporter.js`
  - добавлен enrichment сессий через FlowMusic.app поверх локального архива
- `flowmusic-archiver/archiver.mjs`
  - run стал двухфазным: после harvest/download сохраняет реальные session payloads
  - session JSON пишутся в `flowmusic_backup_N/sessions/session_<conversationId>.json`
  - создаётся `session_capture_summary.json`
- `StorageService.js`
  - добавлена нормализация фрагментов перед записью в IndexedDB
- `SessionExtractor.js`
  - фрагменты теперь получают `fragmentId`, `conversationId`, `text`
- UI
  - кнопки открытия на сайте теперь предпочитают `track.sessionUrl`

## Следующая проверка

1. Запустить `npm run archiver:server` в `react/my-app`
2. Запустить архиватор на одном аккаунте и убедиться, что после `ARCHIVAL COMPLETE` сохраняются session JSON
3. Выполнить импорт локальных данных
4. Проверить:
   - появились ли промты у треков
   - появились ли conversationId/session links
   - открывается ли `SessionDialog` с реальными сообщениями
   - корректно ли связались generated songs по `clip_id` / `operation_id`

## Если что-то ещё останется кривым

- проверить формат дат в таблице
- проверить, не нужны ли дополнительные `part_kind` из `conversation.messages`
- решить, хотим ли хранить raw conversation payload целиком в IndexedDB для отладки
