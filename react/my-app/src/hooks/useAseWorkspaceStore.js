import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useAseWorkspaceStore = create(
  persist(
    (set) => ({
      fontScale: "medium",
      layoutSnapshot: null,
      uiTheme: "vs-dark",
      setFontScale: (fontScale) => set({ fontScale }),
      setLayoutSnapshot: (layoutSnapshot) => set({ layoutSnapshot }),
      setUiTheme: (uiTheme) => set({ uiTheme }),
    }),
    {
      name: "mmss.ase.workspace.v1",
      partialize: (state) => ({
        fontScale: state.fontScale,
        layoutSnapshot: state.layoutSnapshot,
        uiTheme: state.uiTheme,
      }),
    }
  )
);
