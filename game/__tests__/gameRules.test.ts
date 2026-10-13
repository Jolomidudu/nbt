import { describe, expect, it } from "vitest";
import { createInitialPlayerState, purchaseBusiness } from "@/lib/gameRules";
import { loadGameSession, validateGameSave, writeGameSession } from "@/lib/saveGame";
import { completeTransaction, createInitialEconomyState, createTransactionAttempt } from "@/game/simulation/economy";
import { useGameStore } from "@/stores/useGameStore";

describe("purchaseBusiness", () => {
  it("deducts a POS purchase exactly once and records the business", () => {
    const result = purchaseBusiness(createInitialPlayerState(), "plot-01", "pos", 123);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.player.wallet).toBe(30_000);
    expect(result.player.businesses).toHaveLength(1);
    expect(result.player.businesses[0]).toMatchObject({ plotId: "plot-01", type: "pos", level: 1 });
  });

  it("rejects a purchase when the wallet is short", () => {
    const player = { ...createInitialPlayerState(), wallet: 19_999 };
    expect(purchaseBusiness(player, "plot-01", "pos")).toEqual({ ok: false, error: "insufficient-funds" });
    expect(player.wallet).toBe(19_999);
  });

  it("rejects purchases on occupied plots without charging again", () => {
    const first = purchaseBusiness(createInitialPlayerState(), "plot-01", "pos", 123);
    if (!first.ok) throw new Error("Expected initial purchase to succeed");
    const repeated = purchaseBusiness(first.player, "plot-01", "pos", 456);
    expect(repeated).toEqual({ ok: false, error: "occupied" });
    expect(first.player.wallet).toBe(30_000);
  });
});

