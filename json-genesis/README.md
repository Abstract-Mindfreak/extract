# `json-genesis`

`json-genesis` — отдельное приложение для генерации и редактирования JSON/MMSS-структур с AI-пайплайном.

## Назначение

- импорт и просмотр MMSS library из `react/my-app`
- retrieval candidate flow для Mistral
- approve/pin workflow
- generation JSON через Mistral/Gemini
- экспорт и обратная передача результата в основной shell

## Текущий статус

Поддерживается multi-step pipeline:

- `plan`
- `preview`
- `approve`
- `generate`

Также поддерживаются:

- `approved context`
- `Mistral preset` в `localStorage` и bridge
- `Include MMSS Meta Rules`
- инспектор полного library block без перезагрузки

## Команды

```bash
npm install
npm run dev
npm run lint
npm run build
```

## Локальная интеграция

По умолчанию приложение работает вместе с bridge-сервером из `react/my-app`:

- MMSS bridge: `http://localhost:3456/api/mmss`
- Mistral proxy: `http://localhost:3456/api/mistral/*`
- JSON Hero local: `http://localhost:8787`

## Важные файлы

- `src/components/MainEditor.tsx` — главный UI и Mistral pipeline
- `src/services/aiService.ts` — вызовы моделей и parsing ответов
- `src/services/mmssMetaInjector.ts` — MMSS meta-rules injector
- `src/mmss/mmssRetrievalCandidate.schema.json` — schema retrieval candidate

## Ограничения и договоренности

- Retrieval и scoring постепенно выносятся в backend-driven flow.
- `json-genesis` не должен самовольно подтягивать старые Electron/legacy скрипты из `prompt-db-local` в core runtime.
- Любые интеграции с legacy-скриптами должны идти как отдельные adapters, а не как обязательная зависимость UI.
