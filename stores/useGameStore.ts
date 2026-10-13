import { create } from "zustand";
import type { BusinessType, EconomyState, GameSimulationState, PlayerState } from "@/game/types";
import { createInitialPlayerState, purchaseBusiness, type PurchaseResult } from "@/lib/gameRules";
import { loadGameSession, resetGameSave, writeGameSession } from "@/lib/saveGame";
import { createInitialEconomyState, ensureOwnedBusinessLedgers } from "@/game/simulation/economy";

interface GameStore extends PlayerState {
  economy: EconomyState;
  elapsedActiveMs: number;
  manuallyPaused: boolean;
  hydrated: boolean;
  hydrate: () => void;
  purchase: (plotId: string, type: BusinessType) => PurchaseResult;
  setElapsedActiveMs: (elapsedActiveMs: number) => void;
  commitSimulation: (state: GameSimulationState, elapsedActiveMs: number) => void;
  setManuallyPaused: (manuallyPaused: boolean) => void;
  persistSimulation: () => void;
  resetProgress: () => void;
}

const initialPlayer = createInitialPlayerState();

export const useGameStore = create<GameStore>((set, get) => ({
  ...initialPlayer,
  economy: createInitialEconomyState(initialPlayer.businesses),
  elapsedActiveMs: 0,
  manuallyPaused: false,
  hydrated: false,
  hydrate: () => {
    if (get().hydrated) return;
    const saved = loadGameSession();
    const player = saved?.player ?? createInitialPlayerState();
    set({
      ...player,
      economy: saved?.economy ?? createInitialEconomyState(player.businesses),
      elapsedActiveMs: saved?.elapsedActiveMs ?? 0,
      manuallyPaused: saved?.manuallyPaused ?? false,
      hydrated: true,
    });
  },
  purchase: (plotId, type) => {
    const current = get();
    const result = purchaseBusiness(current, plotId, type);
    if (!result.ok) return result;
    const economy = ensureOwnedBusinessLedgers(current.economy, result.player.businesses);
    set({ ...result.player, economy });
    writeGameSession(result.player, current.elapsedActiveMs, current.manuallyPaused, economy);
    return result;
  },
  setElapsedActiveMs: (elapsedActiveMs) => set({ elapsedActiveMs }),
  commitSimulation: (simulationState, elapsedActiveMs) => set({
    ...simulationState.player,
    economy: simulationState.economy,
    elapsedActiveMs,
  }),
  setManuallyPaused: (manuallyPaused) => {
    const current = get();
    set({ manuallyPaused });
    writeGameSession(current, current.elapsedActiveMs, manuallyPaused, current.economy);
  },
  persistSimulation: () => {
    const current = get();
    writeGameSession(current, current.elapsedActiveMs, current.manuallyPaused, current.economy);
  },
  resetProgress: () => {
    const player = createInitialPlayerState();
    resetGameSave();
    set({
      ...player,
      economy: createInitialEconomyState(player.businesses),
      elapsedActiveMs: 0,
      manuallyPaused: false,
      hydrated: true,
    });
  },
}));