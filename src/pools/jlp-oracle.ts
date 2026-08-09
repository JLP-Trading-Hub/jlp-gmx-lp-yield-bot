export interface JlpSnapshot {
  priceUsd: number;
  aprPct: number;
  source: string;
  ts: number;
}

export async function fetchJlpSnapshot(): Promise<JlpSnapshot> {
  const url = "https://api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112";
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const json = (await res.json()) as {
        data?: Record<string, { price?: string | number }>;
      };
      const first = Object.values(json.data ?? {})[0];
      const px = Number(first?.price ?? 0);
      if (px > 0) {
        return { priceUsd: px, aprPct: 24, source: "jupiter-price", ts: Date.now() };
      }
    }
  } catch {
    // fall through to synthetic
  }
  return { priceUsd: 1, aprPct: 22, source: "synthetic", ts: Date.now() };
}

export function netApr(gross: number, drag: number): number {
  return Math.max(0, gross - drag);
}
