// @ts-check
/**
 * Iterative evidence runner for the Recall Graph IR <-> Excalidraw pipelines.
 *
 * It drives the real app and Excalidraw export path through Playwright, then
 * writes the artifacts required by goal.txt under research-runs/.
 *
 * Usage:
 *   node scripts/perfect-pipelines.mjs [run-dir] [iter-name]
 */

import { chromium } from "playwright";
import { createServer } from "vite";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "fs";
import { dirname, relative, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const coreScenarioFiles = [
  "hierarchy_tree.json",
  "hub_spoke.json",
  "linear_pipeline.json",
  "branching_workflow.json",
  "mixed_complexity.json",
  "control_system_reduction_6_step.json",
];

const styleNames = [
  "readable_default",
  "readable_compact",
  "readable_spacious",
  "readable_radial",
  "readable_flowchart",
  "readable_block_diagram",
  "readable_control_system",
];

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

const runDir = resolve(
  root,
  process.argv[2] || `research-runs/perfect-pipelines/${timestamp()}`
);
const iterName = process.argv[3] || "iter-01";
const iterDir = resolve(runDir, iterName);
const patchNote = process.env.PATCH_NOTE || "none in this iteration";
const scenarioSuite = process.env.SCENARIO_SUITE || "core";

function graph(title, layout, nodes, edges, childrenOrder) {
  return {
    schema: "recall-graph-ir-v2",
    title,
    layout: {
      style: "readable_compact",
      density: "readable",
      sibling_order_policy: "explicit",
      rank_policy: "from_root_depth",
      ...layout,
    },
    nodes: nodes.map((node, index) => ({ order: index, ...node })),
    edges: edges.map((edge, index) => ({ id: `e${index + 1}`, order: index, ...edge })),
    children_order: childrenOrder,
  };
}

function edgeScenarioInputs() {
  const hubSpokes = Array.from({ length: 10 }, (_, i) => ({
    id: `spoke_${i + 1}`,
    label: `Spoke ${i + 1}`,
  }));

  const deepNodes = Array.from({ length: 10 }, (_, i) => ({
    id: `level_${i + 1}`,
    label: `Level ${i + 1}`,
  }));

  return [
    {
      scenario: "edge_deleted_elements",
      mutation: "appendDeletedElements",
      graph: graph(
        "edge_deleted_elements",
        { strategy: "pipeline", direction: "TD", root_ids: ["input"] },
        [
          { id: "input", label: "Input" },
          { id: "active_step", label: "Active step" },
          { id: "result", label: "Result" },
        ],
        [
          { from: "input", to: "active_step" },
          { from: "active_step", to: "result" },
        ],
        { input: ["active_step"], active_step: ["result"] }
      ),
    },
    {
      scenario: "edge_multiple_disconnected_clusters",
      graph: graph(
        "edge_multiple_disconnected_clusters",
        { strategy: "mixed", direction: "TD", root_ids: ["alpha", "beta", "note"] },
        [
          { id: "alpha", label: "Alpha cluster" },
          { id: "alpha_a", label: "Alpha A" },
          { id: "alpha_b", label: "Alpha B" },
          { id: "beta", label: "Beta cluster" },
          { id: "beta_a", label: "Beta A" },
          { id: "note", label: "Standalone annotation", body: "No incoming or outgoing edge." },
        ],
        [
          { from: "alpha", to: "alpha_a" },
          { from: "alpha", to: "alpha_b" },
          { from: "beta", to: "beta_a" },
        ],
        { alpha: ["alpha_a", "alpha_b"], beta: ["beta_a"] }
      ),
    },
    {
      scenario: "edge_long_labels",
      graph: graph(
        "edge_long_labels",
        { strategy: "tree", direction: "TD", root_ids: ["root"] },
        [
          { id: "root", label: "Extremely long root label that must wrap cleanly without spilling outside its rectangle" },
          { id: "a", label: "Long branch label with multiple operational qualifiers and a deadline" },
          { id: "b", label: "Another long branch label that should remain readable after wrapping" },
          { id: "c", label: "Short label" },
        ],
        [
          { from: "root", to: "a" },
          { from: "root", to: "b" },
          { from: "root", to: "c" },
        ],
        { root: ["a", "b", "c"] }
      ),
    },
    {
      scenario: "edge_tiny_labels_sparse",
      graph: graph(
        "edge_tiny_labels_sparse",
        { strategy: "mixed", direction: "TD", root_ids: ["a", "x"] },
        [
          { id: "a", label: "A" },
          { id: "b", label: "B" },
          { id: "c", label: "C" },
          { id: "x", label: "X" },
          { id: "y", label: "Y" },
        ],
        [
          { from: "a", to: "b" },
          { from: "b", to: "c" },
          { from: "x", to: "y" },
        ],
        { a: ["b"], b: ["c"], x: ["y"] }
      ),
    },
    {
      scenario: "edge_dense_crosslinks_multiple_parents",
      graph: graph(
        "edge_dense_crosslinks_multiple_parents",
        { strategy: "mixed", direction: "TD", root_ids: ["start"] },
        [
          { id: "start", label: "Start" },
          { id: "a", label: "Branch A" },
          { id: "b", label: "Branch B" },
          { id: "c", label: "Branch C" },
          { id: "d", label: "Shared D" },
          { id: "e", label: "Shared E" },
          { id: "f", label: "Finish F" },
          { id: "g", label: "Audit G" },
          { id: "h", label: "Review H" },
        ],
        [
          { from: "start", to: "a" },
          { from: "start", to: "b" },
          { from: "start", to: "c" },
          { from: "a", to: "d" },
          { from: "b", to: "d", label: "shared" },
          { from: "b", to: "e" },
          { from: "c", to: "e", label: "shared" },
          { from: "d", to: "f" },
          { from: "e", to: "f" },
          { from: "a", to: "g", label: "cross-check" },
          { from: "g", to: "h" },
          { from: "h", to: "f", label: "approve" },
        ],
        { start: ["a", "b", "c"], a: ["d", "g"], b: ["d", "e"], c: ["e"], d: ["f"], e: ["f"], g: ["h"], h: ["f"] }
      ),
    },
    {
      scenario: "edge_hub_many_spokes",
      graph: graph(
        "edge_hub_many_spokes",
        { strategy: "hub_spoke", direction: "TD", root_ids: ["hub"] },
        [{ id: "hub", label: "Central hub" }, ...hubSpokes],
        hubSpokes.map((node) => ({ from: "hub", to: node.id })),
        { hub: hubSpokes.map((node) => node.id) }
      ),
    },
    {
      scenario: "edge_deep_tree",
      graph: graph(
        "edge_deep_tree",
        { strategy: "tree", direction: "TD", root_ids: ["level_1"] },
        deepNodes,
        deepNodes.slice(0, -1).map((node, index) => ({ from: node.id, to: deepNodes[index + 1].id })),
        Object.fromEntries(deepNodes.slice(0, -1).map((node, index) => [node.id, [deepNodes[index + 1].id]]))
      ),
    },
    {
      scenario: "edge_feedback_loop_control",
      graph: graph(
        "edge_feedback_loop_control",
        { strategy: "mixed", direction: "LR", root_ids: ["reference"] },
        [
          { id: "reference", label: "Reference R" },
          { id: "sum", label: "Summing junction", body: "+R minus feedback" },
          { id: "controller", label: "Controller Gc" },
          { id: "plant", label: "Plant Gp" },
          { id: "output", label: "Output C" },
          { id: "sensor", label: "Sensor H" },
        ],
        [
          { from: "reference", to: "sum", label: "+" },
          { from: "sum", to: "controller" },
          { from: "controller", to: "plant" },
          { from: "plant", to: "output" },
          { from: "output", to: "sensor", label: "feedback" },
          { from: "sensor", to: "sum", label: "-" },
        ],
        {
          reference: ["sum"],
          sum: ["controller"],
          controller: ["plant"],
          plant: ["output"],
          output: ["sensor"],
          sensor: ["sum"],
        }
      ),
    },
    {
      scenario: "edge_parallel_branches_annotations",
      graph: graph(
        "edge_parallel_branches_annotations",
        { strategy: "mixed", direction: "TD", root_ids: ["request", "annotation"] },
        [
          { id: "request", label: "Incoming request" },
          { id: "fast_path", label: "Fast path" },
          { id: "manual_path", label: "Manual review" },
          { id: "automated_path", label: "Automated review" },
          { id: "merge", label: "Merge decision" },
          { id: "ship", label: "Ship response" },
          { id: "annotation", label: "Annotation", body: "Escalate if confidence is low." },
        ],
        [
          { from: "request", to: "fast_path" },
          { from: "request", to: "manual_path" },
          { from: "request", to: "automated_path" },
          { from: "fast_path", to: "merge" },
          { from: "manual_path", to: "merge" },
          { from: "automated_path", to: "merge" },
          { from: "merge", to: "ship" },
          { from: "annotation", to: "manual_path", label: "note" },
        ],
        {
          request: ["fast_path", "manual_path", "automated_path"],
          fast_path: ["merge"],
          manual_path: ["merge"],
          automated_path: ["merge"],
          merge: ["ship"],
          annotation: ["manual_path"],
        }
      ),
    },
  ];
}

function loadScenarioInputs() {
  if (scenarioSuite === "edge") {
    return edgeScenarioInputs();
  }
  if (scenarioSuite === "styles") {
    const core = coreScenarioFiles.map((name) => {
      const scenario = name.replace(/\.json$/, "");
      const graphPath = resolve(root, "benchmarks", name);
      return { scenario, graph: JSON.parse(readFileSync(graphPath, "utf-8")) };
    });
    return styleNames.flatMap((style) =>
      core.map((item) => {
        const styledGraph = JSON.parse(JSON.stringify(item.graph));
        styledGraph.title = `${style}__${item.scenario}`;
        styledGraph.layout = { ...styledGraph.layout, style };
        return {
          scenario: `${style}__${item.scenario}`,
          graph: styledGraph,
        };
      })
    );
  }
  if (scenarioSuite !== "core") {
    throw new Error(`Unknown scenario suite: ${scenarioSuite}`);
  }
  return coreScenarioFiles.map((name) => {
    const scenario = name.replace(/\.json$/, "");
    const graphPath = resolve(root, "benchmarks", name);
    return {
      scenario,
      graph: JSON.parse(readFileSync(graphPath, "utf-8")),
    };
  });
}

function ensureDir(path) {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function pngDimensions(path) {
  const bytes = readFileSync(path);
  if (
    bytes.length < 24 ||
    bytes[0] !== 0x89 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x4e ||
    bytes[3] !== 0x47
  ) {
    return null;
  }
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function overlapArea(a, b) {
  const left = Math.max(a.x, b.x);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const top = Math.max(a.y, b.y);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  if (right <= left || bottom <= top) return 0;
  return (right - left) * (bottom - top);
}

function pointInsideRect(px, py, rect, inset = 0) {
  return (
    px > rect.x + inset &&
    px < rect.x + rect.width - inset &&
    py > rect.y + inset &&
    py < rect.y + rect.height - inset
  );
}

function arrowAbsPoints(arrow) {
  const points = Array.isArray(arrow.points) ? arrow.points : [[0, 0], [arrow.width || 0, arrow.height || 0]];
  return points.map((p) => ({ x: (arrow.x || 0) + p[0], y: (arrow.y || 0) + p[1] }));
}

function polylineLength(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    total += Math.hypot(dx, dy);
  }
  return total;
}

function countPolylineRectHits(points, rects, excludedIds) {
  const hits = new Set();
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const length = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
    const steps = Math.max(8, Math.ceil(length / 8));
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      const px = a.x + (b.x - a.x) * t;
      const py = a.y + (b.y - a.y) * t;
      for (const rect of rects) {
        if (excludedIds.has(rect.id)) continue;
        if (pointInsideRect(px, py, rect, 3)) hits.add(rect.id);
      }
    }
  }
  return hits;
}

