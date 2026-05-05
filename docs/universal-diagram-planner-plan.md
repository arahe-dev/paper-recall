# Universal Recall Diagram Planner Plan

## Research Notes And Sources

This plan is based on local repo inspection plus web research of current diagram formats, layout engines, and structured-output contracts. Key sources:

- Mermaid diagram syntax and layout options: https://mermaid.js.org/intro/syntax-reference.html
- Graphviz DOT language grammar: https://graphviz.org/doc/info/lang.html
- PlantUML sequence-diagram syntax as representative text-to-diagram precedent: https://plantuml.com/sequence-diagram
- Excalidraw export and JSON scene APIs: https://excalidraw-excalidraw.mintlify.app/guides/export
- tldraw shape and store records: https://tldraw.dev/sdk-features/shapes and https://tldraw.dev/sdk-features/store
- draw.io XML source model: https://www.drawio.com/doc/faq/diagram-source-edit
- React Flow node model and handles: https://reactflow.dev/api-reference/types/node and https://reactflow.dev/learn/customization/handles
- ELK layout options: https://eclipse.dev/elk/reference/options.html
- Dagre local dependency in this repo: `package.json`
- JSON Schema specification: https://json-schema.org/specification
- OpenAI Structured Outputs and JSON Schema guidance: https://developers.openai.com/api/docs/guides/structured-outputs
- Local Recall files inspected: `src/recallGraphIR.ts`, `src/layoutEngine.ts`, `src/excalidrawAdapter.ts`, `src/boardTextGraph.ts`, `scripts/perfect-pipelines.mjs`, `package.json`

Important research takeaways:

- Mermaid is strong as human-writable text-to-diagram, but its syntax is diagram-type-specific and can break on reserved words or malformed syntax. It is a useful import/export target, not the safest canonical AI contract.
- DOT/Graphviz has a compact graph grammar with ports, attributes, subgraphs, and clusters. It is excellent inspiration for graph semantics but too text-parser-heavy and too layout-engine-specific to be the primary Recall contract.
- PlantUML proves that text-to-diagram can cover many domains, but its syntax is broad, legacy, and tuned for UML-ish diagrams rather than editable Excalidraw round trips.
- Excalidraw JSON is a render/persistence format with full scene data. It should remain the renderer target, not the primary AI output, because it is too visual, verbose, brittle, and easy for AI to produce invalid geometry.
- tldraw and React Flow are strong precedents for separating semantic records from rendering behavior. React Flow handles are especially relevant for future domain-specific ports.
- draw.io/mxGraph XML is powerful and editable but XML-heavy; it is a poor first AI contract for Recall.
- JSON Schema and structured outputs strongly support using a strict JSON diagram spec with validation, normalization, and repair.

## 1. Executive Summary

We are building a Universal Recall Diagram Planner: a generic AI-to-board and board-to-AI pipeline where a connected AI can answer a user question from almost any field and emit a structured `Recall Diagram Spec`. Recall validates and normalizes that spec, routes it to the right layout strategy, renders it as an editable Excalidraw board, and parses the board back into compact text/graph JSON that an AI can understand without screenshots.

We are explicitly not building a universal domain solver yet. The generic planner can create useful explanatory diagrams across engineering, biology, literature, CS, business, study planning, and related fields, but it cannot guarantee formal correctness for arbitrary control systems, circuits, chemistry, symbolic math, or other rule-heavy domains. Those require future domain plugins that produce or verify a Recall Diagram Spec.

This matters for Recall because the durable contract should not be pixels, screenshots, Mermaid text, or raw Excalidraw JSON. The durable contract should be a compact, validated, AI-friendly semantic diagram spec with stable IDs and round-trip metadata. Excalidraw remains the editable human surface; Recall Diagram Spec becomes the AI/human bridge.

Recommended architecture:

```text
User prompt
-> AI planner prompt
-> Recall Diagram Spec
-> schema validator
-> normalizer/repair
-> diagram-type router
-> layout engine
-> Excalidraw renderer
-> visual validator
-> board text graph parser
-> parse-back verifier
-> artifacts/report
```

## 2. Problem Statement

Recall needs a field-agnostic way to turn AI answers into clean editable diagrams and then turn edited boards back into AI-readable structure.

The exact problem:

- AI-to-human board generation: the AI should produce a compact structured description of nodes, relations, groups, annotations, layout intent, and style intent.
- Human-to-AI parse-back: Recall should parse the editable Excalidraw board back into compact graph/text JSON without screenshot OCR.
- No screenshot dependency: screenshots may be used for visual QA, but the core AI understanding path should use Excalidraw scene data and Recall metadata.
- Field-agnostic generic diagrams: the first system should cover common explanatory diagrams without hardcoding every field's formal semantics.
- Domain solvers as later plugins: when formal correctness matters, a specialized domain IR and solver/verifier should plug in upstream of the generic renderer.

Generic path:

```text
User question
-> AI understands topic
-> AI emits Recall Diagram Spec
-> Recall validates spec
-> Recall renders editable Excalidraw board
-> Recall exports/parses board back into compact text graph
-> AI understands the board from text alone
```

Future deep verified path:

```text
User question
-> domain-specific IR
-> solver/verifier
-> verified Recall Diagram Spec
-> board render
-> parse-back verification
```

The generic system should never claim arbitrary-domain mathematical, scientific, or legal correctness. It should claim only structural validity, visual readability, parse-back fidelity, and fidelity to the AI-emitted spec.

## 3. Requirements

### Functional Requirements

- Accept a user question plus optional AI answer/context.
- Ask the connected AI for a strict `Recall Diagram Spec`.
- Validate the spec against a schema before rendering.
- Normalize IDs, order fields, missing defaults, empty groups, and layout preferences.
- Route by `diagram_type` to a layout strategy.
- Render editable Excalidraw elements with stable metadata.
- Export PNG, Excalidraw JSON, Recall Diagram Spec JSON, Board Text Graph JSON, and validation reports.
- Parse generated boards back into compact AI-readable graph/text form.
- Support selected-region, viewport, whole-board, group, and cluster parse modes.
- Preserve generated metadata while tolerating human edits.
- Flag ambiguity instead of silently inventing certainty.

### Non-Functional Requirements

- Fast for normal diagrams: target under 5 seconds after AI spec is available for small/medium diagrams, under 30 seconds for dense diagrams, excluding model latency.
- Deterministic rendering for the same normalized spec and style preset.
- No package installation during planning; future implementation should prefer existing `dagre` and Excalidraw dependency first.
- Human-editable boards: nodes, labels, groups, arrows, and annotations must remain normal Excalidraw elements.
- Source-control-friendly artifacts: JSON should be stable, sorted, and minimally noisy.
- Minimal vendor lock-in: AI contract should be plain JSON Schema, not a proprietary model-only format.