describe("validateGameSave", () => {
  it("accepts a valid versioned save", () => {
    const save = {
      version: 1,
      player: {
        wallet: 30_000,
        level: 1,
        businesses: [{ id: "business-1", plotId: "plot-01", type: "pos", level: 1, purchaseCost: 20_000 }],
      },
    };
    expect(validateGameSave(save)).toEqual({
      ...save,
      version: 3,
      elapsedActiveMs: 0,
      manuallyPaused: false,
      economy: expect.objectContaining({ totalRevenue: 0, activeCustomers: [] }),
    });
  });

  it("migrates a phase-one save without losing wallet or purchases", () => {
    const save = {
      version: 1,
      player: {
        wallet: 30_000,
        level: 2,
        businesses: [{ id: "business-1", plotId: "plot-01", type: "pos", level: 1, purchaseCost: 20_000 }],
      },
    };
    expect(validateGameSave(save)).toMatchObject({
      version: 3,
      player: save.player,
      elapsedActiveMs: 0,
      manuallyPaused: false,
      economy: expect.objectContaining({ totalRevenue: 0, activeCustomers: [] }),
    });
  });

  it("migrates version-two clock and pause fields without losing purchases", () => {
    const save = {
      version: 2,
      player: {
        wallet: 30_000,
        level: 1,
        businesses: [{ id: "business-1", plotId: "plot-01", type: "pos", level: 1, purchaseCost: 20_000 }],
      },
      elapsedActiveMs: 15_000,
      manuallyPaused: true,
    };
    expect(validateGameSave(save)).toMatchObject({
      version: 3,
      player: save.player,
      elapsedActiveMs: 15_000,
      manuallyPaused: true,
      economy: expect.objectContaining({ currentDay: 1, totalRevenue: 0 }),
    });
  });

  it("resets malformed or out-of-range clock fields without discarding player progress", () => {
    const player = {
      wallet: 30_000,
      level: 1,
      businesses: [{ id: "business-1", plotId: "plot-01", type: "pos", level: 1, purchaseCost: 20_000 }],
    };
    expect(validateGameSave({
      version: 2,
      player,
      elapsedActiveMs: Number.MAX_SAFE_INTEGER,
      manuallyPaused: "yes",
    })).toMatchObject({ player, elapsedActiveMs: 0, manuallyPaused: false });
  });

  it("loads migrated purchases and wallet from a phase-one save", () => {
    const values = new Map<string, string>([["naija-business-tycoon-save-v1", JSON.stringify({
      version: 1,
      player: {
        wallet: 30_000,
        level: 1,
        businesses: [{ id: "business-1", plotId: "plot-01", type: "pos", level: 1, purchaseCost: 20_000 }],
      },
    })]]);
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
    } as unknown as Storage;
    const session = loadGameSession(storage);
    expect(session?.player.wallet).toBe(30_000);
    expect(session?.player.businesses).toHaveLength(1);
    expect(session?.elapsedActiveMs).toBe(0);
  });

  it("persists the canonical clock and manual pause in the current save format", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
    } as unknown as Storage;
    const playerWithStoreFields = {
      ...createInitialPlayerState(),
      hydrated: true,
      elapsedActiveMs: 15_000,
    };
    writeGameSession(playerWithStoreFields, 15_000, true, null, storage);
    expect(JSON.parse(values.get("naija-business-tycoon-save-v1") ?? "{}")).toMatchObject({
      version: 3,
      player: createInitialPlayerState(),
      elapsedActiveMs: 15_000,
      manuallyPaused: true,
      economy: expect.objectContaining({ currentDay: 1, lastTickIndex: 15 }),
    });
  });

  it("persists and reloads revenue and bounded transaction state atomically", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
    } as unknown as Storage;
    const purchase = purchaseBusiness(createInitialPlayerState(), "plot-01", "pos", 123);
    if (!purchase.ok) throw new Error("Expected business purchase to succeed");
    const business = purchase.player.businesses[0];
    const economy = { ...createInitialEconomyState([business]), lastTickIndex: 1 };
    const initial = { player: purchase.player, economy };
    const settled = completeTransaction(initial, createTransactionAttempt(business, economy.businessLedgers[business.id], 1, 1));
    writeGameSession(settled.player, 1000, false, settled.economy, storage);

    const restored = loadGameSession(storage);
    expect(restored?.player.wallet).toBe(30_250);
    expect(restored?.economy.totalRevenue).toBe(250);
    expect(restored?.economy.businessLedgers[business.id].totalTransactions).toBe(1);
    expect(restored?.economy.recentTransactions).toHaveLength(1);
    expect(restored?.economy.activeCustomers).toEqual([]);
  });

  it("rejects malformed, incompatible, and duplicate-plot saves", () => {
    expect(validateGameSave(null)).toBeNull();
    expect(validateGameSave({ version: 2, player: {} })).toBeNull();
    expect(
      validateGameSave({
        version: 1,
        player: {
          wallet: 30_000,
          level: 1,
          businesses: [
            { id: "a", plotId: "plot-01", type: "pos", level: 1, purchaseCost: 20_000 },
            { id: "b", plotId: "plot-01", type: "food", level: 1, purchaseCost: 45_000 },
          ],
        },
      }),
    ).toBeNull();
  });
});

describe("game store simulation state", () => {
  it("resets the clock, revenue, and customers with player progress", () => {
    const purchase = purchaseBusiness(createInitialPlayerState(), "plot-01", "pos", 123);
    if (!purchase.ok) throw new Error("Expected business purchase to succeed");
    const business = purchase.player.businesses[0];
    const economy = createInitialEconomyState([business]);
    useGameStore.getState().commitSimulation({
      player: purchase.player,
      economy: {
        ...economy,
        totalRevenue: 250,
        businessLedgers: {
          ...economy.businessLedgers,
          [business.id]: { ...economy.businessLedgers[business.id], totalRevenue: 250, totalTransactions: 1, dailyTransactions: 1 },
        },
        activeCustomers: [{
          id: "1:business-1:1", businessId: business.id, plotId: business.plotId,
          stage: "WALKING", routeStep: 1, outfitIndex: 0,
        }],
      },
    }, 120_000);
    useGameStore.getState().setManuallyPaused(true);
    useGameStore.getState().resetProgress();
    expect(useGameStore.getState()).toMatchObject({
      wallet: 50_000,
      businesses: [],
      elapsedActiveMs: 0,
      manuallyPaused: false,
      economy: expect.objectContaining({
        totalRevenue: 0,
        activeCustomers: [],
        businessLedgers: {},
        recentTransactions: [],
      }),
    });
  });
});