function activeElements(scene) {
  return (scene.elements || []).filter((el) => !el.isDeleted);
}

function nodeShapes(scene) {
  return activeElements(scene).filter(
    (el) =>
      (el.type === "rectangle" || el.type === "ellipse" || el.type === "diamond") &&
      !String(el.id || "").startsWith("bg-")
  );
}

function scoreReadability(scene, pngPath) {
  const active = activeElements(scene);
  const shapes = nodeShapes(scene);
  const arrows = active.filter((el) => el.type === "arrow");
  const texts = active.filter((el) => el.type === "text");
  const defects = [];

  const overlapPairs = [];
  for (let i = 0; i < shapes.length; i++) {
    for (let j = i + 1; j < shapes.length; j++) {
      if (rectsOverlap(shapes[i], shapes[j])) {
        const area = overlapArea(shapes[i], shapes[j]);
        if (area > 1) {
          overlapPairs.push({
            a: shapes[i].id,
            b: shapes[j].id,
            area: Math.round(area),
          });
        }
      }
    }
  }
  if (overlapPairs.length > 0) defects.push(`${overlapPairs.length} node overlap(s)`);

  const degenerateArrows = [];
  const unboundArrows = [];
  const missingArrowheads = [];
  const arrowNodeHits = [];
  const arrowTextHits = [];
  for (const arrow of arrows) {
    const pts = arrowAbsPoints(arrow);
    if (polylineLength(pts) <= 10) degenerateArrows.push(arrow.id);
    if (!arrow.startBinding || !arrow.endBinding) unboundArrows.push(arrow.id);
    if (!arrow.endArrowhead) missingArrowheads.push(arrow.id);

    const excluded = new Set([
      arrow.startBinding?.elementId,
      arrow.endBinding?.elementId,
    ].filter(Boolean));
    const shapeHits = countPolylineRectHits(pts, shapes, excluded);
    for (const id of shapeHits) arrowNodeHits.push({ arrow: arrow.id, shape: id });

    const excludedTextIds = new Set();
    for (const t of texts) {
      if (excluded.has(t.containerId) || t.containerId === arrow.id) {
        excludedTextIds.add(t.id);
      }
    }
    const textHits = countPolylineRectHits(
      pts,
      texts,
      excludedTextIds
    );
    for (const id of textHits) arrowTextHits.push({ arrow: arrow.id, text: id });
  }
  if (degenerateArrows.length > 0) defects.push(`${degenerateArrows.length} degenerate arrow(s)`);
  if (unboundArrows.length > 0) defects.push(`${unboundArrows.length} unbound arrow(s)`);
  if (missingArrowheads.length > 0) defects.push(`${missingArrowheads.length} arrow(s) missing arrowhead`);
  if (arrowNodeHits.length > 0) defects.push(`${arrowNodeHits.length} arrow/node crossing(s)`);
  if (arrowTextHits.length > 0) defects.push(`${arrowTextHits.length} arrow/text crossing(s)`);

  const image = pngDimensions(pngPath);
  if (!image) defects.push("exported PNG dimensions could not be read");

  let score = 1;
  score -= Math.min(0.55, overlapPairs.length * 0.18);
  score -= Math.min(0.5, degenerateArrows.length * 0.18);
  score -= Math.min(0.3, unboundArrows.length * 0.05);
  score -= Math.min(0.3, missingArrowheads.length * 0.05);
  score -= Math.min(0.45, arrowNodeHits.length * 0.04);
  score -= Math.min(0.35, arrowTextHits.length * 0.05);
  score = Math.max(0, Math.min(1, score));

  return {
    score: Number(score.toFixed(2)),
    pass: score >= 0.95,
    defects,
    metrics: {
      activeElementCount: active.length,
      nodeCount: shapes.length,
      textCount: texts.length,
      arrowCount: arrows.length,
      nodeOverlaps: overlapPairs,
      degenerateArrows,
      unboundArrows,
      missingArrowheads,
      arrowNodeHits,
      arrowTextHits,
      pngDimensions: image,
    },
  };
}

