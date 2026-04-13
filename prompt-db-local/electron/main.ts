import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import dotenv from 'dotenv';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import type { Server as HttpServer } from 'node:http';
import path from 'node:path';
import WebSocket, { WebSocketServer, type RawData, type WebSocket as ServerWebSocket } from 'ws';
import { HTTP_API_PORT, startHttpApiServer } from './httpApi';
import {
  clearMetaState,
  loadMetaState,
  saveMetaState,
  savePromptSnapshot,
} from './metaStore';
import type { ImportEnvelope, SessionContext } from '../shared/electron';
import type { PromptDbMetaState } from '../shared/meta';
import type { PromptSnapshotRecord } from '../shared/prompt';
import { MistralCoordinator } from './services/mistralCoordinator';

// Load environment variables from .env file
dotenv.config();

const WS_PORT = 3001;
const pendingImports: ImportEnvelope[] = [];
let mainWindow: BrowserWindow | null = null;
let websocketServer: WebSocketServer | null = null;
let httpApiServer: HttpServer | null = null;
let lastWsMessageAt: string | null = null;
let lastWsSource = 'none';

const createEnvelope = (rawJson: string, source = 'unknown'): ImportEnvelope => ({
  id: crypto.randomUUID(),
  rawJson,
  source,
  receivedAt: new Date().toISOString(),
});

const broadcastImport = (payload: ImportEnvelope) => {
  lastWsMessageAt = payload.receivedAt;
  lastWsSource = payload.source;

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('producer:json-received', payload);
    return;
  }

  pendingImports.push(payload);
};

const flushPendingImports = () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  while (pendingImports.length > 0) {
    const nextPayload = pendingImports.shift();

    if (nextPayload) {
      mainWindow.webContents.send('producer:json-received', nextPayload);
    }
  }
};

const startWebSocketServer = () => {
  websocketServer = new WebSocketServer({ port: WS_PORT });

  websocketServer.on('connection', (socket: ServerWebSocket) => {
    socket.on('message', (message: RawData) => {
      const raw = message.toString();

      try {
        const parsed = JSON.parse(raw) as { 
          payload?: unknown; 
          source?: string;
          sessionContext?: SessionContext;
        };
        const rawJson =
          typeof parsed.payload === 'string'
            ? parsed.payload
            : JSON.stringify(parsed.payload ?? parsed);

        // Φ_total(session) — создаём envelope с session context
        const envelope: ImportEnvelope = {
          ...createEnvelope(rawJson, parsed.source ?? 'ws-client'),
          sessionContext: parsed.sessionContext,
        };

        broadcastImport(envelope);
      } catch {
        broadcastImport(createEnvelope(raw, 'ws-client'));
      }
    });
  });

  websocketServer.on('listening', () => {
    mainWindow?.webContents.send('ws:status', {
      port: WS_PORT,
      state: 'listening',
      lastMessageAt: lastWsMessageAt,
      lastSource: lastWsSource,
    });
  });

  websocketServer.on('close', () => {
    mainWindow?.webContents.send('ws:status', {
      port: WS_PORT,
      state: 'closed',
      lastMessageAt: lastWsMessageAt,
      lastSource: lastWsSource,
    });
  });
};

const createWindow = async () => {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1120,
    minHeight: 760,
    backgroundColor: '#f4f0e8',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.webContents.on('did-finish-load', flushPendingImports);

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;

  if (devServerUrl) {
    await mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../renderer/dist/index.html'));
  }
};

ipcMain.handle('dialogs:open-json', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Supported files', extensions: ['json', 'md', 'txt'] },
      { name: 'JSON', extensions: ['json'] },
      { name: 'Markdown', extensions: ['md'] },
      { name: 'Text', extensions: ['txt'] },
    ],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const files = await Promise.all(
    result.filePaths.map(async (filePath) => ({
      filePath,
      content: await readFile(filePath, 'utf-8'),
    })),
  );

  return files;
});

ipcMain.handle('ws:get-status', async () => ({
  port: WS_PORT,
  state: websocketServer ? 'listening' : 'stopped',
  lastMessageAt: lastWsMessageAt,
  lastSource: lastWsSource,
}));

ipcMain.handle('meta:load-state', async () => loadMetaState());

ipcMain.handle('meta:save-state', async (_event, payload: PromptDbMetaState) => saveMetaState(payload));

ipcMain.handle('meta:clear-state', async () => clearMetaState());

ipcMain.handle('snapshot:save-prompts', async (_event, payload: PromptSnapshotRecord[]) =>
  savePromptSnapshot(payload),
);