### Reliability Requirements

- Stable IDs survive render, parse, export, and re-import.
- Generated node/edge metadata must be embedded in Excalidraw `customData`.
- Parser must handle deleted elements and must not treat `isDeleted` elements as active content.
- Generated metadata path is authoritative when still valid.
- Fallback geometric inference path must include confidence scores.
- Visual validation must detect overlaps, label crossings, degenerate arrows, missing arrowheads, unbound arrows, unreadable labels, and off-canvas elements.
- Round-trip checks must compare semantic graph content, not only image appearance.

### Validation Requirements

- Spec validator: structural/schema validity.
- Normalizer validator: canonical IDs, references, diagram type, node count, edge count, group references.
- Render validator: all semantic entities became editable Excalidraw elements.
- Visual readability validator: score target `>= 0.95`.
- Parse-back validator: score target `>= 0.99`.
- Artifact validator: required PNG/JSON/report files exist and are non-empty.

### UX Requirements

- User should be able to ask in natural language.
- AI should be able to choose diagram type, but user can override it.
- Recall should show the rendered board immediately, not a landing page or raw JSON.
- If validation fails, show actionable errors: "3 labels overlap", "edge from X to Y unresolved", "diagram too dense; split suggested".
- The board should remain useful after manual edits.
- Parse-back should offer "whole board", "selection", "viewport", and "group" modes.

### Future Extensibility Requirements

- Domain payload slot for future solvers/verifiers.
- Ports and handles model for circuits, control systems, architecture interfaces, database schemas, and biochemical pathways.
- Diagram-type plugins can add validators and renderers without changing the base schema.
- Versioned schema migration.
- Import/export adapters for Mermaid, DOT, Excalidraw, and maybe draw.io later.

## 4. Architecture Options Considered

### Option A: Use Mermaid As Primary Format

Pros:

- Very AI-friendly for simple diagrams.
- Human-readable text format with wide adoption.
- Supports many diagram families including flowcharts, timelines, block diagrams, architecture diagrams, mindmaps, and more.
- Mermaid now supports layout configuration including Dagre and optional ELK for some diagram types.

Cons:

- Syntax is not one unified data model; each diagram type has its own grammar and edge cases.
- Mermaid docs warn that unknown words, misspellings, and some reserved words can break diagrams.
- Harder to preserve stable IDs, metadata, parse-back provenance, and generated-vs-human-edited state.
- Layout output is not Excalidraw-native editable semantics by default.
- It is text-to-image/DOM oriented, not board-to-AI oriented.

Failure modes:

- AI emits syntactically plausible but invalid Mermaid.
- Reserved labels or special characters break rendering.
- Parsing Mermaid back from edited Excalidraw is not reliable.
- Mermaid output becomes a dead end if the user edits shapes manually.

Implementation complexity:

- Low for initial generation.
- High for robust editable Excalidraw round-trip.

AI friendliness:

- High for simple output.
- Medium for strict, lossless contracts.

Parse-back friendliness:

- Low to medium.

Long-term Recall fit:

- Good as import/export and quick preview.
- Not recommended as canonical format.

### Option B: Use Excalidraw JSON Directly As AI Output

Pros:

- Directly targets the editable board.
- No intermediate renderer required for basic shapes.
- Can encode exact positions, arrows, text, groups, frames, and app state.

Cons:

- Too verbose for AI.
- Easy to generate invalid or visually bad scene geometry.
- Excalidraw scene data includes low-level rendering/persistence details that are not semantic.
- Hard to validate "meaning" beyond element existence.
- Poor portability to other renderers.

Failure modes:

- Broken bindings.
- Degenerate arrows.
- Text not grouped to shapes.
- Missing required element fields.
- Correct-looking but semantically unparseable board.

Implementation complexity:

- Low to produce something.
- Very high to make robust.

AI friendliness:

- Low.

Parse-back friendliness:

- Medium if generated metadata is perfect.
- Low for arbitrary AI-produced scenes.

Long-term Recall fit:

- Good as render target and persistence format.
- Not recommended as canonical AI output.

### Option C: Use Custom Recall Diagram Spec As Canonical AI Contract

Pros:

- Strict JSON Schema contract can be used with structured model outputs.
- Stable IDs, semantic node/edge/group/annotation fields, metadata, provenance, and validation can be first-class.
- Keeps AI output compact and semantic.
- Renderer can choose Excalidraw, Mermaid, SVG, React Flow, or other targets later.
- Parse-back can compare board to the original semantic spec.
- Domain plugins can attach `domain_payload` without polluting the generic schema.

Cons:

- Requires schema, validator, normalizer, renderer, docs, examples, and benchmarks.
- Needs good prompt engineering and repair loop.
- Initial diagram type taxonomy must be carefully constrained.

Failure modes:

- Schema too broad: AI emits vague or inconsistent data.
- Schema too narrow: common diagrams cannot be expressed.
- Renderer overfits generated examples.
- Parser trusts metadata after human edits when it should degrade confidence.

Implementation complexity:

- Medium initially.
- Best long-term control.

AI friendliness:

- High if schema is simple, enum-constrained, and examples are clear.

Parse-back friendliness:

- High because IDs, provenance, generated metadata, and expected graph can be explicit.

Long-term Recall fit:

- Best fit.

Recommendation:

- Use custom Recall Diagram Spec as canonical.

### Option D: Use React Flow / Node-Edge Model As Inspiration

Pros:

- Clear node/edge model.
- Mature conventions for node type, data, position, dimensions, handles, selection, viewport, and interactive graph editing.
- Handles are a strong pattern for future ports.

Cons:

- It is a UI state model, not a knowledge/diagram interchange model.
- Not designed for Excalidraw scene metadata or rough hand-drawn editing.
- React Flow-specific fields should not leak into the AI contract.

Failure modes:

- Overfitting Recall to a React Flow runtime that is not the actual board.
- Too much focus on node positions rather than semantic relationships.

Implementation complexity:

- Medium if adopted directly.
- Low if used as inspiration.

AI friendliness:

- Medium.

Parse-back friendliness:

- Medium to high if handles/ports are adapted.

Long-term Recall fit:

- Good inspiration, not canonical.

### Option E: Use DOT/Graphviz-Like Structure As Inspiration

Pros:

- Compact graph model.
- Supports directed graphs, attributes, subgraphs, clusters, and ports.
- Strong precedent for layout-oriented graph interchange.
- Graphviz grammar clearly separates graph, node, edge, attributes, and subgraph.

