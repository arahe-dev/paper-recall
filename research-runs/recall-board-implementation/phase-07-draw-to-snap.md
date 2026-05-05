# Phase 7 - Draw-to-Snap / Gesture Recognition

## Scope Completed

- Added `src/utils/gestureRecognizer.ts` with Douglas-Peucker simplification and shape classification.
- Recognizes rough rectangles, ellipses, lines, arrows, and diamonds from completed freedraw strokes.
- Leaves low-confidence strokes as freedraw.
- Added Auto-snap and confidence threshold settings.
- Added top-bar controls for Auto-snap and snap threshold.
- Added brief visual feedback after a stroke snaps.
- Integrated snapping into Excalidraw `onChange` without adding dependencies.
- Replaces only completed freedraw strokes and uses Excalidraw history so undo restores the original freedraw stroke.

## Acceptance Gate Results

- Rough rectangle snaps to rectangle: pass.
- Rough ellipse/circle snaps to ellipse: pass.
- Rough line snaps to line: pass.
- Rough arrow snaps to arrow: pass.
- Rough diamond snaps to diamond: pass.
- Low-confidence stroke remains freehand: pass.
- Undo after snap restores the original freedraw as the active element: pass.
- Auto-snap can be toggled off: pass.
- Performance guard:
  - Recognition runs only after `cursorButton` returns to `up`.
  - Already-processed freedraw IDs are skipped.
  - No new package or worker overhead added.

## Verification

- `npm run build`: pass.
- `npm run lint`: pass.
- `cargo check` in `src-tauri`: pass.
- CSS hardcoded color sweep with `rg "#[0-9A-Fa-f]{3,8}|rgba\(|hsla?\(" src -g "*.css"`: pass, no matches.
- Browser smoke via Playwright on Vite dev server:
  - Draw rough rectangle, ellipse, line, arrow, diamond, and low-confidence squiggle.
  - Verify snapped element types and low-confidence freehand preservation.
  - Toggle Auto-snap off and verify freehand preservation.
  - Undo snapped rectangle and verify active element is freedraw.
- Tauri launch smoke:
  - Tauri process started.
  - Vite dev server listened on port 5173.
  - App process launched.

## Bugs Found and Fixed

- Initial verification counted deleted Excalidraw history elements in undo checks.
  - Fixed the smoke assertion to evaluate active, non-deleted elements only.
- Playwright could not click Excalidraw toolbar radio inputs normally because the icon overlay intercepted pointer events.
  - Browser smoke uses forced toolbar selection for the freedraw tool.

## Known Limitations

- Recognition is heuristic, not a trained handwriting model; unusual drawing styles can still miss or misclassify.
- Arrow recognition assumes a single continuous stroke with a visible head near the shaft endpoint.
- Visual feedback is an overlay status, not an animated outline on the snapped element.
- The confidence threshold is global; per-shape thresholds may be useful later if user testing shows uneven behavior.
