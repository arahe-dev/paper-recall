# Visual Review — Iteration 03 (maxChildrenPerRow=4, maxRootsPerRow=2, subtree backgrounds)

## Scenario: hierarchy_tree

### First-glance readability
Score: 7/10

### What works
- maxChildrenPerRow=4 restored reasonable height (416px)
- Bus routing creates clean inverted-T for root edges
- Subtle subtree background behind single root helps contain the diagram
- No diagonal arrow crossings

### What fails
- Recovery (row-2 root child) still lands near same y as necessary’s grandchildren (mutual, hold, etc.) because vertical spacing is uniform per level
- Subtree background is a single large box; doesn’t visually group individual branches

### Specific visual defects
- Recovery at y≈376 while necessary’s children are also at y≈376 (interleaving)
- Minor horizontal segment overlap between root→recovery and necessary→mutual bus lines

### Required fix
- Use levelHeightMultiplier to push deeper descendants further down, preventing interleaving

### Pass/fail
PASS (marginal)

---

## Scenario: hub_spoke

### First-glance readability
Score: 8/10

### What works
- hubRadius=220 spread spokes nicely; center overlap reduced
- Straight radial arrows restored
- Clean central hub

### What fails
- Slight arrow overlap still visible at hub center for dense labels

### Required fix
- Minor; acceptable

### Pass/fail
PASS

---

## Scenario: linear_pipeline

### First-glance readability
Score: 8/10

### What works
- Straight vertical flow preserved
- Thinner arrows (#333, 1px) reduce visual weight
- Sequential order obvious

### What fails
- Very tall (920px) but narrow; fits viewport when centered

### Pass/fail
PASS

---

## Scenario: branching_workflow

### First-glance readability
Score: 7/10

### What works
- maxChildrenPerRow=4 brought height down to 584px
- Bus routing makes Project Goal→children very clean
- Subtree background groups the whole project

### What fails
- Width is 1517px; still fairly wide
- Iterate (row-2 root child) interleaves vertically with research’s grandchildren (r1, r2)

### Required fix
- levelHeightMultiplier to separate row-2 parent from row-1 grandchildren

### Pass/fail
PASS (marginal)

---

## Scenario: mixed_complexity

### First-glance readability
Score: 4/10

### What works
- maxRootsPerRow=2 correctly placed the two roots in one row
- Subtree backgrounds separate product vs note subtrees
- Thinner arrows slightly reduce density

### What fails
- Width is still 3133px — product subtree dominates
- Overlap resolver created massive gaps:
  - state shifted right by ~178px
  - assets shifted right by ~347px
  - m3 shifted right by ~392px
- Interleaving: timeline’s children (m1,m2,m3) are interleaved among engineering’s grandchildren (ui,state,assets) at y=544
- Arrow density still overwhelming

### Root cause
- product’s 5 children with maxChildrenPerRow=4 produces a 2400px-wide row1 (strategy+engineering+marketing+support)
- timeline sits in row2, centered under row1, so its children land in the middle of the grandchildren row and trigger cascade shifts
- No vertical separation between row1 grandchildren and row2 children

### Required fix
- Reduce maxChildrenPerRow to 2 to cap row widths
- Implement levelHeightMultiplier so deeper levels get extra vertical spacing, eliminating interleaving

### Pass/fail
FAIL

---

## Summary

Hard gates: all pass
Visual gates: 3/5 pass (hierarchy_tree, hub_spoke, linear_pipeline, branching_workflow marginal)

Primary issues:
1. mixed_complexity width still excessive (3133px)
2. Interleaving of wrapped-row descendants causes overlap-resolver cascade gaps
3. levelHeightMultiplier is defined in preset but ignored by engine

Next iteration plan:
- Implement levelHeightMultiplier in assignPositions (multiply verticalSpacing by multiplier^level)
- Reduce maxChildrenPerRow from 4 → 2 to aggressively limit row widths
- Re-render all 5 benchmarks and verify widths drop below 1600px and interleaving is gone
