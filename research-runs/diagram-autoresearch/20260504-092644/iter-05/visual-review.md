# Visual Review — Iteration 05 (dagre layered graph layout)

## Scenario: hierarchy_tree

### First-glance readability
Score: 9/10

### What works
- dagre produces perfect level alignment:
  - L0: root (y=40)
  - L1: necessary, prevention, avoidance, detection, recovery (y=228)
  - L2: mutual, hold, nopreempt, circular (y=416)
- No interleaving whatsoever
- Clean orthogonal edge routing with minimal crossings
- Width 858px fits viewport comfortably
- Subtree background provides subtle grouping

### What fails
- Nothing significant

### Pass/fail
PASS

---

## Scenario: hub_spoke

### First-glance readability
Score: 8/10

### What works
- hub_spoke still uses custom radial layout (not dagre)
- Straight radial arrows clean and unobstructed
- hubRadius=220 spread spokes nicely

### What fails
- Nearly perfect

### Pass/fail
PASS

---

## Scenario: linear_pipeline

### First-glance readability
Score: 9/10

### What works
- dagre places all 6 nodes in a perfect vertical column
- Straight arrows, obvious sequential flow
- Width 196px, height 1020px — narrow and readable
- No crossings

### What fails
- Slightly tall but acceptable for a pipeline

### Pass/fail
PASS

---

## Scenario: branching_workflow

### First-glance readability
Score: 9/10

### What works
- dagre produces clean level alignment:
  - L0: goal (y=40)
  - L1: research, design, prototype, validate, iterate (y=228)
  - L2: r1, r2, d1, d2, p1, p2, v1, v2, i1, i2 (y=416)
- Width 1485px fits within 1600px viewport
- No interleaving
- Edge crossings minimized by dagre

### What fails
- Minor: some L2 nodes are far from their parents (dagre centers all L2 nodes)

### Pass/fail
PASS

---

## Scenario: mixed_complexity

### First-glance readability
Score: 8/10

### What works
- dagre produces perfect level alignment:
  - L0: product, note1 (y=40)
  - L1: strategy, engineering, marketing, support, timeline, note2 (y=228)
  - L2: 15 nodes all at y=416
  - L3: 8 nodes all at y=604
- ZERO interleaving — no node from a deeper level appears between shallower nodes
- Edge routing is clean orthogonal with minimal crossings
- Subtree backgrounds separate product vs note subgraphs

### What fails
- Width 2897px exceeds 1600px viewport (requires ~55% zoom to fit)
- Height 644px is comfortable
- For 31 nodes, some width is unavoidable; minimum possible width is ~1900px

### Required fix
- Optional: add zoom-to-fit logic for wide diagrams
- Otherwise acceptable for a complex 31-node diagram

### Pass/fail
PASS

---

## Summary

Hard gates: all pass
Visual gates: 5/5 pass

### Key improvement
Replacing the custom recursive tree layout with **dagre** completely eliminated the interleaving problem. dagre's Sugiyama-style layered graph layout ensures:
1. All nodes at the same depth share the same y-coordinate
2. Edge crossings are minimized
3. Orthogonal edge routing is computed automatically
4. Disconnected components are placed side-by-side

### Trade-off
Wide diagrams (mixed_complexity) no longer fit in a 1600px viewport without zooming. However, the structure is infinitely more readable than the previous interleaved circuit-board layout.

### Remaining optional improvements
- Auto-zoom to fit wide diagrams in viewport
- Color-code nodes by top-level parent for faster scanning

## Next Steps
- Lock the default preset with dagre-based layout
- Consider adding zoom-to-fit as a follow-up feature
