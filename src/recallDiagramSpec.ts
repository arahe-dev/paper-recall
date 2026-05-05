import type {
  LayoutDensity,
  LayoutDirection,
  LayoutStrategy,
  RecallGraphAnnotation,
  RecallGraphEdge,
  RecallGraphGroup,
  RecallGraphIR,
  RecallGraphNode,
} from "./recallGraphIR";

export const RECALL_DIAGRAM_SPEC_SCHEMA = "recall-diagram-spec-v0" as const;

export const DIAGRAM_TYPES = [
  "concept_map",
  "process_flow",
  "flowchart",
  "hierarchy",
  "hub_spoke",
  "timeline",
  "comparison",
  "cycle",
  "block_diagram",
  "system_architecture",
  "argument_map",
  "cause_effect",
  "study_exam_plan",
  "control_system_summary",
] as const;

export type RecallDiagramType = typeof DIAGRAM_TYPES[number];

export interface RecallDiagramLayoutPreferences {
  strategy?: LayoutStrategy;
  direction?: LayoutDirection;
  density?: LayoutDensity;
  style?: string;
  root_ids?: string[];
  columns?: string[];
  lanes?: string[];
}

export interface RecallDiagramNodeLayoutHint {
  row?: number;
  column?: number;
  lane?: string;
  rank?: number;
  order?: number;
  x?: number;
  y?: number;
}

export interface RecallDiagramNode {
  id: string;
  label: string;
  body?: string;
  kind?: string;
  group_id?: string;
  order?: number;
  rank?: number;
  layout?: RecallDiagramNodeLayoutHint;
  metadata?: Record<string, unknown>;
}

export interface RecallDiagramEdge {
  id?: string;
  from: string;
  to: string;
  label?: string;
  relation?: string;
  direction?: "directed" | "undirected" | "bidirectional";
  order?: number;
  route_hint?: string;
  metadata?: Record<string, unknown>;
}

export interface RecallDiagramGroup {
  id: string;
  label?: string;
  node_ids: string[];
  order?: number;
  metadata?: Record<string, unknown>;
}

export interface RecallDiagramAnnotation {
  id?: string;
  text: string;
  target_ids?: string[];
  kind?: string;
  order?: number;
  metadata?: Record<string, unknown>;
}

export interface RecallDiagramSpecV0 {
  schema: typeof RECALL_DIAGRAM_SPEC_SCHEMA;
  title: string;
  diagram_type: RecallDiagramType;
  summary?: string;
  nodes: RecallDiagramNode[];
  edges: RecallDiagramEdge[];
  groups?: RecallDiagramGroup[];
  annotations?: RecallDiagramAnnotation[];
  layout?: RecallDiagramLayoutPreferences;
  style?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  provenance?: Record<string, unknown>;
  domain_payload?: Record<string, unknown>;
}

export interface RecallDiagramSpecValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface RecallDiagramSpecNormalization extends RecallDiagramSpecValidation {
  spec?: RecallDiagramSpecV0;
}

const DEFAULTS: Record<RecallDiagramType, { strategy: LayoutStrategy; direction: LayoutDirection; style: string }> = {
  concept_map: { strategy: "mixed", direction: "TD", style: "readable_default" },
  process_flow: { strategy: "pipeline", direction: "LR", style: "readable_flowchart" },
  flowchart: { strategy: "mixed", direction: "TD", style: "readable_flowchart" },
  hierarchy: { strategy: "tree", direction: "TD", style: "readable_spacious" },
  hub_spoke: { strategy: "hub_spoke", direction: "TD", style: "readable_radial" },
  timeline: { strategy: "timeline", direction: "LR", style: "readable_timeline" },
  comparison: { strategy: "matrix", direction: "TD", style: "readable_matrix" },
  cycle: { strategy: "cycle", direction: "TD", style: "readable_cycle" },
  block_diagram: { strategy: "block", direction: "LR", style: "readable_block_diagram" },
  system_architecture: { strategy: "mixed", direction: "LR", style: "readable_system_architecture" },
  argument_map: { strategy: "tree", direction: "TD", style: "readable_spacious" },
  cause_effect: { strategy: "mixed", direction: "LR", style: "readable_flowchart" },
  study_exam_plan: { strategy: "mixed", direction: "TD", style: "readable_default" },
  control_system_summary: { strategy: "block", direction: "LR", style: "readable_block_diagram" },
};

