import type { PromptRecord as SharedPromptRecord } from '../../../shared/prompt';

export type {
  PromptRecord,
  PromptServiceMeta,
  PromptSourceItem,
} from '../../../shared/prompt';

export type PromptDraft = Omit<
  SharedPromptRecord,
  'id' | 'created_at' | 'updated_at' | 'fingerprint' | 'text'
> & {
  text?: string;
  id?: string;
  fingerprint?: string;
  created_at?: string;
  updated_at?: string;
};

export type PromptSearchFilters = {
  query: string;
  keyword?: string;
};
