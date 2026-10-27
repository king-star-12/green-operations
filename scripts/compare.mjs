#!/usr/bin/env node
/**
 * Compare baseline vs optimized runs recorded in evidence/runs/ and write
 * evidence/summary.json. Only comparable runs (same change class, successful,
 * all required jobs ran) are compared. If there is nothing comparable, the
 * summary says so instead of inventing a number.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { summarise, comparable, reductionPercent, jobCounts, runnerMinutes } from "../src/metrics.js";
import { stateFromComparison } from "../src/ledger.js";

const runsDir = join(process.cwd(), "evidence", "runs");
const ledgerPath = join(process.cwd(), "evidence", "ledger.json");

// Jobs that MUST run for a change class for an optimized run to count.
const REQUIRED_JOBS = {
  code: ["lint", "test", "build", "secret_detection"],
  docs: ["secret_detection"],
  UNKNOWN: ["lint", "test", "build", "secret_detection"]
};

const files = existsSync(runsDir) ? readdirSync(runsDir).filter((f) => f.endsWith(".json") && f !== "index.json") : [];
const runs = files.map((f) => JSON.parse(readFileSync(join(runsDir, f), "utf8")));

const byArm = (arm) => runs.filter((r) => r.arm === arm);
const baseline = byArm("baseline");
const optimized = byArm("optimized");

const classes = [...new Set(runs.map((r) => r.change_class))];
const comparisons = [];

for (const cls of classes) {
  const b = baseline.filter((r) => r.change_class === cls && r.status === "success");
  const o = optimized.filter((r) => r.change_class === cls && r.status === "success");
  if (b.length === 0 || o.length === 0) {
    comparisons.push({ change_class: cls, comparable: false, reasons: [`need at least one successful baseline and one successful optimized run (have ${b.length}/${o.length})`], baseline: summarise(b), optimized: summarise(o) });
    continue;
  }
  const reasons = [];
  for (const ob of b) for (const oo of o) {
    const c = comparable(ob, oo, REQUIRED_JOBS);
    if (!c.ok) reasons.push(...c.reasons.map((r) => `${ob.id} vs ${oo.id}: ${r}`));
  }
  const sb = summarise(b);
  const so = summarise(o);
  const metric = (bv, ov, kind, unit) => ({ baseline: bv, optimized: ov, reduction_pct: reductionPercent(bv, ov), kind, unit });
  comparisons.push({
    change_class: cls,
    comparable: reasons.length === 0,
    reasons: [...new Set(reasons)],
    functional_unit: "one successful, equivalent CI pipeline run that validates the same change",
    baseline: sb,
    optimized: so,
    metrics: {
      duration_s: metric(sb.median_duration_s, so.median_duration_s, "measured", "s"),
      runner_minutes: metric(sb.median_runner_minutes, so.median_runner_minutes, "proxy", "runner-min"),
      jobs_executed: metric(sb.median_jobs_executed, so.median_jobs_executed, "counted", "jobs"),
      energy_kwh: { baseline: "UNKNOWN", optimized: "UNKNOWN", reduction_pct: null, kind: "UNKNOWN", unit: "kWh" },
      sci_gco2e_per_run: { baseline: "UNKNOWN", optimized: "UNKNOWN", reduction_pct: null, kind: "UNKNOWN", unit: "gCO2e/run" }
    },
    cache: {
      baseline: b.map((r) => jobCounts(r)).reduce((a, c) => ({ hit: a.hit + c.cache_hit, miss: a.miss + c.cache_miss }), { hit: 0, miss: 0 }),
      optimized: o.map((r) => jobCounts(r)).reduce((a, c) => ({ hit: a.hit + c.cache_hit, miss: a.miss + c.cache_miss }), { hit: 0, miss: 0 })
    }
  });
}

// Update the ledger's state from evidence.
let ledger = existsSync(ledgerPath) ? JSON.parse(readFileSync(ledgerPath, "utf8")) : [];
const primary = comparisons.find((c) => c.change_class === "code") ?? comparisons[0];
const docsComparison = comparisons.find((c) => c.change_class === "docs");
ledger = ledger.map((e) => {
  const cmp = e.verified_by === "docs" ? docsComparison : primary;
  const state = e.state === "suggested" ? "suggested" : stateFromComparison(e, cmp);
  return { ...e, state, evidence: [...new Set([...(e.evidence ?? []), ...(cmp?.baseline?.run_urls ?? []), ...(cmp?.optimized?.run_urls ?? [])])] };
});

const summary = {
  schema: "green-operations/summary/v1",
  generated_at: new Date().toISOString(),
  state: runs.length === 0 ? "before_baseline" : baseline.length && !optimized.length ? "baseline_captured" : comparisons.some((c) => c.comparable) ? "verified" : "insufficient_data",
  runs: runs.map((r) => ({ arm: r.arm, id: r.id, change_class: r.change_class, status: r.status, duration_s: r.duration_s, runner_minutes: Number(runnerMinutes(r.jobs).toFixed(2)), jobs: jobCounts(r), web_url: r.web_url, runner_class: r.runner_class, ref: r.ref, finished_at: r.finished_at, provisional: Boolean(r.note) })),
  comparisons,
  ledger,
  boundary: "GitLab CI jobs of this project only (lint, test, build, secret_detection, collect_evidence). Excludes developer machines, GitLab control plane, artifact storage, and network transfer.",
  limitations: [
    "Runner-minutes are a compute-time proxy, not an energy or carbon measurement.",
    "GitLab shared runners expose no energy telemetry; energy per run is UNKNOWN.",
    "Pipeline durations include variance from runner provisioning and network; medians over several runs are reported.",
    "Only runs with the same change class, runner class and required-job set are compared."
  ]
};

writeFileSync(join(process.cwd(), "evidence", "summary.json"), JSON.stringify(summary, null, 2) + "\n");
writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + "\n");
console.log(`summary state: ${summary.state}; runs=${runs.length} baseline=${baseline.length} optimized=${optimized.length}`);
for (const c of comparisons) {
  const rm = c.metrics?.runner_minutes;
  console.log(`  [${c.change_class}] comparable=${c.comparable}` + (rm && rm.reduction_pct !== null ? ` runner-minute proxy change ${rm.reduction_pct.toFixed(1)}%` : ""));
  for (const r of c.reasons) console.log(`    - ${r}`);
}
