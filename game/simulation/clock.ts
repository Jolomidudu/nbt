export const GAME_TIME_SCALE = 288;
export const GAME_DAY_MS = 24 * 60 * 60 * 1000;
export const GAME_START_OFFSET_MS = 6 * 60 * 60 * 1000;
export const MAX_ELAPSED_ACTIVE_MS = 100 * 365 * GAME_DAY_MS;

export interface GameClock {
  day: number;
  hour: number;
  minute: number;
}

export function getGameClock(elapsedActiveMs: number): GameClock {
  const safeElapsed = Number.isSafeInteger(elapsedActiveMs)
    ? Math.min(Math.max(elapsedActiveMs, 0), MAX_ELAPSED_ACTIVE_MS)
    : 0;
  const totalGameMs = GAME_START_OFFSET_MS + safeElapsed * GAME_TIME_SCALE;
  const day = Math.floor(totalGameMs / GAME_DAY_MS) + 1;
  const dayTimeMs = totalGameMs % GAME_DAY_MS;

  return {
    day,
    hour: Math.floor(dayTimeMs / (60 * 60 * 1000)),
    minute: Math.floor((dayTimeMs % (60 * 60 * 1000)) / (60 * 1000)),
  };
}

export function formatGameClock(clock: GameClock): string {
  return `${String(clock.hour).padStart(2, "0")}:${String(clock.minute).padStart(2, "0")}`;
}