import { z } from "zod";

export const ConfigSchema = z.object({
  mode: z.enum(["paper", "live"]).default("paper"),
  confirmLive: z.boolean().default(false),
  loops: z.number().int().min(1).default(3),
  startingCashUsd: z.number().positive().default(25_000),
  targetJlpWeight: z.number().min(0).max(1).default(0.55),
  targetGmWeight: z.number().min(0).max(1).default(0.45),
  rebalanceBandPct: z.number().positive().max(0.5).default(0.05),
  jlpAprPct: z.number().nonnegative().default(12.5),
  gmAprPct: z.number().nonnegative().default(9.8),
  dragBpsPerLoop: z.number().nonnegative().default(0.005),
  harvestFeeThresholdUsd: z.number().positive().default(25),
  maxRebalanceUsd: z.number().positive().default(5_000),
  maxNetDeltaUsd: z.number().positive().default(8_000),
  solanaRpcUrl: z.string().url().default("https://api.mainnet-beta.solana.com"),
  arbitrumRpcUrl: z.string().url().default("https://arb1.arbitrum.io/rpc"),
  solanaPrivateKey: z.string().optional(),
  evmPrivateKey: z.string().optional(),
}).refine((config) => Math.abs(config.targetJlpWeight + config.targetGmWeight - 1) < 0.001, "target weights must total 100%");

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(argv: string[], env = process.env): Config {
  const option = (key: string): string | undefined => argv[argv.indexOf(`--${key}`) + 1];
  const loops = option("loops");
  return ConfigSchema.parse({
    mode: option("mode"),
    confirmLive: argv.includes("--confirm-live"),
    loops: loops === undefined ? undefined : Number(loops),
    solanaRpcUrl: env.SOLANA_RPC_URL,
    arbitrumRpcUrl: env.ARBITRUM_RPC_URL,
    solanaPrivateKey: env.SOLANA_PRIVATE_KEY,
    evmPrivateKey: env.EVM_PRIVATE_KEY,
  });
}

export function assertLiveReady(config: Config): void {
  if (config.mode !== "live") return;
  if (!config.confirmLive) throw new Error("Live mode requires --confirm-live.");
  if (!config.solanaPrivateKey || !config.evmPrivateKey) throw new Error("Live mode requires both SOLANA_PRIVATE_KEY and EVM_PRIVATE_KEY.");
}