Cons:

- Text grammar is less safe for AI than strict JSON.
- DOT attributes can become arbitrary strings with weak validation.
- Not enough for timelines, matrices, annotations, swimlanes, and domain payloads without conventions.

Failure modes:

- AI emits invalid DOT.
- Semantic details become ad hoc attributes.
- Parse-back to editable Excalidraw semantics remains hard.

Implementation complexity:

- Medium.

AI friendliness:

- Medium.

Parse-back friendliness:

- Medium.

Long-term Recall fit:

- Excellent inspiration for groups/clusters/ports, but not canonical.

## 5. Proposed Architecture

Pipeline:

```text
User prompt
-> AI planner prompt
-> Recall Diagram Spec
-> schema validator
-> normalizer/repair
-> diagram-type router
-> layout engine
-> Excalidraw renderer
-> visual validator
-> board text graph parser
-> parse-back verifier
-> artifact/report output
```

Components:

- AI planner prompt: asks for a strict Recall Diagram Spec, not Excalidraw JSON and not Mermaid.
- Schema validator: checks JSON Schema and semantic rules.
- Normalizer: canonicalizes IDs, ordering, defaults, missing optional fields, group membership, layout hints.
- Repair loop: sends validation errors back to AI or applies safe deterministic repair.
- Diagram-type router: selects layout strategy and renderer behavior.
- Internal graph model: normalized, label-measured, type-aware graph.
- Layout engine: uses Dagre for layered DAG-ish flows, custom radial/grid/timeline/cycle layouts for specialized generic types, and later optional ELK.
- Excalidraw renderer: converts positioned graph to elements with `customData` metadata.
- Visual validator: checks geometry and exported PNG.
- Board text graph parser: reads Excalidraw scene data, not screenshots.
- Parse-back verifier: compares parsed board graph against normalized spec.
- Artifact/report output: writes PNG, Excalidraw JSON, spec JSON, text graph JSON, validation JSON, scores, and contact sheet.

Design rule:

- The AI owns topic understanding.
- Recall owns diagram contract, rendering, editability, and parse-back.
- Domain plugins own formal correctness when required.

## 6. Recall Diagram Spec v0

### TypeScript Interface

```ts
export type RecallDiagramType =
  | "concept_map"
  | "process_flow"
  | "flowchart"
  | "hierarchy"
  | "hub_spoke"
  | "timeline"
  | "comparison"
  | "cycle"
  | "block_diagram"
  | "system_architecture"
  | "argument_map"
  | "cause_effect"
  | "study_flow"
  | "control_system_summary";

export type RecallLayoutStrategy =
  | "auto"
  | "dagre_layered"
  | "radial"
  | "grid"
  | "matrix"
  | "timeline"
  | "cycle"
  | "swimlane"
  | "block";

export type RecallDirection = "TD" | "LR" | "BT" | "RL";

export interface RecallDiagramSpecV0 {
  schema: "recall-diagram-spec-v0";
  title: string;
  diagram_type: RecallDiagramType;
  summary?: string;
  nodes: RecallDiagramNode[];
  edges?: RecallDiagramEdge[];
  groups?: RecallDiagramGroup[];
  annotations?: RecallDiagramAnnotation[];
  layout?: RecallDiagramLayout;
  style?: RecallDiagramStyle;
  metadata?: RecallDiagramMetadata;
  provenance?: RecallDiagramProvenance;
  domain_payload?: RecallDomainPayload;
}

export interface RecallDiagramNode {
  id: string;
  label: string;
  body?: string;
  kind?: string;
  role?: string;
  order?: number;
  rank?: number;
  lane_id?: string;
  group_id?: string;
  size_hint?: "small" | "medium" | "large" | "wide" | "tall";
  shape_hint?: "rectangle" | "rounded_rectangle" | "ellipse" | "diamond" | "pill" | "dot";
  icon_hint?: string;
  emphasis?: "normal" | "primary" | "secondary" | "warning" | "success" | "muted";
  metadata?: Record<string, unknown>;
}

export interface RecallDiagramEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  relation?: string;
  direction?: "directed" | "undirected" | "bidirectional";
  order?: number;
  from_port?: string;
  to_port?: string;
  route_hint?: "auto" | "straight" | "orthogonal" | "arc" | "feedback" | "avoid_labels";
  emphasis?: "normal" | "primary" | "secondary" | "warning" | "success" | "muted";
  metadata?: Record<string, unknown>;
}

export interface RecallDiagramGroup {
  id: string;
  label?: string;
  node_ids: string[];
  kind?: "cluster" | "lane" | "phase" | "boundary" | "module";
  order?: number;
  parent_group_id?: string;
  collapsed?: boolean;
  metadata?: Record<string, unknown>;
}

export interface RecallDiagramAnnotation {
  id: string;
  text: string;
  target_ids?: string[];
  kind?: "note" | "caption" | "warning" | "formula" | "source" | "assumption";
  order?: number;
  placement_hint?: "top" | "bottom" | "left" | "right" | "near_target" | "sidebar";
  parse_semantic?: boolean;
  metadata?: Record<string, unknown>;
}

export interface RecallDiagramLayout {
  strategy?: RecallLayoutStrategy;
  direction?: RecallDirection;
  density?: "compact" | "readable" | "spacious";
  root_ids?: string[];
  lane_order?: string[];
  group_order?: string[];
  manual_hints?: Record<string, { x?: number; y?: number; rank?: number; lane_id?: string }>;
  fit_to_viewport?: boolean;
  max_width?: number;
  max_height?: number;
}

export interface RecallDiagramStyle {
  preset?: string;
  tone?: "neutral" | "technical" | "study" | "business" | "scientific" | "literary";
  color_by?: "none" | "group" | "kind" | "rank" | "emphasis";
  handwriting?: boolean;
  show_group_backgrounds?: boolean;
}

export interface RecallDiagramMetadata {
  created_at?: string;
  source?: "ai" | "user" | "import" | "plugin";
  locale?: string;
  tags?: string[];
  expected_complexity?: "small" | "medium" | "large";
}

export interface RecallDiagramProvenance {
  prompt_id?: string;
  model?: string;
  planner_version?: string;
  source_text_excerpt?: string;
}

export interface RecallDomainPayload {
  domain: string;
  schema: string;
  data: unknown;
  verifier?: string;
  verified?: boolean;
}
```

### JSON Example

