# FlowMusic.app Archiver & MMSS Producer Station

A comprehensive system for archiving tracks from FlowMusic.app and managing them through the MMSS (Multi-Modal Synthesis System) Producer Station interface.

## 📁 Project Structure

```
extract/
├── flowmusic-archiver/     # Node.js archiver for FlowMusic.app
│   ├── archiver.mjs           # Main archiver script with Playwright
│   ├── TECHNICAL_REFERENCE.md   # Technical documentation
│   └── ...
├── prompt-db-local/            # Local prompt database
│   └── database/
│       ├── clips/              # Generated clips database
│       ├── system/             # System configuration
│       └── ...
└── react/my-app/               # React application (MMSS Producer Station)
    ├── src/
    │   ├── components/         # UI components including ASE Console
    │   ├── services/          # API services including ProducerArchiverService
    │   └── mmss/              # MMSS audio engine
    └── archiver-server.js     # Backend server for archiver API
```

## 🎵 FlowMusic.app Archiver

Automated archiving system for FlowMusic.app tracks using Playwright browser automation.

### Features
- Multi-account support (up to 5 accounts)
- Automatic authentication via browser cookies
- Parallel downloading with rate limiting
- Incremental updates (only new tracks)
- WebSocket and HTTP API for real-time status

### Usage
```bash
cd flowmusic-archiver
npm install
node archiver.mjs --account 1 --headful
```

See [flowmusic-archiver/TECHNICAL_REFERENCE.md](flowmusic-archiver/TECHNICAL_REFERENCE.md) for detailed documentation.

## 🎛️ MMSS Producer Station

React-based audio workstation for managing and playing archived tracks.

### Features
- **ASE Console**: Autonomous Symbolic Engine for intelligent track management
- **Producer Archiver Panel**: UI for controlling the archiver from the browser
- **Multi-account support**: Manage multiple FlowMusic.app accounts
- **Real-time sync**: WebSocket connection to archiver backend
- **MMSS Audio Engine**: Advanced audio playback with timeline visualization

### Usage
```bash
cd react/my-app
npm install
npm start          # Start React app
npm run archiver:server  # Start archiver backend (in another terminal)
```

### Default Settings
- Music playback is **paused** on startup
- Default tab: **ASE Console**
- Default panel: **Producer Archiver**

## 🔌 Integration

The React app communicates with the archiver via:
- **HTTP API** at `http://localhost:3456/api`
- **WebSocket** at `ws://localhost:3456`

## 🔒 Security Notes

- Authentication tokens are stored locally (not in Git)
- Downloaded tracks are excluded from version control
- HAR files with session data are ignored
- See `.gitignore` for full list

## 🚀 Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/Abstract-Mindfreak/extract.git
   cd extract
   ```

2. **Install dependencies**
   ```bash
   cd flowmusic-archiver && npm install
   cd ../react/my-app && npm install
   ```

3. **Start the archiver server**
   ```bash
   cd react/my-app
   npm run archiver:server
   ```

4. **Start the React app** (in another terminal)
   ```bash
   cd react/my-app
   npm start
   ```

5. **Log in to FlowMusic.app** through the archiver panel in the UI

## 📝 Requirements

- Node.js 18+
- Chrome/Chromium browser
- npm or yarn

## 📄 License

MIT License - See individual subdirectories for specific licensing.

---

---

# 🇷🇺 FlowMusic.app Архиватор и MMSS Producer Station

Комплексная система для архивирования треков с FlowMusic.app и управления ими через интерфейс MMSS (Multi-Modal Synthesis System) Producer Station.

## 📁 Структура проекта

```
extract/
├── flowmusic-archiver/     # Node.js архиватор для FlowMusic.app
│   ├── archiver.mjs           # Основной скрипт архиватора с Playwright
│   ├── TECHNICAL_REFERENCE.md   # Техническая документация
│   └── ...
├── prompt-db-local/            # Локальная база данных промптов
│   └── database/
│       ├── clips/              # База данных сгенерированных клипов
│       ├── system/             # Системная конфигурация
│       └── ...
└── react/my-app/               # React приложение (MMSS Producer Station)
    ├── src/
    │   ├── components/         # UI компоненты включая ASE Console
    │   ├── services/          # API сервисы включая ProducerArchiverService
    │   └── mmss/              # MMSS аудио движок
    └── archiver-server.js     # Бэкенд сервер для API архиватора
```

## 🎵 Архиватор FlowMusic.app

Система автоматического архивирования треков с FlowMusic.app с использованием браузерной автоматизации Playwright.

### Возможности
- Поддержка нескольких аккаунтов (до 5 аккаунтов)
- Автоматическая аутентификация через cookies браузера
- Параллельная загрузка с ограничением скорости
- Инкрементальные обновления (только новые треки)
- WebSocket и HTTP API для статуса в реальном времени

### Использование
```bash
cd flowmusic-archiver
npm install
node archiver.mjs --account 1 --headful
```

Подробная документация: [flowmusic-archiver/TECHNICAL_REFERENCE.md](flowmusic-archiver/TECHNICAL_REFERENCE.md)

## 🎛️ MMSS Producer Station

React-базированная аудио-станция для управления и воспроизведения архивированных треков.

### Возможности
- **ASE Console**: Автономный Символический Движок для интеллектуального управления треками
- **Панель Архиватора Producer**: UI для управления архиватором из браузера
- **Поддержка нескольких аккаунтов**: Управление несколькими аккаунтами FlowMusic.app
- **Синхронизация в реальном времени**: WebSocket соединение с бэкендом архиватора
- **MMSS Audio Engine**: Продвинутое аудио воспроизведение с визуализацией таймлайна

### Использование
```bash
cd react/my-app
npm install
npm start          # Запуск React приложения
npm run archiver:server  # Запуск бэкенда архиватора (в другом терминале)
```

### Настройки по умолчанию
- Музыка **на паузе** при запуске
- Вкладка по умолчанию: **ASE Console**
- Панель по умолчанию: **Producer Archiver**

## 🔌 Интеграция

React приложение коммуницирует с архиватором через:
- **HTTP API** на `http://localhost:3456/api`
- **WebSocket** на `ws://localhost:3456`

## 🔒 Примечания по безопасности

- Токены аутентификации хранятся локально (не в Git)
- Загруженные треки исключены из версионного контроля
- HAR файлы с данными сессии игнорируются
- Полный список см. в `.gitignore`

## 🚀 Быстрый старт

1. **Клонирование репозитория**
   ```bash
   git clone https://github.com/Abstract-Mindfreak/extract.git
   cd extract
   ```

2. **Установка зависимостей**
   ```bash
   cd flowmusic-archiver && npm install
   cd ../react/my-app && npm install
   ```

3. **Запуск сервера архиватора**
   ```bash
   cd react/my-app
   npm run archiver:server
   ```

4. **Запуск React приложения** (в другом терминале)
   ```bash
   cd react/my-app
   npm start
   ```

5. **Вход в FlowMusic.app** через панель архиватора в UI

## 📝 Требования

- Node.js 18+
- Браузер Chrome/Chromium
- npm или yarn

## 📄 Лицензия

MIT License - Смотрите отдельные поддиректории для специфичных лицензий.
