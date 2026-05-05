import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { serializeAiContext } from "../exporters/aiContext";
import { serializeExcalidrawScene } from "../exporters/excalidraw";
import { serializeTextGraphMarkdown } from "../exporters/markdown";
import { exportPngBlob } from "../exporters/png";
import { exportSvgText } from "../exporters/svg";
import { serializeTextGraph } from "../exporters/textGraph";
import type { ExportedFile, LooseAppState, LooseElement, LooseFiles } from "../exporters/types";
import { isTauriEnv } from "./boardStorage";

export type ExportFormat =
  | "excalidraw"
  | "ai-json"
  | "text-graph-json"
  | "text-graph-md"
  | "png"
  | "svg";

export type ExportOptions = {
  baseName?: string;
  filename?: string;
  imageElements?: readonly LooseElement[];
};

export type ExportSaveResult = {
  cancelled: boolean;
  filename: string;
};

type FormatDefinition = {
  extension: string;
  mimeType: string;
  dialogName: string;
  defaultStem: string;
};

const FORMAT_DEFINITIONS: Record<ExportFormat, FormatDefinition> = {
  excalidraw: {
    extension: "excalidraw",
    mimeType: "application/json",
    dialogName: "Excalidraw JSON",
    defaultStem: "recall-board",
  },
  "ai-json": {
    extension: "json",
    mimeType: "application/json",
    dialogName: "AI Context JSON",
    defaultStem: "recall-ai-context",
  },
  "text-graph-json": {
    extension: "json",
    mimeType: "application/json",
    dialogName: "Text Graph JSON",
    defaultStem: "recall-board-text-graph",
  },
  "text-graph-md": {
    extension: "md",
    mimeType: "text/markdown",
    dialogName: "Markdown",
    defaultStem: "recall-board-text-graph",
  },
  png: {
    extension: "png",
    mimeType: "image/png",
    dialogName: "PNG Image",
    defaultStem: "recall-board",
  },
  svg: {
    extension: "svg",
    mimeType: "image/svg+xml",
    dialogName: "SVG Image",
    defaultStem: "recall-board",
  },
};

export async function exportBoard(
  format: ExportFormat,
  elements: readonly LooseElement[],
  appState: LooseAppState,
  files: LooseFiles,
  options: ExportOptions = {}
): Promise<ExportedFile> {
  const definition = FORMAT_DEFINITIONS[format];
  const filename = ensureExtension(
    options.filename || defaultFilename(format, options.baseName),
    definition.extension
  );
  const imageElements = options.imageElements ?? elements;

  switch (format) {
    case "excalidraw":
      return {
        text: serializeExcalidrawScene(elements, appState, files),
        filename,
        mimeType: definition.mimeType,
      };
    case "ai-json":
      return {
        text: serializeAiContext(elements),
        filename,
        mimeType: definition.mimeType,
      };
    case "text-graph-json":
      return {
        text: serializeTextGraph(elements),
        filename,
        mimeType: definition.mimeType,
      };
    case "text-graph-md":
      return {
        text: serializeTextGraphMarkdown(elements),
        filename,
        mimeType: definition.mimeType,
      };
    case "png":
      return {
        blob: await exportPngBlob(imageElements, appState, files),
        filename,
        mimeType: definition.mimeType,
      };
    case "svg":
      return {
        text: await exportSvgText(imageElements, appState, files),
        filename,
        mimeType: definition.mimeType,
      };
  }
}

export async function exportAndSaveBoard(
  format: ExportFormat,
  elements: readonly LooseElement[],
  appState: LooseAppState,
  files: LooseFiles,
  options: ExportOptions = {}
): Promise<ExportSaveResult> {
  const exported = await exportBoard(format, elements, appState, files, options);
  return saveExportedFile(format, exported);
}

async function saveExportedFile(
  format: ExportFormat,
  exported: ExportedFile
): Promise<ExportSaveResult> {
  if (isTauriEnv()) {
    const definition = FORMAT_DEFINITIONS[format];
    const path = await save({
      defaultPath: exported.filename,
      filters: [{ name: definition.dialogName, extensions: [definition.extension] }],
    });
    if (!path) return { cancelled: true, filename: exported.filename };

    if (exported.text !== undefined) {
      await invoke("save_export_text", { path, content: exported.text });
    } else if (exported.blob) {
      const bytes = Array.from(new Uint8Array(await exported.blob.arrayBuffer()));
      await invoke("save_export_binary", { path, bytes });
    }

    return { cancelled: false, filename: exported.filename };
  }

  downloadInBrowser(exported);
  return { cancelled: false, filename: exported.filename };
}

function downloadInBrowser(exported: ExportedFile): void {
  const blob = exported.blob ?? new Blob([exported.text ?? ""], { type: exported.mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = exported.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function defaultFilename(format: ExportFormat, baseName?: string): string {
  const definition = FORMAT_DEFINITIONS[format];
  const stem = sanitizeFileStem(baseName || definition.defaultStem);
  if (format === "ai-json" || format === "text-graph-json" || format === "text-graph-md") {
    return `${definition.defaultStem}.${definition.extension}`;
  }
  return `${stem}.${definition.extension}`;
}

function ensureExtension(filename: string, extension: string): string {
  const trimmed = filename.trim() || `recall-board.${extension}`;
  return trimmed.toLowerCase().endsWith(`.${extension}`)
    ? trimmed
    : `${trimmed}.${extension}`;
}

function sanitizeFileStem(stem: string): string {
  const safe = Array.from(stem.replace(/\.[^.]+$/, ""))
    .map((char) => char.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(char) ? "-" : char)
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  return safe || "recall-board";
}
