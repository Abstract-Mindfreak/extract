import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import appPersistenceService from "../services/AppPersistenceService";

export const useArchivesWorkspaceStore = create(
  persist(
    (set) => ({
      layoutSnapshot: null,
      setLayoutSnapshot: (layoutSnapshot) => set({ layoutSnapshot }),
    }),
    {
      name: "mmss.archives.workspace.v1",
      storage: createJSONStorage(() => appPersistenceService.createZustandStorage("zustand")),
      partialize: (state) => ({
        layoutSnapshot: state.layoutSnapshot,
      }),
    }
  )
);
