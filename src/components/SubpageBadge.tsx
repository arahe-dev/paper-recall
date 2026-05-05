import { sceneCoordsToViewportCoords } from "@excalidraw/excalidraw";
import type { LooseAppState, LooseElement } from "../exporters/types";
import { getElementSubpageId } from "../utils/subpageEngine";

type SubpageBadgeProps = {
  elements: readonly LooseElement[];
  appState: LooseAppState;
  onOpen: (subpageId: string) => void;
};

function viewportPosition(element: LooseElement, appState: LooseAppState): { x: number; y: number } | null {
  const zoom = appState.zoom;
  if (!zoom || typeof zoom !== "object") return null;
  const zoomValue = "value" in zoom ? zoom.value : undefined;
  if (typeof zoomValue !== "number") return null;
  if (
    typeof appState.scrollX !== "number" ||
    typeof appState.scrollY !== "number" ||
    typeof appState.offsetLeft !== "number" ||
    typeof appState.offsetTop !== "number"
  ) {
    return null;
  }
  return sceneCoordsToViewportCoords(
    {
      sceneX: element.x + element.width,
      sceneY: element.y,
    },
    {
      zoom: zoom as never,
      offsetLeft: appState.offsetLeft,
      offsetTop: appState.offsetTop,
      scrollX: appState.scrollX,
      scrollY: appState.scrollY,
    }
  );
}

function isBadgeTarget(element: LooseElement): boolean {
  if (element.isDeleted || element.type === "arrow" || element.type === "text") return false;
  const customData = element.customData || {};
  if (customData.recallIgnoreInTextGraph === true) return false;
  return customData.recallEntityType !== "layout_background";
}

export default function SubpageBadge({ elements, appState, onOpen }: SubpageBadgeProps) {
  const badges = elements
    .filter(isBadgeTarget)
    .map((element) => ({ element, subpageId: getElementSubpageId(element) }))
    .filter((entry): entry is { element: LooseElement; subpageId: string } => Boolean(entry.subpageId));

  if (badges.length === 0) return null;

  return (
    <div className="subpage-badge-layer">
      {badges.map(({ element, subpageId }) => {
        const position = viewportPosition(element, appState);
        if (!position) return null;
        return (
          <button
            type="button"
            key={`${element.id}-${subpageId}`}
            className="subpage-badge"
            style={{ transform: `translate(${position.x - 8}px, ${position.y - 8}px)` }}
            onClick={() => onOpen(subpageId)}
            title="Open subpage"
          >
            +
          </button>
        );
      })}
    </div>
  );
}
