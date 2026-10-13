import { describe, expect, it } from "vitest";
import {
  MAX_FRAME_DELTA_MS,
  SIMULATION_TICK_MS,
  SimulationEngine,
  SimulationRunner,
  type SimulationScheduler,
} from "@/game/simulation/engine";

class FakeScheduler implements SimulationScheduler {
  time = 0;
  callbacks = new Set<() => void>();

  now = (): number => this.time;
  setInterval = (callback: () => void): unknown => {
    this.callbacks.add(callback);
    return callback;
  };
  clearInterval = (handle: unknown): void => {
    this.callbacks.delete(handle as () => void);
  };

  advanceBy(deltaMs: number): void {
    this.time += deltaMs;
    for (const callback of [...this.callbacks]) callback();
  }
}

describe("simulation engine", () => {
  it("does not progress while manually paused and resumes from the same position", () => {
    const scheduler = new FakeScheduler();
    const engine = new SimulationEngine();
    const runner = new SimulationRunner(engine, scheduler, () => undefined);
    runner.start();
    runner.setManuallyPaused(true);
    scheduler.advanceBy(5000);
    expect(engine.getSnapshot().elapsedActiveMs).toBe(0);
    runner.setManuallyPaused(false);
    scheduler.advanceBy(SIMULATION_TICK_MS);
    expect(engine.getSnapshot()).toMatchObject({ elapsedActiveMs: 1000, tickIndex: 1 });
    runner.stop();
  });

  it("excludes hidden time and preserves manual pause across visibility changes", () => {
    const scheduler = new FakeScheduler();
    const engine = new SimulationEngine();
    const runner = new SimulationRunner(engine, scheduler, () => undefined);
    runner.start();
    scheduler.advanceBy(500);
    runner.setVisibilityHidden(true);
    scheduler.advanceBy(10_000);
    runner.setVisibilityHidden(false);
    expect(engine.getSnapshot().elapsedActiveMs).toBe(500);
    runner.setManuallyPaused(true);
    runner.setVisibilityHidden(true);
    runner.setVisibilityHidden(false);
    scheduler.advanceBy(1000);
    expect(engine.getSnapshot().elapsedActiveMs).toBe(500);
    runner.stop();
  });

  it("keeps one timer across repeated starts and cleans it up on stop", () => {
    const scheduler = new FakeScheduler();
    const runner = new SimulationRunner(new SimulationEngine(), scheduler, () => undefined);
    runner.start();
    runner.start();
    expect(scheduler.callbacks.size).toBe(1);
    runner.stop();
    runner.stop();
    expect(scheduler.callbacks.size).toBe(0);
  });

  it("caps long stalls to five fixed steps", () => {
    const engine = new SimulationEngine();
    engine.advance(60 * 60 * 1000);
    expect(engine.getSnapshot()).toMatchObject({
      elapsedActiveMs: MAX_FRAME_DELTA_MS,
      tickIndex: MAX_FRAME_DELTA_MS / SIMULATION_TICK_MS,
    });
  });

  it("produces deterministic state for the same initial state and accepted ticks", () => {
    const firstElapsedAtTicks: number[] = [];
    const secondElapsedAtTicks: number[] = [];
    const addTick = (elapsedAtTicks: number[]) => (context: { state: number; elapsedGameMs: number }) => {
      elapsedAtTicks.push(context.elapsedGameMs);
      return context.state + context.elapsedGameMs;
    };
    const first = new SimulationEngine(250, 0, [addTick(firstElapsedAtTicks)]);
    const second = new SimulationEngine(250, 0, [addTick(secondElapsedAtTicks)]);
    for (const delta of [250, 700, 1250, 5000]) {
      first.advance(delta);
      second.advance(delta);
    }
    expect(first.getSnapshot()).toEqual(second.getSnapshot());
    expect(first.getState()).toBe(second.getState());
    expect(firstElapsedAtTicks.slice(0, 2)).toEqual([288_000, 576_000]);
    expect(secondElapsedAtTicks).toEqual(firstElapsedAtTicks);
  });
});