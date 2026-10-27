// Minimal "build" step so the pipeline has a real build job with an artifact.
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
mkdirSync("dist", { recursive: true });
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
writeFileSync("dist/build-info.json", JSON.stringify({ name: pkg.name, version: pkg.version, built_at: new Date().toISOString() }, null, 2));
console.log("built dist/build-info.json");