const VALID_STRATEGIES: LayoutStrategy[] = [
  "tree",
  "radial",
  "pipeline",
  "hub_spoke",
  "mixed",
  "timeline",
  "matrix",
  "cycle",
  "block",
];
const VALID_DIRECTIONS: LayoutDirection[] = ["TD", "LR", "BT", "RL"];
const VALID_DENSITIES: LayoutDensity[] = ["compact", "readable", "spacious"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function cleanLabel(value: unknown, fallback: string): string {
  const label = asString(value)?.trim().replace(/\s+/g, " ");
  return label && label.length > 0 ? label : fallback;
}

function slugify(value: string, fallback: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
  return slug || fallback;
}

function uniqueId(raw: unknown, fallback: string, seen: Set<string>): string {
  const base = slugify(asString(raw) || fallback, fallback);
  let id = base;
  let suffix = 2;
  while (seen.has(id)) {
    id = `${base}_${suffix}`;
    suffix++;
  }
  seen.add(id);
  return id;
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function integerOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) ? value : undefined;
}

function layoutHintToString(layout: RecallDiagramNodeLayoutHint | undefined): string | undefined {
  if (!layout) return undefined;
  const parts: string[] = [];
  if (typeof layout.row === "number") parts.push(`row:${layout.row}`);
  if (typeof layout.column === "number") parts.push(`column:${layout.column}`);
  if (layout.lane) parts.push(`lane:${layout.lane}`);
  if (typeof layout.x === "number") parts.push(`x:${layout.x}`);
  if (typeof layout.y === "number") parts.push(`y:${layout.y}`);
  return parts.length > 0 ? parts.join(";") : undefined;
}

function normalizeLayoutHint(value: unknown): RecallDiagramNodeLayoutHint | undefined {
  if (!isRecord(value)) return undefined;
  const hint: RecallDiagramNodeLayoutHint = {};
  const row = integerOrUndefined(value.row);
  const column = integerOrUndefined(value.column ?? value.col);
  const rank = integerOrUndefined(value.rank);
  const order = numberOrUndefined(value.order);
  const x = numberOrUndefined(value.x);
  const y = numberOrUndefined(value.y);
  if (row !== undefined) hint.row = row;
  if (column !== undefined) hint.column = column;
  if (rank !== undefined) hint.rank = rank;
  if (order !== undefined) hint.order = order;
  if (x !== undefined) hint.x = x;
  if (y !== undefined) hint.y = y;
  const lane = asString(value.lane);
  if (lane) hint.lane = lane.trim();
  return Object.keys(hint).length > 0 ? hint : undefined;
}

