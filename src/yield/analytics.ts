import type { Allocation } from "../allocator/rebalance.js";
import type { PoolQuote } from "../pools/adapters.js";
import type { YieldLedger } from "./accrual.js";

export interface YieldProjection {
  readonly pool: "JLP" | "GM";
  readonly capitalUsd: number;
  readonly grossAprPct: number;
  readonly annualFeesUsd: number;
  readonly monthlyFeesUsd: number;
  readonly dailyFeesUsd: number;
}

export function projectPoolYield(pool: "JLP" | "GM", capitalUsd: number, aprPct: number): YieldProjection {
  const annualFeesUsd = capitalUsd * aprPct / 100;
  return { pool, capitalUsd, grossAprPct: aprPct, annualFeesUsd, monthlyFeesUsd: annualFeesUsd / 12, dailyFeesUsd: annualFeesUsd / 365.25 };
}

export function projections(allocation: Allocation, quotes: PoolQuote[]): YieldProjection[] {
  const quote = new Map(quotes.map((item) => [item.id, item]));
  return [
    projectPoolYield("JLP", allocation.JLP, quote.get("JLP")?.aprPct ?? 0),
    projectPoolYield("GM", allocation.GM, quote.get("GM")?.aprPct ?? 0),
  ];
}

export function annualizedNetApr(allocation: Allocation, _quotes: PoolQuote[], ledger: YieldLedger, elapsedDays: number): number {
  const capital = allocation.JLP + allocation.GM;
  if (capital === 0 || elapsedDays <= 0) return 0;
  const net = ledger.jlpFeesUsd + ledger.gmFeesUsd - ledger.dragUsd;
  return net / capital * 365.25 / elapsedDays;
}

export function effectivePoolWeights(allocation: Allocation): { jlp: number; gm: number; cash: number } {
  const total = allocation.JLP + allocation.GM + allocation.cash;
  return total === 0 ? { jlp: 0, gm: 0, cash: 1 } : { jlp: allocation.JLP / total, gm: allocation.GM / total, cash: allocation.cash / total };
}

export function rebalanceCostBenefit(amountUsd: number, fromAprPct: number, toAprPct: number, transactionCostBps: number, holdingDays: number): number {
  const yieldDifference = amountUsd * (toAprPct - fromAprPct) / 100 * holdingDays / 365.25;
  const transactionCost = amountUsd * transactionCostBps / 10_000;
  return yieldDifference - transactionCost;
}

export function stressLoss(allocation: Allocation, jlpShock: number, gmShock: number): number {
  return allocation.JLP * jlpShock + allocation.GM * gmShock;
}

export function deltaStress(allocation: Allocation, quotes: PoolQuote[], underlyingShock: number): number {
  const quoteMap = new Map(quotes.map((quote) => [quote.id, quote]));
  return allocation.JLP * (quoteMap.get("JLP")?.deltaFraction ?? 0) * underlyingShock
    + allocation.GM * (quoteMap.get("GM")?.deltaFraction ?? 0) * underlyingShock;
}
