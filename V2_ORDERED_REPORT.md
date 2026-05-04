# Recall Graph IR v2 — Ordered Layout Semantics Report

## Files Changed

- `src/recallGraphIR.ts` — schema upgraded to v2, new fields, expanded validation
- `src/layoutEngine.ts` — direction-aware layout, explicit children_order, root_ids, edge ordering, collision resolution
- `src/recallGraphRenderer.ts` — added `exportToMermaid()` debug export
- `src/excalidrawAdapter.ts` — no changes (arrow fix preserved)
- `src/stylePresets.ts` — no changes
- `benchmarks/hierarchy_tree.json` — upgraded to v2 with explicit ordering
- `benchmarks/hub_spoke.json` — upgraded to v2 with explicit ordering
- `benchmarks/linear_pipeline.json` — upgraded to v2 with explicit ordering
- `benchmarks/branching_workflow.json` — upgraded to v2 with explicit ordering
- `benchmarks/mixed_complexity.json` — upgraded to v2 with explicit ordering
- `benchmarks/esp32_hub.json` — upgraded to v2 with explicit ordering

## IR Schema Changes (v1 → v2)

### Layout
```
layout: {
  style: string;              // existing
  strategy?: "tree" | "radial" | "pipeline" | "hub_spoke" | "mixed";
  direction?: "TD" | "LR" | "BT" | "RL";   // replaces "top-down" | "left-right" | "radial"
  density?: "compact" | "readable" | "spacious";
  root_ids?: string[];        // explicit roots instead of inference
  sibling_order_policy?: "explicit" | "source_order" | "auto";
  rank_policy?: "explicit" | "from_root_depth";
}
```

### Nodes
Added: `order`, `rank`, `group_id`, `layout_hint`

### Edges
Renamed `kind` → `relation` (semantic relation type)
Added: `order`, `route_hint`

### New top-level fields
- `children_order: Record<string, string[]>` — authoritative sibling sequence per parent
- `groups: { id, label?, node_ids, order? }[]` — visual clusters

## Ordering Logic

1. **Root selection**: `layout.root_ids` is used first. If absent, inferred from zero-in-degree nodes.
2. **Children sorting**: for each parent, children are sorted by:
   - `children_order[parentId]` list position (highest priority)
   - `node.order` numeric value
   - Stable `id` fallback
3. **Edge drawing order**: edges are sorted by `edge.order` before conversion to Excalidraw elements.
4. **Rank/depth**: `rank_policy === "explicit"` uses `node.rank`. Otherwise BFS from roots.

## Renderer Changes

### Direction support
The layout engine computes positions in normalized TD space, then `finalizeLayout` applies a direction transform:
- **TD**: no change
- **BT**: flip vertically
- **LR**: transpose x↔y, width↔height
- **RL**: transpose + horizontal mirror

Collision resolution runs **before** the direction transform, ensuring overlap-free results in all orientations.

### Collision avoidance
Post-layout iterative resolver:
- Groups nodes by approximate y-level
- Sorts each group by x
- For overlapping pairs, shifts the right-side node (and all descendants) rightward
- Repeats until convergence (max 200 iterations)

## Validation Results

All 5 benchmarks pass with 0 overlaps and 0 degenerate arrows.

| Benchmark | Nodes | Edges | Overlaps | Degenerate | Size | fitZoom |
|-----------|-------|-------|----------|------------|------|---------|
| hierarchy_tree | 10 | 9 | 0 | 0 | 711×432 | 2.250 |
| hub_spoke | 6 | 5 | 0 | 0 | 520×228 | 3.077 |
| linear_pipeline | 6 | 5 | 0 | 0 | 164×688 | 1.744 |
| branching_workflow | 16 | 15 | 0 | 0 | 1124×432 | 1.423 |
| mixed_complexity | 31 | 29 | 0 | 0 | 2469×432 | 0.648 |

## Before/After Notes

### Before (v1)
- `direction` was limited to `"top-down" | "left-right" | "radial"` and only TD was implemented
- `children_order` did not exist; sibling order was implicit from edge array order
- `root_ids` did not exist; roots were always inferred
- No explicit `node.order` or `edge.order`
- No `groups` support
- No cycle validation for strict tree layouts

### After (v2)
- Full direction support: TD, LR, BT, RL (LR/BT/RL via transpose/flip)
- `children_order` is authoritative for sibling sequence
- `root_ids` controls starting points explicitly
- `node.order` and `edge.order` control visual priority
- `groups` declared for future cluster rendering
- Cycle detection for `tree` and `pipeline` strategies
- Mermaid debug export for human inspection

## Exported PNGs / Snapshots

Location: `research-output/iteration-v2-ordered/`
- `hierarchy_tree.png` + `hierarchy_tree-snapshot.json`
- `hub_spoke.png` + `hub_spoke-snapshot.json`
- `linear_pipeline.png` + `linear_pipeline-snapshot.json`
- `branching_workflow.png` + `branching_workflow-snapshot.json`
- `mixed_complexity.png` + `mixed_complexity-snapshot.json`

## Mermaid Debug Export Example

```
graph TD
  root["Deadlock"]
  necessary["Necessary conditions"]
  prevention["Prevention"]
  avoidance["Avoidance"]
  detection["Detection"]
  recovery["Recovery"]
  mutual["Mutual exclusion"]
  hold["Hold and wait"]
  nopreempt["No preemption"]
  circular["Circular wait"]
  root --> necessary
  root --> prevention
  root --> avoidance
  root --> detection
  root --> recovery
  necessary --> mutual
  necessary --> hold
  necessary --> nopreempt
  necessary --> circular
```

## Recommended Default Style

Use `readable_compact` with:
- `strategy: "tree"` for hierarchical data
- `direction: "TD"` for top-down reading
- `sibling_order_policy: "explicit"`
- `rank_policy: "from_root_depth"`
- Explicit `children_order` for every parent with more than one child

## Commit Hash

`2125847` — Add ordered Recall Graph IR layout semantics
