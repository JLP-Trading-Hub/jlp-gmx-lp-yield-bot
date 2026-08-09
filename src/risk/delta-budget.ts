export function computeNetDeltaUsd(
  jlpUsd: number,
  gmUsd: number,
  jlpBeta = 0.55,
  gmBeta = 0.85,
): number {
  return jlpUsd * jlpBeta + gmUsd * gmBeta;
}

export function withinDeltaCap(
  netDeltaUsd: number,
  maxNetDeltaUsd: number,
): { ok: boolean; reason: string } {
  const abs = Math.abs(netDeltaUsd);
  if (abs > maxNetDeltaUsd) {
    return {
      ok: false,
      reason: `Net delta $${abs.toFixed(0)} exceeds cap $${maxNetDeltaUsd}`,
    };
  }
  return { ok: true, reason: "Delta budget OK" };
}

export function trimSuggestion(
  netDeltaUsd: number,
  maxNetDeltaUsd: number,
  gmUsd: number,
  jlpUsd: number,
): { pool: "GM-BTC" | "JLP" | "none"; usd: number } {
  const overflow = Math.abs(netDeltaUsd) - maxNetDeltaUsd;
  if (overflow <= 0) return { pool: "none", usd: 0 };
  if (gmUsd > 0) return { pool: "GM-BTC", usd: Math.min(gmUsd, overflow / 0.85) };
  if (jlpUsd > 0) return { pool: "JLP", usd: Math.min(jlpUsd, overflow / 0.55) };
  return { pool: "none", usd: 0 };
}