```json
{
  "schema": "recall-diagram-spec-v0",
  "title": "Database Replication Flow",
  "diagram_type": "system_architecture",
  "summary": "Primary database streams writes to replicas through a log shipper.",
  "nodes": [
    { "id": "client", "label": "Client", "kind": "actor", "order": 0 },
    { "id": "api", "label": "API service", "kind": "service", "order": 1 },
    { "id": "primary_db", "label": "Primary DB", "kind": "database", "order": 2, "group_id": "data" },
    { "id": "replica_a", "label": "Replica A", "kind": "database", "order": 3, "group_id": "data" },
    { "id": "replica_b", "label": "Replica B", "kind": "database", "order": 4, "group_id": "data" }
  ],
  "edges": [
    { "id": "e1", "from": "client", "to": "api", "label": "request" },
    { "id": "e2", "from": "api", "to": "primary_db", "label": "write" },
    { "id": "e3", "from": "primary_db", "to": "replica_a", "label": "replication log" },
    { "id": "e4", "from": "primary_db", "to": "replica_b", "label": "replication log" }
  ],
  "groups": [
    { "id": "data", "label": "Data tier", "node_ids": ["primary_db", "replica_a", "replica_b"], "kind": "boundary" }
  ],
  "annotations": [
    { "id": "a1", "text": "Replicas can lag behind the primary.", "target_ids": ["replica_a", "replica_b"], "kind": "note" }
  ],
  "layout": {
    "strategy": "dagre_layered",
    "direction": "LR",
    "density": "readable",
    "root_ids": ["client"],
    "fit_to_viewport": true
  },
  "style": {
    "preset": "readable_default",
    "tone": "technical",
    "color_by": "kind",
    "show_group_backgrounds": true
  },
  "metadata": {
    "source": "ai",
    "expected_complexity": "small",
    "tags": ["database", "replication"]
  }
}
```

### Validation Rules

- `schema` must equal `recall-diagram-spec-v0`.
- `title` must be a non-empty string.
- `diagram_type` must be an allowed enum.
- `nodes` must contain 1 to a configured maximum, initially 80.
- Every node ID must be unique, stable, lowercase-friendly, and non-empty.
- Every edge ID must be unique.
- Edge `from` and `to` must reference existing nodes.
- Groups must reference existing nodes.
- Annotations must reference existing nodes, edges, or groups if `target_ids` are supplied.
- `diagram_type` may restrict node/edge patterns. Example: `timeline` needs sortable events; `comparison` needs rows/columns or group axes.
- `domain_payload` is allowed but ignored by generic validation except for shape and namespace checks.
- Unknown top-level keys should fail in strict mode.

### Normalization Rules

- Trim labels and bodies.
- Collapse internal whitespace in labels.
- Convert missing `edges`/`groups`/`annotations` to empty arrays.
- Generate IDs only when an import adapter omitted them; AI-generated specs should provide IDs.
- Sort nodes, edges, groups, and annotations by `order`, then ID.
- Infer `layout.strategy` from `diagram_type` if omitted.
- Infer `layout.direction` from diagram type: `LR` for process/system/block diagrams, `TD` for hierarchy/study flows, horizontal for timelines.
- Remove empty groups.
- Deduplicate repeated edges unless explicitly marked as parallel.
- Degrade invalid style hints to defaults with warnings.

### ID Rules

- IDs should match `^[a-z][a-z0-9_:-]{1,63}$`.
- IDs should be stable semantic slugs, not random UUIDs, when produced by AI.
- Renderer-created Excalidraw IDs should include source IDs in `customData`, not rely only on string prefixes.
- If labels change after human edit, source IDs stay stable but parse confidence may degrade.

### Edge Rules

- Directed edges default to `directed`.
- Undirected edges render without arrowheads.
- Bidirectional edges render with arrowheads on both ends.
- Self-loops are allowed only for supported diagram types and require special routing.
- Edge labels must be short. Long explanations belong in annotations.
- Edge ports are optional in generic diagrams but required by future port-based domain plugins.

### Group Rules

- Groups represent semantic clusters, lanes, phases, boundaries, or modules.
- Groups must not be required for basic parse-back.
- A node may have one primary `group_id`; nested groups use `parent_group_id`.
- Renderer should use background bands or boundaries, not opaque containers that obscure nodes.

### Annotation Rules

- Annotations are visible explanatory text.
- `parse_semantic: false` means the parser should not turn the annotation into a graph node.
- Formula/caption/source annotations should default to non-semantic.
- Notes attached to nodes may be exported as annotation records in Board Text Graph.

## 7. Diagram Type Taxonomy

### concept_map

- Use when: explaining relationships between concepts.
- Semantics: nodes are concepts; edges are labeled relationships.
- Layout: `dagre_layered`, radial for central concept, or force-like mixed layout later.
- Renderer: rounded rectangles, labeled arrows, optional clusters.
- Parse-back: preserve relation labels.
- Failure modes: too many cross-links, vague unlabeled edges, dense hairball.

### process_flow

- Use when: steps happen in order, usually with optional branches.
- Semantics: nodes are actions/states; edges are transitions.
- Layout: layered LR or TD.
- Renderer: step boxes, decision diamonds when `kind: decision`.
- Parse-back: ordered path plus branches.
- Failure modes: long step text, implicit branching, missing start/end.

### flowchart

- Use when: process plus decisions/control flow.
- Semantics: start/end/process/decision nodes.
- Layout: Dagre layered.
- Renderer: standard flowchart shapes.
- Parse-back: node kind and branch labels matter.
- Failure modes: unlabeled decision branches, crossed arrows around diamonds.

### hierarchy

- Use when: parent-child structure.
- Semantics: tree or mostly-tree.
- Layout: tree TD or LR.
- Renderer: compact boxes, subtree groups.
- Parse-back: roots, children, depth.
- Failure modes: cycles, multiple parents, huge breadth.

### hub_spoke

- Use when: one central concept with independent facets.
- Semantics: hub plus spokes.
- Layout: radial.
- Renderer: central node larger, spokes evenly distributed.
- Parse-back: central root plus spokes.
- Failure modes: many spokes causing overlap; long spoke labels.

### timeline

- Use when: chronological events, phases, history, plans.
- Semantics: events ordered by time/order; optional dependencies.
- Layout: horizontal or vertical timeline.
- Renderer: line axis, event cards, milestone markers.
- Parse-back: order and dates.
- Failure modes: imprecise dates, too many events, labels colliding on axis.

### comparison

- Use when: comparing entities across criteria.
- Semantics: matrix rows/columns, cell notes.
- Layout: grid/matrix.
- Renderer: table-like Excalidraw rectangles and labels.
- Parse-back: row/column/cell structure.
- Failure modes: treating table cells as independent graph nodes without coordinates.

### cycle

