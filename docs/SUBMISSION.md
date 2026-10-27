# Devpost submission — paste-ready

**Track:** Path A (Start Fresh). **Opt in:** Most Environmentally Impactful.

**Repository (public, MIT):** https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43797788/showcase
**Live evidence page:** https://showcase-693979.gitlab.io/
**Pipelines (public history):** https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43797788/showcase/-/pipelines
**Duo agent:** "Green Operations" custom agent on the GitLab Duo Agent Platform, created and versioned from `.gitlab/duo/agents/green-operations.yml` via `scripts/duo_agent_sync.mjs`.

## Tagline

Measure CI waste with real GitLab pipelines, cut it, and refuse to claim carbon you can't prove.

## Description

Green Operations measures the compute a GitLab CI pipeline spends to validate one change, tests optimizations as separate pipeline "arms" on the same shared runner class, and reports only what the evidence supports. Every number is labelled measured, counted, proxy or UNKNOWN.

**What we measured (GitLab.com saas-linux-small-amd64, 14 real pipelines):**

- **Consolidating lint, test and build into one job cut runner-minutes 32.9% for code changes and 38.0% for docs changes**, with every quality and security gate still running. The data showed each job spends ~12–15 s on provisioning and checkout against ~2 s of real work, so job count was the real lever.
- **Skipping lint/test/build on documentation-only changes cut runner-minutes 23.4%.** A `classify` job diffs the full pushed range with git and fails safe to "code". It replaced GitLab `rules:changes`, which we caught skipping tests on a real code push.
- **Dependency caching was a regression here (+34.2%)**: the cache hit, but `npm ci` takes ~1 s, and the extra classify job cost more. We publish that result instead of hiding it.

**Sustainability method:** SCI = (E×I + M)/R with R = one successful, equivalent pipeline run. Runner energy, grid intensity and embodied data are not available for GitLab shared runners, so SCI is shown as **not calculated**, and we make no CO₂ claim. Comparisons are allowed only when both runs succeeded, used the same runner class and change class, and every required job ran; a faster run that skipped a gate counts as a regression.

**GitLab Duo Agent Platform:** a custom "Green Operations" agent, with read access to the repository, pipelines, job logs and commits, plus CI Linter and issue tools. Its prompt requires cited evidence, measured/proxy/modeled labels, UNKNOWN for missing data, and never inferring kWh or CO₂ from runtime. The prompt is versioned in the repo and deployed through the AI Catalog GraphQL API.

**Built with:** GitLab CI/CD (parent-child pipelines, cache, secret detection, Pages), GitLab Duo Agent Platform (custom agent, AI Catalog API), Node.js, plain HTML/CSS/JS.

## Before you click submit

- [ ] Paste the video URL (YouTube, public or unlisted, under 3 min).
- [ ] Optional: in GitLab, open an issue, choose the Green Operations agent in the Duo sidebar, ask for the report, and link the issue.
