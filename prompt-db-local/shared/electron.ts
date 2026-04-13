import type { PromptDbMetaState } from './meta';
import type { PromptSnapshotRecord } from './prompt';
import type {
  CritiqueOutput,
  CritiqueOutputRequest,
  GeneratedRules,
  GenerateRulesRequest,
  GenerationPlan,
  GenerationPlanRequest,
  MistralStatus,
  SessionSummary,
  StructuredResult,
  SummarizeSessionRequest,
} from './mistral';

export type SessionContext = {
  accountId: string;
  accountName?: string;
  sessionName?: string;
  messageIndex?: number;
  totalMessages?: number;
  previousContext?: string;
};

export type ImportEnvelope = {
  id: string;
  rawJson: string;
  source: string;
  receivedAt: string;
  sessionContext?: SessionContext;
};

export type WsStatus = {
  port: number;
  state: 'listening' | 'closed' | 'stopped';
  lastMessageAt: string | null;
  lastSource: string;
};

export type JsonFileResult = {
  filePath: string;
  content: string;
};

export type MMSSRunTaskPayload = {
  script: string;
  args: string[];
};

export type MMSSJobResult = {
  ok: boolean;
  output: string;
  error?: string;
  data?: unknown;
};

export type MistralMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type MistralChoice = {
  message: {
    role: string;
    content: string;
  };
  finish_reason: string;
  index: number;
};

export type MistralUsage = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
};

export type MistralResponse = {
  ok: boolean;
  data?: {
    choices: MistralChoice[];
    usage?: MistralUsage;
  };
  error?: string;
};

export type ElectronAPI = {
  openJsonFile: () => Promise<JsonFileResult[] | null>;
  getWsStatus: () => Promise<WsStatus>;
  runWsSelfTest: () => Promise<{
    ok: boolean;
    wsUrl: string;
    sentAt: string;
  }>;
  loadMetaState: () => Promise<PromptDbMetaState>;
  saveMetaState: (payload: PromptDbMetaState) => Promise<{
    directoryPath: string;
  }>;
  clearMetaState: () => Promise<PromptDbMetaState>;
  savePromptSnapshot: (payload: PromptSnapshotRecord[]) => Promise<{
    directoryPath: string;
    count: number;
  }>;
  saveExportFile: (payload: {
    defaultFileName: string;
    content: string;
  }) => Promise<{
    filePath: string;
  } | null>;
  exportBatchFiles: (payload: {
    defaultFolderName: string;
    files: Array<{ fileName: string; content: string }>;
  }) => Promise<{
    directoryPath: string;
    count: number;
  } | null>;
  onImportedJson: (callback: (payload: ImportEnvelope) => void) => () => void;
  onWsStatus: (callback: (payload: WsStatus) => void) => () => void;
  mmssRunTask: (payload: MMSSRunTaskPayload) => Promise<MMSSJobResult>;
  mistralChat: (payload: {
    messages: MistralMessage[];
    model?: string;
  }) => Promise<MistralResponse>;
  mistralApplyPhi: (payload: {
    process: string;
    context?: string;
    model?: string;
  }) => Promise<MistralResponse>;
  getMistralStatus: () => Promise<MistralStatus>;
  mistralPlanGeneration: (
    payload: GenerationPlanRequest,
  ) => Promise<StructuredResult<GenerationPlan>>;
  mistralGenerateRules: (
    payload: GenerateRulesRequest,
  ) => Promise<StructuredResult<GeneratedRules>>;
  mistralCritiqueOutput: (
    payload: CritiqueOutputRequest,
  ) => Promise<StructuredResult<CritiqueOutput>>;
  mistralSummarizeSession: (
    payload: SummarizeSessionRequest,
  ) => Promise<StructuredResult<SessionSummary>>;
};
