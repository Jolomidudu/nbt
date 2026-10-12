export type BusinessType = "pos" | "provisions" | "food";

export interface Business {
  id: string;
  plotId: string;
  type: BusinessType;
  level: number;
  purchaseCost: number;
}

export interface Plot {
  id: string;
  x: number;
  y: number;
}

export interface PlayerState {
  wallet: number;
  businesses: Business[];
  level: number;
}

export interface GameSave {
  version: 1;
  player: PlayerState;
}