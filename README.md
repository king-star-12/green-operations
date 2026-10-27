# Green Operations

**Smarter pipelines. Lower compute waste. Measurable environmental impact.**

Green Operations inspects real GitLab pipeline evidence, applies one small, safe
CI optimization at a time, re-runs the equivalent workload, and reports what
changed, with every value labelled **measured**, **counted**, **proxy**,
**modeled** or **UNKNOWN**. A GitLab Duo Agent Platform agent explains the
evidence and writes a transparent sustainability report.

It never infers energy or CO₂ from runtime. If the inputs for a Software Carbon
Intensity (SCI) score are missing, the page says so.

## Layout

| Path | What |
|---|---|
| `.gitlab-ci.yml` | **Optimized** pipeline: lockfile-keyed npm cache, docs-only job rules, de-duplicated MR pipelines. Secret detection always runs. |
| `ci/baseline.gitlab-ci.yml` | **Baseline** pipeline for reproducing "before" runs. |
| `src/` | Measurement library: medians, comparability rules, SCI worksheet, optimization ledger. |
| `test/` | Unit tests (`node --test`). |
| `scripts/collect_evidence.mjs` | Records a real pipeline (status, job durations, runner class, cache outcome) from the GitLab API into `evidence/runs/`. |
| `scripts/compare.mjs` | Compares baseline vs optimized runs that are actually comparable; writes `evidence/summary.json`. |
| `scripts/sci.mjs` | SCI worksheet; outputs UNKNOWN and "not calculated" when inputs are missing. |
| `site/` | "Field Notes for Software Energy" static UI, published by the `pages` job. |
| `evidence/` | Ledger, recorded runs, summary, SCI worksheet. Nothing hand-written except the ledger text. |
| `.gitlab/duo/` | Duo agent definition and chat rules. See `docs/DUO_AGENT.md`. |
| `SUSTAINABILITY.md` | Boundary, functional unit, method, assumptions, limitations. |
| `docs/` | Demo script, submission draft, agent setup. |

## Evidence project

Live hackathon project: https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43797788/showcase (pipelines are public).

## Quick start

```bash
npm ci
npm run lint && npm test && npm run build
npm run evidence:all        # summary.json + sci.json from whatever is in evidence/runs
npm run site                # static page in public/ (open public/index.html)
```

## Collecting evidence

Inside CI the `collect_evidence` job records the current pipeline (marked
provisional because the pipeline is still running). For final figures, collect
finished pipelines from a machine with a `read_api` token:

```bash
GITLAB_TOKEN=glpat-… CI_PROJECT_ID=<project id> \
  npm run evidence:collect -- --pipeline <pipeline id> --arm baseline   # or optimized
npm run evidence:all && npm run site
```

Reproduce the baseline on a throwaway branch by copying
`ci/baseline.gitlab-ci.yml` over `.gitlab-ci.yml`. Steps are in `docs/DEMO.md`.

## Integrity rules

- Required tests, security checks and release gates are preserved.
- Every value is labelled measured, modeled, counted, proxy or UNKNOWN.
- No CO₂ saving is inferred from runtime alone.
- Missing energy, grid-intensity or embodied data is shown as UNKNOWN.
- The agent is a GitLab Duo Agent Platform custom agent, not a script.

## License

MIT. See `LICENSE`.
