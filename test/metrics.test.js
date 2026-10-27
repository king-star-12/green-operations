import { test } from "node:test";
import assert from "node:assert/strict";
import { median, reductionPercent, runnerMinutes, comparable, jobCounts, summarise } from "../src/metrics.js";

const REQUIRED = { code: ["lint", "test", "secret_detection"], docs: ["secret_detection"] };

function run(id, status, jobs, extra = {}) {
  return { id, status, change_class: "code", runner_class: "saas-linux-small-amd64", duration_s: jobs.reduce((a, j) => a + j.duration_s, 0), jobs, ...extra };
}

test("median handles odd, even and empty inputs", () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.equal(median([]), null);
  assert.equal(median([1, NaN, 3]), 2);
});

test("reductionPercent keeps sign and refuses bad input", () => {
  assert.equal(reductionPercent(100, 82), 18);
  assert.equal(reductionPercent(100, 120), -20);
  assert.equal(reductionPercent(0, 10), null);
  assert.equal(reductionPercent(null, 10), null);
});

test("runnerMinutes sums job durations as a proxy", () => {
  assert.equal(runnerMinutes([{ duration_s: 60 }, { duration_s: 30 }, { duration_s: "x" }]), 1.5);
});

test("comparable rejects runs that skip required jobs", () => {
  const base = run(1, "success", [
    { name: "lint", status: "success", duration_s: 10 },
    { name: "test", status: "success", duration_s: 20 },
    { name: "secret_detection", status: "success", duration_s: 5 }
  ]);
  const opt = run(2, "success", [
    { name: "lint", status: "success", duration_s: 8 },
    { name: "test", status: "skipped", duration_s: 0 },
    { name: "secret_detection", status: "success", duration_s: 5 }
  ]);
  const result = comparable(base, opt, REQUIRED);
  assert.equal(result.ok, false);
  assert.match(result.reasons.join("\n"), /required job "test" did not run/);
});

test("comparable rejects different change classes or runner classes", () => {
  const base = run(1, "success", [{ name: "secret_detection", status: "success", duration_s: 5 }]);
  const opt = run(2, "success", [{ name: "secret_detection", status: "success", duration_s: 5 }], { change_class: "docs" });
  assert.equal(comparable(base, opt, REQUIRED).ok, false);
  const opt2 = run(3, "success", [{ name: "lint", status: "success", duration_s: 1 }, { name: "test", status: "success", duration_s: 1 }, { name: "secret_detection", status: "success", duration_s: 1 }], { runner_class: "other" });
  assert.match(comparable(base, opt2, REQUIRED).reasons.join(), /runner class differs/);
});

test("comparable accepts equivalent successful runs", () => {
  const jobs = [
    { name: "lint", status: "success", duration_s: 10 },
    { name: "test", status: "success", duration_s: 20 },
    { name: "secret_detection", status: "success", duration_s: 5 }
  ];
  assert.deepEqual(comparable(run(1, "success", jobs), run(2, "success", jobs), REQUIRED), { ok: true, reasons: [] });
});

test("jobCounts and summarise count only what was recorded", () => {
  const r = run(1, "success", [
    { name: "a", status: "success", duration_s: 60, cache: "hit" },
    { name: "b", status: "skipped", duration_s: 0 },
    { name: "c", status: "failed", duration_s: 30, cache: "miss" }
  ], { web_url: "https://gitlab.example/p/-/pipelines/1" });
  assert.deepEqual(jobCounts(r), { executed: 1, skipped: 1, failed: 1, cache_hit: 1, cache_miss: 1 });
  const s = summarise([r, { ...r, id: 2, status: "failed" }]);
  assert.equal(s.samples, 2);
  assert.equal(s.successful, 1);
  assert.equal(s.median_duration_s, 90);
  assert.equal(s.median_runner_minutes, 1.5);
  assert.equal(s.run_urls.length, 2);
});

test("deploy-only jobs are excluded from runner-minutes and counts", () => {
  const jobs = [{ name: "lint", status: "success", duration_s: 60 }, { name: "pages", status: "success", duration_s: 600, cache: "miss" }];
  assert.equal(runnerMinutes(jobs), 1);
  assert.deepEqual(jobCounts({ jobs }), { executed: 1, skipped: 0, failed: 0, cache_hit: 0, cache_miss: 0 });
});
