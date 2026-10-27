import { test } from "node:test";
import assert from "node:assert/strict";
import { ledgerEntry, stateFromComparison } from "../src/ledger.js";

test("ledgerEntry validates state", () => {
  assert.throws(() => ledgerEntry({ id: "x", change: "c", state: "done" }));
  assert.equal(ledgerEntry({ id: "x", change: "c" }).state, "suggested");
});

test("stateFromComparison never claims verification without comparable runs", () => {
  const applied = ledgerEntry({ id: "x", change: "c", state: "applied" });
  assert.equal(stateFromComparison(applied, null), "applied");
  assert.equal(stateFromComparison(applied, { comparable: false }), "applied");
  assert.equal(stateFromComparison(applied, { comparable: true, metrics: { runner_minutes: { reduction_pct: null } } }), "applied");
  assert.equal(stateFromComparison(applied, { comparable: true, metrics: { runner_minutes: { reduction_pct: 12 } } }), "verified");
  assert.equal(stateFromComparison(applied, { comparable: true, metrics: { runner_minutes: { reduction_pct: -3 } } }), "regressed");
});