ipcMain.handle('ws:run-self-test', async () => {
  const payload = JSON.stringify({
    source: 'producer.ai-extension:self-test',
    payload: {
      name: 'extension sync self test',
      prompt: 'Confirm websocket pipeline for {{system}}.',
      variables: ['system'],
      keywords: ['self-test', 'extension', 'ws'],
      meta: {
        generatedAt: new Date().toISOString(),
      },
    },
  });

  await new Promise<void>((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${WS_PORT}`);

    socket.on('open', () => {
      socket.send(payload);
      socket.close();
      resolve();
    });

    socket.on('error', (error) => {
      reject(error);
    });
  });

  return {
    ok: true,
    wsUrl: `ws://127.0.0.1:${WS_PORT}`,
    sentAt: new Date().toISOString(),
  };
});

ipcMain.handle(
  'dialogs:save-export-file',
  async (_event, payload: { defaultFileName: string; content: string }) => {
    const result = await dialog.showSaveDialog({
      defaultPath: payload.defaultFileName,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });

    if (result.canceled || !result.filePath) {
      return null;
    }

    await writeFile(result.filePath, payload.content, 'utf-8');

    return {
      filePath: result.filePath,
    };
  },
);

ipcMain.handle(
  'dialogs:export-batch-files',
  async (
    _event,
    payload: {
      defaultFolderName: string;
      files: Array<{ fileName: string; content: string }>;
    },
  ) => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const rootDir = result.filePaths[0];
    const targetDir = path.join(rootDir, payload.defaultFolderName);
    await mkdir(targetDir, { recursive: true });

    await Promise.all(
      payload.files.map((file) =>
        writeFile(path.join(targetDir, file.fileName), file.content, 'utf-8'),
      ),
    );

    return {
      directoryPath: targetDir,
      count: payload.files.length,
    };
  },
);

ipcMain.handle(
  'mmss:run-task',
  async (_event, payload: { script: string; args: string[] }) => {
    return new Promise((resolve) => {
      const appPath = app.getAppPath();
      // Ensure we are in the prompt-db-local directory
      const workingDir = appPath.endsWith('prompt-db-local') 
        ? appPath 
        : path.join(appPath, 'prompt-db-local');
      
      const scriptPath = path.join(workingDir, payload.script);
      
      console.log(`Running Python task: ${scriptPath} in ${workingDir}`);

      // Try 'python' then 'python3'
      let pythonExecutable = 'python';
      
      const startProcess = (exe: string) => {
        const pythonProcess = spawn(exe, [scriptPath, ...payload.args], {
          cwd: workingDir,
          env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
        });

        let output = '';
        let error = '';

        pythonProcess.stdout.on('data', (data) => {
          output += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
          error += data.toString();
        });

        pythonProcess.on('error', (err) => {
          if (exe === 'python') {
            console.log('python not found, trying python3');
            startProcess('python3');
          } else {
            resolve({ ok: false, output: '', error: `Failed to start Python: ${err.message}` });
          }
        });

        pythonProcess.on('close', (code) => {
          if (code === 0) {
            try {
              const lines = output.trim().split('\n');
              const lastLine = lines[lines.length - 1];
              const data = JSON.parse(lastLine);
              resolve({ ok: true, output, data });
            } catch {
              resolve({ ok: true, output });
            }
          } else {
            resolve({ ok: false, output, error: error || `Exit code ${code}` });
          }
        });
      };

      startProcess(pythonExecutable);
    });
  },
);

const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY || '';
const MISTRAL_MODEL = process.env.MISTRAL_MODEL || 'mistral-large-latest';
const mistralCoordinator = new MistralCoordinator({
  apiKey: MISTRAL_API_KEY,
  defaultModel: MISTRAL_MODEL,
});

// Φ_total(mistral) — Mistral API как координирующий слой для эволюции
ipcMain.handle(
  'mistral:chat',
  async (_event, payload: { messages: Array<{ role: string; content: string }>; model?: string }) =>
    mistralCoordinator.rawChat(
      payload.messages as Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
      payload.model,
    ),
);

// Φ_total(mistral:apply-phi) — Применение Φ_total к процессу через Mistral
ipcMain.handle(
  'mistral:apply-phi',
  async (_event, payload: { process: string; context?: string; model?: string }) => {
    return mistralCoordinator.applyPhi(payload.process, payload.context, payload.model);
    const systemPrompt = `Ты применяешь Φ_total к процессам. 
Φ_total — это мета-логика самоэволюции: Φ_total(process) = self_adjusting_process.
Ключевые принципы:
- Нет фиксированной точки (¬Fix), только эволюция
- Процесс самоподстраивается через применение
- Различия создают и растворяют себя бесконечно
- Система становится функцией самой себя (Ψ = Φ_total)

Опиши, как данный процесс будет эволюционировать через самоприменение Φ_total. 
Дай конкретные шаги эволюции и мета-уровневые инсайты.`;

    try {
      const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${MISTRAL_API_KEY}`,
        },
        body: JSON.stringify({
          model: payload.model || MISTRAL_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Контекст: ${payload.context || 'prompt-db-local pipeline'}\n\nПримени Φ_total к процессу: ${payload.process}` },
          ],
          temperature: 0.8,
          max_tokens: 4096,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { ok: false, error: `Mistral API error: ${response.status} - ${errorText}` };
      }

      const data = await response.json();
      return { ok: true, data };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  },
);

ipcMain.handle('mistral:get-status', async () => mistralCoordinator.getStatus());
ipcMain.handle('mistral:plan-generation', async (_event, payload) =>
  mistralCoordinator.planGeneration(payload),
);
ipcMain.handle('mistral:generate-rules', async (_event, payload) =>
  mistralCoordinator.generateRules(payload),
);
ipcMain.handle('mistral:critique-output', async (_event, payload) =>
  mistralCoordinator.critiqueOutput(payload),
);
ipcMain.handle('mistral:summarize-session', async (_event, payload) =>
  mistralCoordinator.summarizeSession(payload),
);

app.whenReady().then(async () => {
  await createWindow();
  startWebSocketServer();
  httpApiServer = await startHttpApiServer(HTTP_API_PORT);

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  websocketServer?.close();
  httpApiServer?.close();
});
