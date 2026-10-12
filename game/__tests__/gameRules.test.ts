import { describe, expect, it } from "vitest";
import { createInitialPlayerState, purchaseBusiness } from "@/lib/gameRules";
import { validateGameSave } from "@/lib/saveGame";

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
    expect(purchaseBusiness(player, "plot-01", "pos").error).toBe("insufficient-funds");
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
    expect(validateGameSave(save)).toEqual(save);
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