- Use when: repeated loop, biological cycle, lifecycle, feedback cycle.
- Semantics: ordered cycle edges, optional side annotations.
- Layout: circular.
- Renderer: nodes around circle with curved/segmented arrows.
- Parse-back: cycle order.
- Failure modes: first/last overlap, arrow-label collisions, unclear direction.

### block_diagram

- Use when: components transform signals/data/materials.
- Semantics: blocks with directed flows.
- Layout: LR layered/block.
- Renderer: rectangular blocks, ports optional, orthogonal arrows.
- Parse-back: blocks and directed flows.
- Failure modes: confusing block diagrams with flowcharts; missing ports for technical cases.

### system_architecture

- Use when: software/hardware/service components.
- Semantics: components, containers, external actors, data stores, protocols.
- Layout: layered or grouped by tier.
- Renderer: groups/boundaries, service/database shapes, protocol labels.
- Parse-back: components, connections, groups.
- Failure modes: too much detail; unclear direction of data flow.

### argument_map

- Use when: claims, evidence, objections, conclusions.
- Semantics: claim/support/attack/example nodes.
- Layout: TD with conclusion root or LR argument flow.
- Renderer: color/emphasis by relation type.
- Parse-back: support/attack relations.
- Failure modes: AI overstates truth; relation labels missing.

### cause_effect

- Use when: causal chains, fishbone-ish explanations, root cause analysis.
- Semantics: causes lead to effects; confidence optional.
- Layout: layered or fishbone later.
- Renderer: cause clusters feeding effect node.
- Parse-back: causal relations and clusters.
- Failure modes: correlation shown as causation; dense multi-cause graph.

### study_flow

- Use when: study/exam preparation plans.
- Semantics: topics, tasks, checkpoints, dependencies.
- Layout: process flow or timeline.
- Renderer: milestones, tasks, review loops.
- Parse-back: ordered plan and dependencies.
- Failure modes: overpacked schedule; ambiguous dependencies.

### control_system_summary

- Use when: high-level explanation of control-system components only.
- Semantics: generic block diagram, not formal solver output.
- Layout: block.
- Renderer: blocks, summing symbols if generic style supports them.
- Parse-back: blocks/signals only.
- Failure modes: falsely claiming solved transfer functions. Formal reductions must use future domain plugin path, not generic planner.

## 8. Renderer Plan

### Spec To Internal Graph

- Validate `RecallDiagramSpecV0`.
- Normalize IDs and sort order.
- Convert nodes, edges, groups, and annotations into `NormalizedDiagram`.
- Measure labels using deterministic text approximation first; later optionally use browser text measurement.
- Expand shape hints into renderer primitives.
- Attach provenance and expected parse-back metadata.

### Internal Graph To Excalidraw

- Nodes become Excalidraw rectangles/ellipses/diamonds/text with `customData`:
  - `recallSpecSchema`
  - `recallDiagramId`
  - `recallNodeId`
  - `recallLabel`
  - `recallBody`
  - `recallKind`
  - `recallGenerated: true`
- Edges become Excalidraw arrows with bindings and optional label text bound to arrows.
- Groups become background rectangles, frames, or subtle bands with non-semantic metadata.
- Annotations become text/note shapes with target metadata.

### Layout Selection

- `concept_map`: auto between Dagre, radial, mixed.
- `process_flow`, `flowchart`, `system_architecture`, `block_diagram`: Dagre layered.
- `hierarchy`: tree layout.
- `hub_spoke`: radial layout.
- `timeline`: timeline layout.
- `comparison`: grid/matrix layout.
- `cycle`: circular/cycle layout.
- `argument_map`, `cause_effect`: layered with relation-aware styling.

### Node Sizing Rules

- Measure label and body separately.
- Reserve width by diagram type and density.
- Wrap at word boundaries.
- Cap maximum width; if label still too long, expand height.
- Never scale font by viewport width.
- Stable dimensions before layout; hover/selection state must not resize layout.

### Label Wrapping Rules

- Labels should be concise.
- Bodies wrap below labels with smaller visual hierarchy.
- Edge labels should be short; long edge explanations become annotations.
- Long unbreakable tokens should force wider node or reduced font within bounds.

### Edge Routing Rules

- Prefer bound arrows.
- Use orthogonal routes for layered/block/system diagrams.
- Use curved/arc routes only where Excalidraw supports them cleanly or via segmented arrows.
- Reserve edge-label clearance zones.
- Route feedback/back edges outside the main node row.
- Do not let arrows cross node labels, edge labels, captions, or formulas.

### Group/Background Rendering

- Groups render behind nodes.
- Background opacity must not reduce label readability.
- Group labels render outside or at top-left inside padding.
- Parser must ignore generated background rectangles as semantic nodes.

### Annotation Rendering

- Captions and formulas render as text blocks with `recallIgnoreInTextGraph` unless `parse_semantic` is true.
- Notes render near targets with connector if needed.
- Annotation metadata preserves target IDs.

### Viewport Fitting

- Compute full content bounds.
- Add padding.
- Call Excalidraw API to scroll/zoom to content.
- Export should use content bounds, not arbitrary viewport screenshot.

### Editable Element Metadata

- Every generated semantic shape and arrow must carry enough metadata to parse back after reasonable human edits.
- If a human duplicates an element, duplicated metadata should be detected as suspicious and confidence should degrade unless IDs are regenerated.

## 9. Parse-Back Plan

### Generated Metadata Path

- Prefer `customData.recallNodeId`, `recallEdgeId`, `recallGroupId`, and `recallAnnotationId`.
- Verify that element still exists, is not deleted, and has compatible type.
- Verify bound text still matches or record changed label/body.
- Reconstruct nodes, edges, groups, and annotations directly.
- Confidence starts high but drops on duplicate IDs, missing bindings, deleted endpoint, or incompatible shape type.

### Fallback Geometric Inference Path

- Filter deleted elements.
- Identify semantic shapes by type and visible styling.
- Group text to shapes by `containerId`, bound elements, or geometric containment.
- Extract arrows by binding first, then nearest endpoints.
- Infer groups by background rectangles/frames containing nodes.
- Infer annotations by unbound text near nodes/edges or with connector arrows.
- Emit confidence scores and unresolved elements.

### Deleted Element Filtering

- `isDeleted` elements are excluded from active parse.
- Deleted element count is still reported for audit.
- Optional mode can include deleted elements for debugging only.

### Text-To-Shape Grouping

- Priority:
  1. `containerId`
  2. shape `boundElements`
  3. text center inside shape
  4. nearest compatible shape within threshold
- Multiple text blocks in one shape become label/body lines.

### Arrow-To-Node Relation Extraction

