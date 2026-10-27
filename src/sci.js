/**
 * Software Carbon Intensity worksheet.
 *
 *   SCI = (O + M) / R
 *
 *   O = E * I        operational emissions (energy in kWh * grid intensity gCO2e/kWh)
 *   M                embodied emissions allocated to this run (gCO2e)
 *   R                functional unit: one successful, equivalent CI pipeline run
 *
 * The worksheet never fills a missing input. Any input that is not supplied
 * is reported as UNKNOWN and the SCI value is not calculated.
 */

export const UNKNOWN = "UNKNOWN";

const INPUTS = [
  { key: "energy_kwh", symbol: "E", label: "Energy per functional unit (kWh)" },
  { key: "grid_intensity_gco2e_per_kwh", symbol: "I", label: "Grid carbon intensity (gCO2e/kWh)" },
  { key: "embodied_gco2e", symbol: "M", label: "Embodied emissions allocated to the run (gCO2e)" }
];

function isNumber(v) {
  return typeof v === "number" && Number.isFinite(v);
}

/**
 * @param {object} inputs  { energy_kwh, grid_intensity_gco2e_per_kwh, embodied_gco2e, sources: {key: url|string} }
 * @returns {object} worksheet with every row labelled and status "calculated" | "not_calculated"
 */
export function sciWorksheet(inputs = {}) {
  const sources = inputs.sources ?? {};
  const rows = INPUTS.map(({ key, symbol, label }) => ({
    symbol,
    label,
    value: isNumber(inputs[key]) ? inputs[key] : UNKNOWN,
    kind: inputs.kinds?.[key] ?? (isNumber(inputs[key]) ? "modeled" : UNKNOWN),
    source: sources[key] ?? UNKNOWN
  }));

  const missing = rows.filter((r) => r.value === UNKNOWN).map((r) => r.label);
  const functionalUnit = "one successful, equivalent CI pipeline run that validates the same change";

  if (missing.length > 0) {
    return {
      equation: "SCI = (E * I + M) / R",
      functional_unit: functionalUnit,
      rows,
      operational_gco2e: UNKNOWN,
      sci_gco2e_per_run: UNKNOWN,
      status: "not_calculated",
      message: `SCI not calculated: ${missing.join("; ")} unavailable.`
    };
  }

  const O = inputs.energy_kwh * inputs.grid_intensity_gco2e_per_kwh;
  const M = inputs.embodied_gco2e;
  return {
    equation: "SCI = (E * I + M) / R",
    functional_unit: functionalUnit,
    rows,
    operational_gco2e: O,
    sci_gco2e_per_run: O + M,
    status: "calculated",
    message: "SCI calculated from the inputs above. Values labelled 'modeled' are estimates, not measurements."
  };
}
