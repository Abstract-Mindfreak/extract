# `react/my-app`

Основной React shell проекта Flowmusic MMSS.

## Что здесь живет

- `Prompt Library`
- `ASE Console`
- `Archives`
- `JSON Genesis bridge`

## Команды

```bash
npm install
npm start
npm run build
npm run archiver:server
```

Дополнительно:

```bash
npm run json:genesis:dev
npm run jsonhero:dev
```

## Локальные сервисы

- app shell: `http://localhost:3000`
- archiver / MMSS bridge / Mistral proxy: `http://localhost:3456`
- local JSON Hero: `http://localhost:8787`

## Актуальные UX-правила

- Переключение режимов идет через левую rail-навигацию.
- Верхние `template-mode-switcher` кнопки удалены как дублирующий элемент.
- `Service Health` находится в `System State` и обновляется только по кнопке `Check Status`.
- В `Block Library` по умолчанию показываются первые 6 блоков, полный список раскрывается через `View All`.

## Основные файлы

- `src/App.js` — shell, drawer, stage routing, bridge controls
- `src/components/JsonBlockList.jsx` — список блоков библиотеки
- `src/components/JsonSequenceBuilder.jsx` — sequence builder
- `archiver-server.js` — bridge, proxy и MMSS endpoints

## Важно для следующих изменений

- Не реанимировать legacy/performance/magnetic поверхности автоматически.
- Не считать старые README, комментарии или остаточные стили источником истины, если они противоречат текущему shell.
