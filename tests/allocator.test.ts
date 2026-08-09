import test from "node:test";
import assert from "node:assert/strict";
import { applyRebalance, planRebalance, poolDelta } from "../src/allocator/rebalance.js";
import { accrue, emptyLedger, harvest } from "../src/yield/accrual.js";

const quotes = [
  { id: "JLP" as const, priceUsd: 3.42, aprPct: 12.5, deltaFraction: 0.35, source: "test", observedAt: new Date() },
  { id: "GM" as const, priceUsd: 1.08, aprPct: 9.8, deltaFraction: 0.2, source: "test", observedAt: new Date() },
];

test("rebalance moves overweight JLP into GM", () => {
  const plan = planRebalance({ JLP: 8_000, GM: 2_000, cash: 0 }, 0.55, 0.45, 0.05, 5_000);
  assert.ok(plan);
  assert.equal(plan?.from, "JLP");
  assert.equal(plan?.to, "GM");
  const result = applyRebalance({ JLP: 8_000, GM: 2_000, cash: 0 }, plan!);
  assert.ok(result.JLP < 8_000);
  assert.ok(result.GM > 2_000);
});

test("yield accrual captures fees and drag", () => {
  const ledger = accrue({ JLP: 5_500, GM: 4_500, cash: 0 }, quotes, emptyLedger(), 24, 1);
  assert.ok(ledger.jlpFeesUsd > 0);
  assert.ok(ledger.gmFeesUsd > 0);
  assert.equal(ledger.dragUsd, 1);
});

test("fee harvest respects a minimum threshold", () => {
  const small = harvest({ jlpFeesUsd: 2, gmFeesUsd: 1, dragUsd: 0, harvestedUsd: 0 }, 25);
  assert.equal(small.amountUsd, 0);
  const large = harvest({ jlpFeesUsd: 30, gmFeesUsd: 10, dragUsd: 0, harvestedUsd: 0 }, 25);
  assert.equal(large.amountUsd, 40);
});

test("delta calculation uses both pool exposures", () => {
  assert.equal(poolDelta({ JLP: 1_000, GM: 1_000, cash: 0 }, quotes), 550);
});
