import type { RebalancePlan } from "../allocator/rebalance.js";

export interface ExecutionReceipt {
  readonly status: "paper-filled" | "blocked";
  readonly id: string;
  readonly plan: RebalancePlan;
  readonly message: string;
}

export interface VaultExecutor {
  execute(plan: RebalancePlan): Promise<ExecutionReceipt>;
  harvest(amountUsd: number): Promise<ExecutionReceipt | undefined>;
}

const cashPlan = (amountUsd: number): RebalancePlan => ({ from: "JLP", to: "cash", amountUsd, reason: "fee harvest" });

export class PaperVaultExecutor implements VaultExecutor {
  private sequence = 0;
  async execute(plan: RebalancePlan): Promise<ExecutionReceipt> {
    if (plan.amountUsd <= 0) throw new Error("Rebalance amount must be positive");
    return { status: "paper-filled", id: `paper-vault-${++this.sequence}`, plan, message: "paper allocation updated" };
  }
  async harvest(amountUsd: number): Promise<ExecutionReceipt | undefined> {
    return amountUsd > 0 ? this.execute(cashPlan(amountUsd)) : undefined;
  }
}

export class LiveVaultExecutor implements VaultExecutor {
  constructor(private readonly solanaKey: string | undefined, private readonly evmKey: string | undefined, private readonly confirmed: boolean) {}
  async execute(plan: RebalancePlan): Promise<ExecutionReceipt> {
    if (!this.confirmed || !this.solanaKey || !this.evmKey) throw new Error("LIVE EXECUTION BLOCKED: require confirmation and both private keys.");
    // JLP and GM deposit/withdraw instructions need venue-specific audited builders.
    return { status: "blocked", id: "live-blocked", plan, message: "LIVE EXECUTION BLOCKED: transaction builders are intentionally not implemented." };
  }
  async harvest(amountUsd: number): Promise<ExecutionReceipt | undefined> {
    return amountUsd > 0 ? this.execute(cashPlan(amountUsd)) : undefined;
  }
}
