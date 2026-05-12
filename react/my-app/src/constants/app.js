// App Constants

export const ACCOUNTS = [
  { id: 1, name: 'abstract', email: 'mungorodnaneve@gmail.com', color: '#bd8b02', avatarUrl: 'https://storage.googleapis.com/producer-app-public/user-metadata/e1719abc-d49a-4095-863f-0ae637f65bf4/profile.jpg' },
  { id: 2, name: 'abstraction', email: 'kleafrog@gmail.com', color: '#10b981', avatarUrl: 'https://storage.googleapis.com/producer-app-public/user-metadata/bd215e1c-5355-4649-b683-34002f542523/profile.jpg' },
  { id: 3, name: 'Import', email: 'gimportm@gmail.com', color: '#f59e0b', avatarUrl: 'https://storage.googleapis.com/producer-app-public/user-metadata/1c369b74-9214-4fcf-a149-e08f03f2c17b/profile.jpg?v=1776283318280' },
  { id: 4, name: 'abstractmind', email: 'tulaqua@gmail.com', color: '#0897a4', avatarUrl: 'https://storage.googleapis.com/producer-app-public/user-metadata/7f0a0aad-f088-470b-8855-84c9537c80af/profile.jpg?v=1776283176758' }
];

export const RATING_OPTIONS = [
  { value: 0, label: 'No rating' },
  { value: 1, label: '1 star' },
  { value: 2, label: '2 stars' },
  { value: 3, label: '3 stars' },
  { value: 4, label: '4 stars' },
  { value: 5, label: '5 stars' }
];

export const TABLE_COLUMNS = {
  SELECT: { id: 'select', label: '', width: 40, fixed: true },
  COVER: { id: 'cover', label: 'Cover', width: 80, fixed: true },
  TITLE: { id: 'title', label: 'Title', width: 200, sortable: true },
  ACCOUNT: { id: 'account', label: 'Account', width: 120, sortable: true },
  DURATION: { id: 'duration', label: 'Length', width: 80, sortable: true },
  PROMPT: { id: 'prompt', label: 'Prompt', width: 300 },
  RATING: { id: 'rating', label: 'Rating', width: 100, sortable: true },
  DATE: { id: 'date', label: 'Date', width: 120, sortable: true },
  PLAY_COUNT: { id: 'playCount', label: 'Plays', width: 80, sortable: true },
  ACTIONS: { id: 'actions', label: 'Actions', width: 120, fixed: true }
};

export const DEFAULT_VISIBLE_COLUMNS = [
  'cover', 'title', 'account', 'duration', 'prompt', 'rating', 'date', 'actions'
];

export const APP_CONFIG = {
  name: 'FlowMusic Archive Workspace',
  version: '1.0.0',
  pageSize: 25,
  debounceDelay: 300
};
