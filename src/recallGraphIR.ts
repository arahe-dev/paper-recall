/**
 * Recall Graph IR v2 — Canonical AI-to-Excalidraw generation format
 *
 * Design goals:
 * - Explicit ordering: no accidental array-order semantics
 * - Mermaid-inspired: direction, rank, subgraphs, edge labels
 * - Renderer-agnostic: layout strategy and hints are advisory
 */

export type LayoutStrategy = "tree" | "radial" | "pipeline" | "hub_spoke" | "mixed";
export type LayoutDirection = "TD" | "LR" | "BT" | "RL";
export type LayoutDensity = "compact" | "readable" | "spacious";
export type SiblingOrderPolicy = "explicit" | "source_order" | "auto";
export type RankPolicy = "explicit" | "from_root_depth";

export interface RecallGraphLayout {
  /** Style preset name (e.g. "readable_compact") */
  style: string;
  /** Structural layout strategy */
  strategy?: LayoutStrategy;
  /** Reading direction: Top-Down, Left-Right, Bottom-Top, Right-Left */
  direction?: LayoutDirection;
  /** Density hint */
  density?: LayoutDensity;
  /** Explicit root node IDs. If omitted, roots are inferred from edges. */
  root_ids?: string[];
  /** How sibling order is determined */
  sibling_order_policy?: SiblingOrderPolicy;
  /** How node rank/depth is determined */
  rank_policy?: RankPolicy;
}

export interface RecallGraphNode {
  id: string;
  label: string;
  body?: string;
  kind?: string;
  /** Stable ordering weight. Lower = earlier. */
  order?: number;
  /** Explicit rank/depth. Used when rank_policy is "explicit". */
  rank?: number;
  /** Group / cluster ID */
  group_id?: string;
  /** Free-form layout hint for the renderer */
  layout_hint?: string;
}

export interface RecallGraphEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  /** Semantic relation type */
  relation?: string;
  /** Stable ordering weight. Lower = drawn earlier. */
  order?: number;
  /** Free-form routing hint for the renderer */
  route_hint?: string;
}

export interface RecallGraphGroup {
  id: string;
  label?: string;
  node_ids: string[];
  order?: number;
}

