/**
 * Recall Graph IR - Canonical AI-to-Excalidraw generation format
 */

export interface RecallGraphNode {
  id: string;
  label: string;
  body?: string;
  kind?: string;
}

export interface RecallGraphEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  kind?: string;
}

export interface RecallGraphLayout {
  style: string;
  direction?: "top-down" | "left-right" | "radial";
}

export interface RecallGraphIR {
  schema: "recall-graph-ir-v1";
  title: string;
  layout: RecallGraphLayout;
  nodes: RecallGraphNode[];
  edges: RecallGraphEdge[];
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
  if (obj.schema !== "recall-graph-ir-v1") {
    errors.push(`schema must be "recall-graph-ir-v1", got: ${JSON.stringify(obj.schema)}`);
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
    if (layout.direction !== undefined) {
      const validDirections = ["top-down", "left-right", "radial"];
      if (!validDirections.includes(layout.direction as string)) {
        errors.push(`layout.direction must be one of ${validDirections.join(", ")}, got: ${layout.direction}`);
      }
    }
  }

  // nodes
  if (!Array.isArray(obj.nodes)) {
    errors.push("nodes is required and must be an array.");
  } else if (obj.nodes.length === 0) {
    errors.push("nodes array must not be empty.");
  } else {
    const nodeIds = new Set<string>();
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
    }

    // edges
    if (!Array.isArray(obj.edges)) {
      errors.push("edges is required and must be an array.");
    } else {
      const edgeIds = new Set<string>();
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
        if (edge.kind !== undefined && typeof edge.kind !== "string") {
          errors.push(`edges[${i}].kind must be a string if provided.`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
