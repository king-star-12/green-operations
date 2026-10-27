/* Green Operations — Field Notes UI. Renders only what is in evidence/*.json. */
(async function () {
  const $ = (sel) => document.querySelector(sel);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmtS = (s) => (typeof s !== "number" ? "UNKNOWN" : s >= 60 ? `${Math.floor(s / 60)}m ${String(Math.round(s % 60)).padStart(2, "0")}s` : `${Math.round(s)}s`);
  const fmtN = (n, d = 1) => (typeof n === "number" ? n.toFixed(d) : "UNKNOWN");
  const tag = (kind) => `<span class="tag tag-${esc(kind === "UNKNOWN" ? "unknown" : kind)}">${esc(kind)}</span>`;

  async function load(path) {
    try { const r = await fetch(path, { cache: "no-store" }); if (!r.ok) return null; return await r.json(); } catch { return null; }
  }
  const [summary, sci, agent] = await Promise.all([load("evidence/summary.json"), load("evidence/sci.json"), load("evidence/agent-report.json")]);

  const runs = summary?.runs ?? [];
  const state = summary?.state ?? "before_baseline";
  const projectPath = runs[0]?.web_url?.match(/https?:\/\/[^/]+\/(.+?)\/-\/pipelines/)?.[1];
  $("#project-name").textContent = projectPath ?? "no runs recorded";
  $("#generated-at").textContent = summary?.generated_at ?? "—";
  $("#boundary").textContent = summary?.boundary ?? "—";
  $("#limitations").innerHTML = (summary?.limitations ?? []).map((l) => `<li>${esc(l)}</li>`).join("");

  // Evidence mode + strip
  const mode = $("#evidence-mode");
  const modes = {
    before_baseline: ["none", "no evidence", "No pipeline evidence recorded yet."],
    baseline_captured: ["partial", "baseline only", "Baseline captured. No optimized runs recorded yet; nothing is compared."],
    insufficient_data: ["partial", "not comparable", "Baseline and optimized runs exist but are not comparable. No reduction is reported."],
    verified: ["full", "measured comparison", "Comparable baseline and optimized runs recorded. Figures below are medians."]
  };
  const [m, mt, st] = modes[state] ?? modes.before_baseline;
  mode.dataset.mode = m; $("#evidence-mode-text").textContent = mt;
  const dates = runs.map((r) => r.finished_at).filter(Boolean).sort();
  $("#strip-text").textContent = st + (dates.length ? ` Runs recorded ${dates[0].slice(0, 10)} to ${dates[dates.length - 1].slice(0, 10)}.` : "");
  $("#energy-note").hidden = !(sci && (sci.baseline?.status !== "calculated" || sci.optimized?.status !== "calculated"));

  // Class selector + hero
  const comparisons = summary?.comparisons ?? [];
  const sel = $("#class-select");
  if (comparisons.length === 0) sel.innerHTML = `<option>—</option>`;
  else sel.innerHTML = comparisons.map((c) => `<option value="${esc(c.change_class)}">${esc(c.change_class)}</option>`).join("");
  sel.addEventListener("change", renderHero);
  renderHero();

  function renderHero() {
    const hero = $("#hero"); const cap = $("#hero-caption");
    if (state === "before_baseline") {
      hero.innerHTML = `<div class="empty"><h3>Before baseline</h3>
        <p>Trigger a pipeline on a branch using <code class="mono">ci/baseline.gitlab-ci.yml</code>. The <code class="mono">collect_evidence</code> job records pipeline status, job durations, runner class and cache outcome from GitLab. Nothing is estimated.</p>
        <pre>GITLAB_TOKEN=… CI_PROJECT_ID=&lt;id&gt; npm run evidence:collect -- --pipeline &lt;id&gt; --arm baseline
npm run evidence:all &amp;&amp; npm run site</pre></div>`;
      cap.textContent = ""; return;
    }
    const c = comparisons.find((x) => x.change_class === sel.value) ?? comparisons[0];
    if (!c) { hero.innerHTML = `<div class="empty"><h3>No comparison</h3></div>`; return; }
    const metricCard = (label, mtr, fmt) => {
      const b = mtr.baseline, o = mtr.optimized;
      const unknown = typeof b !== "number" || typeof o !== "number";
      let delta = `<div class="delta none">not calculated</div>`;
      if (!unknown && c.comparable && mtr.reduction_pct !== null) {
        const p = mtr.reduction_pct;
        delta = Math.abs(p) < 0.05 ? `<div class="delta none">no change (${esc(mtr.kind)})</div>` : p > 0 ? `<div class="delta good">▼ ${p.toFixed(1)}% lower (${esc(mtr.kind)})</div>` : `<div class="delta bad">▲ ${Math.abs(p).toFixed(1)}% higher — regression</div>`;
      } else if (!unknown && !c.comparable) delta = `<div class="delta none">runs not comparable; no change reported</div>`;
      return `<div class="metric"><div class="label">${esc(label)} ${tag(mtr.kind)}</div>
        <div class="pair">
          <div><span class="sub">baseline</span><span class="big ${unknown ? "unknown" : ""}">${esc(fmt(b))}</span></div>
          <div><span class="sub">optimized</span><span class="big ${unknown ? "unknown" : ""}">${esc(fmt(o))}</span></div>
        </div><div class="unit">${esc(mtr.unit)}</div>${delta}</div>`;
    };
    hero.innerHTML =
      metricCard("Median pipeline runtime", c.metrics.duration_s, fmtS) +
      metricCard("Median runner-minutes", c.metrics.runner_minutes, (v) => fmtN(v, 2)) +
      metricCard("Jobs executed", c.metrics.jobs_executed, (v) => fmtN(v, 0)) +
      metricCard("SCI per successful run", c.metrics.sci_gco2e_per_run, (v) => v);
    const warn = c.comparable ? "" : ` Not compared: ${c.reasons.join("; ")}`;
    cap.textContent = `${c.baseline.successful} baseline / ${c.optimized.successful} optimized successful runs, class "${c.change_class}", runner ${[...new Set([...c.baseline.runner_classes, ...c.optimized.runner_classes])].join(", ") || "UNKNOWN"}.${warn}`;
    cap.className = c.comparable ? "small muted" : "note note-yellow small";
  }

  // Pipeline trace
  const trace = $("#trace");
  if (runs.length === 0) trace.innerHTML = `<p class="small muted">No recorded pipelines.</p>`;
  else {
    const all = [];
    for (const f of (await load("evidence/runs/index.json")) ?? []) { const r = await load(`evidence/runs/${f}`); if (r) all.push(r); }
    const maxDur = Math.max(1, ...all.flatMap((r) => r.jobs.map((j) => j.duration_s || 0)));
    trace.innerHTML = all.sort((a, b) => (a.arm > b.arm ? 1 : a.arm < b.arm ? -1 : a.id - b.id)).map((r) => `
      <div class="trace-run">
        <div class="meta"><div class="arm">${esc(r.arm)} · ${esc(r.change_class)}</div>
          <a href="${esc(r.web_url)}">#${esc(r.iid ?? r.id)}</a> <span class="mono">${esc(r.status)}</span>${r.note ? ' <span class="tag tag-unknown">provisional</span>' : ""}<br>
          <span class="mono small">${esc(fmtS(r.duration_s))}</span> · <span class="small muted">${esc(r.runner_class)}</span></div>
        <div class="jobs">${r.jobs.map((j) => `
          <a class="job ${esc(j.status)}" href="${esc(j.web_url ?? "#")}" title="${esc(j.name)} ${esc(j.status)}">
            <span class="name">${esc(j.name)}</span>
            <span class="st">${esc(j.status)}${j.status !== "skipped" ? ` · ${esc(fmtS(j.duration_s))}` : ""}</span>
            <span class="bar" style="width:${Math.max(4, ((j.duration_s || 0) / maxDur) * 100)}%"></span>
            ${j.cache && j.cache !== "none" && j.cache !== "UNKNOWN" ? `<span class="cache ${esc(j.cache)}">cache ${esc(j.cache)}</span>` : ""}
          </a>`).join("")}</div>
      </div>`).join("");
  }

  // Ledger
  $("#ledger-body").innerHTML = (summary?.ledger ?? []).map((e) => `<tr>
    <td class="id">${esc(e.id)}</td><td>${esc(e.change)}</td><td>${esc(e.expected_effect)}</td><td>${esc(e.risk)}</td>
    <td>${e.evidence.length ? e.evidence.map((u, i) => `<a class="mono" href="${esc(u)}">run ${i + 1}</a>`).join(", ") : '<span class="muted">none yet</span>'}</td>
    <td><span class="state state-${esc(e.state)}">${esc(e.state)}</span>${e.state === "suggested" ? '<br><span class="small muted">Suggested by Green Operations; not applied</span>' : ""}</td></tr>`).join("") || `<tr><td colspan="6" class="muted">No ledger entries.</td></tr>`;

  // SCI
  const sciBody = $("#sci-body");
  if (!sci) sciBody.innerHTML = `<p class="muted">sci.json not found.</p>`;
  else {
    const ws = sci.optimized ?? sci.baseline;
    sciBody.innerHTML = `<table class="sci"><thead><tr><th>Symbol</th><th>Input</th><th>Baseline</th><th>Optimized</th><th>Kind</th><th>Source</th></tr></thead><tbody>
      ${ws.rows.map((row, i) => `<tr><td class="mono">${esc(row.symbol)}</td><td>${esc(row.label)}</td>
        <td class="mono">${esc(sci.baseline.rows[i].value)}</td><td class="mono">${esc(row.value)}</td><td>${tag(row.kind)}</td>
        <td>${row.source === "UNKNOWN" ? tag("UNKNOWN") : `<a class="mono" href="${esc(row.source)}">${esc(row.source)}</a>`}</td></tr>`).join("")}
      <tr><td class="mono">R</td><td>Functional unit</td><td colspan="4">${esc(ws.functional_unit)}</td></tr>
    </tbody></table>
    <div class="sci-result ${ws.status === "calculated" ? "calculated" : ""}">
      ${ws.status === "calculated"
        ? `<div>SCI per successful run — baseline <span class="big">${fmtN(sci.baseline.sci_gco2e_per_run, 2)}</span> → optimized <span class="big">${fmtN(ws.sci_gco2e_per_run, 2)}</span> gCO₂e</div><div class="small">${esc(ws.message)}</div>`
        : `<strong>SCI not calculated — energy/embodied data unavailable.</strong><div class="small">${esc(ws.message)}</div>`}
    </div>`;
  }

  // Agent note
  const ab = $("#agent-body");
  if (!agent) ab.innerHTML = `<p class="small">No agent report saved. Run the <span class="mono">green-operations</span> agent in GitLab Duo Agent Platform with the evidence files as context and save its output to <span class="mono">evidence/agent-report.json</span> (see <span class="mono">docs/DUO_AGENT.md</span>).</p>`;
  else ab.innerHTML = `<p class="small muted">${esc(agent.agent ?? "agent")} · ${esc(agent.generated_at ?? "")}${agent.source_url ? ` · <a href="${esc(agent.source_url)}">source</a>` : ""}</p><pre>${esc(agent.report ?? JSON.stringify(agent, null, 2))}</pre>`;
})();
