#!/usr/bin/env node
/**
 * Collect REAL evidence for the current (or a given) GitLab pipeline and
 * write it to evidence/runs/<arm>-<pipeline_id>.json.
 *
 * Inputs (environment, all provided automatically inside GitLab CI):
 *   CI_API_V4_URL, CI_PROJECT_ID, CI_PIPELINE_ID, CI_JOB_TOKEN
 * Optional:
 *   GITLAB_TOKEN   personal/project access token (read_api) when running locally
 *   --arm          baseline | optimized   (default: $GREEN_OPS_ARM or "unknown")
 *   --pipeline     pipeline id to collect (default: $CI_PIPELINE_ID)
 *   --project      project id or URL-encoded path (default: $CI_PROJECT_ID)
 *   --class        change class override: code | docs (default: detected from the commit diff)
 *
 * Every field written is either MEASURED from GitLab (timestamps, statuses),
 * COUNTED from the pipeline graph, or parsed from job logs. Fields that cannot
 * be determined are written as "UNKNOWN" rather than guessed.
 */
import { mkdirSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const args = Object.fromEntries(
  process.argv.slice(2).map((a, i, arr) => (a.startsWith("--") ? [a.slice(2), arr[i + 1] ?? "true"] : null)).filter(Boolean)
);

const api = (process.env.CI_API_V4_URL ?? "https://gitlab.com/api/v4").replace(/\/$/, "");
const project = encodeURIComponent(args.project ?? process.env.CI_PROJECT_ID ?? "");
const pipelineId = args.pipeline ?? process.env.CI_PIPELINE_ID;
const arm = args.arm ?? process.env.GREEN_OPS_ARM ?? "unknown";
const outDir = join(process.cwd(), "evidence", "runs");

if (!project || !pipelineId) {
  console.error("collect_evidence: need --project/--pipeline or CI_PROJECT_ID/CI_PIPELINE_ID");
  process.exit(2);
}

const headers = process.env.GITLAB_TOKEN
  ? { "PRIVATE-TOKEN": process.env.GITLAB_TOKEN }
  : process.env.CI_JOB_TOKEN
    ? { "JOB-TOKEN": process.env.CI_JOB_TOKEN }
    : {};

async function get(path, { text = false } = {}) {
  const res = await fetch(`${api}${path}`, { headers });
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status} ${res.statusText}`);
  return text ? res.text() : res.json();
}

const DOCS_ONLY = [/\.md$/i, /^docs\//, /^LICENSE$/, /^\.gitlab\/issue_templates\//];

async function detectChangeClass(sha) {
  if (args.class) return args.class;
  try {
    const diff = await get(`/projects/${project}/repository/commits/${sha}/diff`);
    const paths = diff.flatMap((d) => [d.old_path, d.new_path]).filter(Boolean);
    if (paths.length === 0) return "UNKNOWN";
    return paths.every((p) => DOCS_ONLY.some((re) => re.test(p))) ? "docs" : "code";
  } catch (err) {
    console.warn(`could not detect change class: ${err.message}`);
    return "UNKNOWN";
  }
}

function cacheOutcome(trace) {
  // Patterns emitted by gitlab-runner. Anything else is UNKNOWN, not guessed.
  if (/Successfully extracted cache/.test(trace)) return "hit";
  if (/Checking cache for .*\n(?:.*\n){0,3}?.*(file does not exist|Failed to extract cache|no matching cache)/.test(trace)) return "miss";
  if (/Checking cache for/.test(trace)) return "miss";
  if (/Not downloading cache/.test(trace)) return "not_downloaded";
  return "none";
}

function seconds(a, b) {
  if (!a || !b) return null;
  return Math.round((new Date(b) - new Date(a)) / 1000);
}

const pipeline = await get(`/projects/${project}/pipelines/${pipelineId}`);
const jobsRaw = await get(`/projects/${project}/pipelines/${pipelineId}/jobs?per_page=100&include_retried=false`);
const projectInfo = await get(`/projects/${project}`);

const jobs = [];
for (const j of jobsRaw) {
  let trace = "";
  if (j.status === "success" || j.status === "failed") {
    try {
      trace = await get(`/projects/${project}/jobs/${j.id}/trace`, { text: true });
    } catch (err) {
      console.warn(`no trace for job ${j.id}: ${err.message}`);
    }
  }
  const runnerDesc = j.runner?.description ?? "UNKNOWN";
  const sizeMatch = trace.match(/Running on runner-[\w-]+ via [\w.-]+|(saas-linux-\w+-\w+)/);
  jobs.push({
    id: j.id,
    name: j.name,
    stage: j.stage,
    status: j.status,
    duration_s: Number.isFinite(j.duration) ? Math.round(j.duration) : null,
    queued_s: Number.isFinite(j.queued_duration) ? Math.round(j.queued_duration) : null,
    started_at: j.started_at,
    finished_at: j.finished_at,
    runner: runnerDesc,
    runner_class: sizeMatch?.[1] ?? j.runner?.description ?? "UNKNOWN",
    cache: j.status === "success" || j.status === "failed" ? cacheOutcome(trace) : "UNKNOWN",
    web_url: j.web_url
  });
}

const sha = pipeline.sha;
const changeClass = await detectChangeClass(sha);
const runnerClasses = [...new Set(jobs.map((j) => j.runner_class).filter((c) => c && c !== "UNKNOWN"))];

const record = {
  schema: "green-operations/run/v1",
  collected_at: new Date().toISOString(),
  arm,
  change_class: changeClass,
  project: { id: projectInfo.id, path: projectInfo.path_with_namespace, web_url: projectInfo.web_url },
  id: pipeline.id,
  iid: pipeline.iid,
  sha,
  ref: pipeline.ref,
  source: pipeline.source,
  status: pipeline.status,
  web_url: pipeline.web_url,
  created_at: pipeline.created_at,
  started_at: pipeline.started_at,
  finished_at: pipeline.finished_at,
  // MEASURED: wall-clock from GitLab timestamps; GitLab's own `duration` excludes queue time.
  duration_s: Number.isFinite(pipeline.duration) ? pipeline.duration : seconds(pipeline.started_at, pipeline.finished_at),
  queued_s: Number.isFinite(pipeline.queued_duration) ? pipeline.queued_duration : null,
  runner_class: runnerClasses.length === 1 ? runnerClasses[0] : runnerClasses.length ? runnerClasses.join("+") : "UNKNOWN",
  vcpu: "UNKNOWN", // GitLab does not expose vCPU via the API; fill from runner documentation in SUSTAINABILITY.md if known.
  energy_kwh: "UNKNOWN", // no runner telemetry available
  jobs,
  labels: {
    duration_s: "measured",
    queued_s: "measured",
    jobs: "counted",
    cache: "parsed from job log",
    runner_class: runnerClasses.length ? "parsed from job log" : "UNKNOWN",
    energy_kwh: "UNKNOWN"
  }
};

// The pipeline that is collecting is still running, so its own status/duration are
// provisional. Mark that honestly instead of pretending it finished.
if (String(process.env.CI_PIPELINE_ID) === String(pipelineId)) {
  record.note = "Collected from inside the pipeline; pipeline-level status/duration are provisional. Re-run `npm run evidence:collect -- --pipeline " + pipelineId + "` after completion to finalise.";
}

mkdirSync(outDir, { recursive: true });
const file = join(outDir, `${arm}-${pipeline.id}.json`);
writeFileSync(file, JSON.stringify(record, null, 2) + "\n");

// Keep an index so the static site can list runs without a directory listing.
const index = readdirSync(outDir).filter((f) => f.endsWith(".json") && f !== "index.json").sort();
writeFileSync(join(outDir, "index.json"), JSON.stringify(index, null, 2) + "\n");

console.log(`wrote ${file}`);
console.log(`  arm=${arm} class=${changeClass} status=${record.status} duration_s=${record.duration_s} jobs=${jobs.length}`);
