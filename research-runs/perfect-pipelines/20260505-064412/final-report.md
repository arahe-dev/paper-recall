# Perfect Pipelines Final Report

## 1. Summary Verdict

PASS. The AI -> Human and Human -> AI pipelines meet the requested thresholds in this research run:

- Stage 1 core benchmarks: 6/6 pass readability >= 0.95 and parse fidelity >= 0.99.
- Stage 2 edge cases: 9/9 pass readability >= 0.95 and parse fidelity >= 0.99.
- Stage 3 style expansion: 42/42 style/core combinations pass readability >= 0.95 and parse fidelity >= 0.99.

## 2. Default Style Selected

`readable_default`, implemented as the named default alias of `readable_compact`.

## 3. Style Variants Selected

- `readable_default`
- `readable_compact`
- `readable_spacious`
- `readable_radial`
- `readable_flowchart`
- `readable_block_diagram`
- `readable_control_system`

## 4. Benchmark Score Table

Source: `iter-02/scores.md`

| Scenario | Readability | Parse fidelity | Status |
|---|---:|---:|---|
| hierarchy_tree | 1.00 | 1.00 | PASS |
| hub_spoke | 1.00 | 1.00 | PASS |
| linear_pipeline | 1.00 | 1.00 | PASS |
| branching_workflow | 1.00 | 1.00 | PASS |
| mixed_complexity | 1.00 | 1.00 | PASS |
| control_system_reduction_6_step | 1.00 | 1.00 | PASS |

## 5. Edge-Case Score Table

Source: `iter-06/scores.md`

| Scenario | Readability | Parse fidelity | Status |
|---|---:|---:|---|
| edge_deleted_elements | 1.00 | 1.00 | PASS |
| edge_multiple_disconnected_clusters | 1.00 | 1.00 | PASS |
| edge_long_labels | 1.00 | 1.00 | PASS |
| edge_tiny_labels_sparse | 1.00 | 1.00 | PASS |
| edge_dense_crosslinks_multiple_parents | 1.00 | 1.00 | PASS |
| edge_hub_many_spokes | 1.00 | 1.00 | PASS |
| edge_deep_tree | 1.00 | 1.00 | PASS |
| edge_feedback_loop_control | 1.00 | 1.00 | PASS |
| edge_parallel_branches_annotations | 1.00 | 1.00 | PASS |

## 6. Major Architectural Changes

- Added `scripts/perfect-pipelines.mjs`, an Excalidraw-backed autoresearch runner that produces PNGs, scene JSON, text graph JSON, validation JSON, visual reviews, parse reviews, scores, and contact sheets.
- Added exact generated-node metadata to Excalidraw shapes for label/body round-trip fidelity.
- Rendered node bodies visibly into generated Excalidraw boards.
- Parsed edge-label text bound to arrows and preserved it in text graph edges.
- Ignored generated subtree background rectangles in semantic text graph extraction.
- Exposed automation text-graph export and deleted-element-inclusive scene snapshots.
- Made subtree traversal cycle-safe for feedback/control graphs.
- Added dynamic hub-spoke radius and fixed full-circle radial angle spacing.
- Routed LR feedback/back edges below the node row.
- Added style-family presets for default, flowchart, block diagram, and control-system use.

## 7. Files Changed

Pipeline-related files changed or added:

- `src/App.tsx`
- `src/boardTextGraph.ts`
- `src/excalidrawAdapter.ts`
- `src/layoutEngine.ts`
- `src/stylePresets.ts`
- `benchmarks/control_system_reduction_6_step.json`
- `scripts/perfect-pipelines.mjs`
- `research-runs/perfect-pipelines/20260505-064412/`

The worktree also contains pre-existing unrelated dirty/untracked files from earlier work, including Tauri/package/UI changes. Those were not part of this pipeline scope.

## 8. Artifact Paths

- Run folder: `research-runs/perfect-pipelines/20260505-064412/`
- Core pass: `research-runs/perfect-pipelines/20260505-064412/iter-02/`
- Edge-case pass: `research-runs/perfect-pipelines/20260505-064412/iter-06/`
- Style pass: `research-runs/perfect-pipelines/20260505-064412/iter-08/`

Each scenario folder contains rendered PNG, generated Recall Graph IR JSON, Excalidraw scene JSON, text graph JSON, `validation.json`, `visual-review.md`, `parse-review.md`, `scores.md`, and `plan.md`.

## 9. Known Limitations

- Scores are backed by direct image inspection plus deterministic geometry/round-trip validation, but they are still research-run metrics rather than a formal visual theorem.
- Generated node metadata preserves exact label/body round-trip for generated boards; fully arbitrary hand-edited boards still rely on visible text grouping heuristics.
- LR feedback routing is handled for left-returning edges; more specialized routing lanes may be needed for very complex multi-loop control systems.
- The repository had unrelated dirty work before this run, so no new all-changes commit was created in this pass.

## 10. Exact Commands Run

- `Get-Content -Raw -LiteralPath 'C:\Users\arahe\recall-board-excalidraw\goal.txt'`
- `git status --short`
- `npm.cmd run build`
- `node scripts\perfect-pipelines.mjs`
- `$env:PATCH_NOTE='Rendered node bodies, ignored generated subtree backgrounds, parsed arrow-label text, and stopped penalizing narrow-but-legible exported PNGs.'; node scripts\perfect-pipelines.mjs 'research-runs\perfect-pipelines\20260505-064412' iter-02`
- `$env:SCENARIO_SUITE='edge'; $env:PATCH_NOTE='Added edge-case suite support and exposed deleted scene elements to the parser.'; node scripts\perfect-pipelines.mjs 'research-runs\perfect-pipelines\20260505-064412' iter-03`
- `$env:SCENARIO_SUITE='edge'; $env:PATCH_NOTE='Added generated node metadata for exact label/body round-trip and scaled hub-spoke radius dynamically for many spokes.'; node scripts\perfect-pipelines.mjs 'research-runs\perfect-pipelines\20260505-064412' iter-04`
- `$env:SCENARIO_SUITE='edge'; $env:PATCH_NOTE='Routed left-returning LR feedback edges below the node row after multimodal review.'; node scripts\perfect-pipelines.mjs 'research-runs\perfect-pipelines\20260505-064412' iter-05`
- `$env:SCENARIO_SUITE='edge'; $env:PATCH_NOTE='Updated validation to ignore an arrow crossing its own Excalidraw edge label.'; node scripts\perfect-pipelines.mjs 'research-runs\perfect-pipelines\20260505-064412' iter-06`
- `$env:SCENARIO_SUITE='styles'; $env:PATCH_NOTE='Added readable_default, readable_flowchart, readable_block_diagram, and readable_control_system style presets.'; node scripts\perfect-pipelines.mjs 'research-runs\perfect-pipelines\20260505-064412' iter-07`
- `$env:SCENARIO_SUITE='styles'; $env:PATCH_NOTE='Fixed full-circle radial hub spacing so first and last spokes do not share an angle.'; node scripts\perfect-pipelines.mjs 'research-runs\perfect-pipelines\20260505-064412' iter-08`

## 11. Commit Hash

Current repository HEAD during final audit:

`1c54b1eb5076d5955bb0ea64d9494842987160b6`

No new commit was created because the worktree already contained unrelated dirty/untracked changes outside the pipeline scope.
