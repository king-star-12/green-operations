#!/usr/bin/env node
/**
 * Create or update the Green Operations custom agent on the GitLab Duo Agent
 * Platform from .gitlab/duo/agents/green-operations.yml, release the new
 * version, and make sure it is enabled in the project.
 *
 *   GITLAB_TOKEN=<token with api + ai_features> CI_PROJECT_ID=<id> node scripts/duo_agent_sync.mjs
 *
 * The YAML file stays the reviewed source of truth; this script only mirrors it
 * into GitLab (GraphQL mutations aiCatalogAgentCreate / aiCatalogAgentUpdate /
 * aiCatalogItemConsumerCreate). The token is read from the environment only.
 */
import { readFileSync } from "node:fs";

const token = process.env.GITLAB_TOKEN;
const projectId = process.env.CI_PROJECT_ID;
const api = (process.env.CI_API_V4_URL ?? "https://gitlab.com/api/v4").replace(/\/api\/v4\/?$/, "");
if (!token || !projectId) {
  console.error("duo_agent_sync: set GITLAB_TOKEN and CI_PROJECT_ID");
  process.exit(2);
}

// Tiny parser for the flat YAML we use: scalar keys, a `tools:` list, and a `system_prompt: |` block.
function parseAgentYaml(text) {
  const out = { tools: [] };
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*#/.test(line) || !line.trim()) continue;
    let m;
    if ((m = line.match(/^system_prompt:\s*\|/))) {
      const body = [];
      for (i += 1; i < lines.length && (lines[i].startsWith("  ") || !lines[i].trim()); i++) body.push(lines[i].slice(2));
      i -= 1;
      out.system_prompt = body.join("\n").trim() + "\n";
    } else if ((m = line.match(/^description:\s*>-?/))) {
      const body = [];
      for (i += 1; i < lines.length && lines[i].startsWith("  "); i++) body.push(lines[i].trim());
      i -= 1;
      out.description = body.join(" ");
    } else if ((m = line.match(/^tools:/))) {
      for (i += 1; i < lines.length && /^\s+-\s/.test(lines[i]); i++) out.tools.push(lines[i].replace(/^\s+-\s*/, "").trim());
      i -= 1;
    } else if ((m = line.match(/^(\w+):\s*(.+)$/))) {
      out[m[1]] = m[2].trim();
    }
  }
  return out;
}

async function gql(query, variables) {
  const res = await fetch(`${api}/api/graphql`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "PRIVATE-TOKEN": token },
    body: JSON.stringify({ query, variables })
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

const agent = parseAgentYaml(readFileSync(".gitlab/duo/agents/green-operations.yml", "utf8"));
const projectGid = `gid://gitlab/Project/${projectId}`;

// Resolve built-in tool titles to IDs.
const toolNodes = (await gql(`{ aiCatalogBuiltInTools(first: 200) { nodes { id title } } }`)).aiCatalogBuiltInTools.nodes;
const toolIds = agent.tools.map((title) => {
  const t = toolNodes.find((n) => n.title.toLowerCase() === title.toLowerCase());
  if (!t) throw new Error(`unknown built-in tool "${title}"`);
  return t.id;
});

// Find an existing agent managed by this project.
const existing = (await gql(`query($q: String!){ aiCatalogItems(itemType: AGENT, search: $q, first: 20) { nodes { id name project { id } } } }`, { q: agent.display_name }))
  .aiCatalogItems.nodes.find((n) => n.name === agent.display_name && n.project?.id === projectGid);

const common = { name: agent.display_name, description: agent.description, systemPrompt: agent.system_prompt, tools: toolIds, visibility: (agent.visibility ?? "PRIVATE").toUpperCase(), release: true };
let itemId;
if (existing) {
  // Item-level fields (name, description, visibility) can always be updated.
  const update = async (extra) => {
    const r = await gql(`mutation($i: AiCatalogAgentUpdateInput!){ aiCatalogAgentUpdate(input: $i){ errors item { id versions { nodes { versionName released } } } } }`, { i: { id: existing.id, ...extra } });
    return r.aiCatalogAgentUpdate;
  };
  const meta = await update({ name: common.name, description: common.description, visibility: common.visibility });
  if (meta.errors.length) throw new Error(meta.errors.join("; "));
  itemId = meta.item.id;
  // Version-level fields (system prompt, tools) live in a version. GitLab
  // refuses to change a released version through this API, so report that
  // plainly instead of pretending the prompt was synced.
  const ver = await update({ systemPrompt: common.systemPrompt, tools: common.tools, release: true, versionBump: "MINOR" });
  if (ver.errors.length) {
    console.log(`updated item metadata for ${itemId}; prompt/tools NOT changed: ${ver.errors.join("; ")}`);
    console.log("  The latest released version is immutable via the API. Open the agent page, create a new version, paste the prompt from the YAML, and release it; or run with DUO_AGENT_RECREATE=1 to delete and recreate (new ID).");
    if (process.env.DUO_AGENT_RECREATE === "1") {
      const d = await gql(`mutation($i: AiCatalogAgentDeleteInput!){ aiCatalogAgentDelete(input: $i){ errors } }`, { i: { id: existing.id } });
      if (d.aiCatalogAgentDelete.errors.length) throw new Error(d.aiCatalogAgentDelete.errors.join("; "));
      const r = await gql(`mutation($i: AiCatalogAgentCreateInput!){ aiCatalogAgentCreate(input: $i){ errors item { id } } }`, { i: { projectId: projectGid, ...common } });
      if (r.aiCatalogAgentCreate.errors.length) throw new Error(r.aiCatalogAgentCreate.errors.join("; "));
      itemId = r.aiCatalogAgentCreate.item.id;
      console.log(`recreated as ${itemId}`);
    }
  } else {
    console.log(`updated ${itemId}: versions ${ver.item.versions.nodes.map((v) => v.versionName + (v.released ? "" : " (draft)")).join(", ")}`);
  }
} else {
  const r = await gql(`mutation($i: AiCatalogAgentCreateInput!){ aiCatalogAgentCreate(input: $i){ errors item { id } } }`, { i: { projectId: projectGid, ...common } });
  if (r.aiCatalogAgentCreate.errors.length) throw new Error(r.aiCatalogAgentCreate.errors.join("; "));
  itemId = r.aiCatalogAgentCreate.item.id;
  console.log(`created ${itemId}`);
}

// Enable in the project (idempotent: an error about an existing consumer is fine).
const c = await gql(`mutation($i: AiCatalogItemConsumerCreateInput!){ aiCatalogItemConsumerCreate(input: $i){ errors itemConsumer { id } } }`, { i: { itemId, target: { projectId: projectGid } } });
console.log(c.aiCatalogItemConsumerCreate.errors.length ? `enable: ${c.aiCatalogItemConsumerCreate.errors.join("; ")}` : `enabled in project as ${c.aiCatalogItemConsumerCreate.itemConsumer.id}`);
console.log(`agent page: ${api}/${process.env.CI_PROJECT_PATH ?? "<project path>"}/-/automate/agents/${itemId.split("/").pop()}`);
