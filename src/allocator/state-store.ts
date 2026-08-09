import type { Allocation, RebalancePlan } from "./rebalance.js";

export interface PersistedPoolPosition {
  readonly poolId: "JLP" | "GM";
  readonly units: number;
  readonly costBasisUsd: number;
  readonly lastPriceUsd: number;
  readonly accruedFeesUsd: number;
}

export interface AllocatorEvent {
  readonly id: string;
  readonly at: string;
  readonly kind: "deposit" | "withdrawal" | "rebalance" | "harvest" | "mark";
  readonly detail: string;
  readonly amountUsd: number;
}

export interface AllocatorState {
  readonly version: 1;
  readonly cashUsd: number;
  readonly positions: PersistedPoolPosition[];
  readonly events: AllocatorEvent[];
  readonly updatedAt: string;
}

export interface StateStore {
  load(): Promise<AllocatorState | undefined>;
  save(state: AllocatorState): Promise<void>;
}

export class MemoryStateStore implements StateStore {
  private state: AllocatorState | undefined;
  async load(): Promise<AllocatorState | undefined> {
    return this.state ? structuredClone(this.state) : undefined;
  }
  async save(state: AllocatorState): Promise<void> {
    this.state = structuredClone(state);
  }
}

export function emptyAllocatorState(cashUsd: number): AllocatorState {
  if (cashUsd < 0) throw new Error("Cash cannot be negative");
  return { version: 1, cashUsd, positions: [], events: [], updatedAt: new Date().toISOString() };
}

function event(kind: AllocatorEvent["kind"], detail: string, amountUsd: number, index: number): AllocatorEvent {
  return { id: `${Date.now()}-${index}`, at: new Date().toISOString(), kind, detail, amountUsd };
}

function position(state: AllocatorState, poolId: PersistedPoolPosition["poolId"]): PersistedPoolPosition {
  return state.positions.find((item) => item.poolId === poolId)
    ?? { poolId, units: 0, costBasisUsd: 0, lastPriceUsd: 0, accruedFeesUsd: 0 };
}

function upsert(state: AllocatorState, next: PersistedPoolPosition): PersistedPoolPosition[] {
  return [...state.positions.filter((item) => item.poolId !== next.poolId), next];
}

function commit(_state: AllocatorState, update: Omit<AllocatorState, "version" | "updatedAt">): AllocatorState {
  return { version: 1, ...update, updatedAt: new Date().toISOString() };
}

export function deposit(state: AllocatorState, poolId: PersistedPoolPosition["poolId"], amountUsd: number, priceUsd: number): AllocatorState {
  if (amountUsd <= 0 || priceUsd <= 0 || state.cashUsd < amountUsd) throw new Error("Invalid pool deposit");
  const current = position(state, poolId);
  const units = amountUsd / priceUsd;
  const next = { ...current, units: current.units + units, costBasisUsd: current.costBasisUsd + amountUsd, lastPriceUsd: priceUsd };
  return commit(state, { cashUsd: state.cashUsd - amountUsd, positions: upsert(state, next), events: [...state.events, event("deposit", `deposit ${poolId}`, amountUsd, state.events.length)] });
}

export function withdraw(state: AllocatorState, poolId: PersistedPoolPosition["poolId"], amountUsd: number, priceUsd: number): AllocatorState {
  const current = position(state, poolId);
  const units = amountUsd / priceUsd;
  if (amountUsd <= 0 || priceUsd <= 0 || current.units + 1e-12 < units) throw new Error("Invalid pool withdrawal");
  const fraction = current.units === 0 ? 0 : units / current.units;
  const next = { ...current, units: current.units - units, costBasisUsd: current.costBasisUsd * (1 - fraction), lastPriceUsd: priceUsd };
  return commit(state, { cashUsd: state.cashUsd + amountUsd, positions: upsert(state, next), events: [...state.events, event("withdrawal", `withdraw ${poolId}`, amountUsd, state.events.length)] });
}

export function mark(state: AllocatorState, poolId: PersistedPoolPosition["poolId"], priceUsd: number): AllocatorState {
  if (priceUsd <= 0) throw new Error("Price must be positive");
  const current = position(state, poolId);
  const next = { ...current, lastPriceUsd: priceUsd };
  return commit(state, { cashUsd: state.cashUsd, positions: upsert(state, next), events: [...state.events, event("mark", `mark ${poolId}`, current.units * priceUsd, state.events.length)] });
}

export function accrueFees(state: AllocatorState, poolId: PersistedPoolPosition["poolId"], amountUsd: number): AllocatorState {
  if (amountUsd < 0) throw new Error("Fee accrual cannot be negative");
  const current = position(state, poolId);
  const next = { ...current, accruedFeesUsd: current.accruedFeesUsd + amountUsd };
  return commit(state, { cashUsd: state.cashUsd, positions: upsert(state, next), events: state.events });
}

export function harvestFees(state: AllocatorState, poolId: PersistedPoolPosition["poolId"]): AllocatorState {
  const current = position(state, poolId);
  const next = { ...current, accruedFeesUsd: 0 };
  return commit(state, { cashUsd: state.cashUsd + current.accruedFeesUsd, positions: upsert(state, next), events: [...state.events, event("harvest", `harvest ${poolId}`, current.accruedFeesUsd, state.events.length)] });
}

export function applyPlan(state: AllocatorState, plan: RebalancePlan, prices: Record<"JLP" | "GM", number>): AllocatorState {
  if (plan.from === "cash") return deposit(state, plan.to as "JLP" | "GM", plan.amountUsd, prices[plan.to as "JLP" | "GM"]);
  if (plan.to === "cash") return withdraw(state, plan.from as "JLP" | "GM", plan.amountUsd, prices[plan.from as "JLP" | "GM"]);
  const afterWithdrawal = withdraw(state, plan.from, plan.amountUsd, prices[plan.from]);
  const afterDeposit = deposit(afterWithdrawal, plan.to, plan.amountUsd, prices[plan.to]);
  return commit(afterDeposit, { cashUsd: afterDeposit.cashUsd, positions: afterDeposit.positions, events: [...afterDeposit.events, event("rebalance", plan.reason, plan.amountUsd, afterDeposit.events.length)] });
}

export function allocation(state: AllocatorState): Allocation {
  const jlp = position(state, "JLP");
  const gm = position(state, "GM");
  return { JLP: jlp.units * jlp.lastPriceUsd, GM: gm.units * gm.lastPriceUsd, cash: state.cashUsd };
}

export function totalValue(state: AllocatorState): number {
  const balances = allocation(state);
  return balances.JLP + balances.GM + balances.cash;
}

export function unrealizedPnl(state: AllocatorState): number {
  return state.positions.reduce((sum, item) => sum + item.units * item.lastPriceUsd - item.costBasisUsd, 0);
}

export class PersistentAllocator {
  private state: AllocatorState | undefined;
  constructor(private readonly store: StateStore) {}
  async initialize(cashUsd: number): Promise<AllocatorState> {
    this.state = await this.store.load() ?? emptyAllocatorState(cashUsd);
    return this.state;
  }
  snapshot(): AllocatorState {
    if (!this.state) throw new Error("Allocator is not initialized");
    return structuredClone(this.state);
  }
  async transact(mutator: (state: AllocatorState) => AllocatorState): Promise<AllocatorState> {
    if (!this.state) throw new Error("Allocator is not initialized");
    this.state = mutator(this.state);
    await this.store.save(this.state);
    return this.snapshot();
  }
}
