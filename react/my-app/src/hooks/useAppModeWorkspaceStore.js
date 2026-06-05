import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useAppModeWorkspaceStore = create(
  persist(
    (set) => ({
      layoutSnapshot: null,
      setLayoutSnapshot: (layoutSnapshot) => set({ layoutSnapshot }),
    }),
    {
      name: "mmss.app.mode-workspace.v1",
      partialize: (state) => ({
        layoutSnapshot: state.layoutSnapshot,
      }),
    }
  )
);
