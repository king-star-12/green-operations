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
const arms = [...new Set(runs.map((r) => r.arm).filter((a) => a && a !== "baseline"))].sort();
const classes = [...new Set(runs.map((r) => r.change_class))].sort();
const comparisons = [];

const totals = (rs) => rs.map((r) => jobCounts(r)).reduce((a, c) => ({ hit: a.hit + c.cache_hit, miss: a.miss + c.cache_miss }), { hit: 0, miss: 0 });

for (const arm of arms) for (const cls of classes) {
  const b = baseline.filter((r) => r.change_class === cls && r.status === "success");
  const o = byArm(arm).filter((r) => r.change_class === cls && r.status === "success");
  if (b.length === 0 || o.length === 0) {
    if (o.length === 0) continue; // this arm has no runs of this class; nothing to say
    comparisons.push({ arm, change_class: cls, comparable: false, reasons: [`need at least one successful baseline and one successful ${arm} run (have ${b.length}/${o.length})`], baseline: summarise(b), optimized: summarise(o) });
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
    arm,
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
    cache: { baseline: totals(b), optimized: totals(o) }
  });
}

// Update the ledger's state from evidence.
let ledger = existsSync(ledgerPath) ? JSON.parse(readFileSync(ledgerPath, "utf8")) : [];
ledger = ledger.map((e) => {
  const arm = e.arm ?? "optimized";
  const cmp = comparisons.find((c) => c.arm === arm && c.change_class === (e.verified_by ?? "code"));
  const state = e.state === "suggested" ? "suggested" : stateFromComparison(e, cmp);
  const result = cmp?.comparable && cmp.metrics?.runner_minutes?.reduction_pct !== null && cmp.metrics?.runner_minutes?.reduction_pct !== undefined
    ? `${cmp.metrics.runner_minutes.reduction_pct >= 0 ? "−" : "+"}${Math.abs(cmp.metrics.runner_minutes.reduction_pct).toFixed(1)}% runner-minutes (proxy), ${cmp.metrics.jobs_executed.baseline}→${cmp.metrics.jobs_executed.optimized} jobs, class ${cmp.change_class}, ${cmp.baseline.successful}/${cmp.optimized.successful} runs`
    : null;
  return { ...e, arm, state, measured_result: result, evidence: [...new Set([...(cmp?.baseline?.run_urls ?? []), ...(cmp?.optimized?.run_urls ?? [])])] };
});

const summary = {
  schema: "green-operations/summary/v1",
  generated_at: new Date().toISOString(),
  state: runs.length === 0 ? "before_baseline" : baseline.length && arms.length === 0 ? "baseline_captured" : comparisons.some((c) => c.comparable) ? "verified" : "insufficient_data",
  arms,
  runs: runs.map((r) => ({ arm: r.arm, id: r.id, change_class: r.change_class, status: r.status, duration_s: r.duration_s, runner_minutes: Number(runnerMinutes(r.jobs).toFixed(2)), jobs: jobCounts(r), web_url: r.web_url, runner_class: r.runner_class, ref: r.ref, finished_at: r.finished_at, provisional: Boolean(r.note) })),
  comparisons,
  ledger,
  boundary: "GitLab CI jobs of this project only, including child pipelines (classify, lint, test, build, docs_only_notice, secret_detection, collect_evidence, pages). Excludes developer machines, GitLab control plane, artifact storage, and network transfer.",
  limitations: [
    "Runner-minutes are a compute-time proxy, not an energy or carbon measurement.",
    "GitLab shared runners expose no energy telemetry; energy per run is UNKNOWN.",
    "Pipeline durations include variance from runner provisioning and network; medians over several runs are reported.",
    "Only runs with the same change class, runner class and required-job set are compared."
  ]
};

writeFileSync(join(process.cwd(), "evidence", "summary.json"), JSON.stringify(summary, null, 2) + "\n");
writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + "\n");
console.log(`summary state: ${summary.state}; runs=${runs.length} baseline=${baseline.length} arms=${arms.join(",")}`);
for (const c of comparisons) {
  const rm = c.metrics?.runner_minutes;
  console.log(`  [${c.arm} / ${c.change_class}] comparable=${c.comparable}` + (rm && rm.reduction_pct !== null ? ` runner-minute proxy change ${rm.reduction_pct.toFixed(1)}% (${rm.baseline?.toFixed(2)} → ${rm.optimized?.toFixed(2)})` : ""));
  for (const r of c.reasons) console.log(`    - ${r}`);
}
