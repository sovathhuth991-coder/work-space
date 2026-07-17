# Lessons CSS Improvement Plan

## Context
File: `Workspace/WorkspaceFeatures/lessons/lessons.css` (779 lines)
Covers: explorer sidebar, Notion-style editor, find bar, context menu, export dropdown, responsive breakpoint.
No CSS preprocessor — plain CSS only.

## Findings & Proposed Changes

### 1. Remove invalid transition on `.folder-content`
**Line 210**: `transition: display 0.2s ease` — `display` is not animatable; the transition does nothing and misleads maintainers.

**Change**: Delete the `transition` property. Keep `display: none` / `display: flex` toggle as-is (instant show/hide is fine for folder expand/collapse).

### 2. Make sidebar sticky during scroll
**Line 11**: `.lesson-menu-panel` has no `position: sticky`. When scrolling long lesson content, the explorer sidebar scrolls away.

**Change**: Add `position: sticky; top: 0;` to `.lesson-menu-panel`.

**Header overlap note**: The global app header (`index.html:235`) is `position: sticky; top: 0; z-index: 10`. The sidebar sticking at `top: 0` will overlap the header visually, but the header's higher z-index keeps it on top and readable. This is acceptable for now.

**Future enhancement**: If a `--header-height` custom property is ever added to the project, update the sidebar to `top: var(--header-height, 0px)` for pixel-perfect positioning. No need to introduce one today — the header height is inline-styled and not centralized.

### 3. Scope `.burger-toggle` override to lessons view
**Line 724**: `.burger-toggle { display: flex !important; }` is unscoped. The `#burgerToggle` button exists in the global app header (`index.html:236`) and already has `display: flex` from its own styles. This rule is a no-op for the header but could interfere if any other view uses `.burger-toggle`.

**Change**: Scope to `.lessons-view .burger-toggle { display: flex !important; }`.

**Verification**: `<section id="lessons-view" class="hub-view lessons-view">` exists in HTML at line 1211, so the scope works.

### 4. Add internal scroll to editor panel
**Line 257**: `.lesson-document-panel` has no `overflow-y: auto`. Long documents cause layout overflow instead of scrolling internally.

**Prerequisite — height must be constrained first**: `overflow-y: auto` only activates when the element has a bounded height. The parent chain is:
- `.hub-content` → `height: 100vh` ✓ (constrained)
- `.hub-view` → `flex: 1 0 auto` ✓ (fills remaining space in flex column)
- `.lesson-workspace-shell` → **no height** ✗ (this is the gap)
- `.lesson-document-panel` → `flex: 1` but parent is unconstrained

**Change A — constrain the flex parent**: Add `flex: 1; min-height: 0;` to `.lesson-workspace-shell` so it fills the `.hub-view` height. `min-height: 0` is required to allow flex children to shrink below their content size.

**Change B — enable editor scroll**: Add `overflow-y: auto`, `scrollbar-width: thin`, `scrollbar-color: var(--accent-1) transparent`, and matching `::-webkit-scrollbar` rules to `.lesson-document-panel`. Match the sidebar scrollbar styling already in the file.

**Responsive note**: On mobile (`max-width: 850px`), `.lesson-workspace-shell` becomes `flex-direction: column` and `.lesson-document-panel` gets `width: 100%`. The `flex: 1; min-height: 0;` on the shell ensures the editor still fills available height and scrolls correctly.

### 5. Constrain explorer dropdown height
**Line 87**: `.explorer-dropdown-menu` has no `max-height` or `overflow-y`. A context menu with many items could overflow the viewport.

**Change**: Add `max-height: 60vh; overflow-y: auto;`.

### 6. Fix active leaf node layout shift
**Line 240**: `.lesson-leaf-node.active` uses `border-left: 2px solid var(--accent-1)`. This adds 2px width when activated, pushing content right.

**Change**: Replace `border-left` with `box-shadow: inset 2px 0 0 var(--accent-1)`. `box-shadow` doesn't affect layout dimensions. Using `2px` matches the original border width exactly.

### 7. Fix cursor on editor rows
**Line 373**: `.notion-row-node` has `cursor: default`. Editable blocks should indicate text editing affordance.

**Change**: `cursor: text`.

**Note**: `.block-drag-handle` (child) already has `cursor: grab` at line 411, which overrides the parent cursor via specificity. Safe to change parent.

### 8. Make callout background themeable
**Line 477**: `.notion-row-node[data-type="callout"] .editable-line` uses hardcoded `background: rgba(124, 109, 240, 0.1)`.

**Change**: Add `background: var(--callout-bg, rgba(124, 109, 240, 0.1));` so themes can override. The fallback preserves current appearance.

### 9. Add text selection styling
**No existing rule**: No `::selection` styling in the editor area.

**Change**: Add `.lesson-document-panel ::selection { background: rgba(124, 109, 240, 0.3); color: var(--text-primary); }`.

### 10. Add tab-size to code blocks
**Line 563**: `.code-block` has no `tab-size`. Code tabs render at browser default (usually 8 spaces).

**Change**: Add `tab-size: 2;`.

## Out of Scope
- HTML/JS changes (CSS-only unless a class name addition is unavoidable)
- Extracting shared classes between `.editable-line` and `.toggle-content` — duplication is minor (11 properties) and no CSS preprocessor exists to make `@extend` practical. If desired, a future refactor can add a shared `.editor-content` class via HTML/JS.
- Moving styles to other CSS files
- Major layout restructuring

## Validation Steps
1. Open lessons view, expand/collapse folders — verify no jitter (invalid transition removed)
2. Scroll long lesson content — verify sidebar stays visible (sticky)
3. Switch to dashboard/schedule/other views — verify global burger toggle unaffected (scoped override)
4. Click a leaf node in the tree — verify no 2px layout shift (box-shadow replaces border-left)
5. Open a long document — verify editor panel scrolls internally (overflow-y: auto)
6. Right-click in explorer to open context menu — verify it doesn't overflow viewport (max-height: 60vh)
7. Hover over editor rows — verify text cursor appears (cursor: text)
8. Type in a callout block — verify background color is consistent (themeable fallback)
9. Select text in editor — verify custom selection color (::selection)
10. View a code block with tabs — verify tab width is 2 spaces (tab-size: 2)
