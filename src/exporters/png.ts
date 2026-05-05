import { exportToBlob } from "@excalidraw/excalidraw";
import type { LooseAppState, LooseElement, LooseFiles } from "./types";

export async function exportPngBlob(
  elements: readonly LooseElement[],
  appState: LooseAppState,
  files: LooseFiles
): Promise<Blob> {
  return exportToBlob({
    elements: elements.filter((el) => !el.isDeleted) as never,
    appState: appState as never,
    files: files as never,
    mimeType: "image/png",
    exportPadding: 20,
  });
}
