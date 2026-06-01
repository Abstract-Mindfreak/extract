# Flowmusic MMSS Workspace

Основные рабочие приложения в этом репозитории:

- `react/my-app` — основной shell для `Prompt Library`, `ASE Console`, `Archives`, `JSON Genesis bridge`
- `json-genesis` — отдельный Vite/React редактор и Mistral/Gemini pipeline для JSON/MMSS

`prompt-db-local`, `flowmusic-archiver`, `jsonhero-web` и другие каталоги остаются в репозитории как вспомогательные или legacy-слои, но не являются главным UI-контуром.

## Актуальная структура

```text
extract/
├─ react/my-app/        # основной React shell
├─ json-genesis/        # standalone JSON Genesis
├─ prompt-db-local/     # legacy / optional scripts and research tooling
├─ docs/mmss/           # taskboard, progress log, MMSS docs
└─ gitprojects/         # внешние встроенные git-проекты
```

## Что сейчас считается основным

- В `react/my-app` поддерживаются только:
  - `Prompt Library`
  - `ASE Console`
  - `Archives`
  - `JSON Genesis`
- `Service Health` теперь проверяется вручную из `System State`.
- `Magnetic Builder` удален из runtime shell.
- `StageCanvas`, `MatrixEditor`, `IntentComposer`, `CompactTransportBar`, `PrismaticCoreDock` удалены из приложения и считаются вынесенными в репозиторную "корзину".

Важно:
- Эти удаленные поверхности не нужно возвращать без явного запроса.
- Если что-то из них когда-либо снова понадобится, восстанавливать это нужно осознанно из git-истории, а не включать случайно через layout или shell-навигацию.

## Быстрый запуск

### `react/my-app`

```bash
cd react/my-app
npm install
npm run archiver:server
npm start
```

### `json-genesis`

```bash
cd json-genesis
npm install
npm run dev
```

## Bridge и локальные сервисы

- MMSS bridge / Mistral proxy: `http://localhost:3456`
- JSON Hero local: `http://localhost:8787`
- `react/my-app` синхронизирует библиотеку с `json-genesis` через `/api/mmss/*`

## Документы проекта

- `TASKBOArd.md` — operational task board
- `docs/mmss/mmss_progress_log.json` — журнал выполнения
- `docs/mmss/mmss-metrics-contract.json` — MMSS metrics contract

## Правило для следующих агентных правок

- Не возвращать в приложение `Magnetic Builder`, `StageCanvas`, `MatrixEditor`, `IntentComposer`, `CompactTransportBar`, `PrismaticCoreDock`.
- Не считать старые performance/magnetic поверхности частью текущего UX.
- Любые новые правки UI нужно делать вокруг текущих четырех режимов shell.
