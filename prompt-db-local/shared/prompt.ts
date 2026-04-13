export type PromptSourceItem = {
  id: string;
  sourceElementIds: string[];
};

export type PromptServiceMeta = {
  fragmentIndex?: number;
  items?: PromptSourceItem[];
};

export type PromptRecord = {
  id: string;
  name: string;
  text: string;
  json_data: Record<string, unknown>;
  fingerprint: string;
  variables: string[];
  keywords: string[];
  created_at: string;
  updated_at: string;
  source?: string;
  serviceMeta?: PromptServiceMeta;
};

export type PromptSnapshotRecord = PromptRecord;