export function normalizeRecallDiagramSpec(data: unknown): RecallDiagramSpecNormalization {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isRecord(data)) {
    return { valid: false, errors: ["Recall Diagram Spec must be an object."], warnings };
  }

  if (data.schema !== RECALL_DIAGRAM_SPEC_SCHEMA) {
    errors.push(`schema must be "${RECALL_DIAGRAM_SPEC_SCHEMA}".`);
  }

  const rawType = asString(data.diagram_type) as RecallDiagramType | undefined;
  const diagramType = rawType && (DIAGRAM_TYPES as readonly string[]).includes(rawType)
    ? rawType
    : undefined;
  if (!diagramType) {
    errors.push(`diagram_type must be one of ${DIAGRAM_TYPES.join(", ")}.`);
  }

  const title = cleanLabel(data.title, "Untitled diagram");
  if (!Array.isArray(data.nodes) || data.nodes.length === 0) {
    errors.push("nodes must be a non-empty array.");
  }
  if (!Array.isArray(data.edges)) {
    errors.push("edges must be an array.");
  }

  if (errors.length > 0 && (!Array.isArray(data.nodes) || !Array.isArray(data.edges) || !diagramType)) {
    return { valid: false, errors, warnings };
  }

  const nodeIdSeen = new Set<string>();
  const nodeIdMap = new Map<string, string>();
  const nodes: RecallDiagramNode[] = [];
  for (let i = 0; i < (data.nodes as unknown[]).length; i++) {
    const raw = (data.nodes as unknown[])[i];
    if (!isRecord(raw)) {
      errors.push(`nodes[${i}] must be an object.`);
      continue;
    }
    const label = cleanLabel(raw.label, `Node ${i + 1}`);
    const originalId = asString(raw.id) || label;
    const id = uniqueId(raw.id, `node_${i + 1}_${slugify(label, "node")}`, nodeIdSeen);
    if (id !== originalId) {
      warnings.push(`nodes[${i}].id normalized from "${originalId}" to "${id}".`);
    }
    nodeIdMap.set(originalId, id);
    nodeIdMap.set(id, id);

    const layout = normalizeLayoutHint(raw.layout);
    const rank = integerOrUndefined(raw.rank) ?? layout?.rank;
    const order = numberOrUndefined(raw.order) ?? layout?.order ?? i;
    const node: RecallDiagramNode = { id, label, order };
    const body = asString(raw.body);
    const kind = asString(raw.kind);
    const groupId = asString(raw.group_id);
    if (body && body.trim()) node.body = body.trim();
    if (kind && kind.trim()) node.kind = kind.trim();
    if (groupId && groupId.trim()) node.group_id = slugify(groupId, groupId.trim());
    if (rank !== undefined) node.rank = rank;
    if (layout) node.layout = layout;
    if (isRecord(raw.metadata)) node.metadata = raw.metadata;
    nodes.push(node);
  }

  const edgeIdSeen = new Set<string>();
  const edges: RecallDiagramEdge[] = [];
  for (let i = 0; i < (data.edges as unknown[]).length; i++) {
    const raw = (data.edges as unknown[])[i];
    if (!isRecord(raw)) {
      errors.push(`edges[${i}] must be an object.`);
      continue;
    }
    const fromRaw = asString(raw.from);
    const toRaw = asString(raw.to);
    const from = fromRaw ? nodeIdMap.get(fromRaw) : undefined;
    const to = toRaw ? nodeIdMap.get(toRaw) : undefined;
    if (!fromRaw || !from) errors.push(`edges[${i}].from references an unknown node.`);
    if (!toRaw || !to) errors.push(`edges[${i}].to references an unknown node.`);
    const id = uniqueId(raw.id, `edge_${i + 1}`, edgeIdSeen);
    const edge: RecallDiagramEdge = {
      id,
      from: from || fromRaw || "",
      to: to || toRaw || "",
      order: numberOrUndefined(raw.order) ?? i,
    };
    const label = asString(raw.label);
    const relation = asString(raw.relation);
    const direction = asString(raw.direction);
    const routeHint = asString(raw.route_hint);
    if (label && label.trim()) edge.label = label.trim();
    if (relation && relation.trim()) edge.relation = relation.trim();
    if (direction === "directed" || direction === "undirected" || direction === "bidirectional") edge.direction = direction;
    if (routeHint && routeHint.trim()) edge.route_hint = routeHint.trim();
    if (isRecord(raw.metadata)) edge.metadata = raw.metadata;
    edges.push(edge);
  }

  const groupIdSeen = new Set<string>();
  const groups: RecallDiagramGroup[] = [];
  if (Array.isArray(data.groups)) {
    for (let i = 0; i < data.groups.length; i++) {
      const raw = data.groups[i];
      if (!isRecord(raw)) {
        errors.push(`groups[${i}] must be an object.`);
        continue;
      }
      const id = uniqueId(raw.id, `group_${i + 1}`, groupIdSeen);
      const rawNodeIds = Array.isArray(raw.node_ids) ? raw.node_ids : [];
      if (!Array.isArray(raw.node_ids)) errors.push(`groups[${i}].node_ids must be an array.`);
      const node_ids = rawNodeIds
        .map((idValue) => asString(idValue))
        .filter((idValue): idValue is string => Boolean(idValue))
        .map((idValue) => nodeIdMap.get(idValue))
        .filter((idValue): idValue is string => Boolean(idValue));
      if (node_ids.length === 0) {
        warnings.push(`groups[${i}] has no valid node_ids after normalization.`);
      }
      const group: RecallDiagramGroup = { id, node_ids, order: numberOrUndefined(raw.order) ?? i };
      const label = asString(raw.label);
      if (label && label.trim()) group.label = label.trim();
      if (isRecord(raw.metadata)) group.metadata = raw.metadata;
      groups.push(group);
    }
  }

  const knownTargetIds = new Set<string>([
    ...nodes.map((node) => node.id),
    ...edges.map((edge) => edge.id || ""),
  ]);
  const annotationIdSeen = new Set<string>();
  const annotations: RecallDiagramAnnotation[] = [];
  if (Array.isArray(data.annotations)) {
    for (let i = 0; i < data.annotations.length; i++) {
      const raw = data.annotations[i];
      if (!isRecord(raw)) {
        errors.push(`annotations[${i}] must be an object.`);
        continue;
      }
      const text = asString(raw.text)?.trim();
      if (!text) {
        errors.push(`annotations[${i}].text must be a non-empty string.`);
        continue;
      }
      const target_ids = Array.isArray(raw.target_ids)
        ? raw.target_ids
            .map((idValue) => asString(idValue))
            .filter((idValue): idValue is string => Boolean(idValue))
            .map((idValue) => nodeIdMap.get(idValue) || idValue)
            .filter((idValue) => knownTargetIds.has(idValue))
        : undefined;
      const annotation: RecallDiagramAnnotation = {
        id: uniqueId(raw.id, `annotation_${i + 1}`, annotationIdSeen),
        text,
        order: numberOrUndefined(raw.order) ?? i,
      };
      const kind = asString(raw.kind);
      if (kind && kind.trim()) annotation.kind = kind.trim();
      if (target_ids && target_ids.length > 0) annotation.target_ids = target_ids;
      if (isRecord(raw.metadata)) annotation.metadata = raw.metadata;
      annotations.push(annotation);
    }
  }

  const defaultLayout = DEFAULTS[diagramType as RecallDiagramType];
  const rawLayout = isRecord(data.layout) ? data.layout : {};
  const layout: RecallDiagramLayoutPreferences = {
    strategy: VALID_STRATEGIES.includes(rawLayout.strategy as LayoutStrategy)
      ? rawLayout.strategy as LayoutStrategy
      : defaultLayout.strategy,
    direction: VALID_DIRECTIONS.includes(rawLayout.direction as LayoutDirection)
      ? rawLayout.direction as LayoutDirection
      : defaultLayout.direction,
    density: VALID_DENSITIES.includes(rawLayout.density as LayoutDensity)
      ? rawLayout.density as LayoutDensity
      : "readable",
    style: asString(rawLayout.style) || defaultLayout.style,
  };
  if (Array.isArray(rawLayout.root_ids)) {
    layout.root_ids = rawLayout.root_ids
      .map((idValue) => asString(idValue))
      .filter((idValue): idValue is string => Boolean(idValue))
      .map((idValue) => nodeIdMap.get(idValue) || idValue)
      .filter((idValue) => nodes.some((node) => node.id === idValue));
  }
  if (Array.isArray(rawLayout.columns)) {
    layout.columns = rawLayout.columns.map((column) => asString(column)).filter((column): column is string => Boolean(column));
  }
  if (Array.isArray(rawLayout.lanes)) {
    layout.lanes = rawLayout.lanes.map((lane) => asString(lane)).filter((lane): lane is string => Boolean(lane));
  }

  const spec: RecallDiagramSpecV0 = {
    schema: RECALL_DIAGRAM_SPEC_SCHEMA,
    title,
    diagram_type: diagramType as RecallDiagramType,
    nodes,
    edges,
    layout,
  };
  const summary = asString(data.summary);
  if (summary && summary.trim()) spec.summary = summary.trim();
  if (groups.length > 0) spec.groups = groups;
  if (annotations.length > 0) spec.annotations = annotations;
  if (isRecord(data.style)) spec.style = data.style;
  if (isRecord(data.metadata)) spec.metadata = data.metadata;
  if (isRecord(data.provenance)) spec.provenance = data.provenance;
  if (isRecord(data.domain_payload)) spec.domain_payload = data.domain_payload;

  return { valid: errors.length === 0, errors, warnings, spec };
}

