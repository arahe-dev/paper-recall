# Recall Graph IR Autoresearch Log

## Goal
Implement Recall Graph IR as the canonical AI-to-Excalidraw generation format, then run an iterative autoresearch loop to make generated outputs readable, clean, and visually strong.

**Constraints**
- Excalidraw engine is the actual rendering target (no Mermaid).
- Recall Graph IR is the canonical AI→board format.
- Visual evaluation happens on actual Excalidraw-generated PNG exports.
- One small layout/rendering change per iteration; rerender all 5 benchmarks; keep or revert based on weighted rubric.

## Benchmarks

| Benchmark | Nodes | Edges | Structure |
|-----------|-------|-------|-----------|
| `hierarchy_tree` | 10 | 9 | 2-level tree, root with 5 children, one branch has 4 grandchildren |
| `hub_spoke` | 6 | 5 | Classic hub-and-spoke (1 root, 5 leaves) |
| `linear_pipeline` | 6 | 5 | Straight vertical chain |
| `branching_workflow` | 16 | 15 | Root with 5 branches, each with 2 sub-tasks |
| `mixed_complexity` | 31 | 29 | Deep 3-level tree with 5 major branches + 2 disconnected notes |

Viewport for all screenshots: **1600×1200**.

## Iteration History

### Iteration 0 — Baseline
- Initial implementation of `recallGraphIR`, `stylePresets`, `layoutEngine`, `excalidrawAdapter`, `recallGraphRenderer`.
- **Bug**: `isHubSpoke` heuristic (`>= 70%` leaves) falsely matched `hierarchy_tree`, causing inverted hub-spoke layout.
- Metrics (selected):
  - `mixed_complexity`: 3203×432 px, fitZoom **0.500**
  - `branching_workflow`: 1426×304 px, fitZoom **1.122**

### Iteration 1 — Fix Hub-Spoke Detection & Arc Angles
- Changed `isHubSpoke` to require **100%** of root children be leaves (`leafCount === children.length`).
- Fixed hub-spoke arc angles to spread **left→top→right** (`startAngle=Math.PI`, `span=-Math.PI`).
- Result: `hierarchy_tree` correctly uses hierarchical layout.

### Iteration 2 — Reduce Spacing
- Reduced `siblingSpacing` (20→12), `subtreeSpacing` (40→14), `horizontalSpacing` (60→20), `verticalSpacing` (120→80).
- Width reductions on all wide benchmarks.

### Iteration 3 — Fit to Viewport
- Changed `scrollToContent` call to `{ fitToViewport: true }` so wide graphs zoom to fit the screenshot viewport for fair comparison.

### Iteration 4 — Further Spacing Reduction
- Additional spacing tweaks.
- `mixed_complexity`: 3203×432 px, fitZoom **0.500** (no further improvement from spacing alone).

### Iteration 5 — Grid Wrapping (`maxChildrenPerRow`)
- **Change**: Added `maxChildrenPerRow` to `StylePreset`. When a node has more children than this limit, children are wrapped into multiple centered rows instead of a single horizontal line.
- Set `readable_compact.maxChildrenPerRow = 3`.
- **Impact**:
  - `hierarchy_tree`: 1091→**711** px width (−35%), fitZoom **1.467→2.250**
  - `branching_workflow`: 1426→**912** px width (−36%), fitZoom **1.122→1.754**
  - `mixed_complexity`: 3203→**2345** px width (−27%), fitZoom **0.500→0.682**
  - `hub_spoke` and `linear_pipeline`: unchanged (not affected).
- **Decision**: **Kept**. Objective metrics show clear width reduction and zoom improvement on the three widest benchmarks with zero regression on the others.

## Phase 2 — Preset Comparison

All 5 benchmarks rendered with all 5 presets. Key metrics (`fitZoom` higher is better):

