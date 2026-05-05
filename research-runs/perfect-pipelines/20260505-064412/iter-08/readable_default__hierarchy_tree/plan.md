# Iteration Plan

Scenario: readable_default__hierarchy_tree

- Generate Recall Graph IR through the app automation API.
- Render/export PNG using Excalidraw's PNG export path.
- Capture the live editable Excalidraw scene JSON.
- Export compact Board Text Graph JSON through the same parser used by the UI.
- Validate readability geometry and parse round-trip fidelity against the source IR.
