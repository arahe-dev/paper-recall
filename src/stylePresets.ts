export interface StylePreset {
  name: string;
  description: string;

  // Node sizing
  nodeWidth: number;
  nodeMinWidth: number;
  nodeMaxWidth: number;
  nodeHeight: number;
  nodePaddingHorizontal: number;
  nodePaddingVertical: number;
  cornerRadius: number;

  // Text
  fontSize: number;
  fontFamily: number; // Excalidraw FONT_FAMILY enum value
  lineHeight: number;
  textWrapThreshold: number; // chars before wrapping

  // Spacing
  verticalSpacing: number; // between levels
  horizontalSpacing: number; // between unrelated subtrees
  siblingSpacing: number; // between siblings
  subtreeSpacing: number; // extra padding around subtrees

  // Hub/spoke
  hubRadius: number; // distance from hub to spoke nodes
  hubSpokeAngleStart: number; // radians
  hubSpokeAngleSpan: number; // radians

  // Root centering
  rootCentering: boolean;

  // Arrow routing
  arrowStrokeWidth: number;
  arrowColor: string;
  arrowStartGap: number;
  arrowEndGap: number;

  // Colors
  nodeStrokeColor: string;
  nodeBackgroundColor: string;
  nodeTextColor: string;
  nodeStrokeWidth: number;
  nodeFillStyle: "hachure" | "cross-hatch" | "solid" | "zigzag";
  nodeRoughness: number;
  nodeOpacity: number;

  // Background
  canvasBackgroundColor: string;

  // Layout engine tuning
  levelHeightMultiplier: number; // multiply verticalSpacing by this per level
  compactWidth: boolean; // shrink width to fit text
  alignLeaves: boolean; // align leaf nodes to same depth
  maxChildrenPerRow: number; // 0 = single row; >0 wraps children into a grid
  maxRootsPerRow: number; // 0 = single row; >0 wraps roots into a grid

  // Subtree backgrounds
  subtreeBackgroundColor: string;
  subtreeBackgroundOpacity: number;
}

// Excalidraw FONT_FAMILY values (from constants.ts)
// Virgil = 1, Helvetica = 2, Cascadia = 3
export const FONT_FAMILY_VIRGIL = 1;
export const FONT_FAMILY_HELVETICA = 2;
export const FONT_FAMILY_CASCADIA = 3;

