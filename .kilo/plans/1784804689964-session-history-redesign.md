# Plan: Redesign "Today's Sessions" to match mockup

## Goal
Restyle the `renderSessionHistory()` output in the dashboard's Today's Sessions card to match the provided mockup. Both `Workspace/` and `public/` copies must be updated because `deploy.bat` syncs them, and the app can be served from either path.

## Files to modify
1. `Workspace/WorkspaceFeatures/dashboard/dashboard.js` — `renderSessionHistory()` HTML
2. `Workspace/WorkspaceFeatures/dashboard/dashboard.css` — `.session-history-*` styles
3. `public/WorkspaceFeatures/dashboard/dashboard.js` — mirror of (1)
4. `public/WorkspaceFeatures/dashboard/dashboard.css` — mirror of (2)

## Scope boundary
- Do NOT touch `.timer-sessions-panel .session-history-item` in `timer-enhancements.css` — it is a separate, unrelated panel.
- Do NOT modify `showSessionDetailsModal`, data model, or localStorage keys.

---

## HTML changes — `renderSessionHistory()` in dashboard.js

### Live session HTML (replace current block at lines 413-425)

Before:
```html
<div class="session-history-item session-history-live" title="Still in progress">
    <div class="session-history-time">🔴 Now</div>
    <div class="session-history-info">
        <div class="session-history-task-name">${escapeHtml(live.taskName)}</div>
        <div class="session-history-duration">
            <span class="focus-time">⏱ ${formatTimeShort(live.focusSeconds || 0)}</span>
            <span class="break-time">☕ ${formatTimeShort(live.breakSeconds || 0)}</span>
            <span>⏳ ${formatTimeShort(live.totalSeconds || 0)}</span>
        </div>
    </div>
</div>
```

After:
```html
<div class="session-history-item session-history-live" title="Still in progress">
    <div class="session-history-now-indicator">
        <span class="now-dot"></span>
        <span class="now-text">NOW</span>
    </div>
    <div class="session-history-info">
        <div class="session-history-task-name">${escapeHtml(live.taskName)}</div>
        <div class="session-history-duration">
            <span class="focus-time">⏱ ${formatTimeShort(live.focusSeconds || 0)}</span>
            <span class="break-time">☕ ${formatTimeShort(live.breakSeconds || 0)}</span>
            <span>⏳ ${formatTimeShort(live.totalSeconds || 0)}</span>
        </div>
    </div>
    <div class="session-history-still-progress">Still in progress</div>
</div>
```

### Completed session HTML (lines 446-458)
No structural change needed. Keep existing structure with `.session-history-time` as first child.

---

## CSS changes — `dashboard.css`

### 1. Tighten base `.session-history-item`
Replace the current `gap` and `padding`:
```css
.session-history-item {
    gap: 10px;
    padding: 10px 14px;
}
```

### 2. Update `.session-history-live` block
Replace the current live-only rules:
```css
.session-history-live {
    cursor: default;
    background: rgba(239, 68, 68, 0.04);
    border-color: rgba(239, 68, 68, 0.15);
}

.session-history-live::before {
    background: var(--status-danger);
    opacity: 1;
}

.session-history-live:hover {
    background: rgba(239, 68, 68, 0.08);
    border-color: rgba(239, 68, 68, 0.25);
    transform: none;
}

.session-history-live .session-history-time {
    color: var(--status-danger);
    animation: sessionLivePulse 2s ease-in-out infinite;
}
```

Note: `.session-history-live .session-history-time` now matches nothing (live item no longer uses that class). Keep it as a harmless fallback, or remove it. Either is fine.

### 3. Add `.session-history-now-indicator` and children (new)
```css
.session-history-now-indicator {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
}

.now-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--status-danger);
    box-shadow: 0 0 8px rgba(239, 68, 68, 0.6);
    animation: nowPulse 2s ease-in-out infinite;
}

.now-text {
    font-size: 0.65rem;
    font-weight: 700;
    color: var(--status-danger);
    text-transform: uppercase;
    letter-spacing: 0.06em;
}

@keyframes nowPulse {
    0%, 100% { opacity: 1; box-shadow: 0 0 8px rgba(239, 68, 68, 0.6); }
    50%      { opacity: 0.6; box-shadow: 0 0 3px rgba(239, 68, 68, 0.3); }
}
```

### 4. Add `.session-history-still-progress` (new)
```css
.session-history-still-progress {
    font-size: 0.65rem;
    font-weight: 500;
    padding: 4px 10px;
    border-radius: 9999px;
    background: rgba(239, 68, 68, 0.08);
    color: #f87171;
    white-space: nowrap;
    flex-shrink: 0;
}
```

### 5. Adjust `.session-history-time` for completed items
Override accent color and uppercase transform for completed timestamps:
```css
.session-history-item:not(.session-history-live) .session-history-time {
    color: #60a5fa;
    text-transform: none;
    letter-spacing: normal;
}
```

### 6. Prevent duration row wrap
Change existing `flex-wrap: wrap` to `nowrap`:
```css
.session-history-duration {
    flex-wrap: nowrap;
}
```

### 7. Reduce `@media (prefers-reduced-motion: reduce)` scope
The existing reduced-motion rule only targets `.session-history-live .session-history-time`. After the HTML change, the live indicator lives in `.session-history-now-indicator .now-dot`, not `.session-history-time`. Update or duplicate the reduced-motion rule so it still disables the pulse when users prefer reduced motion:

Option A (preferred — explicit and clear):
```css
@media (prefers-reduced-motion: reduce) {
    .session-history-live .session-history-time,
    .session-history-now-indicator .now-dot {
        animation: none;
    }
}
```

Option B — remove the old unused rule and add only the new one. Either is acceptable; I recommend Option A for safety.

---

## JS changes — `renderSessionHistory()` selectors
The existing selectors remain valid:
- `container.querySelectorAll('.session-history-item:not(.session-history-live)')` — still correctly targets completed items for click handlers.
- Delete button selector — unchanged.
- No new event listeners needed; the pill is static text.

---

## Sync rule
Both `Workspace/` and `public/` copies must be updated. `deploy.bat` overwrites `public/`, so if only `Workspace/` is changed, the changes are lost on deploy. If the app is opened directly from `public/index.html` without running deploy, the old `public/` files would show the old UI.

---

## Validation steps
1. Open dashboard with no live session, only completed sessions: timestamps appear on the left (blue), task names centered, stats row on one line, arrow + delete on the right.
2. Start a focus session: live row shows pulsing red dot + "NOW", title, stats, and "Still in progress" pill on the right. No arrow. No hover-shift.
3. Complete the session: it transitions to a completed row with the time label.
4. Delete a completed row: no JS errors, list updates correctly.
5. Hover a completed row: subtle purple tint, left bar brightens, arrow shifts.
6. Resize below 860px: card stacks vertically, text remains readable, no overflow.
7. Check `prefers-reduced-motion`: the red dot does not pulse.

---

## Out of scope
- No changes to `showSessionDetailsModal`.
- No changes to `timer-enhancements.css`.
- No changes to data model, localStorage keys, or session-tracker/task-focus logic.
