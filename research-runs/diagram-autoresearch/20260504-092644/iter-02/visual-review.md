# Visual Review — Iteration 02 (Bus routing + maxChildrenPerRow=2)

## Scenario: hierarchy_tree

### First-glance readability
Score: 5/10

### What works
- Bus routing creates clean inverted-T for root edges
- No diagonal arrow crossings
- Hub-spoke and pipeline reverted to straight arrows correctly

### What fails
- maxChildrenPerRow=2 causes excessive wrapping; Avoidance ends up between grandchildren
- Subtree grouping still weak
- Prevention is isolated far right
- Circular wait very far down

### Specific visual defects
- Avoidance (root child, row 2) at same y as Mutual exclusion (grandchild)
- Recovery is at bottom row, very far from siblings
- Too much vertical empty space between levels

### Required fix
- Revert maxChildrenPerRow to 3-4
- Add subtree background rectangles for visual grouping

### Pass/fail
FAIL

---

## Scenario: hub_spoke

### First-glance readability
Score: 7/10

### What works
- Straight radial arrows restored
- Clean central hub
- No orthogonal clutter

### What fails
- Minor arrow overlap at esp32 center

### Required fix
- Slightly larger hub radius

### Pass/fail
PASS

---

## Scenario: linear_pipeline

### First-glance readability
Score: 8/10

### What works
- Straight vertical flow
- Sequential order obvious

### What fails
- Last arrow still slightly angled (node width mismatch)
- Excessive empty horizontal space

### Pass/fail
PASS

---

## Scenario: branching_workflow

### First-glance readability
Score: 6/10

### What works
- Bus routing makes Project Goal→children very clean
- Each parent's children have shared horizontal segment
- Sub-branch order preserved

### What fails
- Diagram is VERY tall due to maxChildrenPerRow=2 wrapping
- 5 levels deep instead of 3
- Hard to see overall structure at a glance
- Validate's children (User testing, Performance audit) appear far from Validate

### Required fix
- Revert maxChildrenPerRow to 3-4 to reduce height
- Add subtree backgrounds

### Pass/fail
FAIL

---

## Scenario: mixed_complexity

### First-glance readability
Score: 3/10

### What works
- Zoom improved to 80% (from 60%)
- Note subgraph clear
- Bus routing creates some structure

### What fails
- Still ultra-wide
- Overlapping horizontal segments from many parents create circuit-board clutter
- Many nodes from different subtrees interleaved
- Arrow density is overwhelming

### Required fix
- Wrap roots into 2 columns (maxRootsPerRow)
- Add subtree backgrounds
- Reduce arrow stroke width or use lighter color

### Pass/fail
FAIL

---

## Summary

Hard gates: all pass
Visual gates: 2/5 pass (hub_spoke, linear_pipeline)

Primary issues:
1. maxChildrenPerRow=2 causes excessive height and interleaving
2. No visual grouping of subtrees
3. mixed_complexity width still too large
4. Arrow density overwhelming in complex diagrams

Next iteration plan:
- Revert maxChildrenPerRow to 4
- Add maxRootsPerRow=2 for root wrapping
- Add subtree background rectangles
- Consider lighter arrow color or thinner stroke for dense diagrams