export const PRESETS: Record<string, StylePreset> = {
  readable_compact: {
    name: "readable_compact",
    description: "Default style optimized for clear hierarchy, readability, low overlap, and compactness.",

    nodeWidth: 160,
    nodeMinWidth: 80,
    nodeMaxWidth: 280,
    nodeHeight: 48,
    nodePaddingHorizontal: 16,
    nodePaddingVertical: 10,
    cornerRadius: 8,

    fontSize: 15,
    fontFamily: FONT_FAMILY_HELVETICA,
    lineHeight: 1.25,
    textWrapThreshold: 24,

    verticalSpacing: 120,
    horizontalSpacing: 50,
    siblingSpacing: 30,
    subtreeSpacing: 40,

    hubRadius: 220,
    hubSpokeAngleStart: Math.PI,
    hubSpokeAngleSpan: -Math.PI,

    rootCentering: true,

    arrowStrokeWidth: 1,
    arrowColor: "#333333",
    arrowStartGap: 4,
    arrowEndGap: 4,

    nodeStrokeColor: "#1e1e1e",
    nodeBackgroundColor: "#f5f5f5",
    nodeTextColor: "#1e1e1e",
    nodeStrokeWidth: 1,
    nodeFillStyle: "solid",
    nodeRoughness: 0,
    nodeOpacity: 100,

    canvasBackgroundColor: "#ffffff",

    levelHeightMultiplier: 1.5,
    compactWidth: true,
    alignLeaves: false,
    maxChildrenPerRow: 2,
    maxRootsPerRow: 2,

    subtreeBackgroundColor: "#e8e8e8",
    subtreeBackgroundOpacity: 30,
  },

  readable_spacious: {
    name: "readable_spacious",
    description: "More breathing room. Good for presentations and sparse boards.",

    nodeWidth: 180,
    nodeMinWidth: 100,
    nodeMaxWidth: 320,
    nodeHeight: 56,
    nodePaddingHorizontal: 20,
    nodePaddingVertical: 14,
    cornerRadius: 10,

    fontSize: 16,
    fontFamily: FONT_FAMILY_HELVETICA,
    lineHeight: 1.35,
    textWrapThreshold: 28,

    verticalSpacing: 130,
    horizontalSpacing: 70,
    siblingSpacing: 40,
    subtreeSpacing: 60,

    hubRadius: 220,
    hubSpokeAngleStart: Math.PI,
    hubSpokeAngleSpan: -Math.PI,

    rootCentering: true,

    arrowStrokeWidth: 1.5,
    arrowColor: "#1e1e1e",
    arrowStartGap: 6,
    arrowEndGap: 6,

    nodeStrokeColor: "#1e1e1e",
    nodeBackgroundColor: "#ffffff",
    nodeTextColor: "#1e1e1e",
    nodeStrokeWidth: 1.5,
    nodeFillStyle: "solid",
    nodeRoughness: 0,
    nodeOpacity: 100,

    canvasBackgroundColor: "#ffffff",

    levelHeightMultiplier: 1.0,
    compactWidth: true,
    alignLeaves: false,
    maxChildrenPerRow: 0,
    maxRootsPerRow: 0,

    subtreeBackgroundColor: "#e8e8e8",
    subtreeBackgroundOpacity: 0,
  },

  readable_long: {
    name: "readable_long",
    description: "Wider nodes, more horizontal spread. Good for text-heavy nodes and linear pipelines.",

    nodeWidth: 240,
    nodeMinWidth: 140,
    nodeMaxWidth: 400,
    nodeHeight: 48,
    nodePaddingHorizontal: 20,
    nodePaddingVertical: 10,
    cornerRadius: 6,

    fontSize: 14,
    fontFamily: FONT_FAMILY_HELVETICA,
    lineHeight: 1.2,
    textWrapThreshold: 40,

    verticalSpacing: 100,
    horizontalSpacing: 60,
    siblingSpacing: 30,
    subtreeSpacing: 50,

    hubRadius: 200,
    hubSpokeAngleStart: Math.PI,
    hubSpokeAngleSpan: -Math.PI,

    rootCentering: true,

    arrowStrokeWidth: 1.5,
    arrowColor: "#1e1e1e",
    arrowStartGap: 4,
    arrowEndGap: 4,

    nodeStrokeColor: "#1e1e1e",
    nodeBackgroundColor: "#f8f8f8",
    nodeTextColor: "#1e1e1e",
    nodeStrokeWidth: 1,
    nodeFillStyle: "solid",
    nodeRoughness: 0,
    nodeOpacity: 100,

    canvasBackgroundColor: "#ffffff",

    levelHeightMultiplier: 1.0,
    compactWidth: true,
    alignLeaves: false,
    maxChildrenPerRow: 0,
    maxRootsPerRow: 0,

    subtreeBackgroundColor: "#e8e8e8",
    subtreeBackgroundOpacity: 0,
  },

  readable_radial: {
    name: "readable_radial",
    description: "Radial/hub-spoke oriented layout. Good for star topologies and concept maps.",

    nodeWidth: 150,
    nodeMinWidth: 80,
    nodeMaxWidth: 260,
    nodeHeight: 48,
    nodePaddingHorizontal: 14,
    nodePaddingVertical: 10,
    cornerRadius: 8,

    fontSize: 14,
    fontFamily: FONT_FAMILY_HELVETICA,
    lineHeight: 1.25,
    textWrapThreshold: 22,

    verticalSpacing: 100,
    horizontalSpacing: 50,
    siblingSpacing: 20,
    subtreeSpacing: 40,

    hubRadius: 200,
    hubSpokeAngleStart: 0,
    hubSpokeAngleSpan: 2 * Math.PI,

    rootCentering: true,

    arrowStrokeWidth: 1.5,
    arrowColor: "#1e1e1e",
    arrowStartGap: 4,
    arrowEndGap: 4,

    nodeStrokeColor: "#1e1e1e",
    nodeBackgroundColor: "#f0f4ff",
    nodeTextColor: "#1e1e1e",
    nodeStrokeWidth: 1,
    nodeFillStyle: "solid",
    nodeRoughness: 0,
    nodeOpacity: 100,

    canvasBackgroundColor: "#ffffff",

    levelHeightMultiplier: 1.0,
    compactWidth: true,
    alignLeaves: false,
    maxChildrenPerRow: 0,
    maxRootsPerRow: 0,

    subtreeBackgroundColor: "#e8e8e8",
    subtreeBackgroundOpacity: 0,
  },

  readable_dense: {
    name: "readable_dense",
    description: "Tight packing. Good for large complex graphs where screen real estate matters.",

    nodeWidth: 140,
    nodeMinWidth: 70,
    nodeMaxWidth: 220,
    nodeHeight: 40,
    nodePaddingHorizontal: 10,
    nodePaddingVertical: 6,
    cornerRadius: 4,

    fontSize: 13,
    fontFamily: FONT_FAMILY_HELVETICA,
    lineHeight: 1.15,
    textWrapThreshold: 20,

    verticalSpacing: 60,
    horizontalSpacing: 30,
    siblingSpacing: 12,
    subtreeSpacing: 20,

    hubRadius: 140,
    hubSpokeAngleStart: Math.PI,
    hubSpokeAngleSpan: -Math.PI,

    rootCentering: true,

    arrowStrokeWidth: 1,
    arrowColor: "#333333",
    arrowStartGap: 2,
    arrowEndGap: 2,

    nodeStrokeColor: "#333333",
    nodeBackgroundColor: "#fafafa",
    nodeTextColor: "#1e1e1e",
    nodeStrokeWidth: 0.5,
    nodeFillStyle: "solid",
    nodeRoughness: 0,
    nodeOpacity: 100,

    canvasBackgroundColor: "#ffffff",

    levelHeightMultiplier: 1.0,
    compactWidth: true,
    alignLeaves: false,
    maxChildrenPerRow: 4,
    maxRootsPerRow: 0,

    subtreeBackgroundColor: "#e8e8e8",
    subtreeBackgroundOpacity: 0,
  },
};

export function getPreset(name: string): StylePreset {
  const preset = PRESETS[name];
  if (!preset) {
    console.warn(`Unknown preset "${name}", falling back to readable_compact.`);
    return PRESETS.readable_compact;
  }
  return preset;
}
