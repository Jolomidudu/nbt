import { create } from "zustand";
import type { BusinessType, PlayerState } from "@/game/types";
import { createInitialPlayerState, purchaseBusiness, type PurchaseResult } from "@/lib/gameRules";
import { loadGameSave, resetGameSave, writeGameSave } from "@/lib/saveGame";

interface GameStore extends PlayerState {
  hydrated: boolean;
  hydrate: () => void;
  purchase: (plotId: string, type: BusinessType) => PurchaseResult;
  resetProgress: () => void;
}

const initialPlayer = createInitialPlayerState();

export const useGameStore = create<GameStore>((set, get) => ({
  ...initialPlayer,
  hydrated: false,
  hydrate: () => {
    if (get().hydrated) return;
    set({ ...(loadGameSave() ?? createInitialPlayerState()), hydrated: true });
  },
  purchase: (plotId, type) => {
    const current = get();
    const result = purchaseBusiness(current, plotId, type);
    if (!result.ok) return result;
    set(result.player);
    writeGameSave(result.player);
    return result;
  },
  resetProgress: () => {
    const player = createInitialPlayerState();
    resetGameSave();
    set({ ...player, hydrated: true });
  },
}));