import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyChange, isDocsPath } from "../src/classify.js";

test("docs paths", () => {
  for (const p of ["README.md", "docs/DEMO.md", "docs/a/b.MD", "LICENSE", ".gitlab/issue_templates/x.md"]) assert.equal(isDocsPath(p), true, p);
  for (const p of ["src/a.js", ".gitlab-ci.yml", "package.json", "docs.js", "LICENSE.txt", "site/index.html"]) assert.equal(isDocsPath(p), false, p);
});

test("docs only when every path is documentation", () => {
  assert.equal(classifyChange(["README.md", "docs/DEMO.md"]).change_class, "docs");
  assert.equal(classifyChange(["README.md", "src/a.js"]).change_class, "code");
});

test("fails safe on unknown or empty input", () => {
  assert.equal(classifyChange(null).change_class, "code");
  assert.equal(classifyChange(undefined).change_class, "code");
  assert.equal(classifyChange([]).change_class, "code");
  assert.equal(classifyChange(["", "  "]).change_class, "code");
});
