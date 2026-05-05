# AI Context and Exports

## Why Text Graph Export Exists

Screenshots are expensive and ambiguous for AI models. Recall Board exports structured board context so an AI can read the board as text and graph data.

## Text Graph Model

The text graph export contains:

- Nodes from shapes and grouped text.
- Edges from arrows.
- Labels from visible text.
- Confidence scores for inferred relationships.
- Diagnostics for unresolved arrows and ungrouped text.

## Relation Confidence

Bound arrows are treated as stronger visual relations.

Loose arrows are treated as candidate relations because their intent has to be inferred from geometry.

## Deleted Elements

Deleted Excalidraw elements are filtered out of AI context and text graph exports. This prevents old board state from confusing the parse-back path.

## What AI Should Assume

AI consumers should separate visible board facts from interpretation.

The export can say what labels and arrows are visible. It should not be treated as proof that a domain-specific equation, circuit, biological pathway, or legal argument is correct.

## Future Direction

The generic board export path is separate from domain-specific verification. Future solvers can add verified payloads, but the current system is a general diagram and board context pipeline.
