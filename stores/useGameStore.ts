import { create } from "zustand";
import type { BusinessType, PlayerState } from "@/game/types";
import { createInitialPlayerState, purchaseBusiness, type PurchaseResult } from "@/lib/gameRules";
import { loadGameSession, resetGameSave, writeGameSession } from "@/lib/saveGame";

interface GameStore extends PlayerState {
  elapsedActiveMs: number;
  manuallyPaused: boolean;
  hydrated: boolean;
  hydrate: () => void;
  purchase: (plotId: string, type: BusinessType) => PurchaseResult;
  setElapsedActiveMs: (elapsedActiveMs: number) => void;
  setManuallyPaused: (manuallyPaused: boolean) => void;
  persistSimulation: () => void;
  resetProgress: () => void;
}

const initialPlayer = createInitialPlayerState();

export const useGameStore = create<GameStore>((set, get) => ({
  ...initialPlayer,
  elapsedActiveMs: 0,
  manuallyPaused: false,
  hydrated: false,
  hydrate: () => {
    if (get().hydrated) return;
    const saved = loadGameSession();
    set({
      ...(saved?.player ?? createInitialPlayerState()),
      elapsedActiveMs: saved?.elapsedActiveMs ?? 0,
      manuallyPaused: saved?.manuallyPaused ?? false,
      hydrated: true,
    });
  },
  purchase: (plotId, type) => {
    const current = get();
    const result = purchaseBusiness(current, plotId, type);
    if (!result.ok) return result;
    set(result.player);
    writeGameSession(result.player, current.elapsedActiveMs, current.manuallyPaused);
    return result;
  },
  setElapsedActiveMs: (elapsedActiveMs) => set({ elapsedActiveMs }),
  setManuallyPaused: (manuallyPaused) => {
    const current = get();
    set({ manuallyPaused });
    writeGameSession(current, current.elapsedActiveMs, manuallyPaused);
  },
  persistSimulation: () => {
    const current = get();
    writeGameSession(current, current.elapsedActiveMs, current.manuallyPaused);
  },
  resetProgress: () => {
    const player = createInitialPlayerState();
    resetGameSave();
    set({ ...player, elapsedActiveMs: 0, manuallyPaused: false, hydrated: true });
  },
}));