function scoreParseFidelity(graph, textGraph) {
  const expectedNodeLabels = graph.nodes.map((n) => normalizeText(n.label));
  const actualNodeLabels = (textGraph.nodes || []).map((n) => normalizeText(n.label));
  const actualLabelCounts = new Map();
  for (const label of actualNodeLabels) {
    actualLabelCounts.set(label, (actualLabelCounts.get(label) || 0) + 1);
  }

  const missingNodes = [];
  for (const label of expectedNodeLabels) {
    const count = actualLabelCounts.get(label) || 0;
    if (count <= 0) missingNodes.push(label);
    else actualLabelCounts.set(label, count - 1);
  }
  const extraNodes = [];
  for (const [label, count] of actualLabelCounts) {
    for (let i = 0; i < count; i++) extraNodes.push(label);
  }

  const missingBodies = [];
  for (const node of graph.nodes) {
    if (!node.body) continue;
    const exportedNode = (textGraph.nodes || []).find((n) => normalizeText(n.label) === normalizeText(node.label));
    if (!exportedNode || !normalizeText(exportedNode.body).includes(normalizeText(node.body))) {
      missingBodies.push(normalizeText(node.label));
    }
  }

  const actualEdgeKeys = new Set(
    (textGraph.edges || []).map((e) => `${normalizeText(e.from_label)}->${normalizeText(e.to_label)}`)
  );
  const actualEdgeLabelKeys = new Set(
    (textGraph.edges || []).map((e) => `${normalizeText(e.from_label)}->${normalizeText(e.to_label)}:${normalizeText(e.label || e.edge_label || "")}`)
  );
  const missingEdges = [];
  const missingEdgeLabels = [];
  for (const edge of graph.edges) {
    const from = graph.nodes.find((n) => n.id === edge.from);
    const to = graph.nodes.find((n) => n.id === edge.to);
    const key = `${normalizeText(from?.label)}->${normalizeText(to?.label)}`;
    if (!actualEdgeKeys.has(key)) missingEdges.push(key);
    if (edge.label && !actualEdgeLabelKeys.has(`${key}:${normalizeText(edge.label)}`)) {
      missingEdgeLabels.push(`${key}:${normalizeText(edge.label)}`);
    }
  }

  const unresolved = textGraph.unresolved_arrows || [];
  const ungrouped = textGraph.ungrouped_text || [];
  const looseEdges = (textGraph.edges || []).filter((e) => e.status !== "bound_visual_relation");

  const defects = [];
  if (missingNodes.length > 0) defects.push(`${missingNodes.length} expected node(s) missing`);
  if (extraNodes.length > 0) defects.push(`${extraNodes.length} unexpected node(s) exported`);
  if (missingBodies.length > 0) defects.push(`${missingBodies.length} node body field(s) missing`);
  if (missingEdges.length > 0) defects.push(`${missingEdges.length} expected edge(s) missing`);
  if (missingEdgeLabels.length > 0) defects.push(`${missingEdgeLabels.length} edge label(s) missing`);
  if (unresolved.length > 0) defects.push(`${unresolved.length} unresolved arrow(s)`);
  if (ungrouped.length > 0) defects.push(`${ungrouped.length} ungrouped text item(s)`);
  if (looseEdges.length > 0) defects.push(`${looseEdges.length} loose inferred edge(s)`);

  let score = 1;
  score -= Math.min(0.5, (missingNodes.length / Math.max(1, graph.nodes.length)) * 0.5);
  score -= Math.min(0.2, (extraNodes.length / Math.max(1, graph.nodes.length)) * 0.2);
  score -= Math.min(0.25, (missingBodies.length / Math.max(1, graph.nodes.filter((n) => n.body).length || 1)) * 0.25);
  score -= Math.min(0.5, (missingEdges.length / Math.max(1, graph.edges.length || 1)) * 0.5);
  score -= Math.min(0.2, (missingEdgeLabels.length / Math.max(1, graph.edges.filter((e) => e.label).length || 1)) * 0.2);
  score -= Math.min(0.35, unresolved.length * 0.12);
  score -= Math.min(0.2, ungrouped.length * 0.05);
  score -= Math.min(0.2, looseEdges.length * 0.04);
  score = Math.max(0, Math.min(1, score));

  return {
    score: Number(score.toFixed(2)),
    pass: score >= 0.99,
    defects,
    metrics: {
      expectedNodeCount: graph.nodes.length,
      actualNodeCount: textGraph.nodes?.length || 0,
      expectedEdgeCount: graph.edges.length,
      actualEdgeCount: textGraph.edges?.length || 0,
      missingNodes,
      extraNodes,
      missingBodies,
      missingEdges,
      missingEdgeLabels,
      unresolvedArrowCount: unresolved.length,
      ungroupedTextCount: ungrouped.length,
      looseInferredEdgeCount: looseEdges.length,
      deletedElementCount: textGraph.summary?.deleted_element_count || 0,
    },
  };
}

