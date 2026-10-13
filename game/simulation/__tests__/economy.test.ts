import { describe, expect, it } from "vitest";
import { createInitialPlayerState } from "@/lib/gameRules";
import {
  BUSINESS_ECONOMY_RULES,
  MAX_ACTIVE_CUSTOMERS,
  advanceCustomerSimulation,
  completeTransaction,
  createInitialEconomyState,
  createTransactionAttempt,
  type TransactionAttempt,
} from "@/game/simulation/economy";
import { SimulationEngine, SimulationRunner, type SimulationScheduler } from "@/game/simulation/engine";
import type { Business, GameSimulationState } from "@/game/types";

const posBusiness: Business = {
  id: "pos-1", plotId: "plot-01", type: "pos", level: 1, purchaseCost: 20_000,
};
const foodBusiness: Business = {
  id: "food-1", plotId: "plot-02", type: "food", level: 1, purchaseCost: 45_000,
};

function createState(businesses: Business[] = [posBusiness]): GameSimulationState {
  const player = { ...createInitialPlayerState(), businesses };
  return { player, economy: createInitialEconomyState(businesses) };
}

function transactionFor(
  state: GameSimulationState,
  business: Business,
  overrides: Partial<TransactionAttempt> = {},
): TransactionAttempt {
  return {
    ...createTransactionAttempt(business, state.economy.businessLedgers[business.id], state.economy.lastTickIndex, state.economy.currentDay),
    ...overrides,
  };
}

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

function stateWithWaitingCustomer(): GameSimulationState {
  const state = createState();
  return {
    ...state,
    economy: {
      ...state.economy,
      activeCustomers: [{
        id: "visit-1",
        businessId: posBusiness.id,
        plotId: posBusiness.plotId,
        stage: "WAITING",
        routeStep: 4,
        outfitIndex: 0,
      }],
    },
  };
}

