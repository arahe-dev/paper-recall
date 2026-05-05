import type { LooseAppState, LooseElement, LooseFiles } from "./types";

export function sanitizeExportAppState(appState: LooseAppState): Record<string, unknown> {
  return {
    viewBackgroundColor: appState.viewBackgroundColor,
    currentItemStrokeColor: appState.currentItemStrokeColor,
    currentItemBackgroundColor: appState.currentItemBackgroundColor,
    currentItemFillStyle: appState.currentItemFillStyle,
    currentItemStrokeWidth: appState.currentItemStrokeWidth,
    currentItemRoughness: appState.currentItemRoughness,
    theme: appState.theme,
  };
}

export function createExcalidrawScene(
  elements: readonly LooseElement[],
  appState: LooseAppState,
  files: LooseFiles
) {
  return {
    type: "excalidraw",
    version: 2,
    source: "recall-board",
    elements: elements.map((el) => ({ ...el })),
    appState: sanitizeExportAppState(appState),
    files,
  };
}

export function serializeExcalidrawScene(
  elements: readonly LooseElement[],
  appState: LooseAppState,
  files: LooseFiles
): string {
  return JSON.stringify(createExcalidrawScene(elements, appState, files), null, 2);
}
