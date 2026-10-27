# Rules for GitLab Duo in this project

- Treat `evidence/runs/*.json` and `evidence/summary.json` as the only source of pipeline measurements. Do not quote figures that are not in those files or in a linked GitLab pipeline.
- Label every number as measured, counted, proxy, modeled, or UNKNOWN.
- Runner-minutes and pipeline duration are proxies for compute. Never convert them to kWh or CO2e unless `evidence/sci-inputs.json` exists and its sources are cited.
- Any optimization must keep `secret_detection` running on every change and `lint`, `test`, `build` running on every code change.
- A faster pipeline that skipped a required job is a regression.
- Say "Suggested by Green Operations; not applied" for changes that have not been merged.