export interface RecallGraphIR {
  schema: "recall-graph-ir-v2";
  title: string;
  layout: RecallGraphLayout;
  nodes: RecallGraphNode[];
  edges: RecallGraphEdge[];
  /** Authoritative sibling order per parent node ID */
  children_order?: Record<string, string[]>;
  /** Visual clusters / subgraphs */
  groups?: RecallGraphGroup[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateRecallGraphIR(data: unknown): ValidationResult {
  const errors: string[] = [];

  if (data === null || typeof data !== "object") {
    return { valid: false, errors: ["Input must be an object."] };
  }

  const obj = data as Record<string, unknown>;

  // schema
  if (obj.schema !== "recall-graph-ir-v2") {
    errors.push(`schema must be "recall-graph-ir-v2", got: ${JSON.stringify(obj.schema)}`);
  }

  // title
  if (typeof obj.title !== "string" || obj.title.trim().length === 0) {
    errors.push("title is required and must be a non-empty string.");
  }

  // layout
  if (obj.layout === null || typeof obj.layout !== "object") {
    errors.push("layout is required and must be an object.");
  } else {
    const layout = obj.layout as Record<string, unknown>;
    if (typeof layout.style !== "string" || layout.style.trim().length === 0) {
      errors.push("layout.style is required and must be a non-empty string.");
    }
    const validStrategies: LayoutStrategy[] = ["tree", "radial", "pipeline", "hub_spoke", "mixed"];
    if (layout.strategy !== undefined && !validStrategies.includes(layout.strategy as LayoutStrategy)) {
      errors.push(`layout.strategy must be one of ${validStrategies.join(", ")}, got: ${layout.strategy}`);
    }
    const validDirections: LayoutDirection[] = ["TD", "LR", "BT", "RL"];
    if (layout.direction !== undefined && !validDirections.includes(layout.direction as LayoutDirection)) {
      errors.push(`layout.direction must be one of ${validDirections.join(", ")}, got: ${layout.direction}`);
    }
    const validDensities: LayoutDensity[] = ["compact", "readable", "spacious"];
    if (layout.density !== undefined && !validDensities.includes(layout.density as LayoutDensity)) {
      errors.push(`layout.density must be one of ${validDensities.join(", ")}, got: ${layout.density}`);
    }
    if (layout.root_ids !== undefined) {
      if (!Array.isArray(layout.root_ids)) {
        errors.push("layout.root_ids must be an array of strings.");
      } else {
        for (const rid of layout.root_ids) {
          if (typeof rid !== "string") {
            errors.push(`layout.root_ids contains non-string: ${JSON.stringify(rid)}`);
          }
        }
      }
    }
    const validSiblingPolicies: SiblingOrderPolicy[] = ["explicit", "source_order", "auto"];
    if (layout.sibling_order_policy !== undefined && !validSiblingPolicies.includes(layout.sibling_order_policy as SiblingOrderPolicy)) {
      errors.push(`layout.sibling_order_policy must be one of ${validSiblingPolicies.join(", ")}, got: ${layout.sibling_order_policy}`);
    }
    const validRankPolicies: RankPolicy[] = ["explicit", "from_root_depth"];
    if (layout.rank_policy !== undefined && !validRankPolicies.includes(layout.rank_policy as RankPolicy)) {
      errors.push(`layout.rank_policy must be one of ${validRankPolicies.join(", ")}, got: ${layout.rank_policy}`);
    }
  }

  const nodeIds = new Set<string>();
  const nodeRanks = new Map<string, number>();

  // nodes
  if (!Array.isArray(obj.nodes)) {
    errors.push("nodes is required and must be an array.");
  } else if (obj.nodes.length === 0) {
    errors.push("nodes array must not be empty.");
  } else {
    for (let i = 0; i < obj.nodes.length; i++) {
      const n = obj.nodes[i];
      if (n === null || typeof n !== "object") {
        errors.push(`nodes[${i}] must be an object.`);
        continue;
      }
      const node = n as Record<string, unknown>;
      if (typeof node.id !== "string" || node.id.trim().length === 0) {
        errors.push(`nodes[${i}].id is required and must be a non-empty string.`);
      } else {
        if (nodeIds.has(node.id)) {
          errors.push(`Duplicate node id: "${node.id}".`);
        }
        nodeIds.add(node.id);
      }
      if (typeof node.label !== "string") {
        errors.push(`nodes[${i}].label is required and must be a string.`);
      }
      if (node.body !== undefined && typeof node.body !== "string") {
        errors.push(`nodes[${i}].body must be a string if provided.`);
      }
      if (node.kind !== undefined && typeof node.kind !== "string") {
        errors.push(`nodes[${i}].kind must be a string if provided.`);
      }
      if (node.order !== undefined && typeof node.order !== "number") {
        errors.push(`nodes[${i}].order must be a number if provided.`);
      }
      if (node.rank !== undefined) {
        if (typeof node.rank !== "number" || !Number.isInteger(node.rank)) {
          errors.push(`nodes[${i}].rank must be an integer if provided.`);
        } else {
          nodeRanks.set(node.id as string, node.rank as number);
        }
      }
      if (node.group_id !== undefined && typeof node.group_id !== "string") {
        errors.push(`nodes[${i}].group_id must be a string if provided.`);
      }
      if (node.layout_hint !== undefined && typeof node.layout_hint !== "string") {
        errors.push(`nodes[${i}].layout_hint must be a string if provided.`);
      }
    }
  }

  // edges
  const edgeIds = new Set<string>();
  if (!Array.isArray(obj.edges)) {
    errors.push("edges is required and must be an array.");
  } else {
    for (let i = 0; i < obj.edges.length; i++) {
      const e = obj.edges[i];
      if (e === null || typeof e !== "object") {
        errors.push(`edges[${i}] must be an object.`);
        continue;
      }
      const edge = e as Record<string, unknown>;
      if (typeof edge.id !== "string" || edge.id.trim().length === 0) {
        errors.push(`edges[${i}].id is required and must be a non-empty string.`);
      } else {
        if (edgeIds.has(edge.id)) {
          errors.push(`Duplicate edge id: "${edge.id}".`);
        }
        edgeIds.add(edge.id);
      }
      if (typeof edge.from !== "string") {
        errors.push(`edges[${i}].from is required and must be a string.`);
      } else if (!nodeIds.has(edge.from)) {
        errors.push(`edges[${i}].from references unknown node id: "${edge.from}".`);
      }
      if (typeof edge.to !== "string") {
        errors.push(`edges[${i}].to is required and must be a string.`);
      } else if (!nodeIds.has(edge.to)) {
        errors.push(`edges[${i}].to references unknown node id: "${edge.to}".`);
      }
      if (edge.label !== undefined && typeof edge.label !== "string") {
        errors.push(`edges[${i}].label must be a string if provided.`);
      }
      if (edge.relation !== undefined && typeof edge.relation !== "string") {
        errors.push(`edges[${i}].relation must be a string if provided.`);
      }
      if (edge.order !== undefined && typeof edge.order !== "number") {
        errors.push(`edges[${i}].order must be a number if provided.`);
      }
      if (edge.route_hint !== undefined && typeof edge.route_hint !== "string") {
        errors.push(`edges[${i}].route_hint must be a string if provided.`);
      }
    }
  }

  // children_order validation
  if (obj.children_order !== undefined) {
    if (typeof obj.children_order !== "object" || obj.children_order === null || Array.isArray(obj.children_order)) {
      errors.push("children_order must be an object mapping parent IDs to arrays of child IDs.");
    } else {
      const co = obj.children_order as Record<string, unknown>;
      for (const [parentId, childList] of Object.entries(co)) {
        if (!nodeIds.has(parentId)) {
          errors.push(`children_order key references unknown node id: "${parentId}".`);
        }
        if (!Array.isArray(childList)) {
          errors.push(`children_order["${parentId}"] must be an array of strings.`);
          continue;
        }
        const seen = new Set<string>();
        for (const cid of childList) {
          if (typeof cid !== "string") {
            errors.push(`children_order["${parentId}"] contains non-string: ${JSON.stringify(cid)}.`);
          } else if (!nodeIds.has(cid)) {
            errors.push(`children_order["${parentId}"] contains unknown node id: "${cid}".`);
          }
          if (seen.has(cid)) {
            errors.push(`children_order["${parentId}"] contains duplicate child id: "${cid}".`);
          }
          seen.add(cid);
        }
      }
    }
  }

  // root_ids must reference existing nodes
  const layout = (obj.layout || {}) as Record<string, unknown>;
  if (Array.isArray(layout.root_ids)) {
    for (const rid of layout.root_ids) {
      if (typeof rid === "string" && !nodeIds.has(rid)) {
        errors.push(`layout.root_ids contains unknown node id: "${rid}".`);
      }
    }
  }

  // groups validation
  if (obj.groups !== undefined) {
    if (!Array.isArray(obj.groups)) {
      errors.push("groups must be an array.");
    } else {
      const groupIds = new Set<string>();
      for (let i = 0; i < obj.groups.length; i++) {
        const g = obj.groups[i];
        if (g === null || typeof g !== "object") {
          errors.push(`groups[${i}] must be an object.`);
          continue;
        }
        const group = g as Record<string, unknown>;
        if (typeof group.id !== "string" || group.id.trim().length === 0) {
          errors.push(`groups[${i}].id is required and must be a non-empty string.`);
        } else {
          if (groupIds.has(group.id)) {
            errors.push(`Duplicate group id: "${group.id}".`);
          }
          groupIds.add(group.id);
        }
        if (!Array.isArray(group.node_ids)) {
          errors.push(`groups[${i}].node_ids is required and must be an array.`);
        } else {
          for (const nid of group.node_ids) {
            if (typeof nid !== "string") {
              errors.push(`groups[${i}].node_ids contains non-string: ${JSON.stringify(nid)}.`);
            } else if (!nodeIds.has(nid)) {
              errors.push(`groups[${i}].node_ids contains unknown node id: "${nid}".`);
            }
          }
        }
        if (group.label !== undefined && typeof group.label !== "string") {
          errors.push(`groups[${i}].label must be a string if provided.`);
        }
        if (group.order !== undefined && typeof group.order !== "number") {
          errors.push(`groups[${i}].order must be a number if provided.`);
        }
      }
    }
  }

  // Cycle check for strict tree layouts
  const strategy = (layout.strategy || "mixed") as LayoutStrategy;
  if (strategy === "tree" || strategy === "pipeline") {
    const adj = new Map<string, string[]>();
    for (const id of nodeIds) adj.set(id, []);
    if (Array.isArray(obj.edges)) {
      for (const e of obj.edges) {
        const edge = e as Record<string, unknown>;
        const from = edge.from as string;
        const to = edge.to as string;
        if (nodeIds.has(from) && nodeIds.has(to)) {
          adj.get(from)!.push(to);
        }
      }
    }
    const visited = new Set<string>();
    const recStack = new Set<string>();
    function hasCycle(nodeId: string): boolean {
      visited.add(nodeId);
      recStack.add(nodeId);
      for (const neighbor of adj.get(nodeId) || []) {
        if (!visited.has(neighbor)) {
          if (hasCycle(neighbor)) return true;
        } else if (recStack.has(neighbor)) {
          return true;
        }
      }
      recStack.delete(nodeId);
      return false;
    }
    for (const id of nodeIds) {
      if (!visited.has(id)) {
        if (hasCycle(id)) {
          errors.push(`Cycle detected in edges, but strategy is "${strategy}" which requires an acyclic graph.`);
          break;
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
