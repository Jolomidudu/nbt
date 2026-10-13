import { BUSINESS_TYPES } from "@/game/data/businessTypes";
import { PLOT_IDS } from "@/game/data/mapData";
import { MAX_ELAPSED_ACTIVE_MS } from "@/game/simulation/clock";
import type { Business, BusinessType, GameSave, PlayerState } from "@/game/types";

export const SAVE_KEY = "naija-business-tycoon-save-v1";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBusinessType(value: unknown): value is BusinessType {
  return typeof value === "string" && value in BUSINESS_TYPES;
}

function isBusiness(value: unknown): value is Business {
  if (!isRecord(value) || !isBusinessType(value.type)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.plotId === "string" &&
    PLOT_IDS.has(value.plotId) &&
    Number.isSafeInteger(value.level) &&
    Number(value.level) >= 1 &&
    Number.isSafeInteger(value.purchaseCost) &&
    value.purchaseCost === BUSINESS_TYPES[value.type].cost
  );
}

export function validateGameSave(value: unknown): GameSave | null {
  if (!isRecord(value) || (value.version !== 1 && value.version !== 2) || !isRecord(value.player)) {
    return null;
  }

  const { wallet, level, businesses } = value.player;
  if (
    !Number.isSafeInteger(wallet) ||
    Number(wallet) < 0 ||
    !Number.isSafeInteger(level) ||
    Number(level) < 1 ||
    !Array.isArray(businesses) ||
    !businesses.every(isBusiness)
  ) {
    return null;
  }

  const plotIds = businesses.map((business) => business.plotId);
  const businessIds = businesses.map((business) => business.id);
  if (new Set(plotIds).size !== plotIds.length || new Set(businessIds).size !== businessIds.length) {
    return null;
  }

  return {
    version: 2,
    player: { wallet: Number(wallet), level: Number(level), businesses: businesses as Business[] },
    elapsedActiveMs:
      value.version === 2 && Number.isSafeInteger(value.elapsedActiveMs) &&
      Number(value.elapsedActiveMs) >= 0 && Number(value.elapsedActiveMs) <= MAX_ELAPSED_ACTIVE_MS
        ? Number(value.elapsedActiveMs)
        : 0,
    manuallyPaused: value.version === 2 && typeof value.manuallyPaused === "boolean"
      ? value.manuallyPaused
      : false,
  };
}

function getStorage(storage?: Storage): Storage | null {
  if (storage) return storage;
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function loadGameSession(storage?: Storage): GameSave | null {
  try {
    const raw = getStorage(storage)?.getItem(SAVE_KEY);
    if (!raw) return null;
    return validateGameSave(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function loadGameSave(storage?: Storage): PlayerState | null {
  return loadGameSession(storage)?.player ?? null;
}

export function writeGameSave(player: PlayerState, storage?: Storage): void {
  const previous = loadGameSession(storage);
  writeGameSession(player, previous?.elapsedActiveMs ?? 0, previous?.manuallyPaused ?? false, storage);
}

export function writeGameSession(
  player: PlayerState,
  elapsedActiveMs: number,
  manuallyPaused: boolean,
  storage?: Storage,
): void {
  try {
    const safeElapsedActiveMs = Number.isSafeInteger(elapsedActiveMs) && elapsedActiveMs >= 0
      ? Math.min(elapsedActiveMs, MAX_ELAPSED_ACTIVE_MS)
      : 0;
    const save: GameSave = {
      version: 2,
      player,
      elapsedActiveMs: safeElapsedActiveMs,
      manuallyPaused,
    };
    getStorage(storage)?.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Storage can be unavailable in private browsing or restricted contexts.
  }
}

export function resetGameSave(storage?: Storage): void {
  try {
    getStorage(storage)?.removeItem(SAVE_KEY);
  } catch {
    // Storage can be unavailable in private browsing or restricted contexts.
  }
}