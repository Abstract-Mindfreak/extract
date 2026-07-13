import { create } from "zustand";
import { persist } from "zustand/middleware";

const DEFAULT_ASE_THEME_COLORS = {
  accent: "#4aa0d9",
  background: "#08111f",
  surface: "#101826",
  tab: "#182235",
  text: "#e7edf7",
  scrollbar: "#4aa0d9",
};

const DEFAULT_ASE_RAG_TAB_COLORS = {
  "main-panel-rag": "#3b82f6",
  "search-results": "#22c55e",
  "skill-tree-design": "#f59e0b",
  answer: "#ef4444",
  "prompt-context": "#d946ef",
  diagnostics: "#fde047",
  "runtime-jobs": "#2dd4bf",
};

export const useAseWorkspaceStore = create(
  persist(
    (set) => ({
      fontScale: "medium",
      layoutSnapshot: null,
      ragTabColors: DEFAULT_ASE_RAG_TAB_COLORS,
      themeColors: DEFAULT_ASE_THEME_COLORS,
      uiTheme: "vs-dark",
      setFontScale: (fontScale) => set({ fontScale }),
      setLayoutSnapshot: (layoutSnapshot) => set({ layoutSnapshot }),
      setRagTabColor: (tabId, color) =>
        set((state) => ({
          ragTabColors: {
            ...state.ragTabColors,
            [tabId]: color,
          },
        })),
      setThemeColor: (colorId, color) =>
        set((state) => ({
          themeColors: {
            ...state.themeColors,
            [colorId]: color,
          },
        })),
      setUiTheme: (uiTheme) => set({ uiTheme }),
    }),
    {
      name: "mmss.ase.workspace.v1",
      partialize: (state) => ({
        fontScale: state.fontScale,
        layoutSnapshot: state.layoutSnapshot,
        ragTabColors: state.ragTabColors,
        themeColors: state.themeColors,
        uiTheme: state.uiTheme,
      }),
      version: 2,
      migrate: (persistedState, version) => {
        if (!persistedState) {
          return persistedState;
        }

        if (version >= 2) {
          return {
            ...persistedState,
            ragTabColors: {
              ...DEFAULT_ASE_RAG_TAB_COLORS,
              ...(persistedState.ragTabColors || {}),
            },
            themeColors: {
              ...DEFAULT_ASE_THEME_COLORS,
              ...(persistedState.themeColors || {}),
            },
          };
        }

        return {
          ...persistedState,
          ragTabColors: DEFAULT_ASE_RAG_TAB_COLORS,
          themeColors: DEFAULT_ASE_THEME_COLORS,
        };
      },
    }
  )
);
