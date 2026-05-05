import type { RecallGraphIR } from "../recallGraphIR";

export const kwlTemplateIr: RecallGraphIR = {
  schema: "recall-graph-ir-v2",
  title: "KWL Chart",
  diagram_type: "process_flow",
  layout: {
    style: "readable_flowchart",
    strategy: "pipeline",
    direction: "LR",
    density: "spacious",
    root_ids: ["know"],
    sibling_order_policy: "explicit",
  },
  nodes: [
    {
      id: "know",
      label: "Know",
      body: "Facts, prior knowledge, and assumptions",
      order: 1,
    },
    {
      id: "want_to_know",
      label: "Want to know",
      body: "Questions, gaps, and research targets",
      order: 2,
    },
    {
      id: "learned",
      label: "Learned",
      body: "Findings, answers, and next steps",
      order: 3,
    },
  ],
  edges: [
    { id: "kwl_1", from: "know", to: "want_to_know", label: "ask" },
    { id: "kwl_2", from: "want_to_know", to: "learned", label: "learn" },
  ],
  children_order: {
    know: ["want_to_know"],
    want_to_know: ["learned"],
  },
};
