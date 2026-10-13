import { BUSINESS_TYPES } from "@/game/data/businessTypes";
import { GAME_START_OFFSET_MS, GAME_TIME_SCALE, getGameClock } from "@/game/simulation/clock";
import { SIMULATION_TICK_MS, type SimulationContext } from "@/game/simulation/engine";
import type {
  Business,
  BusinessLedger,
  BusinessType,
  CompletedTransaction,
  EconomyState,
  GameSimulationState,
  SimulatedCustomer,
} from "@/game/types";

export const MAX_ACTIVE_CUSTOMERS = 12;
export const MAX_RECENT_TRANSACTIONS = 4;
export const MAX_CUSTOMERS_PER_BUSINESS = 3;
export const CUSTOMER_ROUTE_TILES: Record<string, Array<[number, number]>> = {
  "plot-01": [[5, 3], [4, 3], [3, 3], [3, 2], [2, 2]],
  "plot-02": [[5, 3], [6, 3], [6, 2], [5, 2]],
  "plot-03": [[5, 3], [4, 3], [3, 3], [2, 3], [1, 3]],
  "plot-04": [[5, 3], [5, 4]],
  "plot-05": [[5, 3], [6, 3], [7, 3]],
  "plot-06": [[5, 3], [5, 4], [5, 5], [5, 6], [4, 6]],
};

export const BUSINESS_ECONOMY_RULES: Record<BusinessType, {
  revenuePerTransaction: number;
  maxDailyTransactions: number;
  arrivalIntervalTicks: number;
}> = {
  pos: { revenuePerTransaction: 250, maxDailyTransactions: 40, arrivalIntervalTicks: 7 },
  provisions: { revenuePerTransaction: 450, maxDailyTransactions: 35, arrivalIntervalTicks: 8 },
  food: { revenuePerTransaction: 700, maxDailyTransactions: 30, arrivalIntervalTicks: 9 },
};

function createBusinessLedger(businessId: string, day: number): BusinessLedger {
  return { businessId, totalRevenue: 0, totalTransactions: 0, dailyTransactions: 0, day };
}

export function createInitialEconomyState(
  businesses: Business[],
  day = 1,
  lastTickIndex = 0,
): EconomyState {
  return {
    totalRevenue: 0,
    currentDay: day,
    lastTickIndex,
    businessLedgers: Object.fromEntries(
      businesses.map((business) => [business.id, createBusinessLedger(business.id, day)]),
    ),
    activeCustomers: [],
    recentTransactions: [],
  };
}

