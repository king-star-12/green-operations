# Excluded runs

Real pipelines that are kept for transparency but left out of the comparison.
Each file is unmodified collector output.

| Pipeline | Arm | Why excluded |
|---|---|---|
| 2994150067 | optimized | Earlier config using `rules:changes`; lint/test/build were skipped on a code change because GitLab judged the merge commit by its first parent. This is the defect that motivated the `classify` job. Not a valid optimized code run. |
| 2994169521 | optimized | Intermediate config: classify job without git (failed safe to "code", so all jobs ran) and the npm cache directory was never written. Config differs from the final optimized arm, so it is not pooled with it. |

Rule: only runs whose configuration matches the arm as finally documented are
compared. Excluding a run never hides a regression; the reasons are stated here
and the raw files stay in the repository.
