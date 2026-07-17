# AI Assistant Relocation — Implementation Plan

## Goal
Apply the AI Assistant update from `workspace-ai-update/` into the main `Workspace/` folder, replacing the old sidebar chat widget with a full-view AI Assistant and decluttering the sidebar nav.

## Files to delete
- `Workspace/WorkspaceShared/ai-assistant.js`

## Files to copy from `workspace-ai-update/` → `Workspace/`
- `WorkspaceFeatures/ai-assistant/ai-assistant.js` *(new)*
- `WorkspaceFeatures/ai-assistant/ai-context.js` *(new)*
- `WorkspaceFeatures/ai-assistant/ai-tools.js` *(new)*
- `WorkspaceFeatures/ai-assistant/ai-assistant.css` *(new)*
- `Workspace.html` *(overwrite)*
- `WorkspaceCore/app.js` *(overwrite)*
- `WorkspaceCore/layout.css` *(overwrite)*
- `WorkspaceCore/variables.css` *(overwrite)*

## Files to modify

### `Workspace/sw.js`
1. Remove `'WorkspaceShared/ai-assistant.js'` from `STATIC_ASSETS`
2. Add these precache entries:
   - `'WorkspaceFeatures/ai-assistant/ai-assistant.css'`
   - `'WorkspaceFeatures/ai-assistant/ai-context.js'`
   - `'WorkspaceFeatures/ai-assistant/ai-tools.js'`
   - `'WorkspaceFeatures/ai-assistant/ai-assistant.js'`
3. Bump `CACHE_NAME` from `'workspace-hub-v8'` to `'workspace-hub-v9'`

### `Workspace/WorkspaceFeatures/dashboard/widgets.css`
Remove lines 335-351 (orphaned `.sidebar-ai` and `.auto-badge` selectors).

## Key changes inside overwritten files

### `Workspace.html`
Safe overwrite — modal structure and element IDs are identical. Changes:
1. New `<link rel="stylesheet" href="WorkspaceFeatures/ai-assistant/ai-assistant.css" />`
2. Old sidebar AI chat box removed
3. Sidebar nav restructured with `.hub-menu-group` wrappers, new "🧠 AI Assistant" button under Dashboard
4. New `ai-view` section between dashboard-view and habits-view
5. Script tags: removed `WorkspaceShared/ai-assistant.js`, added three new scripts before `app.js`

### `WorkspaceCore/app.js`
1. Collapsible menu section logic: `.hub-menu-label` click → toggle `.collapsed` on label + next `.hub-menu-group`, persist in `localStorage.collapsedNavGroups`
2. `ai-view` added to `viewInitMap`

### `WorkspaceCore/layout.css`
1. `.hub-menu-group` flex column with animated `max-height` collapse
2. `.hub-menu-label` enhanced with `::after` arrow and collapse rotation
3. `.hub-menu` gets `min-height: 0`
4. `.nav-btn[data-view="ai-view"]` uses `--nav-ai`

### `WorkspaceCore/variables.css`
1. Add `--nav-ai: #14b8a6;`

## Validation
1. Open `Workspace.html` in browser, check console for errors
2. Verify collapsible sidebar sections (Main/Tools/Knowledge/Help)
3. Verify "🧠 AI Assistant" switches to new chat view
4. Verify old sidebar AI widget is gone
5. Verify localStorage remembers collapsed groups across reloads
6. Verify PWA cache version bumped and new assets precached

## Rollback
Restore the 4 overwritten files, delete `WorkspaceFeatures/ai-assistant/`, restore `WorkspaceShared/ai-assistant.js` + `sw.js` from git.
