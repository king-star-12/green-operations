# Sustainability report — Green Operations

> Section 0 holds the measured results. Sections 1–8 define the method.
> Tables in section 4 describe what is recorded; the values are in section 0
> and `evidence/summary.json`.

## 0. Results (measured 2026-10-27, GitLab.com `saas-linux-small-amd64`)

Runner-minutes = sum of job durations, the **proxy** for compute. Duration is **measured** from GitLab timestamps. Medians over the runs shown. Sign: negative = less compute than baseline.

| Arm | Change class | Runs (baseline / arm) | Median pipeline duration | Median runner-min | Change | Jobs |
|---|---|---|---|---|---|---|
| consolidated | code | 3 / 3 | 75 s → 50 s | 1.27 → 0.85 | **-32.9%** | 5 → 3 |
| consolidated | docs | 2 / 1 | 79 s → 48 s | 1.32 → 0.82 | **-38.0%** | 5 → 3 |
| optimized | docs | 2 / 2 | 79 s → 78 s | 1.32 → 1.01 | **-23.4%** | 5 → 4 |
| optimized | code | 3 / 3 | 75 s → 120 s | 1.27 → 1.70 | **+34.2%** | 5 → 6 |

**What the evidence says**

- **Winner: consolidate jobs (OPT-5).** −32.9% runner-minutes on code changes and −38.0% on docs changes, with lint, test, build and secret detection all still running. Each job here spends ~12–15 s on provisioning, image pull and checkout against ~2 s of real work, so job *count* is the lever.
- **Docs-only skip (OPT-2) works:** −23.4% runner-minutes; secret detection still ran on every docs change.
- **Dependency cache + classify job is a regression on code changes (+34.2%).** The cache does hit (logs show `Successfully extracted cache`), but `npm ci` takes ~1 s here, so it saves almost nothing, while the extra `classify` job adds a full job's overhead. We report this instead of hiding it; the ledger marks OPT-1/OPT-3 as **regressed**.
- **SCI: not calculated.** Energy per run, grid intensity and embodied emissions are UNKNOWN for GitLab shared runners. No CO₂ figure is claimed. A runner-minute reduction is not presented as a carbon reduction.
- **Small samples.** 1–3 runs per cell; treat percentages as indicative.
- **Excluded runs** (kept, with reasons) are in `evidence/excluded/`.

### Run links

- baseline / code: [2994169833](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43797788/showcase/-/pipelines/2994169833) — 74 s, 1.27 runner-min
- baseline / code: [2994185245](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43797788/showcase/-/pipelines/2994185245) — 75 s, 1.27 runner-min
- baseline / code: [2994185489](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43797788/showcase/-/pipelines/2994185489) — 78 s, 1.3 runner-min
- baseline / docs: [2994195319](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43797788/showcase/-/pipelines/2994195319) — 76 s, 1.27 runner-min
- baseline / docs: [2994239357](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43797788/showcase/-/pipelines/2994239357) — 82 s, 1.37 runner-min
- consolidated / code: [2994258534](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43797788/showcase/-/pipelines/2994258534) — 57 s, 0.95 runner-min
- consolidated / code: [2994263580](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43797788/showcase/-/pipelines/2994263580) — 50 s, 0.85 runner-min
- consolidated / code: [2994268064](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43797788/showcase/-/pipelines/2994268064) — 50 s, 0.85 runner-min
- consolidated / docs: [2994277140](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43797788/showcase/-/pipelines/2994277140) — 48 s, 0.82 runner-min
- optimized / code: [2994208555](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43797788/showcase/-/pipelines/2994208555) — 122 s, 1.7 runner-min
- optimized / code: [2994212567](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43797788/showcase/-/pipelines/2994212567) — 118 s, 1.67 runner-min
- optimized / code: [2994224815](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43797788/showcase/-/pipelines/2994224815) — 120 s, 1.7 runner-min
- optimized / docs: [2994191951](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43797788/showcase/-/pipelines/2994191951) — 80 s, 1.03 runner-min
- optimized / docs: [2994258335](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43797788/showcase/-/pipelines/2994258335) — 76 s, 0.98 runner-min

Field Notes page (renders these files): https://showcase-693979.gitlab.io/

## 1. Boundary

GitLab CI jobs of this project only:

| Job | Stage | Runs on |
|---|---|---|
| `classify` | classify | every change (optimized arm only; ~10 s, counted in the optimized figures) |
| `lint` | lint | every code change |
| `test` | test | every code change |
| `build` | build | every code change |
| `docs_only_notice` | notice | docs-only changes (optimized arm only; replaces lint/test/build) |
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
