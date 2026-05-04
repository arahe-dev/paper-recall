# Visual Review — Iteration 00 (Baseline)

## Scenario: hierarchy_tree

### First-glance readability
Score: 4/10

### What works
- No overlaps, labels readable at 220%
- Child order preserved left-to-right
- Root is visually obvious at top

### What fails
- Arrow chaos: 5 diagonal arrows from root create a tangled web
- Root→Prevention and Root→Avoidance arrows pass directly over Necessary conditions node
- Necessary conditions subtree is not visually grouped; grandchildren mix with other root children
- Straight-line arrows make it hard to trace parent-child relationships

### Specific visual defects
- Arrow from Deadlock → Detection crosses over Necessary conditions node
- Arrow from Deadlock → Avoidance crosses over Prevention node  
- Arrow from Necessary conditions → Hold and wait is a long vertical line overlapping other edges
- Circular wait is orphaned far below with a very long vertical arrow

### Required fix
- Orthogonal/elbow routing to eliminate diagonal crossings
- Subtree visual grouping or containment

### Pass/fail
FAIL

---

## Scenario: hub_spoke

### First-glance readability
Score: 7/10

### What works
- Central hub obvious
- Children arranged in arc in declared order
- No clipped nodes, clean layout at 300%
- Straight arrows appropriate for radial layout

### What fails
- Slight visual clutter where arrows converge at esp32
- Children could use a bit more separation

### Specific visual defects
- Arrow overlap at esp32 center (minor)
- imu 2 middle finger is quite far from esp32, arrow is long

### Required fix
- Slightly larger hub radius or more child spacing

### Pass/fail
PASS (acceptable, could be better)

---

## Scenario: linear_pipeline

### First-glance readability
Score: 8/10

### What works
- Sequential order obvious
- One-direction flow clear
- Straight vertical arrows perfect for pipeline
- Readable labels at 160%

### What fails
- Last arrow (Board Text Graph → AI review) is slightly angled due to width difference
- Very narrow, lots of empty horizontal space

### Specific visual defects
- Slight arrow angle on final edge
- Excessive whitespace on sides

### Required fix
- Minor: center pipeline or use LR direction for better proportions

### Pass/fail
PASS

---

## Scenario: branching_workflow

### First-glance readability
Score: 5/10

### What works
- Root obvious, no overlaps
- Sub-branch order preserved
- Labels readable at 140%

### What fails
- FLAT layout: all level-2 nodes share same row, destroying subtree grouping
- Validate and Iterate children appear at a lower level, making depth inconsistent
- Project Goal→Validate arrow crosses over Design subtree

### Specific visual defects
- Market analysis and Wireframes are adjacent but not siblings; confusing
- User testing and Performance audit appear disconnected from their parent Validate
- Arrow from Prototype→Iterate crosses the entire diagram (wait, no edge between them)

### Required fix
- More vertical spacing between levels
- Subtree containment or background grouping
- Orthogonal routing for tree edges

### Pass/fail
FAIL

---

## Scenario: mixed_complexity

### First-glance readability
Score: 2/10

### What works
- No overlaps (technically)
- Note subgraph is separate and clear

### What fails
- ULTRA-WIDE third level: ~15 nodes on one row
- Massive arrow crossings: arrows from Engineering→Backend/Frontend/Infrastructure cross over Support/Timeline subtrees
- At 60% zoom, labels are small and hard to read
- Third-level nodes from different parents are interleaved (Backend next to Support)
- No visual grouping of branches
- Arrow from Product Launch→Marketing is a long diagonal crossing everything

### Specific visual defects
- Row of 15+ nodes at y≈middle is unreadable
- API design is far left but parent Backend is in center; arrow is invisible in clutter
- Timeline→Month 1 arrow crosses over Frontend subtree
- Too much horizontal span, not enough vertical depth

### Required fix
- Reduce width by wrapping or stacking subtrees
- Increase vertical spacing significantly
- Orthogonal routing
- Add subtree grouping rectangles
- Consider LR direction or multi-root layout

### Pass/fail
FAIL

---

## Summary

Hard gates: all pass (0 overlaps, 0 degenerate arrows, build OK)
Visual gates: 1/5 pass (linear_pipeline only)

Primary issues:
1. Straight-line arrows create crossing chaos in all tree layouts
2. Global flat-row placement destroys subtree grouping
3. mixed_complexity becomes ultra-wide due to maxChildrenPerRow wrapping
4. Spacing is too tight, making diagrams feel cramped

Next iteration plan:
- Implement orthogonal (elbow) arrow routing for tree edges
- Increase default spacing (vertical, sibling, subtree)
- Add optional subtree background rectangles for grouping
- Keep straight arrows for hub_spoke and pipeline (they work)
