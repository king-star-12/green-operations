# Recorded pipeline runs

Each `*.json` file here is one real GitLab pipeline, written by
`scripts/collect_evidence.mjs` (run automatically by the `collect_evidence`
job, or locally with a `read_api` token):

```
GITLAB_TOKEN=... CI_PROJECT_ID=<id> npm run evidence:collect -- --pipeline <id> --arm baseline
```

Nothing in this directory is hand-written. If it is empty, no baseline has
been captured yet and the UI shows the "before baseline" state.
