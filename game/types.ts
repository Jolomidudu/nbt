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

export type CustomerStage = "SPAWNED" | "WALKING" | "WAITING" | "SERVED" | "EXITING";

export interface SimulatedCustomer {
  id: string;
  businessId: string;
  plotId: string;
  stage: CustomerStage;
  routeStep: number;
  outfitIndex: number;
}

export interface BusinessLedger {
  businessId: string;
  totalRevenue: number;
  totalTransactions: number;
  dailyTransactions: number;
  day: number;
}

export interface CompletedTransaction {
  id: string;
  businessId: string;
  plotId: string;
  simulationTick: number;
  gameDay: number;
  revenue: number;
}

export interface EconomyState {
  totalRevenue: number;
  currentDay: number;
  lastTickIndex: number;
  businessLedgers: Record<string, BusinessLedger>;
  activeCustomers: SimulatedCustomer[];
  recentTransactions: CompletedTransaction[];
}

export interface GameSimulationState {
  player: PlayerState;
  economy: EconomyState;
}

export interface GameSave {
  version: 3;
  player: PlayerState;
  elapsedActiveMs: number;
  manuallyPaused: boolean;
  economy: EconomyState;
}