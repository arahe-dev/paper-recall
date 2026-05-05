# Phase 6 - Subpages and Custom Context Menu

## Scope Completed

- Added separate subpage storage through `src/utils/subpageEngine.ts`.
- Stored only `customData.recall.subpageId` and `customData.recall.subpageTitle` on elements.
- Added a custom right-click context menu with subpage create/open/delete and board-link actions.
- Added breadcrumb navigation for root board and nested subpages.
- Added subpage badges positioned with Excalidraw viewport coordinates.
- Added double-click navigation into an element subpage.
- Indexed subpage board text graph content in the existing MiniSearch index.
- Added automation hooks for browser smoke coverage:
  - `createSubpageForElement`
  - `openSubpage`
  - `getSubpageStack`

## Acceptance Gate Results

- Right-click element opens custom context menu: pass.
- Native Excalidraw context menu is suppressed for Recall element targets: pass.
- Create Subpage opens a blank canvas for the target element: pass.
- Breadcrumb bar shows active subpage path: pass.
- Go Back returns from nested subpage to parent subpage and then root board: pass.
- Parent state is preserved when returning to the board: pass.
- Nested subpages work: pass.
- Subpage badge appears on elements with subpages: pass.
- Double-click on a subpage element navigates into its subpage: pass.
- Search returns subpage content alongside root board content: pass.

## Verification

- `npm run build`: pass.
- `npm run lint`: pass.
- `cargo check` in `src-tauri`: pass.
- CSS hardcoded color sweep with `rg "#[0-9A-Fa-f]{3,8}|rgba\(|hsla?\(" src -g "*.css"`: pass, no matches.
- Browser smoke via Playwright on Vite dev server:
  - Loads a generated board.
  - Saves it through browser fallback storage.
  - Opens the custom context menu.
  - Creates a root subpage.
  - Creates a nested subpage from within the root subpage.
  - Navigates back through breadcrumbs.
  - Verifies badge visibility.
  - Double-clicks back into the subpage.
  - Verifies search results include subpage content.
- Tauri launch smoke:
  - Tauri process started.
  - Vite dev server listened on port 5173.
  - App process launched.

## Bugs Found and Fixed

- Initial hit testing could target generated layout backgrounds or text labels instead of the real node shape.
  - Fixed by filtering generated backgrounds, ignored elements, arrows, and text from board interaction targets.
- Excalidraw's native context menu could open alongside the Recall menu.
  - Fixed by stopping propagation after a Recall element target is resolved.
- The browser smoke originally used the wrong viewport coordinate formula.
  - Smoke now uses Excalidraw's scroll-scaled viewport coordinates.

## Known Limitations

- Subpages are stored in browser `localStorage` for the current implementation path. A durable board companion file or board metadata storage format is still needed before this is production-grade in Tauri/file sync workflows.
- Subpage storage is global by board ID; if a Tauri board path-derived ID changes after external file moves/renames, subpage references can become stale.
- Context menu targeting supports element bounding boxes, not Excalidraw's exact rotated/rough geometry hit model.
- Subpage delete removes nested subpages but does not scan every board element for stale references outside the deleted branch.
- Search indexes subpages during board save/navigation/index rebuild, but there is still no serialized MiniSearch cache.
