# Plan: Redesign Total Timer card

## Goal
Restyle the Total Timer card to match the provided screenshot:
- Single horizontal row of 4 compact blocks: FOCUS / BREAK / IDLE / TOTAL
- Smaller labels above larger time values
- Segmented 4-color progress bar below the blocks
- Match existing dark card styling, borders, and status colors

## Scope
- Preserve all JS behavior: `updateUI()`, `updateCurrentSessionDisplay()`, `updateTotalTimerFromHistory()`, `saveCompletedSession()`
- Preserve same DOM IDs: `focusTimeDisplay`, `breakTimeDisplay`, `idleTimeDisplay`, `totalTimeDisplay`
- Preserve same class hooks used by JS: `.focus-block`, `.break-block`, `.idle-block`, `.total-block`

## Files to modify
1. `Workspace/index.html` — Total Timer + Current Session HTML structure
2. `Workspace/WorkspaceFeatures/timer/timer-enhancements.css` — styles
3. `public/index.html` — mirror of HTML changes
4. `public/WorkspaceFeatures/timer/timer-enhancements.css` — mirror of CSS changes

## HTML changes — Total Timer block

Current Total Timer blocks:
```html
<div class="session-time-display">
    <div class="time-block focus-block">...</div>
    <div class="time-block break-block">...</div>
    <div class="time-block idle-block">...</div>
    <div class="time-block total-block">...</div>
</div>
```

No structural HTML change needed for the 4 blocks themselves; they're already `1fr x4` grid.

Current Session blocks already exist as `session-time-display-4` with 4 blocks.

## CSS changes

### 1. `.session-time-display` — keep 4-column grid but tighten spacing
Change `gap: 16px` → `gap: 10px` and reduce bottom margin.

### 2. `.time-block` — compact card style
Reduce `padding: 20px` → `10px 8px`.
Reduce `border-radius: 10px` → `8px`.
Keep background and border as-is.

### 3. `.time-label` — smaller uppercase label
`font-size: 0.6rem`.
`margin-bottom: 4px`.
Keep uppercase, letter-spacing.

### 4. `.time-value` — larger dominant number
`font-size: 1.4rem` for Total Timer blocks.
`line-height: 1.1`.

### 5. `.session-time-display-4 .time-value` — smaller for Current Session
`font-size: 1.1rem`.

### 6. Progress bar — segmented 4-color fill
Replace single `session-progress-fill` with 4 child `span` elements:
```html
<div class="session-progress">
    <span class="progress-segment progress-focus" style="width: 25%"></span>
    <span class="progress-segment progress-break" style="width: 25%"></span>
    <span class="progress-segment progress-idle" style="width: 25%"></span>
    <span class="progress-segment progress-total" style="width: 25%"></span>
</div>
```

Add CSS:
```css
.session-progress {
    display: flex;
    height: 6px;
    background: rgba(255,255,255,0.04);
    border-radius: 99px;
    overflow: hidden;
    gap: 2px;
    margin: 10px 0 0;
}
.progress-segment {
    height: 100%;
    border-radius: 2px;
    transition: width 0.4s ease;
}
.progress-focus { background: var(--status-online); }
.progress-break { background: var(--status-attention); }
.progress-idle { background: var(--text-muted); }
.progress-total { background: var(--accent-1); }
```

Widths will be set by JS based on `totalSeconds` and a fixed daily goal (e.g. 8 hours = 28800s). If total < goal, segments are proportional; if total >= goal, fill 100%.

### 7. Remove old `session-progress-fill` styles
Remove `.session-progress-fill`, `.session-progress-fill::after`, and `.session-progress` old rules.

### 8. Responsive
At `max-width: 768px` keep 2-column grid for both Total Timer and Current Session blocks.

## JS integration
No JS changes required for display. The existing `updateUI()` already updates `.time-value` text content.

Optional: update `updateUI()` or add helper to set progress segment widths based on focus/break/idle/total seconds vs a daily goal constant.

## Validation
1. Open timer page: Total Timer shows 4 compact blocks with labels + large numbers
2. Start a session: Current Session blocks update live
3. Progress bar shows 4 colored segments proportional to respective times
4. Resize to mobile: 2-column grid remains readable
5. No console errors from changed selectors

## Out of scope
- No changes to data model, localStorage keys, or save logic
- No changes to session-tracker.js, simple-timer.js, task-focus.js, pomodoro.js
- No changes to Dashboard Today's Sessions redesign
