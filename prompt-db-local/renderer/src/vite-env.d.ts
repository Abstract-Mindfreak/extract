/// <reference types="vite/client" />

import type { ElectronAPI } from '../../shared/electron';

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