export function ensureOwnedBusinessLedgers(
  economy: EconomyState,
  businesses: Business[],
  day = economy.currentDay,
): EconomyState {
  const businessLedgers: Record<string, BusinessLedger> = {};
  for (const business of businesses) {
    const existing = economy.businessLedgers[business.id];
    businessLedgers[business.id] = existing ?? createBusinessLedger(business.id, day);
  }
  const activeCustomers = economy.activeCustomers.filter((customer) =>
    businesses.some((business) => business.id === customer.businessId && business.plotId === customer.plotId),
  );
  if (
    Object.keys(businessLedgers).length === Object.keys(economy.businessLedgers).length &&
    activeCustomers.length === economy.activeCustomers.length
  ) return economy;
  return { ...economy, businessLedgers, activeCustomers };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSafeNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function normalizeEconomyState(
  value: unknown,
  businesses: Business[],
  day: number,
  tickIndex: number,
): EconomyState {
  const initial = createInitialEconomyState(businesses, day, tickIndex);
  if (!isRecord(value)) return initial;

  const savedLedgers = isRecord(value.businessLedgers) ? value.businessLedgers : {};
  const businessLedgers: Record<string, BusinessLedger> = {};
  for (const business of businesses) {
    const saved = savedLedgers[business.id];
    if (!isRecord(saved)) {
      businessLedgers[business.id] = createBusinessLedger(business.id, day);
      continue;
    }
    const rules = BUSINESS_ECONOMY_RULES[business.type];
    const totalTransactions = saved.totalTransactions;
    const totalRevenue = saved.totalRevenue;
    const savedDay = saved.day;
    const dailyTransactions = saved.dailyTransactions;
    const validTotals =
      isSafeNonNegativeInteger(totalTransactions) &&
      isSafeNonNegativeInteger(totalRevenue) &&
      totalTransactions * rules.revenuePerTransaction === totalRevenue;
    const validDailyCount =
      isSafeNonNegativeInteger(dailyTransactions) &&
      Number(dailyTransactions) <= rules.maxDailyTransactions &&
      isSafeNonNegativeInteger(totalTransactions) && Number(dailyTransactions) <= Number(totalTransactions);

    if (!validTotals || !validDailyCount || !Number.isSafeInteger(Number(totalTransactions) * rules.revenuePerTransaction)) {
      businessLedgers[business.id] = createBusinessLedger(business.id, day);
      continue;
    }
    businessLedgers[business.id] = {
      businessId: business.id,
      totalRevenue: Number(totalRevenue),
      totalTransactions: Number(totalTransactions),
      dailyTransactions: savedDay === day ? Number(dailyTransactions) : 0,
      day,
    };
  }

  const activeCustomers: SimulatedCustomer[] = [];
  const customerIds = new Set<string>();
  const customerCounts = new Map<string, number>();
  if (Array.isArray(value.activeCustomers)) {
    for (const saved of value.activeCustomers) {
      if (activeCustomers.length >= MAX_ACTIVE_CUSTOMERS) break;
      if (!isRecord(saved)) continue;
      const business = businesses.find((owned) => owned.id === saved.businessId && owned.plotId === saved.plotId);
      const idParts = typeof saved.id === "string" ? saved.id.split(":") : [];
      const spawnDay = Number(idParts[0]);
      const spawnTick = Number(idParts[2]);
      const activeForBusiness = business ? customerCounts.get(business.id) ?? 0 : MAX_CUSTOMERS_PER_BUSINESS;
      const validStage = ["SPAWNED", "WALKING", "WAITING", "SERVED", "EXITING"].includes(String(saved.stage));
      if (
        !business ||
        typeof saved.id !== "string" ||
        idParts.length !== 3 || idParts[1] !== business.id ||
        !Number.isSafeInteger(spawnDay) || spawnDay < 1 || spawnDay > day ||
        !Number.isSafeInteger(spawnTick) || spawnTick < 1 || spawnTick > tickIndex ||
        activeForBusiness >= MAX_CUSTOMERS_PER_BUSINESS ||
        customerIds.has(saved.id) ||
        !validStage ||
        !isSafeNonNegativeInteger(saved.routeStep) ||
        saved.routeStep >= getCustomerRouteLength(business.plotId) ||
        !Number.isSafeInteger(saved.outfitIndex) ||
        Number(saved.outfitIndex) < 0 || Number(saved.outfitIndex) > 4
      ) continue;
      customerIds.add(saved.id);
      customerCounts.set(business.id, activeForBusiness + 1);
      activeCustomers.push({
        id: saved.id,
        businessId: business.id,
        plotId: business.plotId,
        stage: saved.stage as SimulatedCustomer["stage"],
        routeStep: Number(saved.routeStep),
        outfitIndex: Number(saved.outfitIndex),
      });
    }
  }

  const recentTransactions: CompletedTransaction[] = [];
  const transactionIds = new Set<string>();
  if (Array.isArray(value.recentTransactions)) {
    for (const saved of value.recentTransactions.slice(-MAX_RECENT_TRANSACTIONS)) {
      if (!isRecord(saved) || typeof saved.id !== "string" || transactionIds.has(saved.id)) continue;
      const business = businesses.find((owned) => owned.id === saved.businessId && owned.plotId === saved.plotId);
      const ledger = business ? businessLedgers[business.id] : undefined;
      const sequence = business ? Number(saved.id.slice(`${business.id}:sale:`.length)) : 0;
      if (
        !business || !ledger ||
        saved.id !== `${business.id}:sale:${sequence}` || sequence < 1 || sequence > ledger.totalTransactions ||
        !isSafeNonNegativeInteger(saved.simulationTick) || saved.simulationTick < 1 || saved.simulationTick > tickIndex ||
        !isSafeNonNegativeInteger(saved.gameDay) || saved.gameDay < 1 || saved.gameDay > day ||
        saved.revenue !== BUSINESS_ECONOMY_RULES[business.type].revenuePerTransaction
      ) continue;
      transactionIds.add(saved.id);
      recentTransactions.push({
        id: saved.id,
        businessId: business.id,
        plotId: business.plotId,
        simulationTick: Number(saved.simulationTick),
        gameDay: Number(saved.gameDay),
        revenue: Number(saved.revenue),
      });
    }
  }

  let safeTotalRevenue = Object.values(businessLedgers).reduce((sum, ledger) => sum + ledger.totalRevenue, 0);
  if (!Number.isSafeInteger(safeTotalRevenue)) {
    for (const business of businesses) businessLedgers[business.id] = createBusinessLedger(business.id, day);
    safeTotalRevenue = 0;
    recentTransactions.length = 0;
  }

  return {
    totalRevenue: safeTotalRevenue,
    currentDay: day,
    lastTickIndex: tickIndex,
    businessLedgers,
    activeCustomers,
    recentTransactions,
  };
}

function resetDailyLedgers(economy: EconomyState, day: number): EconomyState {
  if (economy.currentDay === day) return economy;
  return {
    ...economy,
    currentDay: day,
    businessLedgers: Object.fromEntries(
      Object.entries(economy.businessLedgers).map(([businessId, ledger]) => [businessId, {
        ...ledger,
        dailyTransactions: 0,
        day,
      }]),
    ),
  };
}

function stableHash(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function canArrive(
  business: Business,
  economy: EconomyState,
  tickIndex: number,
): boolean {
  const rules = BUSINESS_ECONOMY_RULES[business.type];
  const ledger = economy.businessLedgers[business.id];
  const activeForBusiness = economy.activeCustomers.filter((customer) => customer.businessId === business.id).length;
  return (
    ledger.dailyTransactions < rules.maxDailyTransactions &&
    activeForBusiness < MAX_CUSTOMERS_PER_BUSINESS &&
    economy.activeCustomers.length < MAX_ACTIVE_CUSTOMERS &&
    (tickIndex + stableHash(business.id)) % rules.arrivalIntervalTicks === 0
  );
}

export interface TransactionAttempt {
  id: string;
  businessId: string;
  plotId: string;
  simulationTick: number;
  gameDay: number;
  revenue: number;
}

export function completeTransaction(
  state: GameSimulationState,
  transaction: TransactionAttempt,
): GameSimulationState {
  const business = state.player.businesses.find((owned) =>
    owned.id === transaction.businessId && owned.plotId === transaction.plotId,
  );
  const ledger = state.economy.businessLedgers[transaction.businessId];
  if (!business || !ledger) return state;

  const rules = BUSINESS_ECONOMY_RULES[business.type];
  const expectedId = `${business.id}:sale:${ledger.totalTransactions + 1}`;
  if (
    transaction.id !== expectedId ||
    transaction.simulationTick !== state.economy.lastTickIndex ||
    transaction.gameDay !== state.economy.currentDay ||
    transaction.revenue !== rules.revenuePerTransaction ||
    ledger.day !== state.economy.currentDay ||
    ledger.dailyTransactions >= rules.maxDailyTransactions ||
    !Number.isSafeInteger(state.player.wallet + transaction.revenue) ||
    !Number.isSafeInteger(ledger.totalRevenue + transaction.revenue) ||
    !Number.isSafeInteger(state.economy.totalRevenue + transaction.revenue)
  ) return state;

  const completed: CompletedTransaction = { ...transaction };
  return {
    player: { ...state.player, wallet: state.player.wallet + transaction.revenue },
    economy: {
      ...state.economy,
      totalRevenue: state.economy.totalRevenue + transaction.revenue,
      businessLedgers: {
        ...state.economy.businessLedgers,
        [business.id]: {
          ...ledger,
          totalRevenue: ledger.totalRevenue + transaction.revenue,
          totalTransactions: ledger.totalTransactions + 1,
          dailyTransactions: ledger.dailyTransactions + 1,
        },
      },
      recentTransactions: [...state.economy.recentTransactions, completed].slice(-MAX_RECENT_TRANSACTIONS),
    },
  };
}

function nextCustomerStage(
  customer: SimulatedCustomer,
  routeLength: number,
): SimulatedCustomer | null {
  switch (customer.stage) {
    case "SPAWNED":
      return { ...customer, stage: "WALKING", routeStep: Math.min(1, routeLength - 1) };
    case "WALKING":
      if (customer.routeStep < routeLength - 1) {
        return { ...customer, routeStep: customer.routeStep + 1 };
      }
      return { ...customer, stage: "WAITING" };
    case "WAITING":
      return { ...customer, stage: "SERVED" };
    case "SERVED":
      return { ...customer, stage: "EXITING", routeStep: Math.max(0, routeLength - 2) };
    case "EXITING":
      if (customer.routeStep > 0) return { ...customer, routeStep: customer.routeStep - 1 };
      return null;
  }
}

export function advanceCustomerSimulation(
  context: SimulationContext<GameSimulationState>,
): GameSimulationState {
  const gameDay = getGameClock(context.elapsedActiveMs).day;
  let economy = ensureOwnedBusinessLedgers(context.state.economy, context.state.player.businesses, gameDay);
  economy = resetDailyLedgers(economy, gameDay);
  economy = { ...economy, lastTickIndex: context.tickIndex };
  let state: GameSimulationState = { ...context.state, economy };
  const customers: SimulatedCustomer[] = [];

  for (const customer of economy.activeCustomers) {
    const business = state.player.businesses.find((owned) => owned.id === customer.businessId);
    if (!business) continue;
    const routeLength = getCustomerRouteLength(business.plotId);
    const next = nextCustomerStage(customer, routeLength);
    if (customer.stage === "WAITING" && next?.stage === "SERVED") {
      const ledger = state.economy.businessLedgers[business.id];
      const transaction: TransactionAttempt = {
        id: `${business.id}:sale:${ledger.totalTransactions + 1}`,
        businessId: business.id,
        plotId: business.plotId,
        simulationTick: context.tickIndex,
        gameDay,
        revenue: BUSINESS_ECONOMY_RULES[business.type].revenuePerTransaction,
      };
      state = completeTransaction(state, transaction);
    }
    if (next) customers.push(next);
  }

  for (const business of state.player.businesses) {
    if (!canArrive(business, { ...state.economy, activeCustomers: customers }, context.tickIndex)) continue;
    customers.push({
      id: `${gameDay}:${business.id}:${context.tickIndex}`,
      businessId: business.id,
      plotId: business.plotId,
      stage: "SPAWNED",
      routeStep: 0,
      outfitIndex: stableHash(`${business.id}:${context.tickIndex}`) % 5,
    });
  }

  return { ...state, economy: { ...state.economy, activeCustomers: customers } };
}

export function getCustomerRouteLength(plotId: string): number {
  return CUSTOMER_ROUTE_TILES[plotId]?.length ?? 2;
}

export function createTransactionAttempt(
  business: Business,
  ledger: BusinessLedger,
  simulationTick: number,
  gameDay: number,
): TransactionAttempt {
  return {
    id: `${business.id}:sale:${ledger.totalTransactions + 1}`,
    businessId: business.id,
    plotId: business.plotId,
    simulationTick,
    gameDay,
    revenue: BUSINESS_ECONOMY_RULES[business.type].revenuePerTransaction,
  };
}

export function getDayAtElapsedActiveMs(elapsedActiveMs: number): number {
  const dayMs = GAME_START_OFFSET_MS + elapsedActiveMs * GAME_TIME_SCALE;
  return Math.floor(dayMs / (24 * 60 * 60 * 1000)) + 1;
}

export function getExpectedSimulationTick(elapsedActiveMs: number): number {
  return Math.floor(elapsedActiveMs / SIMULATION_TICK_MS);
}