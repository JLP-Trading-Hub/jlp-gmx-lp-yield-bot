import { Connection } from "@solana/web3.js";
import { createPublicClient, http } from "viem";
import { arbitrum } from "viem/chains";

export interface PoolQuote {
  readonly id: "JLP" | "GM";
  readonly priceUsd: number;
  readonly aprPct: number;
  readonly deltaFraction: number;
  readonly source: string;
  readonly observedAt: Date;
}

async function json<T>(url: string, fetcher: typeof fetch): Promise<T> {
  const response = await fetcher(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`Price endpoint failed: ${response.status}`);
  return response.json() as Promise<T>;
}

export class JlpAdapter {
  private readonly connection: Connection;
  constructor(rpcUrl: string, private readonly fetcher: typeof fetch = fetch) { this.connection = new Connection(rpcUrl, "confirmed"); }

  async quote(): Promise<PoolQuote> {
    const payload = await json<{ data?: Record<string, { price?: number }> }>("https://api.jup.ag/price/v2?ids=JLP", this.fetcher);
    const price = Number(payload.data?.JLP?.price);
    if (!Number.isFinite(price) || price <= 0) throw new Error("Jupiter did not provide a JLP price");
    await this.connection.getSlot(); // confirms the configured Solana RPC is reachable
    return { id: "JLP", priceUsd: price, aprPct: 12.5, deltaFraction: 0.35, source: "Jupiter price + Solana RPC", observedAt: new Date() };
  }

  paperQuote(priceUsd = 3.42): PoolQuote {
    return { id: "JLP", priceUsd, aprPct: 12.5, deltaFraction: 0.35, source: "paper", observedAt: new Date() };
  }
}

export class GmAdapter {
  private readonly client;
  constructor(rpcUrl: string, private readonly fetcher: typeof fetch = fetch) { this.client = createPublicClient({ chain: arbitrum, transport: http(rpcUrl) }); }

  async quote(): Promise<PoolQuote> {
    const fallback = await json<{ prices?: Record<string, number> }>("https://api.gmx.io/prices/tickers", this.fetcher)
      .catch((): { prices: Record<string, number> } => ({ prices: {} }));
    const prices = fallback.prices ?? {};
    const price = Number(prices.GM ?? prices["GM:USDC"] ?? 1);
    await this.client.getBlockNumber();
    return { id: "GM", priceUsd: Number.isFinite(price) && price > 0 ? price : 1, aprPct: 9.8, deltaFraction: 0.2, source: "GMX public fallback + Arbitrum RPC", observedAt: new Date() };
  }

  paperQuote(priceUsd = 1.08): PoolQuote {
    return { id: "GM", priceUsd, aprPct: 9.8, deltaFraction: 0.2, source: "paper", observedAt: new Date() };
  }
}
