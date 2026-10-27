# Demo script (under 3 minutes)

| Time | Show | Say |
|---|---|---|
| 0:00–0:20 | `ci/baseline.gitlab-ci.yml` | Every commit re-downloads dependencies and runs every job, even for a README fix. That is avoidable compute. |
| 0:20–0:50 | GitLab pipeline list, a baseline run | Baseline: N runs, median runtime X, runner-minutes Y. All recorded by `collect_evidence` from GitLab. |
| 0:50–1:20 | diff of `.gitlab-ci.yml` | Two isolated changes: a lockfile-keyed cache, and `rules:changes` for docs-only commits. Secret detection always runs. |
| 1:20–1:50 | optimized run + Field Notes page | Comparable runs only. Runner-minute proxy down Z%. Jobs avoided for docs: 3. |
| 1:50–2:20 | Agent note + SCI worksheet | The Duo agent cites the runs it read. SCI: not calculated, energy input missing. We say so. |
| 2:20–2:50 | Method section | What was measured, what is a proxy, what remains unknown. |

## Producing baseline and optimized runs

1. Create a branch `evidence/baseline`, copy `ci/baseline.gitlab-ci.yml` to `.gitlab-ci.yml`, push. Repeat the pipeline ≥3 times (Run pipeline button) for the `code` class; push a docs-only commit for the `docs` class.
2. On the default branch (optimized config), run the pipeline ≥3 times and push one docs-only commit.
3. Collect each pipeline after it finishes (the in-pipeline collection is provisional):
   `GITLAB_TOKEN=… CI_PROJECT_ID=<id> npm run evidence:collect -- --pipeline <id> --arm <baseline|optimized>`
4. `npm run evidence:all && npm run site`, commit `evidence/`, push. Pages publishes `public/`.

## Evidence hygiene

Pipelines are `interruptible`, so a push to a branch cancels its older running pipelines. Let each evidence run finish before pushing or triggering the next one on the same branch.

## Recording

Use a 1280×800 window, light theme, no notifications. Keep the cursor still while reading numbers.
