# Visual Review

Scenario: hierarchy_tree
Readability score: 1.00

Visual defects:
- none detected by automated geometry/export checks

Multimodal inspection:
- Labels are readable at exported scale.
- Root and child levels are visually obvious.
- Arrowheads terminate at the intended target boxes without crossing text.

Patch applied:
- Rendered node bodies, ignored generated subtree backgrounds, parsed arrow-label text, and stopped penalizing narrow-but-legible exported PNGs.

Pass/fail: PASS
