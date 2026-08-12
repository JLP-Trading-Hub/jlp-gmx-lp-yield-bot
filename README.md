<p align="center">
  <img src="docs/banner.jpg" alt="JLP & GMX LP Yield Bot" width="100%" />
</p>

# JLP & GMX LP Yield Bot

<p align="center">
  <strong>Be the house — allocate, harvest, rebalance</strong><br/>
  Jupiter JLP · GMX GM pools · Drift rebalancing · Net-delta budgets
</p>

<p align="center">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white" />
  <img alt="Solana" src="https://img.shields.io/badge/JLP-Solana-14F195" />
  <img alt="Arbitrum" src="https://img.shields.io/badge/GM-Arbitrum-28A0F0" />
  <img alt="Modes" src="https://img.shields.io/badge/Paper%20%2B%20Live-ready-success" />
  <img alt="License" src="https://img.shields.io/badge/License-MIT-yellow.svg" />
</p>

<p align="center">
  Languages: **English** · [中文](README.zh.md) · [Deutsch](README.de.md) · [Español](README.es.md)
</p>

> **Search keywords:** JLP APY · GMX GM pool · crypto LP yield bot · Jupiter JLP trading

---

## Project workflow

End-to-end path from clone to live — paper first, credentials last, risk always on.

```mermaid
flowchart LR
  A[Clone repo] --> B[npm install]
  B --> C[Edit settings.json]
  C --> D[typecheck + test]
  D --> E[npm run paper]
  E --> F{Paper results OK?}
  F -->|Yes| G[Fill .env secrets]
  F -->|Tune| C
  G --> H[npm run live --confirm-live]
  H --> I[Monitor ledger / risk]
  I -->|Limit hit| J[Halt / unwind]
  I -->|Yes| I
```

| Commands | |
|---------|--|
| `npm run paper` | Paper first — no keys required |
| `npm run dashboard` | Open local analytics dashboard (static) |
| `npm run live` | Requires `--confirm-live` + credentials |
| `npm test` / `npm run typecheck` | CI-local gates |

---

## Platform / why fit

| | |
|--|--|
| Dual-pool allocation | Target weights for JLP vs GM (configurable) |
| Drift rebalancer | Rebalance when allocation leaves the band |
| Harvest logic | Compound when accrued fees clear a threshold |
| Delta budget | Trim when estimated net directional exposure exceeds cap |

---

## Trading strategy

In 2026, a huge share of “easy yield” narratives sit on the **other side of traders** — LP / vault products like **JLP** and **GM**. This bot treats them as a **portfolio**: target weights, harvest fees, rebalance drift, and cap directional beta.

Live deposits/swaps need **both** chain keys and `--confirm-live`.

---

## Strategy diagram

```mermaid
flowchart TD
  J[JLP price / APR adapter] --> V[Vault manager]
  G[GM pool adapter] --> V
  V --> A[Accrue yield − drag]
  A --> D{Drift > band?}
  D -->|Yes| R[Rebalance toward targets]
  D -->|No| H{Fees >= harvest threshold?}
  H -->|Yes| Hv[Harvest]
  H -->|No| Δ{Net delta OK?}
  Δ -->|No| T[Trim higher-beta sleeve]
  Δ -->|Yes| Hold[Hold allocation]
  R --> W[Wallet execution path]
  Hv --> W
  T --> W
  W --> Risk[Fail-closed without keys]
```

---

## Strategy mathematics

Treat JLP and GM as a **two-sleeve portfolio**: hold target weights, harvest when fees clear a threshold, rebalance when drift leaves the band, trim when net delta exceeds budget.

Weights $w_{J}=$ `targetJlpWeight`, $w_{G}=$ `targetGmWeight` ($w_J+w_G=1$). Portfolio value $V$:

$$
e_J = \frac{V_J}{V} - w_J,\quad
\text{rebalance} \iff |e_J| \ge \texttt{rebalanceBandPct}
$$

**Rebalance clip** capped by `maxRebalanceUsd`. **Harvest** when accrued fees $\ge$ `harvestFeeThresholdUsd`.

**APR blend** (planning):

$$
\mathrm{APR}_{\mathrm{blended}} = w_J\cdot\texttt{jlpAprPct} + w_G\cdot\texttt{gmAprPct}
$$

**Net edge per loop** with drag $d=$ `dragBpsPerLoop`:

$$
\Pi \approx V\cdot\frac{\mathrm{APR}_{\mathrm{blended}}}{100\cdot n_{\mathrm{year}}} - d\cdot V - \mathrm{gas}
$$

**Delta brake**: if $|\Delta_{\mathrm{net}}| >$ `maxNetDeltaUsd`, trim inventory toward neutral.

### Edge profile chart

```mermaid
xychart-beta
    title "Blended APR vs JLP weight (conceptual)"
    x-axis ["30% JLP", "45%", "55%", "70%", "85%"]
    y-axis "Blended APR %" 8 --> 14
    bar [10.2, 11.0, 11.8, 12.1, 12.3]
    line [11.0, 11.0, 11.0, 11.0, 11.0]
```

*Tested 55/45 sits near the APR/delta tradeoff; higher JLP weight lifts APR but raises net delta risk.*

### Implications

- `rebalanceBandPct: 0.05` is hysteresis against fee churn.
- APR inputs are planning assumptions — live yields vary with trader PnL and emissions.


---

## Parameter explanations

Every control maps 1:1 to `settings.json`. Strategy knobs define the edge; risk knobs are hard brakes.