export function validateRecallDiagramSpec(data: unknown): RecallDiagramSpecValidation {
  const result = normalizeRecallDiagramSpec(data);
  return { valid: result.valid, errors: result.errors, warnings: result.warnings };
}

export function recallDiagramSpecToGraphIR(spec: RecallDiagramSpecV0): RecallGraphIR {
  const normalized = normalizeRecallDiagramSpec(spec);
  if (!normalized.valid || !normalized.spec) {
    throw new Error(`Invalid Recall Diagram Spec: ${normalized.errors.join("; ")}`);
  }
  const safeSpec = normalized.spec;
  const defaults = DEFAULTS[safeSpec.diagram_type];
  const layout = safeSpec.layout || {};
  const root_ids = layout.root_ids && layout.root_ids.length > 0
    ? layout.root_ids
    : inferRootIds(safeSpec.nodes, safeSpec.edges);

  const nodes: RecallGraphNode[] = safeSpec.nodes.map((node, index) => ({
    id: node.id,
    label: node.label,
    ...(node.body ? { body: node.body } : {}),
    kind: node.kind || safeSpec.diagram_type,
    order: node.order ?? index,
    ...(node.rank !== undefined ? { rank: node.rank } : {}),
    ...(node.group_id ? { group_id: node.group_id } : {}),
    ...(layoutHintToString(node.layout) ? { layout_hint: layoutHintToString(node.layout) } : {}),
  }));

  const edges: RecallGraphEdge[] = safeSpec.edges.map((edge, index) => ({
    id: edge.id || `edge_${index + 1}`,
    from: edge.from,
    to: edge.to,
    ...(edge.label ? { label: edge.label } : {}),
    relation: edge.relation || edge.direction || "related",
    order: edge.order ?? index,
    ...(edge.route_hint ? { route_hint: edge.route_hint } : {}),
  }));

  const groups: RecallGraphGroup[] | undefined = safeSpec.groups?.map((group, index) => ({
    id: group.id,
    ...(group.label ? { label: group.label } : {}),
    node_ids: group.node_ids,
    order: group.order ?? index,
  }));

  const annotations: RecallGraphAnnotation[] | undefined = safeSpec.annotations?.map((annotation, index) => ({
    id: annotation.id || `annotation_${index + 1}`,
    text: annotation.text,
    ...(annotation.kind ? { kind: annotation.kind } : {}),
    ...(annotation.target_ids ? { target_ids: annotation.target_ids } : {}),
    order: annotation.order ?? index,
  }));

  return {
    schema: "recall-graph-ir-v2",
    title: safeSpec.title,
    diagram_type: safeSpec.diagram_type,
    layout: {
      style: layout.style || defaults.style,
      strategy: layout.strategy || defaults.strategy,
      direction: layout.direction || defaults.direction,
      density: layout.density || "readable",
      root_ids,
      sibling_order_policy: "explicit",
      rank_policy: nodes.some((node) => node.rank !== undefined) ? "explicit" : "from_root_depth",
    },
    nodes,
    edges,
    children_order: buildChildrenOrder(safeSpec.nodes, safeSpec.edges),
    ...(groups && groups.length > 0 ? { groups } : {}),
    ...(annotations && annotations.length > 0 ? { annotations } : {}),
    metadata: {
      source_schema: safeSpec.schema,
      summary: safeSpec.summary || "",
      provenance: safeSpec.provenance || {},
      domain_payload_present: Boolean(safeSpec.domain_payload),
    },
  };
}

function inferRootIds(nodes: RecallDiagramNode[], edges: RecallDiagramEdge[]): string[] {
  const incoming = new Set(edges.map((edge) => edge.to));
  const roots = nodes.filter((node) => !incoming.has(node.id)).map((node) => node.id);
  return roots.length > 0 ? roots : nodes.length > 0 ? [nodes[0].id] : [];
}

function buildChildrenOrder(nodes: RecallDiagramNode[], edges: RecallDiagramEdge[]): Record<string, string[]> {
  const order = new Map(nodes.map((node, index) => [node.id, node.order ?? index]));
  const children: Record<string, string[]> = {};
  for (const edge of edges) {
    if (!children[edge.from]) children[edge.from] = [];
    if (!children[edge.from].includes(edge.to)) {
      children[edge.from].push(edge.to);
    }
  }
  for (const childList of Object.values(children)) {
    childList.sort((a, b) => {
      const oa = order.get(a) ?? Infinity;
      const ob = order.get(b) ?? Infinity;
      if (oa !== ob) return oa - ob;
      return a.localeCompare(b);
    });
  }
  return children;
}
