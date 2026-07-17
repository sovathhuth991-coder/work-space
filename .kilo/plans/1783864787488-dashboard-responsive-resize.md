# Dashboard Cards: Resizable + Adaptive Inner UI

## Goal
Let every dashboard card be freely resized (small ⇄ big) AND make the UI *inside* each
card adapt to its actual rendered size — compact when small, spacious when large —
on **both** width and height axes.

Current state (already working, in `WorkspaceShared/drag-drop.js`):
- Drag-resize exists: horizontal `span 1..maxSpan` (maxSpan = `min(3, round(gridWidth/420))`)
  and vertical `min-height` 160–760px, set live on `card.style.gridColumn` / `card.style.minHeight`.
- Persisted via `saveLayout()` / `loadLayout()` to `localStorage["dashboardCardLayout"]`.
- Drag-reorder, minimize, card-visibility toggle also exist.

Gap: inner content uses viewport `clamp()` font/padding values, so a shrunken card keeps
the same density and just gets cramped/clipped. There is no width/height-driven inner
responsiveness, and resize is drag-only (no quick click-to-toggle big/small).

## Chosen approach
JS measures each card's real pixel `width`/`height`, then sets size-class attributes on
the card element. CSS keyed off those attributes re-densifies the inner UI. Covers both
axes (height density can't be done with CSS container queries alone).

---

## 1. Size-class detection (JS) — `WorkspaceShared/drag-drop.js`
Add a single updater and call it at the right moments.

- Helper `getMaxSpan()` — single source of truth for the span cap, used by BOTH the
  drag-resize and the click-cycle:
  `function getMaxSpan(){ const g=document.querySelector('.dashboard-grid'); return g?Math.max(1,Math.min(3,Math.round(g.getBoundingClientRect().width/420))):1; }`
  Replace the two EXISTING inline copies of this formula — in `onResizeMove`
  (`const maxSpan = grid ? Math.max(1, Math.min(3, Math.round(grid.getBoundingClientRect().width / 420))) : 2;`)
  and in `loadLayout` (line ~823, computes the same thing into `maxSpan`) — with `getMaxSpan()`
  so the cap is truly centralized.
  IMPORTANT for `loadLayout`: it ALREADY clamps the restored span so a saved `span 2/3` doesn't
  overflow a narrow grid — `card.style.gridColumn = savedSpan > maxSpan ? \`span ${maxSpan}\` : entry.gridColumn;`
  (line ~835). When swapping the inline formula for `getMaxSpan()`, KEEP that clamp
  (i.e. `savedSpan > getMaxSpan() ? \`span ${getMaxSpan()}\` : entry.gridColumn`). Do NOT naively
  assign `entry.gridColumn` unchanged, or a saved large span would break the grid on mobile.
- New function `updateCardSizeClasses()`:
  - Selector MUST be scoped to the dashboard: `.dashboard-grid .dash-card[data-card-id]`
    (excludes the schedule-view calendar card, which reuses `.dash-card`/`data-card-id`).
    The mini-calendar card (`data-card-id="calendar"`) IS in the grid — include it.
  - Skip cards with `display === 'none'` (hidden via visibility toggle) and
    `classList.contains('card-minimized')` (inner hidden anyway).
  - For each remaining card read `rect = card.getBoundingClientRect()` and set:
    - `data-w`: `xs` (<300), `sm` (300–440), `md` (440–640), `lg` (>640)  [width]
    - `data-h`: `short` (<240), `normal` (240–460), `tall` (>460)        [height]
- Call it (cancel any pending frame before queueing — see §2 rAF note):
  - At end of `initDashboardCards()` (after `loadLayout()`).
  - Throttled with `requestAnimationFrame` inside `onResizeMove` (inner UI adapts live while dragging);
    guard with a module-level `pendingResizeRaf` and `cancelAnimationFrame(pendingResizeRaf)` before
    queueing a new one so only the latest frame runs.
  - In `onResizeEnd` (covers both drag-end and the new click-cycle path).
  - On `window` `resize` (debounced ~150ms via `setTimeout`/`clearTimeout`), so changing viewport
    reflows size classes.
  - After dynamic card insertion: in `initMiniCalendar` (dashboard.js), right after the calendar
    card is inserted + rendered, call `window.initDashboardCards?.()` (idempotent thanks to the
    `dragWired` guard). Its tail already calls `updateCardSizeClasses()`, so a separate call is NOT
    required — adding one is harmless/idempotent if preferred. Same pattern in `live-widgets.js`
    (already re-calls `initDashboardCards()` at line 264; rely on its tail, optional extra call ok).
  - In `toggleCardMinimize` (drag-drop.js — NOT dashboard.js) call `updateCardSizeClasses()`
    **unconditionally** after toggling — both minimize AND un-minimize — because neighboring cards
    reflow to fill/relinquish space and need fresh `data-w`/`data-h`. The updater already skips
    `.card-minimized` cards, so calling it always is safe and accurate.
  - In `applyCardVisibility` (dashboard.js) call `window.updateCardSizeClasses?.()` so size classes
    recompute when a card is shown/hidden.
- Expose globally: `window.updateCardSizeClasses = updateCardSizeClasses;`
  (also already exposes `window.initDashboardCards`).

## 1b. Fix stat-card click conflict (pre-existing) — `WorkspaceShared/drag-drop.js`
Stat cards are clickable to `switchView` (app.js delegated handler matches
`[data-action="switchView"][data-view]`, and the whole stat card is that element). Their
resize button lives inside the card, so a click / end-of-drag on it currently bubbles to the
document handler and triggers navigation. (`data-action="resizeCard"` has NO handler in app.js,
verified — so blocking its click is safe.)

CRITICAL TIMING NOTE: native event order is `mousedown → mouseup → click`. `onResizeEnd` runs
on `mouseup`, so a click-stop listener attached in `startResize` and *removed* inside
`onResizeEnd` is gone before the `click` event fires — it would NOT stop propagation and the
stat card would still navigate. Do NOT attach/remove the listener around the resize lifecycle
(the conditional "keep on click, remove on drag" approach also has a bug: it nulls the button
ref before the self-removing handler runs, throwing on null and leaking the listener).

ROBUST FIX — a PERMANENT click stopper on the button (no lifecycle attach/remove):
- In the `initDashboardCards()` wiring loop (where the resize button already gets
  `mousedown`/`touchstart`), also add once:
  `resizeBtn.addEventListener('click', (e) => e.stopPropagation());`
  This permanently stops the resize button's click from bubbling to the document-level
  `switchView` handler. Harmless otherwise: `data-action="resizeCard"` has no app.js handler;
  `help-mode.js` listens in the CAPTURE phase (unaffected by a bubble-phase `stopPropagation`);
  and the click-cycle (run in `onResizeEnd` on mouseup) is already done before `click` fires.
- No `resizingBtn` / handler-removal bookkeeping required anywhere.

## 2. Click-to-cycle resize (easy big/small) — `WorkspaceShared/drag-drop.js`
Make the resize button also work as a quick S/M/L toggle in addition to drag.
- Add module var: `resizeWasClick = true` (reset each drag).
- In `startResize`, set `resizeWasClick = true` (reset each drag).
- In `onResizeMove`, if `Math.abs(deltaX)+Math.abs(deltaY) > 4` set `resizeWasClick = false`.
- In `onResizeEnd`:
  - If `resizeWasClick` → `cycleCardSize(card)` and `saveLayout()`; else drag path already
    applied `gridColumn`/`minHeight` (keep existing `saveLayout()`).
  - Always call `updateCardSizeClasses()` (final sync).
  - (The navigation-blocking click-stopper is permanent on the button via §1b — nothing to
    remove here.)
- New `cycleCardSize(card)`:
  - presets: `sm` = span 1 / min-height 200; `md` = span 1 / min-height 360;
    `lg` = span `min(2, getMaxSpan())` / min-height 540.  (`getMaxSpan()` from §1)
  - **Deterministic cycle via `data-size-preset` attribute** (do NOT parse `data-w`/styles —
    `data-w` is rendered width and a card may be `md` width with a custom height, making the
    next step ambiguous; after reload there is no preset to read):
    - `const SIZES = ['sm','md','lg'];`
    - `let cur = card.dataset.sizePreset || 'sm';`
    - `let next = SIZES[(SIZES.indexOf(cur)+1) % SIZES.length];`
    - apply the matching preset's span/min-height, then `card.dataset.sizePreset = next;`
      and `updateCardSizeClasses()`.
  - In the **drag‑resize** path (`onResizeMove`/`onResizeEnd` when it was a real drag),
    `delete card.dataset.sizePreset` so the next click‑cycle starts from `sm`.
  - Fallback when `data-size-preset` is missing (e.g. after `loadLayout`): treat as `sm`.
- Keep the drag-resize path unchanged; the button keeps its drag-to-fine-tune behaviour.
  The click-cycle and the drag both terminate in `onResizeEnd`; the §1b click-stopper only
  blocks propagation (never cycles), so a real drag is never overwritten by a cycle.

## 3. Adaptive inner CSS — `WorkspaceFeatures/dashboard/dashboard.css`
Add a new section "FEATURE: RESPONSIVE INNER UI (size-class driven)". ALL selectors MUST be
prefixed with `.dashboard-grid` so only dashboard cards are affected (never modal/settings
cards that might also use `.dash-card`). Example: `.dashboard-grid .dash-card[data-w="xs"] ...`:

- **Compact (small width)** `.dash-card[data-w="xs"], .dash-card[data-w="sm"]`
  - `.card-inner` padding → ~14px; reduce gap between header and body.
  - `.banner-text h2` font-size smaller; `.dash-banner .card-inner` `flex-direction: column`
    (stack headline/progress) and `align-items: flex-start`; `.banner-progress` `max-width:100%`.
  - `.session-hub-grid` → `grid-template-columns: 1fr`.
  - `.dash-quick-links` → `grid-template-columns: 1fr`.
  - `#dashWidgetsGrid` → `grid-template-columns: 1fr`.
  - `.strike-list` gap smaller; `.strike-item` padding 6px; checkbox 16px.
  - `.session-item` padding 10px; `.session-time-range` `min-width: 96px`; `.session-stats` smaller gap.
  - `.stat-card .card-inner` gap 10px, padding 14px; `.stat-icon` smaller.
  - `.metric` padding 4px 8px; `.metric-value`/`.metric-label` smaller.
  - `.session-history-empty` padding smaller.
- **Roomy (large width)** `.dash-card[data-w="lg"]`
  - Banner: keep row layout, increase gap/spacing.
  - `.session-hub-grid` keep 3 cols (already); optional larger widget padding.
  - Stat sparkline scaled up slightly.
- **Short height** `.dash-card[data-h="short"]`
  - Reduce `.session-history-empty` / empty-state padding; tighten `.quick-notes` area;
    reduce `.all-sessions-container` `max-height` so it scrolls instead of overflowing.
  - Reduce `.card-inner` `min-height` influence (let content drive).
- **Tall height** `.dash-card[data-h="tall"]`
  - Allow inner lists (`#dashWidgetsGrid`, `.all-sessions-container`) more breathing room;
    slightly larger internal spacing.

Keep `.dash-card.card-large` and the `@media (max-width:1000px)` rules untouched — size-class
CSS augments them and only narrows scope to the data-attribute. Test that on mobile (span forced
to 1, width <300) cards get `data-w="xs"`/`sm` so inner UI stays compact — no overlap.

## 4. Persistence / reset
- Size classes are derived (not stored) → no schema change to `dashboardCardLayout`.
- `resetLayout()` already clears `gridColumn`/`minHeight`; after reset also call
  `updateCardSizeClasses()` so classes recompute from default sizes.

## 5. Validation
- `npm install` then `npm run lint:css` (stylelint) must pass — keep rules in `.stylelintrc.json`
  (no duplicate selectors/properties, no empty blocks).
- Manual:
  - Dashboard loads; default cards render at `md`/`lg`.
  - Drag a small card's resize handle → inner fonts/padding shrink (banner stacks, hub grid → 1 col).
  - Click (no drag) the resize handle 3× → card cycles sm → md → lg; inner UI matches each.
  - **Stat cards:** click / drag the resize handle on a stat card → card resizes/cycles and the
    view does NOT navigate away (the old `switchView` bug is gone). Clicking the stat card body
    (not the resize button) still navigates to its view.
  - Shrink a card then reload page → saved span/height restored by `loadLayout()` and inner UI
    recomputes to the right density.
  - Mini-calendar card + live-widget cards: their resize buttons are wired (re-run
    `initDashboardCards`) and they get size classes after insertion.
  - Resize window narrow → `window resize` handler re-classes cards, no overflow/clipping.
  - Reset Dashboard (`↺ Reset Dashboard`) → back to defaults, inner UI recomputed.
  - Mobile width (<=1000px): cards full-width, `data-w` small, inner UI compact, no overlap.

## Open questions / risks
- Inner CSS compaction is best-effort per card type; very dense custom content may still need
  scrolling — acceptable, since `card-minimized` and resize-height remain available.
- `maxSpan` formula is now centralized in `getMaxSpan()` (used by both drag-resize and
  `cycleCardSize`), so no duplication/drift.

## Files touched
- `WorkspaceShared/drag-drop.js` — size-class updater + global expose, click-conflict guard,
  click-to-cycle (`cycleCardSize`, `resizeWasClick`), `toggleCardMinimize` (unconditional
  `updateCardSizeClasses` call), and all call sites.
- `WorkspaceFeatures/dashboard/dashboard.css` — new adaptive inner-UI section (scoped to
  `.dashboard-grid .dash-card[data-w]` / `[data-h]`).
- `WorkspaceFeatures/dashboard/dashboard.js` — add `updateCardSizeClasses()` calls in
  `initMiniCalendar` (after insert, via `initDashboardCards` tail) and `applyCardVisibility`.
- `WorkspaceFeatures/dashboard/live-widgets.js` — `updateCardSizeClasses()` already covered by its
  existing `initDashboardCards()` re-call (line ~264); optional extra call acceptable.
- (No HTML changes; `data-action="resizeCard"` attribute already present and has no app.js handler.)