- Bound arrow start/end is authoritative.
- Unbound arrow endpoints use nearest shape edge with threshold.
- Direction comes from arrowheads.
- Edge label text bound to the arrow becomes edge label.
- Loose inferred relations are included with lower confidence.

### Groups/Clusters

- Generated groups use metadata.
- Fallback groups use background/frame containment.
- Nested groups allowed but must be reported explicitly.

### Annotations

- Generated annotations use metadata.
- Fallback annotations are unbound text that is not inside a semantic shape and has no arrow binding.
- Annotations can target nearby nodes/edges if confidence is strong.

### Confidence Scores

- Board-level score.
- Node-level confidence.
- Edge-level confidence.
- Annotation-level confidence.
- Explicit reasons for unresolved or low-confidence items.

### Export Modes

- Whole board: all active elements.
- Selection: selected elements plus connected labels/annotations.
- Viewport: elements intersecting current viewport.
- Group/cluster: all elements in a semantic group.
- Since AI context is limited, default parse-back should produce compact graph plus optional detailed appendix.

## 10. Validation And Scoring Plan

### Spec Validator

Checks:

- JSON Schema validity.
- Enum validity.
- Unique IDs.
- Valid references.
- Diagram-type-specific minimum fields.
- Max node/edge limits.
- No unknown top-level keys in strict mode.

### Render Validator

Checks:

- Every spec node maps to one semantic Excalidraw shape.
- Every spec edge maps to one Excalidraw arrow.
- Every group maps to background/frame/band.
- Every annotation maps to visible text/note.
- All generated elements have metadata.

### Visual Readability Validator

Checks:

- Node overlap.
- Text overflow.
- Arrow crossing node text.
- Arrow crossing edge label text.
- Missing arrowheads.
- Degenerate arrows.
- Unbound semantic arrows.
- Labels too small.
- Elements outside export bounds.
- Excessive edge crossings for graph size.

Target:

- Readability score `>= 0.95`.

### Parse-Back Validator

Checks:

- Expected node labels/IDs present.
- Expected edge endpoints present.
- Expected edge labels present.
- Expected groups and annotations present.
- No unresolved arrows.
- No unexpected semantic nodes unless allowed.
- Generated metadata and geometric inference agree where both exist.

Target:

- Parse fidelity score `>= 0.99`.

### Round-Trip Verifier

Process:

```text
spec -> normalize -> render -> Excalidraw scene -> board text graph -> normalized parsed graph -> compare
```

Comparison should be semantic, not pixel-based:

- IDs if generated metadata exists.
- Labels and relation labels.
- Node/edge counts.
- Group membership.
- Annotation targets.
- Diagram type and layout strategy where preserved.

### When Scores Can Be 1.00

Only when:

- No visual defects are detected.
- No parse defects are detected.
- All generated entities are recovered.
- No unresolved arrows.
- No ungrouped semantic text.
- Round-trip comparison is exact for required fields.

### Avoiding Fake Perfect Scores

- Never score against metadata alone. Also validate visible elements exist and are not deleted.
- Randomly remove or alter metadata in adversarial tests to exercise fallback parser.
- Include human-edited boards in benchmarks.
- Use per-defect penalties and defect lists, not only pass booleans.
- Keep screenshots/PNG inspection as secondary evidence, not primary parse data.

## 11. Benchmark Plan

### Core Generic Benchmarks

#### Deadlock Concept Map

- Input prompt: "Explain deadlock in operating systems and show conditions, prevention, avoidance, and detection."
- Expected diagram type: `concept_map`.
- Criteria: central deadlock node, four Coffman conditions, mitigation branches, labeled relations.
- Pass/fail: readability `>= 0.95`, parse `>= 0.99`, all expected concepts recovered.

#### ESP32 IMU Hub

- Input prompt: "Show an ESP32 project with IMU sensor, calibration, filtering, BLE, and data logging."
- Expected diagram type: `hub_spoke` or `system_architecture`.
- Criteria: ESP32 hub, IMU, filter, BLE, storage, power, calibration.
- Pass/fail: hub/spokes readable, no overlaps, all relations recovered.

#### Krebs Cycle

- Input prompt: "Diagram the Krebs cycle at a study-note level."
- Expected diagram type: `cycle`.
- Criteria: cycle direction, major molecules, CO2/NADH/FADH2 annotations.
- Pass/fail: cyclic order parseable; annotations not mistaken for main nodes unless configured.

#### Hamlet Theme Map

- Input prompt: "Map major themes in Hamlet and connect them to characters and motifs."
- Expected diagram type: `concept_map`.
- Criteria: revenge, mortality, madness, corruption, appearance/reality, key characters.
- Pass/fail: labeled thematic relations; no unsupported formal claims required.

#### Database Replication

- Input prompt: "Explain primary-replica database replication."
- Expected diagram type: `system_architecture`.
- Criteria: client, API, primary, replicas, log shipping, read/write paths.
- Pass/fail: groups and directional data flow preserved.

#### Exam Preparation Plan

- Input prompt: "Create a two-week exam preparation plan for calculus."
- Expected diagram type: `study_flow` or `timeline`.
- Criteria: days/phases, topics, practice, review, mock exam.
- Pass/fail: ordered timeline/flow recovered.

#### Mixed Complexity Graph

- Input prompt: "Show a product launch plan with teams, dependencies, risks, and feedback loops."
- Expected diagram type: `process_flow` with groups.
- Criteria: multiple groups, branches, annotations, cross-links.
- Pass/fail: no fake perfect score if dense graph gets unreadable.

### Edge-Case Benchmarks

#### Long Labels

- Input prompt: includes intentionally long node and edge labels.
- Expected diagram type: `hierarchy`.
- Criteria: wrapping works; text stays inside nodes.
- Pass/fail: no overflow/crossing.

#### Dense Graph

- Input prompt: highly connected service dependency graph.
- Expected diagram type: `system_architecture`.
- Criteria: validator may recommend splitting if unreadable.
- Pass/fail: pass only if readable or if system produces a correct "split required" result.

#### Sparse Graph

- Input prompt: disconnected ideas from brainstorming.
- Expected diagram type: `concept_map`.
- Criteria: disconnected clusters preserved.
- Pass/fail: no forced fake edges.

#### Disconnected Clusters

- Input prompt: three unrelated mini-processes.
- Expected diagram type: `process_flow`.
- Criteria: roots/clusters preserved.
- Pass/fail: cluster separation parseable.

#### Cross-Links

- Input prompt: tree with several cross-cutting dependencies.
- Expected diagram type: `mixed` concept/process map.
- Criteria: cross-links routed outside primary tree.
- Pass/fail: no node overlap and cross-links parse correctly.

