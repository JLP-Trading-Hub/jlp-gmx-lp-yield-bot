import type { PoolQuote } from "../pools/adapters.js";

export interface Allocation { JLP: number; GM: number; cash: number; }
export interface RebalancePlan { from: "JLP" | "GM" | "cash"; to: "JLP" | "GM" | "cash"; amountUsd: number; reason: string; }

export function totalValue(allocation: Allocation): number {
  return allocation.JLP + allocation.GM + allocation.cash;
}

export function weights(allocation: Allocation): Record<keyof Allocation, number> {
  const total = totalValue(allocation);
  if (total <= 0) return { JLP: 0, GM: 0, cash: 1 };
  return { JLP: allocation.JLP / total, GM: allocation.GM / total, cash: allocation.cash / total };
}

export function planRebalance(
  allocation: Allocation,
  targetJlp: number,
  targetGm: number,
  band: number,
  maximumUsd: number,
): RebalancePlan | undefined {
  const total = totalValue(allocation);
  const target = { JLP: total * targetJlp, GM: total * targetGm };
  const deviations = { JLP: allocation.JLP - target.JLP, GM: allocation.GM - target.GM };
  const source = deviations.JLP > deviations.GM ? "JLP" : "GM";
  const destination = source === "JLP" ? "GM" : "JLP";
  const excess = deviations[source];
  if (Math.abs(excess) / Math.max(total, 1) <= band) return undefined;
  const capacity = allocation[source];
  const amountUsd = Math.min(Math.abs(excess), maximumUsd, capacity);
  if (amountUsd <= 0) return undefined;
  return { from: source, to: destination, amountUsd, reason: `${source} weight outside ${Math.round(band * 100)}% drift band` };
}

export function applyRebalance(allocation: Allocation, plan: RebalancePlan): Allocation {
  if (plan.amountUsd < 0 || allocation[plan.from] < plan.amountUsd) throw new Error("Invalid rebalance plan");
  return { ...allocation, [plan.from]: allocation[plan.from] - plan.amountUsd, [plan.to]: allocation[plan.to] + plan.amountUsd };
}

export function poolDelta(allocation: Allocation, quotes: PoolQuote[]): number {
  const byId = new Map(quotes.map((quote) => [quote.id, quote]));
  return allocation.JLP * (byId.get("JLP")?.deltaFraction ?? 0) + allocation.GM * (byId.get("GM")?.deltaFraction ?? 0);
}
