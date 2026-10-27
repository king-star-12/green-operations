/**
 * Change classification for the pipeline.
 *
 * A change is "docs" only when EVERY changed path matches the docs allow-list.
 * Anything else, including an empty or undeterminable path list, is "code".
 * Failing safe matters more than saving a few runner-minutes: a code change
 * that is misclassified as docs would skip lint, test and build.
 */

export const DOCS_ONLY_PATTERNS = [
  /\.md$/i,
  /^docs\//,
  /^LICENSE$/,
  /^\.gitlab\/issue_templates\//
];

export function isDocsPath(path) {
  return DOCS_ONLY_PATTERNS.some((re) => re.test(path));
}

/**
 * @param {string[]|null|undefined} paths changed paths; null/undefined means "could not determine"
 * @returns {{ change_class: "docs"|"code", reason: string, paths: string[] }}
 */
export function classifyChange(paths) {
  if (!Array.isArray(paths)) return { change_class: "code", reason: "changed paths could not be determined; failing safe", paths: [] };
  const clean = paths.map((p) => String(p).trim()).filter(Boolean);
  if (clean.length === 0) return { change_class: "code", reason: "no changed paths reported; failing safe", paths: clean };
  const nonDocs = clean.filter((p) => !isDocsPath(p));
  if (nonDocs.length > 0) return { change_class: "code", reason: `non-documentation paths changed: ${nonDocs.slice(0, 5).join(", ")}${nonDocs.length > 5 ? ", …" : ""}`, paths: clean };
  return { change_class: "docs", reason: `all ${clean.length} changed path(s) are documentation`, paths: clean };
}