describe("customer economy", () => {
  it("spawns customers only for owned businesses", () => {
    const engine = new SimulationEngine(0, createState([posBusiness]), [advanceCustomerSimulation]);
    engine.advance(5000);
    const state = engine.getState();
    expect(state.economy.activeCustomers.length).toBeGreaterThan(0);
    expect(state.economy.activeCustomers.every((customer) => customer.businessId === posBusiness.id)).toBe(true);
    expect(state.economy.activeCustomers.every((customer) => customer.plotId !== "plot-02")).toBe(true);
  });

  it("moves customers through the valid service lifecycle", () => {
    let state = createState();
    const engine = new SimulationEngine(0, state, [advanceCustomerSimulation]);
    const seen = new Set<string>();
    for (let tick = 0; tick < 80; tick += 1) {
      engine.advance(1000);
      state = engine.getState();
      for (const customer of state.economy.activeCustomers) seen.add(customer.stage);
    }
    expect([...seen]).toEqual(expect.arrayContaining(["SPAWNED", "WALKING", "WAITING", "SERVED", "EXITING"]));
  });

  it("credits the configured revenue only after a successful service", () => {
    const state = createState();
    const attempt = transactionFor(state, posBusiness);
    const settled = completeTransaction(state, attempt);
    expect(settled.player.wallet).toBe(50_250);
    expect(settled.economy.totalRevenue).toBe(250);
    expect(settled.economy.businessLedgers[posBusiness.id]).toMatchObject({
      totalRevenue: 250,
      totalTransactions: 1,
      dailyTransactions: 1,
    });
    expect(BUSINESS_ECONOMY_RULES.food.revenuePerTransaction).toBe(700);
  });

  it("credits a visit when its waiting customer is served, not before", () => {
    const initial = stateWithWaitingCustomer();
    expect(initial.player.wallet).toBe(50_000);
    const engine = new SimulationEngine(0, initial, [advanceCustomerSimulation]);
    engine.advance(1000);
    expect(engine.getState().player.wallet).toBe(50_250);
    expect(engine.getState().economy.recentTransactions[0]).toMatchObject({
      simulationTick: 1,
      revenue: 250,
    });
  });

  it("rejects duplicate, stale, unowned, and invalid-value transaction attempts", () => {
    const state = createState();
    const attempt = transactionFor(state, posBusiness);
    const settled = completeTransaction(state, attempt);
    expect(completeTransaction(settled, attempt)).toBe(settled);
    expect(completeTransaction(state, transactionFor(state, posBusiness, { simulationTick: 1 })).player.wallet).toBe(50_000);
    expect(completeTransaction(state, transactionFor(state, posBusiness, { revenue: 999 })).player.wallet).toBe(50_000);
    expect(completeTransaction(state, { ...attempt, businessId: "not-owned" })).toBe(state);
  });

  it("rejects a transaction that would overflow the safe wallet balance", () => {
    const state = createState();
    const nearLimit = {
      ...state,
      player: { ...state.player, wallet: Number.MAX_SAFE_INTEGER - 100 },
    };
    expect(completeTransaction(nearLimit, transactionFor(nearLimit, posBusiness))).toBe(nearLimit);
  });

  it("enforces business-specific daily limits and resets them on day change", () => {
    const state = createState();
    const fullLedger = {
      ...state.economy.businessLedgers[posBusiness.id],
      totalTransactions: 40,
      dailyTransactions: 40,
      totalRevenue: 10_000,
    };
    const full = {
      ...state,
      economy: {
        ...state.economy,
        totalRevenue: 10_000,
        businessLedgers: { [posBusiness.id]: fullLedger },
      },
    };
    expect(completeTransaction(full, transactionFor(full, posBusiness))).toBe(full);
    const engine = new SimulationEngine(225_000, full, [advanceCustomerSimulation]);
    engine.advance(1000);
    expect(engine.getState().economy.businessLedgers[posBusiness.id].dailyTransactions).toBe(0);
  });

  it("keeps multiple businesses independently accounted", () => {
    const state = createState([posBusiness, foodBusiness]);
    const posSale = completeTransaction(state, transactionFor(state, posBusiness));
    const foodSale = completeTransaction(posSale, transactionFor(posSale, foodBusiness));
    expect(foodSale.player.wallet).toBe(50_950);
    expect(foodSale.economy.businessLedgers[posBusiness.id].totalRevenue).toBe(250);
    expect(foodSale.economy.businessLedgers[foodBusiness.id].totalRevenue).toBe(700);
  });

  it("produces identical customers and settlements from the same tick inputs", () => {
    const first = new SimulationEngine(0, createState([posBusiness, foodBusiness]), [advanceCustomerSimulation]);
    const second = new SimulationEngine(0, createState([posBusiness, foodBusiness]), [advanceCustomerSimulation]);
    for (let tick = 0; tick < 100; tick += 1) {
      first.advance(1000);
      second.advance(1000);
    }
    expect(first.getState()).toEqual(second.getState());
  });

  it("does not progress customer service while paused or hidden", () => {
    const scheduler = new FakeScheduler();
    const engine = new SimulationEngine(0, stateWithWaitingCustomer(), [advanceCustomerSimulation]);
    const runner = new SimulationRunner(engine, scheduler, () => undefined);
    runner.start();
    runner.setManuallyPaused(true);
    scheduler.advanceBy(5000);
    expect(engine.getState().player.wallet).toBe(50_000);
    runner.setManuallyPaused(false);
    runner.setVisibilityHidden(true);
    scheduler.advanceBy(10_000);
    expect(engine.getState().player.wallet).toBe(50_000);
    runner.setVisibilityHidden(false);
    scheduler.advanceBy(1000);
    expect(engine.getState().player.wallet).toBe(50_250);
    runner.stop();
  });

  it("keeps start idempotent and does not duplicate a settlement", () => {
    const scheduler = new FakeScheduler();
    const engine = new SimulationEngine(0, stateWithWaitingCustomer(), [advanceCustomerSimulation]);
    const runner = new SimulationRunner(engine, scheduler, () => undefined);
    runner.start();
    runner.start();
    scheduler.advanceBy(1000);
    expect(engine.getState().player.wallet).toBe(50_250);
    expect(engine.getState().economy.businessLedgers[posBusiness.id].totalTransactions).toBe(1);
    runner.stop();
    expect(scheduler.callbacks.size).toBe(0);
  });

  it("bounds visits and settlements during a long stalled event loop", () => {
    const engine = new SimulationEngine(0, createState(), [advanceCustomerSimulation]);
    engine.advance(60 * 60 * 1000);
    expect(engine.getSnapshot()).toMatchObject({ elapsedActiveMs: 5000, tickIndex: 5 });
    expect(engine.getState().economy.activeCustomers.length).toBeLessThanOrEqual(MAX_ACTIVE_CUSTOMERS);
    expect(engine.getState().economy.totalRevenue).toBeLessThanOrEqual(250);
  });
});