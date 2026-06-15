import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import appPersistenceService from "../services/AppPersistenceService";

const DEFAULT_DRAFT_TEMPLATE = '{\n  "prompt": ""\n}';
const DEFAULT_SEQUENCE_PANEL_APPEARANCE = {
  actions: { color: "#17324a", fontSize: 14 },
  savedSequences: { color: "#3a2353", fontSize: 14 },
  workspace: { color: "#1f4d45", fontSize: 15 },
};

export const useIdeWorkspaceStore = create(
  persist(
    (set) => ({
      draftDocuments: {},
      enableGraphDecomposition: false,
      fontScale: "medium",
      layoutSnapshot: null,
      sequenceBatchFormula: "6x44 random",
      sequenceBatchMode: "random",
      sequenceBatchTagPreset: "all",
      sequenceName: "",
      sequencePanelAppearance: DEFAULT_SEQUENCE_PANEL_APPEARANCE,
      sequencePresetCount: 6,
      sequencePreviewVisible: false,
      sequenceSourceFilter: "all",
      sequenceDescription: "",
      previewBlockId: null,
      uiTheme: "vs-dark",
      createDraftDocument: () => {
        const draftId = `draft:${Date.now()}`;
        set((state) => ({
          draftDocuments: {
            ...state.draftDocuments,
            [draftId]: {
              id: draftId,
              name: `New JSON ${Object.keys(state.draftDocuments).length + 1}`,
              content: DEFAULT_DRAFT_TEMPLATE,
            },
          },
        }));
        return draftId;
      },
      removeDraftDocument: (draftId) =>
        set((state) => {
          const nextDrafts = { ...state.draftDocuments };
          delete nextDrafts[draftId];
          return { draftDocuments: nextDrafts };
        }),
      renameDraftDocument: (draftId, name) =>
        set((state) => {
          const draft = state.draftDocuments[draftId];
          if (!draft) return state;
          return {
            draftDocuments: {
              ...state.draftDocuments,
              [draftId]: {
                ...draft,
                name,
              },
            },
          };
        }),
      setEnableGraphDecomposition: (enabled) => set({ enableGraphDecomposition: enabled }),
      setFontScale: (fontScale) => set({ fontScale }),
      setLayoutSnapshot: (layoutSnapshot) => set({ layoutSnapshot }),
      setPreviewBlockId: (previewBlockId) => set({ previewBlockId }),
      setSequenceBatchFormula: (sequenceBatchFormula) => set({ sequenceBatchFormula }),
      setSequenceBatchMode: (sequenceBatchMode) => set({ sequenceBatchMode }),
      setSequenceBatchTagPreset: (sequenceBatchTagPreset) => set({ sequenceBatchTagPreset }),
      setSequenceDescription: (sequenceDescription) => set({ sequenceDescription }),
      setSequenceName: (sequenceName) => set({ sequenceName }),
      setSequencePresetCount: (sequencePresetCount) => set({ sequencePresetCount }),
      setSequencePreviewVisible: (sequencePreviewVisible) => set({ sequencePreviewVisible }),
      setSequenceSourceFilter: (sequenceSourceFilter) => set({ sequenceSourceFilter }),
      setUiTheme: (uiTheme) => set({ uiTheme }),
      updateSequencePanelAppearance: (panelId, patch) =>
        set((state) => ({
          sequencePanelAppearance: {
            ...state.sequencePanelAppearance,
            [panelId]: {
              ...(state.sequencePanelAppearance[panelId] ||
                DEFAULT_SEQUENCE_PANEL_APPEARANCE[panelId] || { color: "#243447", fontSize: 14 }),
              ...patch,
            },
          },
        })),
      updateDraftContent: (draftId, content) =>
        set((state) => {
          const draft = state.draftDocuments[draftId];
          if (!draft) return state;
          return {
            draftDocuments: {
              ...state.draftDocuments,
              [draftId]: {
                ...draft,
                content,
              },
            },
          };
        }),
    }),
    {
      name: "mmss.ide.workspace.v1",
      storage: createJSONStorage(() => appPersistenceService.createZustandStorage("zustand")),
      partialize: (state) => ({
        draftDocuments: state.draftDocuments,
        enableGraphDecomposition: state.enableGraphDecomposition,
        fontScale: state.fontScale,
        layoutSnapshot: state.layoutSnapshot,
        previewBlockId: state.previewBlockId,
        sequenceBatchFormula: state.sequenceBatchFormula,
        sequenceBatchMode: state.sequenceBatchMode,
        sequenceBatchTagPreset: state.sequenceBatchTagPreset,
        sequenceDescription: state.sequenceDescription,
        sequenceName: state.sequenceName,
        sequencePanelAppearance: state.sequencePanelAppearance,
        sequencePresetCount: state.sequencePresetCount,
        sequencePreviewVisible: state.sequencePreviewVisible,
        sequenceSourceFilter: state.sequenceSourceFilter,
        uiTheme: state.uiTheme,
      }),
      version: 2,
      migrate: (persistedState, version) => {
        if (!persistedState || version >= 2) {
          return persistedState;
        }

        return {
          ...persistedState,
          layoutSnapshot: null,
          sequenceBatchFormula: "6x44 random",
          sequenceBatchMode: "random",
          sequenceBatchTagPreset: "all",
          sequenceDescription: "",
          sequenceName: "",
          sequencePanelAppearance: DEFAULT_SEQUENCE_PANEL_APPEARANCE,
          sequencePresetCount: 6,
          sequencePreviewVisible: false,
          sequenceSourceFilter: "all",
        };
      },
    }
  )
);
