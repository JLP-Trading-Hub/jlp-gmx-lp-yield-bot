import type { Allocation } from "../allocator/rebalance.js";
import type { PoolQuote } from "../pools/adapters.js";

export interface RiskDecision { allowed: boolean; reasons: string[]; }

export function assessDelta(allocation: Allocation, quotes: PoolQuote[], maxNetDeltaUsd: number): RiskDecision {
  const quoteMap = new Map(quotes.map((quote) => [quote.id, quote]));
  const delta = allocation.JLP * (quoteMap.get("JLP")?.deltaFraction ?? 0) + allocation.GM * (quoteMap.get("GM")?.deltaFraction ?? 0);
  return delta <= maxNetDeltaUsd
    ? { allowed: true, reasons: [] }
    : { allowed: false, reasons: [`net delta ${delta.toFixed(0)} exceeds cap ${maxNetDeltaUsd}`] };
}

export function assessConcentration(allocation: Allocation, maxWeight = 0.75): RiskDecision {
  const total = allocation.JLP + allocation.GM + allocation.cash;
  const violations = (Object.entries(allocation) as Array<[keyof Allocation, number]>)
    .filter(([, amount]) => total > 0 && amount / total > maxWeight)
    .map(([name]) => `${name} concentration exceeds ${Math.round(maxWeight * 100)}%`);
  return { allowed: violations.length === 0, reasons: violations };
}

export function assessQuoteFreshness(quotes: PoolQuote[], maximumAgeMs = 120_000, now = new Date()): RiskDecision {
  const stale = quotes.filter((quote) => now.getTime() - quote.observedAt.getTime() > maximumAgeMs).map((quote) => `${quote.id} quote stale`);
  return { allowed: stale.length === 0, reasons: stale };
}

export function mergeRisk(...decisions: RiskDecision[]): RiskDecision {
  const reasons = decisions.flatMap((decision) => decision.reasons);
  return { allowed: reasons.length === 0, reasons };
}
