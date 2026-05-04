# Arrow Rendering Fix Report

## Bug Cause

The `excalidrawAdapter.ts` generated arrow skeletons with:
- `width: 1`, `height: 1`
- No `points` array
- `start` / `end` objects for binding references (valid skeleton syntax)

`convertToExcalidrawElements` created `ExcalidrawArrowElement` instances from these skeletons, but because the skeleton lacked actual `points` and had degenerate dimensions, the resulting arrows all collapsed to:
- `points: [[0.5, 0.5], [0.5, 0.5]]`
- `width: 1`, `height: 1`

The `startBinding` and `endBinding` were populated correctly, but Excalidraw renders arrows from their `points` geometry, not from bindings alone. Without real point deltas, every arrow was invisible.

## Exact Fix

Modified `src/excalidrawAdapter.ts` to compute proper arrow geometry for each edge:

1. **Anchor selection** based on relative node positions:
   - If target is mostly below source: bottom-center → top-center
   - If target is mostly above source: top-center → bottom-center
   - If target is mostly to the right: right-center → left-center
   - If target is mostly to the left: left-center → right-center

2. **Arrow element properties**:
   - `x`, `y` set to the source anchor point
   - `points: [[0, 0], [targetX - sourceX, targetY - sourceY]]`
   - `width` = `Math.abs(targetX - sourceX)`
   - `height` = `Math.abs(targetY - sourceY)`
   - `startBinding` and `endBinding` explicitly provided with `elementId`, `focus: 0`, and `gap` from preset
   - `endArrowhead: "arrow"`
   - `start` and `end` preserved for `convertToExcalidrawElements` compatibility

## Acceptance Test Results

| Test | Graph | Arrows | Result |
|------|-------|--------|--------|
| A | Minimal A→B | 1 | Visible |
| B | ESP32 → 5 IMUs | 5 | All visible |
| C | Hierarchy tree | 9 | All visible |
| D | Branching workflow | 15 | All visible |
| E | Mixed complexity | 29 | All visible |

All 84 arrows across all benchmarks are non-degenerate (point distance > 5 px).

## Screenshots Generated

- `research-output/iteration-arrow-fix/hierarchy_tree.png`
- `research-output/iteration-arrow-fix/hub_spoke.png`
- `research-output/iteration-arrow-fix/linear_pipeline.png`
- `research-output/iteration-arrow-fix/branching_workflow.png`
- `research-output/iteration-arrow-fix/mixed_complexity.png`
- `research-output/iteration-arrow-fix/esp32_hub.png`

## Remaining Visual Issues

1. **Arrow lines sometimes cross through unrelated nodes** in wide layouts (e.g., `mixed_complexity`). Straight-line arrows don't route around obstacles.
2. **Arrow endpoint gaps** are consistent (`gap: 4` for `readable_compact`) but not dynamically adjusted based on zoom.
3. **`mixed_complexity` still requires 0.68× zoom** to fit in a 1600×1200 viewport. This is a structural width issue, not an arrow bug.
4. **No edge labels rendered** yet — the adapter supports them but none of the benchmark JSONs include edge labels.

## Recommended Next Style Baseline

- Use **`readable_compact`** as the default preset.
- Keep **`maxChildrenPerRow: 3`** for grid wrapping.
- Next improvement priority: **orthogonal or bezier arrow routing** to reduce line crossings in `mixed_complexity`.
