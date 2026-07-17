# Analytics View — Visible 2-Column Grid (Focus + Heatmap side-by-side)

## Investigation (resolved)
- No on-screen CSS override. `#analytics-view.active { display: grid }` (`analytics.css:138`)
  wins by specificity; the only `!important` display rules are print/focus-timer only.
- The earlier "no change" was because every section spanned both columns, so the grid
  looked like the old stack. Plus the SW served stale CSS (fixed: v13 bump +
  stale-while-revalidate + `updateViaCache:'none'`).

## Chosen design
Focus Session History and Completion Heatmap share a row (each half-width); Stats grid,
Category|Peak, and Conflicts stay full-width.

## Implementation

### 1. HTML (`index.html`) — reorder + wrap Focus & Heatmap
Currently the order is Focus History → Stats grid → Heatmap → Charts grid, and Focus/
Heatmap cards carry inline `grid-column: span 2`. To make them side-by-side they must be
adjacent, so wrap them in a new `.analytics-dual-row-focus-heatmap` and move Heatmap up
(before Stats). Use the specific class name (not a generic `.analytics-dual-row`) so any
future dual-row patterns in Analytics can't collide with or be overridden by this one.

- Wrap Focus History card + Heatmap card in:
  `<div class="analytics-dual-row-focus-heatmap"> … </div>` placed where Focus History
  currently is (before the Stats grid).
- Remove `style="grid-column: span 2;"` from BOTH the Focus History and Heatmap cards
  (keep `class="dash-card"`). They now sit in the 2-col dual-row.
- Keep `.analytics-stats-grid` (`id="analyticsStatsGrid"`) and `.analytics-charts-grid`
  as the following top-level sections, unchanged.
- Leave the Conflicts card's inline `grid-column: span 2` inside `.analytics-charts-grid`
  (it correctly spans the charts grid full-width).

Resulting order: view-header → [Focus History | Heatmap] → Stats grid → Charts grid.

### 2. CSS (`analytics.css`)
- Keep:
  ```css
  #analytics-view.active { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; align-items: start; }
  #analytics-view .view-header,
  #analytics-view .analytics-stats-grid,
  #analytics-view .analytics-charts-grid { grid-column: 1 / -1; }
  ```
- Add the dual-row (this is what makes the 2 columns visibly appear). Use the specific
  class name so it can't clash with future dual-row layouts:
  ```css
  .analytics-dual-row-focus-heatmap {
      grid-column: 1 / -1;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      align-items: start;
  }

  /* When the Heatmap is empty, let the Focus card fill the row instead of
     leaving an orphan 24px gap next to an empty heatmap cell. */
  .analytics-dual-row-focus-heatmap:has(.analytics-heatmap-empty) {
      grid-template-columns: 1fr;
  }
  ```
- Add to the existing `@media (max-width: 900px)` block so the pair collapses:
  ```css
  .analytics-dual-row-focus-heatmap { grid-template-columns: 1fr; }
  ```

### 3. Why this works
All top-level sections span full width (`1 / -1`), so the outer grid just stacks them;
the visible 2-column effect comes from `.analytics-dual-row` (Focus | Heatmap). Below
900px the outer grid is 1 column and the dual-row also collapses to 1 column.

## Validation
- `npm run lint:css` passes (new selectors are unique; no duplicate-selector issues).
- Reload the page (SW updates to v13) → Analytics shows Focus History and Heatmap
  side-by-side; Stats / Category|Peak / Conflicts full-width; resizing < 900px collapses
  everything to a single column without overflow.
- When the Heatmap is empty, the row should still look intentional: the Focus card spans
  the full width (no orphan 24px gap). This relies on the heatmap empty state carrying the
  `.analytics-heatmap-empty` class — `renderHeatmap()` currently always renders the month
  grid (no explicit empty state), so the `:has()` guard is forward-looking; if an empty
  state is later added it should use that class to activate the collapse.

## Notes
- No JS/data changes (the `:has()` guard is pure CSS and defensive).
- The earlier `v13` SW bump + SWR change is what lets the new CSS actually reach the
  browser; without a reload the user would still see stale CSS.