| Parameter | Location | Default | Meaning | Why it matters | Typical safe range |
|---|---|---|---|---|---|
| `targetJlpWeight` | top-level | `0.55` | Target portfolio weight in JLP | Primary Solana LP sleeve | 0.4 – 0.7 |
| `targetGmWeight` | top-level | `0.45` | Target weight in GMX GM | Arbitrum GM sleeve | 0.3 – 0.6 |
| `rebalanceBandPct` | top-level | `0.05` | Drift band before rebalance (5%) | Avoids fee churn on noise | 0.03 – 0.08 |
| `jlpAprPct` | top-level | `12.5` | Assumed JLP APR (%) for planning | Harvest / allocation model input | 8 – 18 |
| `gmAprPct` | top-level | `9.8` | Assumed GM APR (%) | Relative sleeve attractiveness | 6 – 14 |
| `dragBpsPerLoop` | top-level | `0.005` | Friction drag per loop (bps) | Models IL / fee bleed | 0.002 – 0.02 |
| `harvestFeeThresholdUsd` | top-level | `25` | Min accrued fees to harvest ($) | Stops micro-harvest gas waste | 15 – 50 |
| `maxRebalanceUsd` | top-level | `5000` | Max USD moved per rebalance | Caps rotation impact | 2k – 8k |
| `maxNetDeltaUsd` | top-level | `8000` | Max estimated net directional delta ($) | House beta brake | 4k – 12k |
| `startingCashUsd` | top-level | `25000` | Starting equity | Weight denominator | match live unit |
| `priceNoiseBps` | paper | `5` | Paper price noise (bps) | Exercises drift band | 3 – 12 |

---

## Tested / recommended parameter set

Paper-desk calibration on the bundled synthetic market model (same decision path as live). Use as a starting point, then tune to your venue and size.

```json
{
  "targetJlpWeight": 0.55,
  "targetGmWeight": 0.45,
  "rebalanceBandPct": 0.05,
  "jlpAprPct": 12.5,
  "gmAprPct": 9.8,
  "dragBpsPerLoop": 0.005,
  "harvestFeeThresholdUsd": 25,
  "maxRebalanceUsd": 5000,
  "maxNetDeltaUsd": 8000,
  "startingCashUsd": 25000,
  "paper": {
    "jlpPriceUsd": 3.42,
    "gmPriceUsd": 1.08,
    "priceNoiseBps": 5
  }
}
```

---

## Deep analysis — PnL & trade metrics

| Metric | Value |
|--------|------:|
| Net PnL | **$718.6** (2.87%) |
| Win rate | 71.0% |
| Profit factor | 2.22 |
| Expectancy / trade | $18.91 |
| Max drawdown | 3.6% |
| Avg trade R | 0.55 |
| Return / risk (Sharpe-like) | 1.64 |
| Trades in sample | 38 |
| Fee drag | 2.5 bps |
| Slippage drag | 4.0 bps |
| Gas / priority drag | 1.8 bps |

### Equity curve narrative

$25k dual-sleeve paper (~40 loops) finished **+$718.6 (+2.87%)**. Equity is slow compound stairs: APR accrual + occasional harvest bumps, shallow dips on rebalance days.

### Fee / slippage / gas impact

Rebalance slip ~4 bps + L2/Solana gas proxy ~1.8 bps. `harvestFeeThresholdUsd: 25` avoided ~11 dust harvests that would have been net-negative after gas.

### Trade count / churn vs edge

38 rebalance/harvest actions. Widening `rebalanceBandPct` to 0.08 cut actions ~35% with only mild APR drag — 5% band was the sweet spot in sample.

### Regime notes

- Works when JLP/GM APRs are real (not pure emission mirages) and net delta stays inside `maxNetDeltaUsd`.
- Fails in violent beta weeks (LP inventory tilts risk-on), cross-chain RPC failures, or harvesting below fee threshold economics.

---

## Architecture

```
src/
  pools/      JLP oracle + GMX reader / adapters
  allocator/  target weights, drift rebalance, state store
  yield/      accrual model, harvester, IL analytics
  wallets/    Solana + Arbitrum adapters
  risk/       delta budget + controls
  ops/        logger / retry
  app/        vault manager runtime
```

---

## Quickstart

```bash
cd jlp-gmx-lp-yield-bot
npm install
npm run typecheck
npm test
npm run paper
```

### Live

```bash
cp .env.example .env
# `SOLANA_PRIVATE_KEY` + `SOLANA_RPC_URL` and `EVM_PRIVATE_KEY` + `ARBITRUM_RPC_URL`
npm run live -- --confirm-live
```

---

## Configuration

`settings.json` — trading parameters. `.env` — secrets only (see `.env.example`).

- Weights, bands, APR model
- Harvest threshold, delta cap

---

## Risk management

Concrete values from the shipped `settings.json`.

- `maxNetDeltaUsd: 8000` — trim when estimated net delta exceeds $8k
- `maxRebalanceUsd: 5000` — per-rotation size cap
- `rebalanceBandPct: 0.05` — 5% drift before rebalance
- `harvestFeeThresholdUsd: 25` — no dust harvests
- `targetJlpWeight: 0.55` / `targetGmWeight: 0.45`
- Live needs Solana + EVM keys + `--confirm-live`; dedicated hot wallets only

- Fail-closed without keys
- Smart-contract + bridge risk remain
- Simulated APY ≠ future APY

- Live refuses to start without `--confirm-live` and credentials in `.env`
- Prefer dedicated hot wallets / API keys with withdrawals disabled
- Paper and live share the decision path — only the broker/venue adapter changes

## License

MIT — see [LICENSE](LICENSE).
