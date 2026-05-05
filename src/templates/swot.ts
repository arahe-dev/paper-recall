import type { RecallGraphIR } from "../recallGraphIR";

export const swotTemplateIr: RecallGraphIR = {
  schema: "recall-graph-ir-v2",
  title: "SWOT Analysis",
  diagram_type: "comparison",
  layout: {
    style: "readable_matrix",
    strategy: "matrix",
    density: "spacious",
  },
  nodes: [
    {
      id: "strengths",
      label: "Internal",
      body: "Helpful: Strengths",
      order: 1,
      layout_hint: "row:0;column:0",
    },
    {
      id: "opportunities",
      label: "External",
      body: "Helpful: Opportunities",
      order: 2,
      layout_hint: "row:0;column:1",
    },
    {
      id: "weaknesses",
      label: "Internal",
      body: "Harmful: Weaknesses",
      order: 3,
      layout_hint: "row:1;column:0",
    },
    {
      id: "threats",
      label: "External",
      body: "Harmful: Threats",
      order: 4,
      layout_hint: "row:1;column:1",
    },
  ],
  edges: [],
};
