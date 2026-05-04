# Visual Review — Iteration 04 (maxChildrenPerRow=2, levelHeightMultiplier=1.5 capped)

## Scenario: hierarchy_tree

### First-glance readability
Score: 8/10

### What works
- maxChildrenPerRow=2 creates compact 510px width
- levelHeightMultiplier completely eliminates interleaving:
  - mutual/hold (y=436) are 60px below avoidance/detection (y=376)
  - nopreempt/circular (y=664) are 120px below recovery (y=544)
- Bus routing produces clean inverted-T connectors
- Subtree background provides subtle containment
- All nodes fit comfortably within viewport

### What fails
- Minor: 3 rows of root children makes diagram taller (704px) but still well within 1200px viewport

### Pass/fail
PASS

---

## Scenario: hub_spoke

### First-glance readability
Score: 8/10

### What works
- hubRadius=220 spread spokes nicely
- Straight radial arrows clean and unobstructed
- Center hub no longer cluttered

### What fails
- Nearly perfect; no significant defects

### Pass/fail
PASS

---

## Scenario: linear_pipeline

### First-glance readability
Score: 8/10

### What works
- Straight vertical chain, obvious sequential flow
- Height capped at 1160px thanks to spacing cap (max 180px per level)
- Fits within 1200px viewport
- Thinner arrows reduce visual weight

### What fails
- Slightly tall but acceptable for a 6-step pipeline

### Pass/fail
PASS

---

## Scenario: branching_workflow

### First-glance readability
Score: 8/10

### What works
- Width collapsed to 704px (was 1517px in iter-03)
- No interleaving: iterate (y=544) is clearly separated from prototype/validate children (y=604)
- Each branch’s subtree is visually distinct
- Subtree background groups entire project

### What fails
- Height 812px is taller than before but still comfortable

### Pass/fail
PASS

---

## Scenario: mixed_complexity

### First-glance readability
Score: 7/10

### What works
- Width collapsed from 3133px → 1395px (fits 1600px viewport!)
- Height 1040px fits 1200px viewport
- levelHeightMultiplier eliminates all interleaving:
  - engineering’s grandchildren (y=664) are 120px below marketing/support (y=376)
  - timeline’s children (y=772) are well below backend/frontend children
  - auth/assets/deploy/monitor (y=892) are cleanly separated from upper levels
- maxChildrenPerRow=2 forces sensible wrapping at every wide parent (engineering, marketing, support, backend, frontend, timeline)
- Subtree backgrounds clearly separate product vs note areas
- Thinner arrows reduce clutter in dense areas

### What fails
- Still dense; 31 nodes in 1395x1040 is a lot of information
- Some arrows span large vertical distances (e.g., timeline→m3)
- Without color coding, distinct teams (strategy, engineering, marketing, support) are not immediately distinguishable

### Required fix
- Optional: node color coding by top-level parent could improve scannability
- Otherwise acceptable for a complex diagram

### Pass/fail
PASS

---

## Summary

Hard gates: all pass
Visual gates: 5/5 pass

All benchmarks now:
- Fit within 1600x1200 viewport (width ≤ 1395, height ≤ 1160)
- Have zero interleaving between wrapped rows and descendant levels
- Use bus orthogonal routing for tree/mixed strategies
- Use straight arrows for hub_spoke and pipeline
- Include subtree background rectangles for visual grouping
- Have 0 degenerate arrows and 0 overlaps (verified by build + layout engine)

## Next Steps
- Lock the default `readable_compact` preset as the final default.
- Optionally run Phase 2 style variants (readable_spacious, readable_dense, etc.) against these 5 benchmarks to see if any variant outperforms the default.
- If variants are not required, commit final changes and write up the autoresearch report.