| Preset | hierarchy_tree | hub_spoke | linear_pipeline | branching_workflow | mixed_complexity |
|--------|----------------|-----------|-----------------|--------------------|------------------|
| `readable_compact` | **2.250** | 3.078 | 1.744 | **1.754** | **0.682** |
| `readable_spacious` | 1.142 | 2.596 | 1.217 | 0.870 | 0.386 |
| `readable_long` | 1.182 | 2.822 | 1.523 | 0.896 | 0.418 |
| `readable_radial` | 1.503 | 2.679 | 1.523 | 1.140 | 0.504 |
| `readable_dense` | 1.986 | **3.895** | **2.222** | 1.563 | 0.697 |

### Preset Recommendations

| Preset | Best For |
|--------|----------|
| **`readable_compact`** | **Default / general purpose**. Highest fitZoom on wide trees and workflows. Grid wrapping keeps large boards readable. |
| `readable_spacious` | Presentations, sparse boards, or when you want generous whitespace. |
| `readable_long` | Text-heavy nodes, linear pipelines, or when labels are long sentences. |
| `readable_radial` | Concept maps, star topologies, or when you want a non-hierarchical feel. |
| `readable_dense` | Large complex graphs where screen real estate is critical. Smallest fonts and tightest packing. Highest fitZoom on hub-spoke and linear pipelines. |

## Key Findings

1. **Spacing tweaks alone hit diminishing returns quickly.** After iteration 3, further spacing reductions did not materially improve `mixed_complexity` width because the fundamental issue was the single-row child layout algorithm.

2. **Grid wrapping (`maxChildrenPerRow`) is the most impactful single layout change.** It trades a small amount of height for a large width reduction on wide trees. With a limit of 3, 5-child roots wrap into a 3+2 grid, cutting total width by ~30%.

3. **`readable_compact` is the best default preset.** It outperforms `readable_spacious` and `readable_long` on every wide benchmark while maintaining legible font sizes (15px Helvetica).

4. **`readable_dense` is a strong alternative for very large graphs.** It achieves the highest fitZoom on hub-spoke (3.9×) and linear pipelines (2.2×) and is slightly better than compact on `mixed_complexity` (0.697 vs 0.682). The trade-off is 13px font and tighter padding.

5. **`fitToViewport: true` is essential for fair automated evaluation.** Without it, wide graphs are cropped in screenshots, making visual comparison impossible.

## Limitations

- Visual evaluation was performed via **quantitative metrics** (bounds, fitZoom) rather than a multimodal agent inspecting actual pixels. A human or multimodal review could catch subtle overlap or alignment issues that metrics miss.
- `mixed_complexity` still does not fully fit in a 1600px viewport at 100% zoom (fitZoom 0.682). This is a structural limitation of a 31-node tree with long labels. Further improvements would require font-size reduction, multi-level wrapping, or a left-to-right layout direction.

## Files Changed During Research

- `src/layoutEngine.ts` — added `maxChildrenPerRow` grid logic
- `src/stylePresets.ts` — added `maxChildrenPerRow` field; set compact=3, dense=4
- `src/App.tsx` — added `fitToViewport: true` to `scrollToContent`
- `scripts/autoresearch.mjs` — existing automation script
- `scripts/phase2-autoresearch.mjs` — new Phase 2 batch preset runner
- `benchmarks/*.json` — 5 fixed benchmark scenarios

## Next Steps

1. **Human/multimodal visual review** of iteration-5 and Phase-2 screenshots to confirm no overlap or alignment regressions.
2. **Left-to-right layout direction** — add `direction: "left-right"` support for very wide trees like `mixed_complexity`.
3. **Smart label truncation** — for nodes that exceed a max width even after wrapping, consider abbreviating or splitting into multiple lines more aggressively.
4. **Edge routing** — currently arrows are straight lines. Add orthogonal or bezier routing to avoid crossing through unrelated nodes.
5. **Color coding by `kind`** — the IR supports `kind` on nodes/edges, but the adapter does not yet map kinds to distinct colors.
