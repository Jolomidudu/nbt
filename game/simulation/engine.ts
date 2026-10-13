import { GAME_TIME_SCALE, MAX_ELAPSED_ACTIVE_MS } from "@/game/simulation/clock";

export const SIMULATION_TICK_MS = 1000;
export const SIMULATION_POLL_MS = 100;
export const MAX_FRAME_DELTA_MS = 5000;

export interface SimulationSnapshot {
  elapsedActiveMs: number;
  tickIndex: number;
}

export interface SimulationContext<State> {
  tickIndex: number;
  elapsedActiveMs: number;
  elapsedGameMs: number;
  state: Readonly<State>;
}

export type SimulationSystem<State> = (context: SimulationContext<State>) => State;

export interface SimulationScheduler {
  now: () => number;
  setInterval: (callback: () => void, delayMs: number) => unknown;
  clearInterval: (handle: unknown) => void;
}

export class SimulationEngine<State = undefined> {
  private elapsedActiveMs: number;
  private tickIndex: number;
  private accumulatorMs: number;
  private fractionalMs = 0;
  private state: State;

  constructor(
    elapsedActiveMs = 0,
    initialState: State = undefined as State,
    private readonly systems: SimulationSystem<State>[] = [],
  ) {
    this.elapsedActiveMs = this.normalizeElapsed(elapsedActiveMs);
    this.tickIndex = Math.floor(this.elapsedActiveMs / SIMULATION_TICK_MS);
    this.accumulatorMs = this.elapsedActiveMs % SIMULATION_TICK_MS;
    this.state = initialState;
  }

  getSnapshot(): SimulationSnapshot {
    return { elapsedActiveMs: this.elapsedActiveMs, tickIndex: this.tickIndex };
  }

  getState(): Readonly<State> {
    return this.state;
  }

  setState(state: State): void {
    this.state = state;
  }

  advance(deltaMs: number): SimulationSnapshot {
    if (!Number.isFinite(deltaMs) || deltaMs <= 0) return this.getSnapshot();

    const cappedDeltaMs = Math.min(deltaMs, MAX_FRAME_DELTA_MS);
    const accumulatedDeltaMs = cappedDeltaMs + this.fractionalMs;
    const acceptedMs = Math.min(Math.floor(accumulatedDeltaMs), MAX_FRAME_DELTA_MS);
    this.fractionalMs = acceptedMs === MAX_FRAME_DELTA_MS ? 0 : accumulatedDeltaMs - acceptedMs;
    const boundedMs = Math.min(acceptedMs, MAX_ELAPSED_ACTIVE_MS - this.elapsedActiveMs);
    this.elapsedActiveMs += boundedMs;
    this.accumulatorMs += boundedMs;

    while (this.accumulatorMs >= SIMULATION_TICK_MS) {
      this.accumulatorMs -= SIMULATION_TICK_MS;
      this.tickIndex += 1;
      const context: SimulationContext<State> = {
        tickIndex: this.tickIndex,
        elapsedActiveMs: this.tickIndex * SIMULATION_TICK_MS,
        elapsedGameMs: this.tickIndex * SIMULATION_TICK_MS * GAME_TIME_SCALE,
        state: this.state,
      };
      for (const system of this.systems) {
        this.state = system({ ...context, state: this.state });
      }
    }

    return this.getSnapshot();
  }

  reset(elapsedActiveMs = 0, state: State = this.state): void {
    this.elapsedActiveMs = this.normalizeElapsed(elapsedActiveMs);
    this.tickIndex = Math.floor(this.elapsedActiveMs / SIMULATION_TICK_MS);
    this.accumulatorMs = this.elapsedActiveMs % SIMULATION_TICK_MS;
    this.fractionalMs = 0;
    this.state = state;
  }

  private normalizeElapsed(value: number): number {
    return Number.isSafeInteger(value)
      ? Math.min(Math.max(value, 0), MAX_ELAPSED_ACTIVE_MS)
      : 0;
  }
}

export class SimulationRunner<State = undefined> {
  private interval: unknown;
  private running = false;
  private manuallyPaused: boolean;
  private visibilityHidden = false;
  private lastNow = 0;

  constructor(
    private readonly engine: SimulationEngine<State>,
    private readonly scheduler: SimulationScheduler,
    private readonly onUpdate: (snapshot: SimulationSnapshot, state: Readonly<State>) => void,
    manuallyPaused = false,
  ) {
    this.manuallyPaused = manuallyPaused;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastNow = this.scheduler.now();
    this.interval = this.scheduler.setInterval(() => this.pulse(), SIMULATION_POLL_MS);
  }

  stop(): void {
    if (!this.running) return;
    this.pulse();
    this.running = false;
    this.scheduler.clearInterval(this.interval);
    this.interval = undefined;
  }

  flush(): void {
    this.pulse();
  }

  replaceState(state: State): void {
    this.engine.setState(state);
  }

  setManuallyPaused(paused: boolean): void {
    if (this.manuallyPaused === paused) return;
    this.pulse();
    this.manuallyPaused = paused;
    this.lastNow = this.scheduler.now();
    this.onUpdate(this.engine.getSnapshot(), this.engine.getState());
  }

  setVisibilityHidden(hidden: boolean): void {
    if (this.visibilityHidden === hidden) return;
    this.pulse();
    this.visibilityHidden = hidden;
    this.lastNow = this.scheduler.now();
    this.onUpdate(this.engine.getSnapshot(), this.engine.getState());
  }

  reset(elapsedActiveMs = 0, manuallyPaused = false): void {
    this.engine.reset(elapsedActiveMs);
    this.manuallyPaused = manuallyPaused;
    this.lastNow = this.scheduler.now();
    this.onUpdate(this.engine.getSnapshot(), this.engine.getState());
  }

  private pulse(): void {
    const now = this.scheduler.now();
    const deltaMs = Math.max(0, now - this.lastNow);
    this.lastNow = now;
    if (!this.manuallyPaused && !this.visibilityHidden) this.engine.advance(deltaMs);
    this.onUpdate(this.engine.getSnapshot(), this.engine.getState());
  }
}