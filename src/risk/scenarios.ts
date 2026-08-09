import type { Allocation } from "../allocator/rebalance.js";
import type { PoolQuote } from "../pools/adapters.js";

export interface PoolScenario { name: string; jlpShockPct: number; gmShockPct: number; underlyingShockPct: number; }
export interface PoolScenarioResult { name: string; valueChangeUsd: number; deltaChangeUsd: number; endingValueUsd: number; }

export const stressScenarios: PoolScenario[] = [
  { name: "calm market", jlpShockPct: 0, gmShockPct: 0, underlyingShockPct: 0 },
  { name: "crypto drawdown", jlpShockPct: -0.12, gmShockPct: -0.08, underlyingShockPct: -0.2 },
  { name: "liquidity event", jlpShockPct: -0.2, gmShockPct: -0.15, underlyingShockPct: -0.3 },
  { name: "risk-on rally", jlpShockPct: 0.1, gmShockPct: 0.06, underlyingShockPct: 0.15 },
];

export function evaluatePoolScenario(allocation: Allocation, quotes: PoolQuote[], scenario: PoolScenario): PoolScenarioResult {
  const delta = new Map(quotes.map((quote) => [quote.id, quote.deltaFraction]));
  const valueChangeUsd = allocation.JLP * scenario.jlpShockPct + allocation.GM * scenario.gmShockPct;
  const deltaChangeUsd = allocation.JLP * (delta.get("JLP") ?? 0) * scenario.underlyingShockPct
    + allocation.GM * (delta.get("GM") ?? 0) * scenario.underlyingShockPct;
  return { name: scenario.name, valueChangeUsd, deltaChangeUsd, endingValueUsd: allocation.JLP + allocation.GM + allocation.cash + valueChangeUsd };
}

export function worstScenario(allocation: Allocation, quotes: PoolQuote[]): PoolScenarioResult {
  return stressScenarios.map((scenario) => evaluatePoolScenario(allocation, quotes, scenario)).sort((a, b) => a.valueChangeUsd - b.valueChangeUsd)[0];
}

export function rebalanceUnderStress(allocation: Allocation, scenario: PoolScenario): Allocation {
  return { ...allocation, JLP: allocation.JLP * (1 + scenario.jlpShockPct), GM: allocation.GM * (1 + scenario.gmShockPct) };
}

export function capitalAtRisk(allocation: Allocation, quotes: PoolQuote[], confidenceMultiplier = 1.65): number {
  const variance = quotes.reduce((sum, quote) => {
    const capital = allocation[quote.id];
    const assumedVolatility = quote.id === "JLP" ? 0.035 : 0.025;
    return sum + (capital * assumedVolatility) ** 2;
  }, 0);
  return Math.sqrt(variance) * confidenceMultiplier;
}

export function withdrawalPlan(allocation: Allocation, requestedUsd: number): Array<{ pool: "JLP" | "GM"; amountUsd: number }> {
  const invested = allocation.JLP + allocation.GM;
  if (requestedUsd <= 0 || invested <= 0) return [];
  const amount = Math.min(requestedUsd, invested);
  return [{ pool: "JLP", amountUsd: amount * allocation.JLP / invested }, { pool: "GM", amountUsd: amount * allocation.GM / invested }];
}
