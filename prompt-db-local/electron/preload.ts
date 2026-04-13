import { contextBridge, ipcRenderer } from 'electron';
import type { ElectronAPI } from '../shared/electron';

const electronApi: ElectronAPI = {
  openJsonFile: async () => ipcRenderer.invoke('dialogs:open-json'),
  getWsStatus: async () => ipcRenderer.invoke('ws:get-status'),
  runWsSelfTest: async () => ipcRenderer.invoke('ws:run-self-test'),
  loadMetaState: async () => ipcRenderer.invoke('meta:load-state'),
  saveMetaState: async (payload) => ipcRenderer.invoke('meta:save-state', payload),
  clearMetaState: async () => ipcRenderer.invoke('meta:clear-state'),
  savePromptSnapshot: async (payload) => ipcRenderer.invoke('snapshot:save-prompts', payload),
  saveExportFile: async (payload) => ipcRenderer.invoke('dialogs:save-export-file', payload),
  exportBatchFiles: async (payload) => ipcRenderer.invoke('dialogs:export-batch-files', payload),
  onImportedJson: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: Parameters<typeof callback>[0]) => {
      callback(payload);
    };

    ipcRenderer.on('producer:json-received', listener);

    return () => {
      ipcRenderer.removeListener('producer:json-received', listener);
    };
  },
  onWsStatus: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: Parameters<typeof callback>[0]) => {
      callback(payload);
    };

    ipcRenderer.on('ws:status', listener);

    return () => {
      ipcRenderer.removeListener('ws:status', listener);
    };
  },
  mmssRunTask: async (payload) => ipcRenderer.invoke('mmss:run-task', payload),
  mistralChat: async (payload) => ipcRenderer.invoke('mistral:chat', payload),
  mistralApplyPhi: async (payload) => ipcRenderer.invoke('mistral:apply-phi', payload),
  getMistralStatus: async () => ipcRenderer.invoke('mistral:get-status'),
  mistralPlanGeneration: async (payload) => ipcRenderer.invoke('mistral:plan-generation', payload),
  mistralGenerateRules: async (payload) => ipcRenderer.invoke('mistral:generate-rules', payload),
  mistralCritiqueOutput: async (payload) => ipcRenderer.invoke('mistral:critique-output', payload),
  mistralSummarizeSession: async (payload) => ipcRenderer.invoke('mistral:summarize-session', payload),
};

contextBridge.exposeInMainWorld('electronAPI', electronApi);
