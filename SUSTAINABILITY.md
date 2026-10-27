# Sustainability report — Green Operations

> **Status: template with method defined; measurements pending.**
> Every value below marked `MEASURE`, `COUNT` or `UNKNOWN` must be replaced by
> a real figure from a linked GitLab pipeline before this report is cited.
> Do not fill a cell with an estimate and call it a measurement.

## 1. Boundary

GitLab CI jobs of this project only:

| Job | Stage | Runs on |
|---|---|---|
| `lint` | lint | every code change |
| `test` | test | every code change |
| `build` | build | every code change |
| `secret_detection` | security | **every change, always** |
| `collect_evidence` | evidence | every change |

Excluded: developer machines, GitLab's control plane, artifact/cache storage,
network transfer, and GitLab Pages hosting. The same boundary is used for
baseline and optimized runs.

## 2. Functional unit (R)

**One successful, equivalent CI pipeline run that validates the same change.**
Runs are grouped by change class (`code` or `docs`) and compared only within a
class. Comparability rules are enforced by `src/metrics.js#comparable` and
include: both pipelines succeeded, same change class, same runner class, and
every required job for that class ran successfully in the optimized pipeline.

## 3. Optimizations under test

Listed in `evidence/ledger.json`. Only two change compute per run:

- **OPT-1** npm dependency cache keyed on `package-lock.json` with a fallback key.
- **OPT-2** `rules:changes` so `lint`/`test`/`build` are skipped for docs-only changes. `secret_detection` always runs.

OPT-3 (de-duplicating branch and MR pipelines) reduces the *number* of
pipelines, not the cost of one, so it is reported separately from the per-run
comparison. OPT-4 (energy/SCI) is **suggested, not applied**: no defensible
energy input exists.

## 4. Raw measurements

Populated by `scripts/collect_evidence.mjs` into `evidence/runs/*.json`
and summarised by `scripts/compare.mjs` into `evidence/summary.json`.

### 4.1 Code change class

| Metric | Baseline | Optimized | Kind | Source |
|---|---|---|---|---|
| Successful pipeline runtime (median) | MEASURE | MEASURE | measured | GitLab pipeline `duration` |
| Runner-minutes (median, sum of job durations) | MEASURE | MEASURE | **proxy** | job `duration` fields |
| Jobs executed | COUNT | COUNT | counted | pipeline graph |
| Cache outcome (hit/miss per job) | COUNT | COUNT | parsed | job logs |
| Runner class | MEASURE | MEASURE | parsed | job logs (`saas-linux-*`) |
| vCPU allocation | UNKNOWN | UNKNOWN | — | not exposed by GitLab API; see runner docs |
| Samples (successful runs) | COUNT | COUNT | counted | |
| Run links | links | links | | `evidence/summary.json` |

### 4.2 Docs-only change class

Same table; expected effect is a lower job count (3 jobs avoided) with
`secret_detection` still executed.

## 5. SCI method

Specification: https://github.com/Green-Software-Foundation/sci

```
SCI = (O + M) / R
O   = E × I        E: energy per functional unit (kWh); I: grid intensity (gCO2e/kWh)
M   = embodied emissions allocated to the run (gCO2e)
R   = one successful, equivalent CI pipeline run
```

| Input | Value | Kind | Source |
|---|---|---|---|
| E — energy per run | UNKNOWN | — | GitLab shared runners expose no energy telemetry |
| I — grid intensity | UNKNOWN | — | runner region and period not confirmed |
| M — embodied | UNKNOWN | — | hardware and allocation unknown |
| **SCI per successful run** | **not calculated** | | `scripts/sci.mjs` |

To calculate SCI, create `evidence/sci-inputs.json` from the example file with
a stated model for E (e.g. a published per-vCPU-hour power figure with its
source and parameters), a dated grid-intensity source for the runner region,
and an embodied allocation with its datasheet. Each row is then labelled
`modeled` or `measured` accordingly. Until then the UI and this report say
**"SCI not calculated — energy/embodied data unavailable."**

## 6. Calculation

```
reduction (%) = (baseline − optimized) / baseline × 100
```

Applied to each metric separately. A runner-minute reduction is a reduction in
a compute-time proxy. It is **not** reported as a carbon or energy reduction.

## 7. Assumptions and limitations

- Shared-runner performance varies between runs; medians over ≥3 runs per arm are reported, with all run links.
- Queue time is excluded from `duration_s` (GitLab's `duration` field); `queued_s` is recorded separately.
- Cache hit/miss is parsed from runner log lines and may read `UNKNOWN` if the log format changes.
- A faster run with a skipped required job is a regression and is excluded from comparison by design.
- No CO₂e saving is claimed anywhere in this project without the inputs in section 5.

## 8. Reproduce

```bash
# baseline (throwaway branch with the baseline config)
git checkout -b evidence/baseline && cp ci/baseline.gitlab-ci.yml .gitlab-ci.yml && git commit -am "baseline" && git push
# optimized: the default .gitlab-ci.yml
# collect after pipelines finish
GITLAB_TOKEN=… CI_PROJECT_ID=<id> npm run evidence:collect -- --pipeline <id> --arm baseline
GITLAB_TOKEN=… CI_PROJECT_ID=<id> npm run evidence:collect -- --pipeline <id> --arm optimized
npm run evidence:all && npm run site   # writes evidence/summary.json, evidence/sci.json, public/
```
