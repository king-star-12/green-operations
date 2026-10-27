/**
 * Optimization ledger: the list of changes proposed by Green Operations
 * and what has actually been verified about each.
 *
 * state: "suggested" | "applied" | "verified" | "regressed"
 * A change moves to "verified" only when comparable baseline and optimized
 * runs exist and the chosen metric did not get worse.
 */

export const LEDGER_STATES = ["suggested", "applied", "verified", "regressed"];

export function ledgerEntry({ id, change, expected_effect, risk, evidence, state = "suggested" }) {
  if (!LEDGER_STATES.includes(state)) throw new Error(`invalid ledger state: ${state}`);
  return { id, change, expected_effect, risk, evidence: evidence ?? [], state };
}

/** Decide the verified state from a comparison result. */
export function stateFromComparison(entry, comparison) {
  if (!comparison || !comparison.comparable) return entry.state === "suggested" ? "suggested" : "applied";
  const pct = comparison.metrics?.runner_minutes?.reduction_pct;
  if (pct === null || pct === undefined) return "applied";
  return pct >= 0 ? "verified" : "regressed";
}
