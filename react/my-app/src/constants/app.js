// App Constants

export const ACCOUNTS = [
  { id: 1, name: 'Аккаунт 1', email: 'synth.master@yahoo.com', color: '#3b82f6', avatarUrl: '/avatars/account1.svg' },
  { id: 2, name: 'Аккаунт 2', email: 'beat.creator@gmail.com', color: '#10b981', avatarUrl: '/avatars/account2.svg' },
  { id: 3, name: 'Аккаунт 3', email: 'audio.lab@outlook.com', color: '#f59e0b', avatarUrl: '/avatars/account3.svg' },
  { id: 4, name: 'Аккаунт 4', email: 'music.pro@icloud.com', color: '#ef4444', avatarUrl: '/avatars/account4.svg' }
];

export const RATING_OPTIONS = [
  { value: 0, label: 'Без оценки' },
  { value: 1, label: '⭐' },
  { value: 2, label: '⭐⭐' },
  { value: 3, label: '⭐⭐⭐' },
  { value: 4, label: '⭐⭐⭐⭐' },
  { value: 5, label: '⭐⭐⭐⭐⭐' }
];

export const TABLE_COLUMNS = {
  SELECT: { id: 'select', label: '', width: 40, fixed: true },
  COVER: { id: 'cover', label: 'Обложка', width: 80, fixed: true },
  TITLE: { id: 'title', label: 'Название', width: 200, sortable: true },
  ACCOUNT: { id: 'account', label: 'Аккаунт', width: 120, sortable: true },
  DURATION: { id: 'duration', label: 'Длит.', width: 80, sortable: true },
  PROMPT: { id: 'prompt', label: 'Промпт', width: 300 },
  RATING: { id: 'rating', label: 'Оценка', width: 100, sortable: true },
  DATE: { id: 'date', label: 'Дата', width: 120, sortable: true },
  PLAY_COUNT: { id: 'playCount', label: 'Просл.', width: 80, sortable: true },
  ACTIONS: { id: 'actions', label: 'Действия', width: 120, fixed: true }
};

export const DEFAULT_VISIBLE_COLUMNS = [
  'cover', 'title', 'account', 'duration', 'prompt', 'rating', 'date', 'actions'
];

export const APP_CONFIG = {
  name: 'Producer.ai Archive Manager',
  version: '1.0.0',
  pageSize: 25,
  debounceDelay: 300
};
