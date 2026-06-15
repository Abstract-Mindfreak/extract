import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import appPersistenceService from "../services/AppPersistenceService";

export const useAseWorkspaceStore = create(
  persist(
    (set) => ({
      fontScale: "medium",
      layoutSnapshot: null,
      localRagLayoutSnapshot: null,
      uiTheme: "vs-dark",
      setFontScale: (fontScale) => set({ fontScale }),
      setLayoutSnapshot: (layoutSnapshot) => set({ layoutSnapshot }),
      setLocalRagLayoutSnapshot: (localRagLayoutSnapshot) => set({ localRagLayoutSnapshot }),
      setUiTheme: (uiTheme) => set({ uiTheme }),
    }),
    {
      name: "mmss.ase.workspace.v1",
      storage: createJSONStorage(() => appPersistenceService.createZustandStorage("zustand")),
      partialize: (state) => ({
        fontScale: state.fontScale,
        layoutSnapshot: state.layoutSnapshot,
        localRagLayoutSnapshot: state.localRagLayoutSnapshot,
        uiTheme: state.uiTheme,
      }),
    }
  )
);