#### Annotations

- Input prompt: diagram with warnings, assumptions, and formula notes.
- Expected diagram type: any.
- Criteria: semantic vs non-semantic annotations preserved.
- Pass/fail: notes not mistaken for nodes unless `parse_semantic`.

#### Groups

- Input prompt: architecture by frontend/backend/data/security groups.
- Expected diagram type: `system_architecture`.
- Criteria: group membership round-trips.
- Pass/fail: groups parsed and visual backgrounds ignored as nodes.

#### Deleted Elements

- Input prompt: generated board with appended deleted noise elements.
- Expected diagram type: any.
- Criteria: deleted items ignored but counted.
- Pass/fail: active graph unaffected.

#### Loose Arrows

- Input prompt: human-edited board with arrows detached from shapes.
- Expected diagram type: any.
- Criteria: fallback inference with lower confidence.
- Pass/fail: unresolved reported honestly if ambiguity remains.

#### Human-Edited Generated Board

- Input prompt: generated board then manual label move, new node, deleted edge.
- Expected diagram type: any.
- Criteria: parser distinguishes original generated IDs from human changes.
- Pass/fail: confidence and diff report correct.

### Domain-Specific Future Benchmarks

These belong to plugin path, not generic planner correctness:

- Control-system six-board reduction: requires control IR and algebra verification.
- Circuits: requires netlist/equation verification.
- Chemical pathway: requires reaction/entity validation.
- Biological pathway: requires ontology/pathway constraints.
- Database schema: requires relational constraints and cardinality validation.
- Project architecture diagram: may need repo analysis and dependency verification.

For each future domain benchmark:

- Input prompt.
- Domain IR.
- Solver/verifier expected result.
- Generated Recall Diagram Spec.
- Visual and parse-back criteria.
- Domain correctness pass/fail definition.

## 12. Iterative Autoresearch Plan

Loop:

1. Generate N candidate specs from the same user prompt.
2. Validate JSON Schema.
3. Normalize valid candidates.
4. Render each candidate through Excalidraw.
5. Export PNG and Excalidraw JSON.
6. Inspect geometry deterministically.
7. Optionally inspect PNG multimodally for visual issues.
8. Parse board back into Board Text Graph.
9. Score readability and parse fidelity.
10. Patch prompt, schema, normalizer, layout, or renderer based on defect class.
11. Rerun.
12. Stop when thresholds pass across benchmark suite or when a known limitation is documented.

Candidate generation strategy:

- Start with one simple candidate for speed.
- For ambiguous prompts, generate 3 candidates with different diagram types and choose by validator score.
- Keep original prompt, model metadata, normalized spec, and score report.

Stop conditions:

- Core suite all pass readability `>= 0.95` and parse fidelity `>= 0.99`.
- Edge suite all pass or fail with correct "too dense/split required" behavior.
- No new source changes improve score after two iterations.
- Any domain-specific correctness issue is moved out of generic path and into plugin backlog.

## 13. Implementation Phases

### Phase 0: Research And Schema Docs Only

Scope:

- Produce this planning document.
- Do not write feature code.
- Do not modify source files.
- Do not install packages.

Files likely touched:

- `docs/universal-diagram-planner-plan.md`

Acceptance gates:

- Plan covers architecture, schema, renderer, parser, validation, benchmarks, risks.
- Plan clearly separates generic diagrams from domain solvers.

Risks:

- Over-planning without implementation feedback.

Do-not-do:

- Do not implement schema or renderer.
- Do not change current pipelines.

### Phase 1: Spec Schema + Validator + Examples

Scope:

- Add `RecallDiagramSpecV0` TypeScript types.
- Add JSON Schema.
- Add validator and normalizer.
- Add example specs.

Files likely touched:

- `src/recallDiagramSpec.ts`
- `src/recallDiagramSchema.ts`
- `src/recallDiagramValidator.ts`
- `benchmarks/universal/*.json`

Acceptance gates:

- Valid examples pass.
- Invalid examples fail with actionable errors.
- ID/reference/group/annotation rules covered.

Risks:

- Schema too broad.
- AI output too verbose.

Do-not-do:

- Do not add domain solvers.
- Do not render directly from unvalidated JSON.

### Phase 2: Spec -> Existing Recall IR / Renderer Bridge

Scope:

- Map simple diagram specs to existing `RecallGraphIR`.
- Support concept maps, process flows, hierarchy, hub-spoke.
- Preserve metadata through Excalidraw render.

Files likely touched:

- `src/recallDiagramToGraphIR.ts`
- `src/recallGraphIR.ts`
- `src/excalidrawAdapter.ts`
- `src/App.tsx` automation API only if needed.

Acceptance gates:

- Existing renderer can render v0 specs.
- Parse-back recovers IDs/labels/edges.

Risks:

- Existing IR may not cover annotations/groups enough.

Do-not-do:

- Do not bypass existing renderer with raw AI Excalidraw JSON.

### Phase 3: Core Diagram Type Layouts

Scope:

- Add layout strategies for timeline, comparison, cycle, system architecture, block diagram.
- Improve node sizing and edge routing.

Files likely touched:

- `src/layoutEngine.ts`
- `src/stylePresets.ts`
- `src/excalidrawAdapter.ts`
- new layout helper files.

Acceptance gates:

- Core benchmark suite passes.
- Labels readable and stable.

Risks:

- Edge routing complexity.
- Dense diagrams unreadable.

Do-not-do:

- Do not claim formal domain correctness.

### Phase 4: Parse-Back Verifier

Scope:

- Create normalized compare function: spec vs parsed text graph.
- Add generated metadata parser path and fallback confidence reporting.

Files likely touched:

- `src/boardTextGraph.ts`
- `src/recallDiagramParseBack.ts`
- `src/recallDiagramVerifier.ts`

Acceptance gates:

- Parse fidelity `>= 0.99` on generated boards.
- Human-edit tests produce correct diffs/confidence.

Risks:

- Over-trusting metadata.

Do-not-do:

- Do not hide unresolved elements.

### Phase 5: Benchmark Runner And Reports

Scope:

- Add universal benchmark runner.
- Generate PNG, scene JSON, spec JSON, text graph JSON, validation JSON, scores, reports.

Files likely touched:

- `scripts/universal-diagram-benchmarks.mjs`
- `benchmarks/universal/*`
- `research-runs/universal-diagram-planner/*`

Acceptance gates:

- Core and edge benchmark outputs reproducible.
- Report separates generic and future domain suites.

Risks:

- Fake perfect scores if validators are too lenient.

