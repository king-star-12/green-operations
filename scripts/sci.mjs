#!/usr/bin/env node
/**
 * Produce evidence/sci.json from evidence/sci-inputs.json (if present).
 * With no inputs file, every row is UNKNOWN and SCI is not calculated.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { sciWorksheet } from "../src/sci.js";

const inputsPath = join(process.cwd(), "evidence", "sci-inputs.json");
const inputs = existsSync(inputsPath) ? JSON.parse(readFileSync(inputsPath, "utf8")) : {};
const out = { baseline: sciWorksheet(inputs.baseline ?? {}), optimized: sciWorksheet(inputs.optimized ?? {}), generated_at: new Date().toISOString(), inputs_file: existsSync(inputsPath) ? "evidence/sci-inputs.json" : null };
writeFileSync(join(process.cwd(), "evidence", "sci.json"), JSON.stringify(out, null, 2) + "\n");
console.log(`baseline: ${out.baseline.message}`);
console.log(`optimized: ${out.optimized.message}`);
