# Green Operations on the GitLab Duo Agent Platform

The agent runs on the real GitLab Duo Agent Platform. The prompt lives in
`.gitlab/duo/agents/green-operations.yml` so it can be reviewed in merge
requests, and is pasted into the UI form; GitLab does not load custom agents
from a repository file (checked against the GitLab docs on 2026-10-27:
https://docs.gitlab.com/user/duo_agent_platform/agents/custom).

## Prerequisites

- GitLab.com Free (with GitLab Credits), Premium or Ultimate; Duo Agent Platform prerequisites met.
- Custom agents allowed for the group (on by default): group **Settings > GitLab Duo > Change configuration > Allow custom agents**.
- Maintainer or Owner role on the project.

## Create the agent (about 5 minutes)

1. In the project, open **AI > Agents** and select **New agent**.
2. **Display name:** `Green Operations`. **Description:** copy from the YAML file.
3. **Visibility:** Private.
4. **System prompt:** paste the `system_prompt` block from `.gitlab/duo/agents/green-operations.yml` verbatim.
5. **Available tools:** select **Create issue** so the agent can save its report.
6. **Create agent**, then **AI > Agents > Managed > Green Operations > Enable** for this project.

`.gitlab/duo/chat-rules.md` is read automatically by Duo Chat and agents in this
project and restates the integrity rules.

## Run it against real evidence

1. Make sure `evidence/runs/` contains collected pipelines and `evidence/summary.json` is up to date (`npm run evidence:all`), committed on the default branch.
2. Open a merge request or issue in the project. In the GitLab Duo sidebar select **Add new chat**, choose **Green Operations** from the agent dropdown.
3. Prompt, for example:

   > Read `.gitlab-ci.yml`, `ci/baseline.gitlab-ci.yml`, `evidence/summary.json` and the files listed in `evidence/runs/index.json`. Produce the Green Operations report for the `code` change class. Then create an issue titled "Green Operations report 2026-10-27" containing the full report.

4. Save the report for the Field Notes page: copy the issue body into
   `evidence/agent-report.json`:

   ```json
   { "agent": "Green Operations (GitLab Duo Agent Platform)", "generated_at": "<ISO date>", "source_url": "<issue URL>", "report": "<report markdown>" }
   ```

   Commit it; the Agent note panel renders it with the issue link. If this file
   is absent the panel says no report has been saved. Never hand-write a report
   into this file.

## What the agent must not do

- Present a runtime reduction as a carbon or energy reduction.
- Fill a missing SCI input with a guess.
- Recommend skipping `secret_detection`, or skipping `lint`/`test`/`build` for a change that touches code, configuration or dependencies.
