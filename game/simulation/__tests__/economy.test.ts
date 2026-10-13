import { describe, expect, it } from "vitest";
import { createInitialPlayerState } from "@/lib/gameRules";
import {
  BUSINESS_ECONOMY_RULES,
  advanceCustomerSimulation,
  completeTransaction,
  createInitialEconomyState,
  createTransactionAttempt,
  type TransactionAttempt,
} from "@/game/simulation/economy";
import { SimulationEngine } from "@/game/simulation/engine";
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

  it("rejects duplicate, stale, unowned, and invalid-value transaction attempts", () => {
    const state = createState();
    const attempt = transactionFor(state, posBusiness);
    const settled = completeTransaction(state, attempt);
    expect(completeTransaction(settled, attempt)).toBe(settled);
    expect(completeTransaction(state, transactionFor(state, posBusiness, { simulationTick: 1 })).player.wallet).toBe(50_000);
    expect(completeTransaction(state, transactionFor(state, posBusiness, { revenue: 999 })).player.wallet).toBe(50_000);
    expect(completeTransaction(state, { ...attempt, businessId: "not-owned" })).toBe(state);
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
});