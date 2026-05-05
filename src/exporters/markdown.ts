import { buildBoardTextGraph } from "../boardTextGraph";
import type { LooseElement } from "./types";

function listOrNone(items: string[]): string {
  return items.length > 0 ? items.join("\n") : "(none)";
}

export function serializeTextGraphMarkdown(elements: readonly LooseElement[]): string {
  const graph = buildBoardTextGraph(elements);
  const nodes = graph.nodes.map((node) => {
    const body = node.body ? `\n  ${node.body.replace(/\n/g, "\n  ")}` : "";
    return `- ${node.label}${body}`;
  });
  const edges = graph.edges.map((edge) => `- ${edge.plain_text}`);
  const groups = graph.groups.map((group) => `- ${group.label}: ${group.node_ids.join(", ")}`);
  const annotations = graph.annotations.map((annotation) => `- ${annotation.text}`);
  const unresolved = graph.unresolved_arrows.map((arrow) => `- ${arrow.id}: ${arrow.reason}`);
  const ungrouped = graph.ungrouped_text.map((text) => `- ${text.text}`);

  return `# Board Text Graph

## Summary
- Nodes: ${graph.summary.node_count}
- Edges: ${graph.summary.edge_count}
- Groups: ${graph.summary.group_count}
- Annotations: ${graph.summary.annotation_count}
- Unresolved arrows: ${graph.summary.unresolved_arrow_count}
- Ungrouped text: ${graph.summary.ungrouped_text_count}

## Insights
${graph.plain_text_graph.split("## Graph Insights\n")[1]?.split("\n\n## Nodes")[0] ?? "(none)"}

## Nodes
${listOrNone(nodes)}

## Edges
${listOrNone(edges)}

## Groups
${listOrNone(groups)}

## Annotations
${listOrNone(annotations)}

## Unresolved Arrows
${listOrNone(unresolved)}

## Ungrouped Text
${listOrNone(ungrouped)}
`;
}
