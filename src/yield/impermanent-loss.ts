export interface AssetWeight {
  readonly symbol: string;
  readonly weight: number;
  readonly startingPriceUsd: number;
  readonly currentPriceUsd: number;
}

export interface IlEstimate {
  readonly hodlValueMultiple: number;
  readonly lpValueMultiple: number;
  readonly impermanentLossPct: number;
  readonly feeOffsetPct: number;
  readonly netRelativePerformancePct: number;
}

export interface RangeLiquidityEstimate {
  readonly lowerPrice: number;
  readonly upperPrice: number;
  readonly spotPrice: number;
  readonly utilization: number;
  readonly directionalDelta: number;
}

export function validateWeights(weights: AssetWeight[]): void {
  const sum = weights.reduce((total, item) => total + item.weight, 0);
  if (weights.length === 0 || Math.abs(sum - 1) > 1e-6) throw new Error("Asset weights must total 1");
  if (weights.some((item) => item.weight < 0 || item.startingPriceUsd <= 0 || item.currentPriceUsd <= 0)) throw new Error("Invalid asset-weight input");
}

export function hodlMultiple(weights: AssetWeight[]): number {
  validateWeights(weights);
  return weights.reduce((total, item) => total + item.weight * item.currentPriceUsd / item.startingPriceUsd, 0);
}

export function constantProductMultiple(leftRatio: number, rightRatio: number): number {
  if (leftRatio <= 0 || rightRatio <= 0) throw new Error("Price ratios must be positive");
  return Math.sqrt(leftRatio * rightRatio);
}

export function twoAssetImpermanentLoss(startLeft: number, currentLeft: number, startRight: number, currentRight: number): number {
  const leftRatio = currentLeft / startLeft;
  const rightRatio = currentRight / startRight;
  const hodl = (leftRatio + rightRatio) / 2;
  return constantProductMultiple(leftRatio, rightRatio) / hodl - 1;
}

export function weightedGeometricMean(weights: AssetWeight[]): number {
  validateWeights(weights);
  return Math.exp(weights.reduce((total, item) => total + item.weight * Math.log(item.currentPriceUsd / item.startingPriceUsd), 0));
}

export function estimateImpermanentLoss(weights: AssetWeight[], accruedFeePct: number, managementFeePct = 0): IlEstimate {
  const hodlValueMultiple = hodlMultiple(weights);
  const lpValueMultiple = weightedGeometricMean(weights);
  const impermanentLossPct = lpValueMultiple / hodlValueMultiple - 1;
  const feeOffsetPct = accruedFeePct - managementFeePct;
  return { hodlValueMultiple, lpValueMultiple, impermanentLossPct, feeOffsetPct, netRelativePerformancePct: impermanentLossPct + feeOffsetPct };
}

export function concentratedRange(lowerPrice: number, upperPrice: number, spotPrice: number): RangeLiquidityEstimate {
  if (lowerPrice <= 0 || upperPrice <= lowerPrice || spotPrice <= 0) throw new Error("Invalid liquidity range");
  const utilization = spotPrice <= lowerPrice ? 0 : spotPrice >= upperPrice ? 1 : (Math.sqrt(spotPrice) - Math.sqrt(lowerPrice)) / (Math.sqrt(upperPrice) - Math.sqrt(lowerPrice));
  const directionalDelta = spotPrice <= lowerPrice ? 1 : spotPrice >= upperPrice ? 0 : 1 - utilization;
  return { lowerPrice, upperPrice, spotPrice, utilization, directionalDelta };
}

export function feeBreakEvenDays(notionalUsd: number, annualFeeAprPct: number, expectedIlPct: number): number {
  if (notionalUsd <= 0 || annualFeeAprPct <= 0 || expectedIlPct <= 0) return Infinity;
  return expectedIlPct / (annualFeeAprPct / 100) * 365.25;
}

export function compoundedApr(aprPct: number, compoundsPerYear: number): number {
  if (compoundsPerYear <= 0) throw new Error("Compounding frequency must be positive");
  return ((1 + aprPct / 100 / compoundsPerYear) ** compoundsPerYear - 1) * 100;
}

export function estimateHarvestValue(feesUsd: number, reinvestAprPct: number, remainingDays: number): number {
  return feesUsd * (1 + reinvestAprPct / 100 * remainingDays / 365.25);
}

export function stressWeights(weights: AssetWeight[], shocks: Record<string, number>): AssetWeight[] {
  return weights.map((item) => ({ ...item, currentPriceUsd: item.currentPriceUsd * (1 + (shocks[item.symbol] ?? 0)) }));
}

export function pairwiseCorrelationRisk(exposures: Array<{ notionalUsd: number; volatility: number }>, correlation: number): number {
  if (correlation < -1 || correlation > 1) throw new Error("Correlation must be between -1 and 1");
  const variance = exposures.reduce((sum, item) => sum + (item.notionalUsd * item.volatility) ** 2, 0)
    + exposures.flatMap((item, index) => exposures.slice(index + 1).map((other) => 2 * correlation * item.notionalUsd * item.volatility * other.notionalUsd * other.volatility)).reduce((sum, value) => sum + value, 0);
  return Math.sqrt(Math.max(variance, 0));
}