Do-not-do:

- Do not count domain solver tasks as generic passes.

### Phase 6: Style Variants

Scope:

- Add visual style presets by tone and diagram type.
- Keep style secondary to readability.

Files likely touched:

- `src/stylePresets.ts`
- renderer style mapping files.

Acceptance gates:

- Style variants pass same parse-back tests.
- No one-note palettes or unreadable decorative choices.

Risks:

- Style over correctness.

Do-not-do:

- Do not change semantics based on style.

### Phase 7: Human-Drawn Board Adversarial Parser Hardening

Scope:

- Improve fallback parsing for manually drawn boards.
- Add confidence and unresolved reporting.
- Add selection/viewport/group parse modes.

Files likely touched:

- `src/boardTextGraph.ts`
- `src/App.tsx`
- tests/benchmarks for human-edited boards.

Acceptance gates:

- Parser produces honest low-confidence output for ambiguous boards.
- No hallucinated relations.

Risks:

- Human-drawn ambiguity is inherently hard.

Do-not-do:

- Do not promise perfect human-drawn parsing.

### Phase 8: Future Domain Plugin Architecture

Scope:

- Define plugin interface:
  - `domain`
  - `schema`
  - `parseUserPromptToDomainIR`
  - `verifyDomainIR`
  - `domainIRToRecallDiagramSpec`
  - `verifyRenderedParseBack`
- Prototype one domain only after generic system is stable.

Files likely touched:

- `src/domainPlugins/*`
- `src/recallDomainPayload.ts`

Acceptance gates:

- Generic pipeline can ignore unknown domain payloads safely.
- Plugin can add strict validation without modifying generic renderer.

Risks:

- Domain solver scope explosion.

Do-not-do:

- Do not build control-system algebra, circuit solving, or chemistry verification in the generic path.

## 14. File Plan

Likely future files to create:

- `docs/universal-diagram-planner-plan.md`
- `src/recallDiagramSpec.ts`
- `src/recallDiagramSchema.ts`
- `src/recallDiagramValidator.ts`
- `src/recallDiagramNormalizer.ts`
- `src/recallDiagramRouter.ts`
- `src/recallDiagramToGraphIR.ts`
- `src/recallDiagramRenderer.ts`
- `src/recallDiagramVerifier.ts`
- `src/recallDiagramParseBack.ts`
- `src/layouts/timelineLayout.ts`
- `src/layouts/matrixLayout.ts`
- `src/layouts/cycleLayout.ts`
- `src/layouts/blockLayout.ts`
- `benchmarks/universal/*.json`
- `scripts/universal-diagram-benchmarks.mjs`

Likely future files to modify:

- `src/App.tsx` for automation API and UI entry points.
- `src/layoutEngine.ts` for strategy dispatch.
- `src/excalidrawAdapter.ts` for metadata-rich rendering.
- `src/boardTextGraph.ts` for parse-back.
- `src/stylePresets.ts` for diagram-type styles.
- `package.json` only if later phases justify new dependencies. Do not add dependencies in initial implementation.

## 15. Risks And Mitigations

### Overfitting To Generated Boards

Risk:

- Parser only works because metadata is perfect.

Mitigation:

- Add metadata-stripped tests.
- Add human-edited generated board benchmarks.
- Score fallback path separately.

### Human-Drawn Ambiguity

Risk:

- Freehand boards may not have clear bindings or grouping.

Mitigation:

- Use confidence scores.
- Report unresolved elements.
- Offer user correction prompts.

### AI Invalid JSON

Risk:

- Model emits malformed JSON or schema-invalid content.

Mitigation:

- Use structured outputs where available.
- Validate with JSON Schema.
- Repair loop with exact validation errors.
- Keep schema simple and enum-constrained.

### Huge Graphs

Risk:

- Diagram becomes unreadable or slow.

Mitigation:

- Hard node/edge limits.
- Split suggestions.
- Cluster/subgraph summaries.
- "Overview first, expand on demand" workflow.

### Unreadable Dense Diagrams

Risk:

- Technically valid but visually useless board.

Mitigation:

- Visual readability validator.
- Penalize edge crossings and label collisions.
- Auto-split dense graphs into frames/clusters.

### False Parse Confidence

Risk:

- Parser claims relations that are not clearly represented.

Mitigation:

- Confidence reasons.
- Distinguish `bound_visual_relation` from `loose_inferred_relation`.
- Never count loose inferred edges as exact parse fidelity unless explicitly allowed.

### Domain-Specific Correctness

Risk:

- Generic planner draws plausible but wrong formulas, circuits, reactions, or derivations.

Mitigation:

- Mark generic diagrams as explanatory.
- Use `domain_payload.verified` only when a plugin verifies it.
- Do not claim formal correctness in generic path.

### Excalidraw API Limitations

Risk:

- Binding, label, export, or customData behavior may vary by Excalidraw version.

Mitigation:

- Keep adapter isolated.
- Test export/import with current dependency.
- Prefer official APIs like scene elements, app state, export utilities, and JSON serialization.

### Renderer Brittleness

Risk:

- Small layout changes cause overlaps or broken arrows.

Mitigation:

- Deterministic layout tests.
- Geometry validators.
- Benchmark contact sheets.

### Style Over Correctness

Risk:

- Decorative styles reduce readability.

Mitigation:

- Readability gates apply to every style.
- Use restrained default style.
- Style never changes semantic graph.

## 16. Final Recommendation

Recommended architecture:

- Use custom `Recall Diagram Spec v0` as the canonical AI contract.
- Use strict JSON Schema and structured-output-style prompting.
- Use existing Recall/Excalidraw renderer path as the editable human surface.
- Use Mermaid, DOT, React Flow, tldraw, and draw.io as inspirations or import/export adapters, not as the primary contract.
- Keep generic diagrams separate from domain solvers.

First implementation step:

- Phase 1: create `src/recallDiagramSpec.ts`, `src/recallDiagramValidator.ts`, and 5 to 7 example specs under `benchmarks/universal/`. Add no renderer changes until schema validation and examples are stable.

First coding prompt:

```text
Implement Phase 1 only. Add Recall Diagram Spec v0 TypeScript types, a strict validator/normalizer, and example benchmark JSON files. Do not change rendering yet. Do not add dependencies. Include tests or a small script that validates every example and reports actionable errors.
```

What not to build yet:

- Do not build domain solvers.
- Do not make Mermaid canonical.
- Do not ask AI to output raw Excalidraw JSON.
- Do not implement arbitrary image-to-diagram understanding.
- Do not claim arbitrary-domain mathematical correctness.
- Do not optimize for visual style before parse-back correctness.
