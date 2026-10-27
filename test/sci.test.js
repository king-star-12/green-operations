import { test } from "node:test";
import assert from "node:assert/strict";
import { sciWorksheet, UNKNOWN } from "../src/sci.js";

test("SCI is not calculated when any input is missing", () => {
  const ws = sciWorksheet({ grid_intensity_gco2e_per_kwh: 400 });
  assert.equal(ws.status, "not_calculated");
  assert.equal(ws.sci_gco2e_per_run, UNKNOWN);
  assert.equal(ws.operational_gco2e, UNKNOWN);
  assert.match(ws.message, /Energy per functional unit/);
  assert.match(ws.message, /Embodied/);
  assert.equal(ws.rows.find((r) => r.symbol === "E").value, UNKNOWN);
});

test("SCI is calculated only when every input is present, and labels kinds", () => {
  const ws = sciWorksheet({
    energy_kwh: 0.05,
    grid_intensity_gco2e_per_kwh: 400,
    embodied_gco2e: 2,
    kinds: { energy_kwh: "modeled", grid_intensity_gco2e_per_kwh: "measured", embodied_gco2e: "modeled" },
    sources: { energy_kwh: "model-x", grid_intensity_gco2e_per_kwh: "https://example/grid", embodied_gco2e: "vendor-sheet" }
  });
  assert.equal(ws.status, "calculated");
  assert.equal(ws.operational_gco2e, 20);
  assert.equal(ws.sci_gco2e_per_run, 22);
  assert.equal(ws.rows[1].kind, "measured");
  assert.equal(ws.rows[0].source, "model-x");
});

test("empty worksheet has every row UNKNOWN", () => {
  const ws = sciWorksheet();
  assert.ok(ws.rows.every((r) => r.value === UNKNOWN && r.source === UNKNOWN));
});
