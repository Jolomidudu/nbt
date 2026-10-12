import { BUSINESS_TYPES } from "@/game/data/businessTypes";
import { PLOT_IDS } from "@/game/data/mapData";
import type { BusinessType, PlayerState } from "@/game/types";

export type PurchaseError = "invalid-plot" | "occupied" | "insufficient-funds";

export type PurchaseResult =
  | { ok: true; player: PlayerState; businessId: string }
  | { ok: false; error: PurchaseError };

export function createInitialPlayerState(): PlayerState {
  return { wallet: 50_000, businesses: [], level: 1 };
}

export function purchaseBusiness(
  player: PlayerState,
  plotId: string,
  type: BusinessType,
  createdAt = Date.now(),
): PurchaseResult {
  if (!PLOT_IDS.has(plotId)) return { ok: false, error: "invalid-plot" };
  if (player.businesses.some((business) => business.plotId === plotId)) {
    return { ok: false, error: "occupied" };
  }

  const definition = BUSINESS_TYPES[type];
  if (player.wallet < definition.cost) {
    return { ok: false, error: "insufficient-funds" };
  }

  const businessId = `${plotId}-${createdAt}`;
  return {
    ok: true,
    businessId,
    player: {
      ...player,
      wallet: player.wallet - definition.cost,
      businesses: [
        ...player.businesses,
        {
          id: businessId,
          plotId,
          type,
          level: 1,
          purchaseCost: definition.cost,
        },
      ],
    },
  };
}