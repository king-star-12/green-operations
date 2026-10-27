#!/usr/bin/env node
// Copy the static Field Notes UI and committed evidence into public/ for GitLab Pages.
import { cpSync, mkdirSync, existsSync, rmSync } from "node:fs";
const pub = "public";
if (existsSync(pub)) rmSync(pub, { recursive: true });
mkdirSync(pub, { recursive: true });
cpSync("site", pub, { recursive: true });
mkdirSync(`${pub}/evidence`, { recursive: true });
for (const f of ["summary.json", "sci.json", "ledger.json"]) if (existsSync(`evidence/${f}`)) cpSync(`evidence/${f}`, `${pub}/evidence/${f}`);
if (existsSync("evidence/runs")) cpSync("evidence/runs", `${pub}/evidence/runs`, { recursive: true });
console.log("site written to public/");
