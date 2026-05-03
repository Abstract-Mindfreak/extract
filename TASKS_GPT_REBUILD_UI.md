# TASKS: GPT UI Rebuild

## Active checkpoint
- [x] Создать backup branch: `backup/ui-rebuild-preflight-2026-05-03`
- [x] Зафиксировать один source of truth для архивных output-папок
- [ ] Подтвердить и зафиксировать `react/my-app` как главный app
- [ ] Отключить неверный Electron-фокус без удаления полезных Python-скриптов
- [~] Отвязать performance/audio/prismatic слой от главного UI
- [~] Перенести новый shell из `src/main-template-new.tsx`
- [~] Встроить `Prompt Library`, `ASE Console`, `Archives` в одну страницу
- [x] Проверить сборку

## Phase 1. Archiver source of truth
- [x] Найти все места, где используются `producer_backup_*`
- [x] Найти все места, где используются `flowmusic_backup_*`
- [x] Вынести единый конфиг аккаунтов/директорий
- [x] Переключить React service на `flowmusic_*`
- [x] Переключить `archiver-server.js` на `flowmusic_*`
- [x] Проверить совместимость со старой структурой папок
- [x] Обновить UI-тексты, где вводят в заблуждение

## Phase 2. App focus cleanup
- [ ] Найти Electron entrypoints и связанный запускной фокус
- [ ] Отключить/понизить приоритет Electron app
- [~] Проверить, что `react/my-app` остаётся рабочей основной точкой
- [x] Не трогать Python-скрипты, которые используются или могут понадобиться

## Phase 3. Remove audio/performance surface
- [x] Убрать вкладки `Performance` и `Advanced`
- [x] Убрать `HeaderBar` действия `Capture Baseline`, `Orbit Start`, `Play`, `Bind Vision`
- [x] Убрать `Audio Engine Panel` с главной поверхности
- [x] Убрать `Orbit Motion Panel` с главной поверхности
- [x] Убрать `Image Analysis Panel` с главной поверхности
- [x] Убрать `Intent Panel` с главной поверхности
- [x] Убрать `System Panels` с главной поверхности
- [x] Отвязать `PrismaticCoreDock`
- [x] Сохранить `PrismaticCore Sync` как disabled-концепт в `ASE Audio Decomposer`
- [~] Проверить, что `Prompt Library`, `ASE Console`, `Archives` не повреждены

## Phase 4. New shell from template
- [x] Разобрать структуру `main-template-new.tsx`
- [x] Выделить shell-компоненты и зоны layout
- [~] Перенести стили и визуальную иерархию в проект
- [~] Создать новый app shell поверх текущих core modes
- [~] Упростить навигацию и убрать дублирующие слои управления
- [ ] Сохранить fullscreen / panel workflow там, где это уже нужно

## Phase 5. Unified single-page work surface
- [x] Встроить `Prompt Library` в новый shell
- [x] Встроить `ASE Console` в новый shell
- [x] Встроить `Archives` в новый shell
- [~] Сделать работу с подрежимами без перехода на отдельные страницы
- [~] Проверить визуальную связность и удобство
- [ ] Довести rail/drawer/mobile поведение до полностью понятного вида

## Phase 6. Validation
- [x] `npm run build`
- [ ] Проверить архиватор и output path flow
- [ ] Проверить импорт архива в библиотеку
- [ ] Проверить `ASE -> JsonSequenceBuilder`
- [ ] Проверить `Prompt Library` block/sequence flow
- [ ] Подготовить список старого UI на возможное удаление после подтверждения

## What was completed recently
- [x] Переведён app на single-page shell вокруг трёх core modes
- [x] Добавлены rail и contextual drawer
- [x] Сохранена логика `Prompt Library`, `ASE Console`, `Archives`
- [x] Снижен фокус на старом prismatic/performance UI

## What remains next
- [ ] Упростить верхний shell ещё ближе к шаблону без потери функций
- [ ] Дочистить оставшиеся неиспользуемые хвосты в `App.js`
- [ ] Пройтись по responsive UX и убрать потенциальную перегруженность
- [ ] Провести ручную smoke-проверку основных сценариев
