/**
 * Core measurement helpers for Green Operations.
 *
 * Every function here works only on values that were actually recorded.
 * Nothing in this module estimates energy or carbon; see sci.js for the
 * worksheet, which refuses to compute when inputs are missing.
 */

/** Median of a numeric array. Returns null for an empty array. */
export function median(values) {
  const nums = values.filter((v) => typeof v === "number" && Number.isFinite(v)).sort((a, b) => a - b);
  if (nums.length === 0) return null;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 === 0 ? (nums[mid - 1] + nums[mid]) / 2 : nums[mid];
}

/**
 * reduction (%) = (baseline - optimized) / baseline * 100
 * Returns null when either value is missing or baseline is zero.
 * The sign is preserved: a negative result is a regression.
 */
export function reductionPercent(baseline, optimized) {
  if (!Number.isFinite(baseline) || !Number.isFinite(optimized) || baseline === 0) return null;
  return ((baseline - optimized) / baseline) * 100;
}

/**
 * Runner-minutes proxy: sum of job durations in minutes.
 * This is a PROXY for compute use, not an energy or carbon measurement.
 */
/**
 * Jobs outside the functional unit "validate the change": deployment of the
 * evidence page is not part of validating a change and only exists on the
 * default branch, so it is excluded from both arms.
 */
export const EXCLUDED_JOBS = new Set(["pages"]);

export function measuredJobs(jobs) {
  return jobs.filter((j) => !EXCLUDED_JOBS.has(j.name));
}

export function runnerMinutes(jobs) {
  return measuredJobs(jobs).reduce((acc, j) => acc + (Number.isFinite(j.duration_s) ? j.duration_s : 0), 0) / 60;
}

/**
 * Two pipeline runs are comparable only if they validate the same kind of
 * change, both succeeded, and every required job present in the baseline
 * also ran (or was deliberately reused) in the optimized run.
 *
 * Returns { ok: boolean, reasons: string[] }.
 */
export function comparable(baseline, optimized, requiredJobs) {
  const reasons = [];
  if (baseline.status !== "success") reasons.push(`baseline pipeline ${baseline.id} did not succeed (${baseline.status})`);
  if (optimized.status !== "success") reasons.push(`optimized pipeline ${optimized.id} did not succeed (${optimized.status})`);
  if (baseline.change_class !== optimized.change_class) {
    reasons.push(`change class differs: ${baseline.change_class} vs ${optimized.change_class}`);
  }
  const ranIn = (run) => new Set(run.jobs.filter((j) => j.status === "success").map((j) => j.name));
  const optRan = ranIn(optimized);
  for (const name of requiredJobs[optimized.change_class] ?? []) {
    if (!optRan.has(name)) reasons.push(`required job "${name}" did not run successfully in optimized pipeline ${optimized.id}`);
  }
  if (baseline.runner_class && optimized.runner_class && baseline.runner_class !== optimized.runner_class) {
    reasons.push(`runner class differs: ${baseline.runner_class} vs ${optimized.runner_class}`);
  }
  return { ok: reasons.length === 0, reasons };
}

/** Count jobs by outcome for the pipeline trace. */
export function jobCounts(run) {
  const counts = { executed: 0, skipped: 0, failed: 0, cache_hit: 0, cache_miss: 0 };
  for (const j of measuredJobs(run.jobs)) {
    if (j.status === "success") counts.executed += 1;
    else if (j.status === "skipped") counts.skipped += 1;
    else if (j.status === "failed") counts.failed += 1;
    if (j.cache === "hit") counts.cache_hit += 1;
    if (j.cache === "miss") counts.cache_miss += 1;
  }
  return counts;
}

/**
 * Summarise a set of runs of the same arm (baseline or optimized).
 * All values are MEASURED from GitLab timestamps or COUNTED from the
 * pipeline graph. runner_minutes is a PROXY.
 */
export function summarise(runs) {
  const successful = runs.filter((r) => r.status === "success");
  return {
    samples: runs.length,
    successful: successful.length,
    median_duration_s: median(successful.map((r) => r.duration_s)),
    median_runner_minutes: median(successful.map((r) => runnerMinutes(r.jobs))),
    median_jobs_executed: median(successful.map((r) => jobCounts(r).executed)),
    runner_classes: [...new Set(runs.map((r) => r.runner_class).filter(Boolean))],
    run_urls: runs.map((r) => r.web_url).filter(Boolean)
  };
}
