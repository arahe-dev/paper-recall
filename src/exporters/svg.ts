import { exportToSvg } from "@excalidraw/excalidraw";
import type { LooseAppState, LooseElement, LooseFiles } from "./types";

export async function exportSvgText(
  elements: readonly LooseElement[],
  appState: LooseAppState,
  files: LooseFiles
): Promise<string> {
  const svg = await exportToSvg({
    elements: elements.filter((el) => !el.isDeleted) as never,
    appState: appState as never,
    files: files as never,
    exportPadding: 20,
  });
  return new XMLSerializer().serializeToString(svg);
}