function reviewMarkdown(kind, scenario, score, defects, patchApplied, pass) {
  const title = kind === "visual" ? "Visual Review" : "Parse Review";
  const defectTitle = kind === "visual" ? "Visual defects" : "Parse defects";
  const lines = [
    `# ${title}`,
    "",
    `Scenario: ${scenario}`,
    `${kind === "visual" ? "Readability" : "Parse fidelity"} score: ${score.toFixed(2)}`,
    "",
    `${defectTitle}:`,
    defects.length ? defects.map((d) => `- ${d}`) : ["- none detected by automated geometry/export checks"],
    "",
    "Patch applied:",
    `- ${patchApplied}`,
    "",
    `Pass/fail: ${pass ? "PASS" : "FAIL"}`,
    "",
  ];
  return lines.flat().join("\n");
}

function scoresMarkdown(scenario, readability, parse) {
  return [
    "# Scores",
    "",
    `Scenario: ${scenario}`,
    `Readability score: ${readability.score.toFixed(2)}`,
    `Parse fidelity score: ${parse.score.toFixed(2)}`,
    "",
    "Pass/fail:",
    `- Readability: ${readability.pass ? "PASS" : "FAIL"}`,
    `- Parse fidelity: ${parse.pass ? "PASS" : "FAIL"}`,
    "",
  ].join("\n");
}

