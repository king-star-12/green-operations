# Running the pipelines without GitLab.com shared runners

GitLab.com refuses to run CI jobs on shared runners until the account passes
identity verification (pipelines fail instantly with
"Identity verification is required in order to run CI jobs"). Two ways out:

## Option A (recommended): verify the account

In GitLab, open the failed pipeline and follow the verification link, or go to
**User settings > Account** and complete identity verification. Then re-run the
pipelines. Shared SaaS runners give a stable, documented runner class
(`saas-linux-small-amd64`) which is the better evidence source.

## Option B: a self-hosted Docker runner (same machine for both arms)

1. Register a project runner (Maintainer): **Settings > CI/CD > Runners > New
   project runner**, untagged, or via API `POST /user/runners` with
   `runner_type=project_type`. Keep the returned token out of the repository.
2. Copy `ci/runner/config.docker.toml`, replace `__RUNNER_TOKEN__`,
   `__HTTPS_PROXY__` and `__NO_PROXY__` (drop the proxy lines if the host has
   direct egress), and start `gitlab-runner run --config <file>`.
3. Run the baseline and optimized pipelines as in `docs/DEMO.md`.

Record in `SUSTAINABILITY.md` that the runner class is a self-hosted container
on the stated host, and keep both arms on that runner.
