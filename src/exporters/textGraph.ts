import { buildBoardTextGraph } from "../boardTextGraph";
import type { LooseElement } from "./types";

export function serializeTextGraph(elements: readonly LooseElement[]): string {
  return JSON.stringify(buildBoardTextGraph(elements), null, 2);
}

export function createTextGraphPrompt(elements: readonly LooseElement[]): string {
  const graph = buildBoardTextGraph(elements);
  const pretty = JSON.stringify(graph, null, 2);
  return `You are reading a compact board text graph.

Do not ask for a screenshot.
Use only the nodes, edges, graph insights, unresolved arrows, and ungrouped text below.

Each node is text found inside a shape or clear standalone text.
Each edge means one node is connected to another by an arrow.
Graph insights are deterministic structural summaries generated from the graph.

Rules:
- Preserve original wording.
- Do not invent missing labels or relationships.
- Say "unclear" when a relation is ambiguous.
- Separate visible graph facts from likely interpretation.
- Domain interpretations are allowed, but mark them as inference.
- Treat bound_visual_relation as stronger than loose_inferred_relation.
- Treat loose_inferred_relation as plausible but worth checking.

Return:
1. One-sentence summary
2. Visible graph facts
3. Likely interpretation
4. Central/root node if identifiable
5. Main branches
6. Sub-branches
7. Important relationships
8. Unclear/unresolved arrows
9. Ungrouped/disconnected text
10. Suggested cleanup
11. What this board seems to communicate

GRAPH:

${graph.plain_text_graph}

## Full JSON
\`\`\`json
${pretty}
\`\`\`
`;
}