function scenarioPlanMarkdown(scenario) {
  return [
    "# Iteration Plan",
    "",
    `Scenario: ${scenario}`,
    "",
    "- Generate Recall Graph IR through the app automation API.",
    "- Render/export PNG using Excalidraw's PNG export path.",
    "- Capture the live editable Excalidraw scene JSON.",
    "- Export compact Board Text Graph JSON through the same parser used by the UI.",
    "- Validate readability geometry and parse round-trip fidelity against the source IR.",
    "",
  ].join("\n");
}

function summaryMarkdown(rows) {
  const lines = [
    "# Perfect Pipelines Iteration Summary",
    "",
    "| Scenario | Readability | Parse fidelity | Status |",
    "|---|---:|---:|---|",
  ];
  for (const row of rows) {
    const status = row.readability.pass && row.parse.pass ? "PASS" : "FAIL";
    lines.push(`| ${row.scenario} | ${row.readability.score.toFixed(2)} | ${row.parse.score.toFixed(2)} | ${status} |`);
  }
  lines.push("");
  return lines.join("\n");
}

function contactSheetHtml(rows) {
  const cards = rows.map((row) => {
    const png = relative(iterDir, resolve(iterDir, row.scenario, `${row.scenario}.png`)).replace(/\\/g, "/");
    return `<section>
  <h2>${row.scenario}</h2>
  <p>readability ${row.readability.score.toFixed(2)} | parse ${row.parse.score.toFixed(2)}</p>
  <img src="${png}" alt="${row.scenario}">
</section>`;
  }).join("\n");
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Perfect Pipelines Contact Sheet</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; background: #f7f7f7; color: #111; }
    main { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; }
    section { background: #fff; border: 1px solid #ddd; padding: 16px; }
    img { width: 100%; height: auto; border: 1px solid #ccc; }
    h2 { margin: 0 0 4px; font-size: 18px; }
    p { margin: 0 0 12px; color: #555; }
  </style>
</head>
<body>
  <h1>Perfect Pipelines Contact Sheet</h1>
  <main>
${cards}
  </main>
</body>
</html>
`;
}

async function main() {
  ensureDir(iterDir);
  writeFileSync(resolve(iterDir, "plan.md"), [
    "# Iteration Plan",
    "",
    `Scenario suite: ${scenarioSuite}`,
    "",
    "Run the selected benchmark family through the real app/Excalidraw output path.",
    "Use exported PNGs for direct visual inspection and text graph exports for parse scoring.",
    "",
  ].join("\n"));

  const server = await createServer({
    root,
    configFile: resolve(root, "vite.config.ts"),
    server: { port: 0, host: true },
  });
  await server.listen();
  const address = server.httpServer?.address();
  const port = typeof address === "object" && address ? address.port : 5173;
  const url = `http://localhost:${port}`;
  console.log(`Server running at ${url}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1200 },
    acceptDownloads: true,
  });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForFunction(() => !!(window.__RECALL_API__ && window.__RECALL_API__.loadGraph && window.__RECALL_API__.getTextGraph));

  const rows = [];
  const scenarioInputs = loadScenarioInputs();
  for (const input of scenarioInputs) {
    const { scenario, graph } = input;
    const scenarioDir = resolve(iterDir, scenario);
    ensureDir(scenarioDir);
    writeFileSync(resolve(scenarioDir, `${scenario}.recall-graph-ir.json`), JSON.stringify(graph, null, 2));
    writeFileSync(resolve(scenarioDir, "plan.md"), scenarioPlanMarkdown(scenario));

    console.log(`Rendering ${scenario}...`);
    const loadResult = await page.evaluate(async (data) => {
      // @ts-ignore
      return await window.__RECALL_API__.loadGraph(data);
    }, graph);
    if (!loadResult.success) {
      throw new Error(`${scenario} failed to load: ${loadResult.errors.join("; ")}`);
    }
    await page.waitForTimeout(1000);

    if (input.mutation === "appendDeletedElements") {
      await page.evaluate(() => {
        // @ts-ignore
        const snapshot = window.__RECALL_API__.getSceneSnapshot();
        const now = Date.now();
        const deletedElements = [
          {
            id: "deleted-rect-noise",
            type: "rectangle",
            x: 500,
            y: 500,
            width: 120,
            height: 60,
            angle: 0,
            strokeColor: "#ff0000",
            backgroundColor: "#ffeeee",
            fillStyle: "solid",
            strokeWidth: 1,
            roughness: 0,
            opacity: 100,
            isDeleted: true,
            version: 1,
            versionNonce: 1,
            updated: now,
            link: null,
            locked: false,
          },
          {
            id: "deleted-text-noise",
            type: "text",
            x: 510,
            y: 520,
            width: 100,
            height: 20,
            angle: 0,
            text: "Deleted noise",
            fontSize: 16,
            fontFamily: 2,
            textAlign: "center",
            verticalAlign: "middle",
            strokeColor: "#ff0000",
            backgroundColor: "transparent",
            fillStyle: "solid",
            strokeWidth: 1,
            roughness: 0,
            opacity: 100,
            isDeleted: true,
            version: 1,
            versionNonce: 2,
            updated: now,
            link: null,
            locked: false,
          },
          {
            id: "deleted-arrow-noise",
            type: "arrow",
            x: 520,
            y: 590,
            width: 120,
            height: 0,
            angle: 0,
            strokeColor: "#ff0000",
            backgroundColor: "transparent",
            fillStyle: "solid",
            strokeWidth: 1,
            roughness: 0,
            opacity: 100,
            points: [[0, 0], [120, 0]],
            endArrowhead: "arrow",
            isDeleted: true,
            version: 1,
            versionNonce: 3,
            updated: now,
            link: null,
            locked: false,
          },
        ];
        // @ts-ignore
        window.__RECALL_API__.loadScene({ elements: [...snapshot.elements, ...deletedElements] });
      });
      await page.waitForTimeout(500);
    }

    const pngPath = resolve(scenarioDir, `${scenario}.png`);
    const downloadPromise = page.waitForEvent("download");
    await page.evaluate(async (filename) => {
      // @ts-ignore
      await window.__RECALL_API__.exportPNG(filename);
    }, `${scenario}.png`);
    const download = await downloadPromise;
    await download.saveAs(pngPath);

    const scene = await page.evaluate(() => {
      // @ts-ignore
      return window.__RECALL_API__.getSceneSnapshot();
    });
    const textGraph = await page.evaluate(() => {
      // @ts-ignore
      return window.__RECALL_API__.getTextGraph();
    });

    writeFileSync(resolve(scenarioDir, `${scenario}.excalidraw-scene.json`), JSON.stringify(scene, null, 2));
    writeFileSync(resolve(scenarioDir, `${scenario}.text-graph.json`), JSON.stringify(textGraph, null, 2));

    const readability = scoreReadability(scene, pngPath);
    const parse = scoreParseFidelity(graph, textGraph);
    const validation = {
      scenario,
      thresholds: { readability: 0.95, parseFidelity: 0.99 },
      readability,
      parse,
      pass: readability.pass && parse.pass,
    };
    writeFileSync(resolve(scenarioDir, "validation.json"), JSON.stringify(validation, null, 2));
    writeFileSync(resolve(scenarioDir, "visual-review.md"), reviewMarkdown("visual", scenario, readability.score, readability.defects, patchNote, readability.pass));
    writeFileSync(resolve(scenarioDir, "parse-review.md"), reviewMarkdown("parse", scenario, parse.score, parse.defects, patchNote, parse.pass));
    writeFileSync(resolve(scenarioDir, "scores.md"), scoresMarkdown(scenario, readability, parse));

    rows.push({ scenario, readability, parse });
  }

  writeFileSync(resolve(iterDir, "validation.json"), JSON.stringify({
    thresholds: { readability: 0.95, parseFidelity: 0.99 },
    pass: rows.every((row) => row.readability.pass && row.parse.pass),
    scenarios: rows,
  }, null, 2));
  writeFileSync(resolve(iterDir, "scores.md"), summaryMarkdown(rows));
  writeFileSync(resolve(iterDir, "contact-sheet.html"), contactSheetHtml(rows));

  await browser.close();
  await server.close();
  console.log(`Done. Artifacts: ${iterDir}`);
  console.log(summaryMarkdown(rows));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
