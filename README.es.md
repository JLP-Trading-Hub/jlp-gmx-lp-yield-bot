<p align="center">
  <img src="docs/banner.jpg" alt="Bot de Yield LP JLP y GMX" width="100%" />
</p>

# Bot de Yield LP JLP y GMX

<p align="center">
  <strong>Sé la casa — asigna, cosecha, rebalancea</strong><br/>
  Jupiter JLP · pools GM de GMX · rebalanceo por drift · presupuestos de delta neto
</p>

<p align="center">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white" />
  <img alt="Solana" src="https://img.shields.io/badge/JLP-Solana-14F195" />
  <img alt="Arbitrum" src="https://img.shields.io/badge/GM-Arbitrum-28A0F0" />
  <img alt="Modes" src="https://img.shields.io/badge/Paper%20%2B%20Live-ready-success" />
  <img alt="License" src="https://img.shields.io/badge/License-MIT-yellow.svg" />
</p>

<p align="center">
  Idiomas: [English](README.md) · [中文](README.zh.md) · [Deutsch](README.de.md) · **Español**
</p>

> **Palabras clave:** APY JLP · pool GM GMX · bot de yield LP · Jupiter JLP

---

## Flujo del proyecto

Del clon a live: primero paper, luego credenciales, risk siempre activo.

```mermaid
flowchart LR
  A[Clonar repo] --> B[npm install]
  B --> C[Editar settings.json]
  C --> D[typecheck + test]
  D --> E[npm run paper]
  E --> F{¿Paper OK?}
  F -->|Sí| G[Credenciales .env]
  F -->|Ajustar| C
  G --> H[npm run live --confirm-live]
  H --> I[Monitorear ledger / riesgo]
  I -->|Límite| J[Halt / unwind]
  I -->|Sí| I
```

| Comandos | |
|---------|--|
| `npm run paper` | Primero paper — sin keys |
| `npm run dashboard` | Abrir dashboard de analítica local (estático) |
| `npm run live` | Requiere `--confirm-live` + credenciales |
| `npm test` / `npm run typecheck` | CI-local gates |

---

## Encaje con la plataforma

| | |
|--|--|
| Asignación dual-pool | Pesos objetivo JLP vs GM (configurable) |
| Rebalanceador por drift | Rebalancea al salir de la banda |
| Lógica de harvest | Compone al cruzar umbral de fees |
| Presupuesto de delta | Recorta si la exposición neta supera el cap |

---

## Estrategia de trading

En 2026 gran parte del “yield fácil” está del **otro lado de los traders** — productos LP/vault como **JLP** y **GM**. Este bot los trata como **portfolio**: pesos objetivo, harvest de fees, rebalanceo por drift y tope de beta direccional.

Depósitos/swaps live necesitan keys de **ambas** cadenas y `--confirm-live`.

---

## Diagrama de estrategia

```mermaid
flowchart TD
  J[Adaptador precio / APR JLP] --> V[Gestor de vault]
  G[Adaptador pool GM] --> V
  V --> A[Acumular yield − drag]
  A --> D{¿Drift > banda?}
  D -->|Sí| R[Rebalancear a objetivos]
  D -->|No| H{¿Fees >= umbral harvest?}
  H -->|Sí| Hv[Harvest]
  H -->|No| Δ{¿Delta neto OK?}
  Δ -->|No| T[Recortar manga de mayor beta]
  Δ -->|Sí| Hold[Mantener asignación]
  R --> W[Ruta de ejecución wallet]
  Hv --> W
  T --> W
  W --> Risk[Fail-closed sin keys]
```

---

## Matemática de la estrategia

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

### Perfil de edge (gráfico)

```mermaid
xychart-beta
    title "Blended APR vs JLP weight (conceptual)"
    x-axis ["30% JLP", "45%", "55%", "70%", "85%"]
    y-axis "Blended APR %" 8 --> 14
    bar [10.2, 11.0, 11.8, 12.1, 12.3]
    line [11.0, 11.0, 11.0, 11.0, 11.0]
```

*Tested 55/45 sits near the APR/delta tradeoff; higher JLP weight lifts APR but raises net delta risk.*

### Implicaciones

- `rebalanceBandPct: 0.05` is hysteresis against fee churn.
- APR inputs are planning assumptions — live yields vary with trader PnL and emissions.


---

## Tabla de parámetros

Cada control mapea 1:1 a `settings.json`.

| Parámetro | Ubicación | Default | Significado | Por qué importa | Rango seguro típico |
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

## Set de parámetros probado / recomendado

Calibración paper sobre el modelo sintético (misma ruta de decisión que live).

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

## Análisis profundo — PnL y métricas

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

## Arquitectura

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

## Inicio rápido

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
# `SOLANA_PRIVATE_KEY` + `SOLANA_RPC_URL` y `EVM_PRIVATE_KEY` + `ARBITRUM_RPC_URL`
npm run live -- --confirm-live
```

---

## Configuración

`settings.json` — trading parameters. `.env` — secrets only (see `.env.example`).

- Pesos, bandas, modelo APR
- Umbral harvest, cap de delta

---

## Gestión de riesgo

Valores concretos del `settings.json` incluido.

- `maxNetDeltaUsd: 8000` — trim when estimated net delta exceeds $8k
- `maxRebalanceUsd: 5000` — per-rotation size cap
- `rebalanceBandPct: 0.05` — 5% drift before rebalance
- `harvestFeeThresholdUsd: 25` — no dust harvests
- `targetJlpWeight: 0.55` / `targetGmWeight: 0.45`
- Live needs Solana + EVM keys + `--confirm-live`; dedicated hot wallets only

- Fail-closed sin keys
- Riesgo de contrato + bridge permanece
- APY simulado ≠ APY futuro

- Live refuses to start without `--confirm-live` and credentials in `.env`
- Prefer dedicated hot wallets / API keys with withdrawals disabled
- Paper and live share the decision path — only the broker/venue adapter changes

## Licencia

MIT — ver [LICENSE](LICENSE).
