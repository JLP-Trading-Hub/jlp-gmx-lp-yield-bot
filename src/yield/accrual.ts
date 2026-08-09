import type { Allocation } from "../allocator/rebalance.js";
import type { PoolQuote } from "../pools/adapters.js";

export interface YieldLedger {
  readonly jlpFeesUsd: number;
  readonly gmFeesUsd: number;
  readonly dragUsd: number;
  readonly harvestedUsd: number;
}

export function emptyLedger(): YieldLedger {
  return { jlpFeesUsd: 0, gmFeesUsd: 0, dragUsd: 0, harvestedUsd: 0 };
}

export function accrue(
  allocation: Allocation,
  quotes: PoolQuote[],
  ledger: YieldLedger,
  elapsedHours: number,
  dragBps: number,
): YieldLedger {
  const apr = new Map(quotes.map((quote) => [quote.id, quote.aprPct / 100]));
  const jlpFeesUsd = ledger.jlpFeesUsd + allocation.JLP * (apr.get("JLP") ?? 0) * elapsedHours / (365.25 * 24);
  const gmFeesUsd = ledger.gmFeesUsd + allocation.GM * (apr.get("GM") ?? 0) * elapsedHours / (365.25 * 24);
  const dragUsd = ledger.dragUsd + (allocation.JLP + allocation.GM) * dragBps / 10_000;
  return { ...ledger, jlpFeesUsd, gmFeesUsd, dragUsd };
}

export function availableFees(ledger: YieldLedger): number {
  return ledger.jlpFeesUsd + ledger.gmFeesUsd - ledger.harvestedUsd;
}

export function harvest(ledger: YieldLedger, thresholdUsd: number): { ledger: YieldLedger; amountUsd: number } {
  const amountUsd = availableFees(ledger);
  if (amountUsd < thresholdUsd) return { ledger, amountUsd: 0 };
  return { ledger: { ...ledger, harvestedUsd: ledger.harvestedUsd + amountUsd }, amountUsd };
}

export function netAnnualizedYield(allocation: Allocation, quotes: PoolQuote[], dragBps: number): number {
  const total = allocation.JLP + allocation.GM;
  if (total === 0) return 0;
  const gross = quotes.reduce((sum, quote) => sum + allocation[quote.id] * quote.aprPct / 100, 0) / total;
  return gross - dragBps / 10_000 * 365;
}
