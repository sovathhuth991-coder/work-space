# Dashboard — Debug & Improvement Plan

## Verified Findings

| # | Issue | File | Line | Root Cause |
|---|-------|------|------|------------|
| B1 | `renderAllSessions()` delete buttons dead | `dashboard.js` | 312 | `querySelectorAll('.session-delete-btn')` runs **before** `container.innerHTML = html` at line 333 |
| B2 | `deleteDashTodo()` blocks with `confirm()` | `dashboard.js` | 56 | Uses native `confirm()`; undo store already registered |
| B3 | `isPomodoroModeActive()` always `false` | `live-widgets.js` | 213 | Checks `classList.contains('active')` but visibility is `style.display` (confirmed in `session-tracker.js:1164`) |
| B4 | Greeting date stale after midnight | `dashboard.js` | 872-878 | Date rendered once in `initDashboardEngine()`; live interval at line 891 only calls `updateDashboardLiveSession()` |
| B6 | `clearQuickNotes()` blocks with `confirm()` | `dashboard.js` | 863 | Same blocking dialog pattern as B2 |
| I1 | Quick Notes has no "view all" or count | `dashboard.js` | 838-851 | `renderQuickNotes()` only shows last 3 notes; no modal exists |
| I2 | Timer mini lacks phase label | `live-widgets.js` | 229-234 | `renderTimerMini()` only sets time, no phase text |
| I3 | No "active now" schedule highlight | `live-widgets.js` | 151-163 | `renderAgendaItemsHtml()` never checks time window |
| I4 | Focus goal ring lags at 30 s | `dashboard.js` | 929-932 | `__focusGoalInterval` is hardcoded to 30000 ms |
| I5 | Lesson sparkline duplicates tasks | `dashboard.js` | 1170-1194 | `sparkline-lessons` uses `dataKey: 'sessions'` instead of a dedicated `lessons` key |

## Design Decisions

- **I1 modal pattern**: Use `#genericDetailModal` (matching Tasks Done Today / Lesson Folders) instead of `openLiveWidgetModal()`. The modal already has close-button wiring and consistent styling.
- **I2 timer mini phase label (Option A)**: Show custom timer label if one is active, falling back to `'Focus Timer'`. Since `customTimers` is scoped inside `simple-timer.js`'s IIFE, expose a `window.getSimpleTimerLabel()` getter. It returns the matching custom timer's `label` when `totalSeconds` matches a custom timer's `minutes * 60`, otherwise maps known presets (`5`, `25`, `50`) to their labels, and falls back to `'Focus Timer'`.

## Implementation Tasks

### [dashboard.js] Bug Fixes
1. **B1** — Move the `.session-delete-btn` listener block from line 312 to **after** line 333 (`container.innerHTML = html`), keeping the existing click handler body unchanged.
2. **B2** — Replace `confirm('Delete this task?')` with `saveStateForUndo('dashboard-todos')` then immediate delete + `showUndoToast('Task deleted', undoCallback, 5000)`.
3. **B4** — Extract date/greeting rendering into a helper and call it from `updateDashboardLiveSession()` so it refreshes every tick and on `window.focus`.
4. **B6** — Apply same toast+undo pattern as B2 to `clearQuickNotes()` (key: `'quick-notes'`).

### [dashboard.js] Improvements
5. **I1** — In `renderQuickNotes()`, append a badge (`quickNotes.length`) and a "View all X notes" link that calls `showQuickNotesModal()`. Add `showQuickNotesModal()` using `#genericDetailModal` (set `titleEl.textContent`, populate `genericDetailContent` with a scrollable list of all notes, wire close button).
6. **I4** — Change `setInterval` at line 932 from `30000` to `5000`.
7. **I5** — Add `else if (dataKey === 'lessons') value = hubState.folders.filter(f => sameDay(f.createdAt, d)).length;` to the sparkline data builder, and change `sparkline-lessons` config to `dataKey: 'lessons'`.

### [live-widgets.js] Bug Fixes & Improvements
8. **B3** — Change `isPomodoroModeActive()` to check `style.display !== 'none'` (and null-safe), matching `session-tracker.js` pattern.
9. **I2** — In `initTimerMiniCard()` HTML, add `<div class="timer-mini-phase" id="timerMiniPhase"></div>` beneath the display. In `renderTimerMini()`, set phase text: Pomodoro mode reads `pomodoroPhase.textContent` (trimmed); regular mode calls `window.getSimpleTimerLabel()` (new getter from `simple-timer.js`).
10. **I3** — In `renderAgendaItemsHtml()`, compute `currentHHMM` and mark the first item where `ev.start <= currentHHMM && ev.end >= currentHHMM` with `active-now` class. Add CSS rule for `.schedule-mini-item.active-now` in `dashboard.css` or inline style block.

### [simple-timer.js] Supporting Change for I2
11. Expose `window.getSimpleTimerLabel = function() { ... }` that returns the active timer's label: matches `customTimers` by `minutes === totalSeconds / 60`, falls back to preset labels (`5 min`, `25 min`, `50 min`), then `'Focus Timer'`.

## Validation
- **B1**: Delete button in Today's Sessions triggers removal + toast, no console errors.
- **B2/B6**: No native `confirm()` dialogs; 5-second undo toast restores state.
- **B3**: Pomodoro mode shows correct mini timer time (cross-check with full timer display).
- **B4**: Greeting updates after midnight without reload.
- **I1**: Count badge visible; "View all" opens `#genericDetailModal` with all notes scrollable.
- **I2**: Phase label visible and updates when Pomodoro phase changes or custom timer is selected.
- **I3**: Active schedule item has distinct highlight during its time window.
- **I4**: Goal ring updates at least every 5 s during active sessions.
- **I5**: Lessons sparkline shows different data from tasks sparkline.

## Out of Scope
- No layout/toolbar changes.
- No new dependencies.
- HTML structure changes are limited to Quick Notes widget header, timer mini card, and `simple-timer.js` getter addition.
- Individual note deletion inside the "View all" modal is out of scope (bulk clear already has undo).
