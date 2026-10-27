#!/usr/bin/env node
/**
 * Classify the change a pipeline validates and select the child pipeline.
 *
 * Uses git itself to list changed paths across the whole pushed range (or the
 * merge request diff), so merge commits are handled correctly. GitLab's
 * built-in `rules:changes` evaluates a merge commit against its first parent
 * only, which skipped lint/test/build on a code change in pipeline
 * showcase#2994150067 - the reason this job exists.
 *
 * Outputs (in $CI_PROJECT_DIR):
 *   generated/child.yml   the child pipeline to trigger (copied from ci/)
 *   generated/classify.env  CHANGE_CLASS=code|docs, CHANGE_REASON=...
 *   generated/classify.json  full record for evidence collection
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import { classifyChange } from "../src/classify.js";

const ZERO = "0000000000000000000000000000000000000000";
const env = process.env;

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function changedPaths() {
  const sha = env.CI_COMMIT_SHA;
  if (!sha) return { paths: null, how: "not in CI" };
  let base = null;
  let how = "";
  if (env.CI_PIPELINE_SOURCE === "merge_request_event" && env.CI_MERGE_REQUEST_DIFF_BASE_SHA) {
    base = env.CI_MERGE_REQUEST_DIFF_BASE_SHA;
    how = "merge request diff base";
  } else if (env.CI_COMMIT_BEFORE_SHA && env.CI_COMMIT_BEFORE_SHA !== ZERO) {
    base = env.CI_COMMIT_BEFORE_SHA;
    how = "pushed range (CI_COMMIT_BEFORE_SHA..CI_COMMIT_SHA)";
  } else {
    return { paths: null, how: "first push to branch; no base to compare" };
  }
  try {
    // Make sure the base object is present in a shallow clone.
    try { git("cat-file", "-e", `${base}^{commit}`); } catch { git("fetch", "--quiet", "--depth=200", "origin", base); }
    const out = git("diff", "--name-only", base, sha);
    return { paths: out ? out.split("\n") : [], how: `${how} ${base.slice(0, 8)}..${sha.slice(0, 8)}` };
  } catch (err) {
    return { paths: null, how: `git diff failed: ${err.message.split("\n")[0]}` };
  }
}

const { paths, how } = changedPaths();
const result = classifyChange(paths);
const child = result.change_class === "docs" ? "ci/child-docs-only.gitlab-ci.yml" : "ci/child-app-jobs.gitlab-ci.yml";

mkdirSync("generated", { recursive: true });
copyFileSync(child, "generated/child.yml");
writeFileSync("generated/classify.env", `CHANGE_CLASS=${result.change_class}\nCHANGE_REASON=${result.reason.replace(/\n/g, " ")}\n`);
writeFileSync("generated/classify.json", JSON.stringify({ ...result, how, child, sha: env.CI_COMMIT_SHA ?? null, before_sha: env.CI_COMMIT_BEFORE_SHA ?? null, pipeline_id: env.CI_PIPELINE_ID ?? null }, null, 2) + "\n");

console.log(`change class: ${result.change_class}`);
console.log(`basis:        ${how}`);
console.log(`reason:       ${result.reason}`);
console.log(`child config: ${child}`);
if (result.paths.length) console.log(`paths (${result.paths.length}):\n  ${result.paths.slice(0, 50).join("\n  ")}`);
if (result.change_class === "docs") console.log("jobs avoided: lint, test, build (secret_detection still runs in the parent pipeline)");
