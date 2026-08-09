import { type Config, assertLiveReady } from "../config.js";
import { applyRebalance, planRebalance, type Allocation } from "../allocator/rebalance.js";
import { JlpAdapter, GmAdapter, type PoolQuote } from "../pools/adapters.js";
import { assessConcentration, assessDelta, assessQuoteFreshness, mergeRisk } from "../risk/controls.js";
import { accrue, emptyLedger, harvest, type YieldLedger } from "../yield/accrual.js";
import { LiveVaultExecutor, PaperVaultExecutor, type VaultExecutor } from "../wallets/executor.js";

export interface RuntimeState { allocation: Allocation; ledger: YieldLedger; quotes: PoolQuote[]; }

export class YieldRuntime {
  private readonly jlp: JlpAdapter;
  private readonly gm: GmAdapter;
  private readonly executor: VaultExecutor;
  private state: RuntimeState;
  constructor(private readonly config: Config) {
    assertLiveReady(config);
    this.jlp = new JlpAdapter(config.solanaRpcUrl);
    this.gm = new GmAdapter(config.arbitrumRpcUrl);
    this.executor = config.mode === "paper" ? new PaperVaultExecutor() : new LiveVaultExecutor(config.solanaPrivateKey, config.evmPrivateKey, config.confirmLive);
    this.state = { allocation: { JLP: config.startingCashUsd * config.targetJlpWeight, GM: config.startingCashUsd * config.targetGmWeight, cash: 0 }, ledger: emptyLedger(), quotes: [] };
  }

  async cycle(quotesOverride?: PoolQuote[]): Promise<{ action: string; state: RuntimeState }> {
    const quotes = quotesOverride ?? await Promise.all([this.jlp.quote(), this.gm.quote()]);
    const risk = mergeRisk(assessDelta(this.state.allocation, quotes, this.config.maxNetDeltaUsd), assessConcentration(this.state.allocation), assessQuoteFreshness(quotes));
    this.state = { ...this.state, quotes, ledger: accrue(this.state.allocation, quotes, this.state.ledger, 1, this.config.dragBpsPerLoop) };
    if (!risk.allowed) return { action: `risk hold: ${risk.reasons.join("; ")}`, state: this.state };
    const plan = planRebalance(this.state.allocation, this.config.targetJlpWeight, this.config.targetGmWeight, this.config.rebalanceBandPct, this.config.maxRebalanceUsd);
    if (plan) { await this.executor.execute(plan); this.state = { ...this.state, allocation: applyRebalance(this.state.allocation, plan) }; }
    const fee = harvest(this.state.ledger, this.config.harvestFeeThresholdUsd);
    if (fee.amountUsd > 0) { await this.executor.harvest(fee.amountUsd); this.state = { ...this.state, ledger: fee.ledger, allocation: { ...this.state.allocation, cash: this.state.allocation.cash + fee.amountUsd } }; }
    return { action: plan?.reason ?? (fee.amountUsd > 0 ? "harvested fees" : "accrued yield"), state: this.state };
  }

  paperQuotes(): PoolQuote[] { return [this.jlp.paperQuote(), this.gm.paperQuote()]; }
}
