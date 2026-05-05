export type LooseElement = {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  strokeColor: string;
  backgroundColor: string;
  isDeleted?: boolean;
  boundElements?: readonly { id: string; type: string }[] | null;
  containerId?: string | null;
  points?: readonly (readonly [number, number])[];
  text?: string;
  startBinding?: { elementId: string; focus: number; gap: number } | null;
  endBinding?: { elementId: string; focus: number; gap: number } | null;
  link?: string | null;
  customData?: Record<string, unknown>;
};

export type LooseAppState = {
  width?: number;
  height?: number;
  viewBackgroundColor?: string;
  currentItemStrokeColor?: string;
  currentItemBackgroundColor?: string;
  currentItemFillStyle?: string;
  currentItemStrokeWidth?: number;
  currentItemRoughness?: number;
  [key: string]: unknown;
};

export type LooseFiles = Record<string, unknown>;

export type ExportedFile = {
  blob?: Blob;
  text?: string;
  filename: string;
  mimeType: string;
};
