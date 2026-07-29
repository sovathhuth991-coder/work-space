# Flexible Tasks Action Wiring + Task Focus Verification

## Current State
- The `+ Add` button on the Flexible Tasks card (`data-action="toggleAddFlexTaskForm"`) is broken because `app.js` has no handler for it.
- The same `app.js` action-handler map is missing every related flexible-task action: `cancelAddFlexTask`, `submitNewFlexTask`, `startFlexTaskFocus`, `deleteFlexTask`, `toggleFlexTask`, and `focusFlexTask`.
- The underlying functions exist and are already exposed globally in `flexible-tasks.js` and `task-focus.js`, so this is purely a missing wiring issue.
- Task Focus layout in `index.html` is correct: `#taskFocusShell` sits inside `.simple-timer-card` after the pomodoro shell, and `pomodoro.js`’s `switchPomodoroMode('taskFocus')` already handles showing/hiding it.
- The `+ Add` button already has no icon, so no cleanup is needed there.

### Bug discovered during verification (latent type mismatch)
`flexible-tasks.js` creates task IDs as **numbers** via `Date.now()` (line 33). HTML `data-id` attributes always expose strings. `getFlexibleTaskById` (line 57) uses strict equality (`t.id === id`), so lookups from click handlers always fail with `null`, triggering the toast: `"That task isn't there anymore — pick another"`. This was hidden before because the related buttons were not wired into `app.js`.

### Issue: idle timer and session persistence
User reports two problems in `session-tracker.js`:
1. Idle timer appears not to count in real time, and only retroactively updates when switching back from another tab.
2. Today’s sessions are not saved / not persisted.

Root causes:
- `startIdleTrackingOnLoad()` (line 733) resets `lastActivityTime = Date.now()` every time it is called (page load and again on `viewChanged` → timer-view). This can mask real idle time and make the idle display feel jittery or “reset” unexpectedly.
- `endSession()` exists but is never wired to any button; no `endSessionBtn` exists in the HTML. `saveCompletedSession()` is only called from `resetCurrentSession()` (task change). If the user never changes tasks or leaves the page, the current session is never persisted.
- There is no `beforeunload` auto-save. Closing or refreshing the tab loses the in-progress session state.

## Plan

### 1. Wire missing action handlers in `app.js`
In the click-delegated `actionHandlers` map inside `WorkspaceCore/app.js`, add entries for every flexible-task action that is currently unhandled:

| `data-action` | Call |
|---|---|
| `toggleAddFlexTaskForm` | `toggleAddFlexibleTaskForm?.()` |
| `cancelAddFlexTask` | `cancelAddFlexTask?.()` |
| `submitNewFlexTask` | `submitNewFlexTask?.()` |
| `startFlexTaskFocus` | `(id) => startFocusForTask?.(actionBtn.dataset.id)` |
| `deleteFlexTask` | `(id) => deleteFlexibleTask?.(actionBtn.dataset.id)` |
| `toggleFlexTask` | `(id) => toggleFlexibleTaskManual?.(actionBtn.dataset.id)` |
| `focusFlexTask` | `(id) => selectTaskForFocus?.(actionBtn.dataset.id)` |

Notes:
- `startFocusForTask` is the global entry point exposed by `task-focus.js` (line 288). It handles view switching + mode switching + picking the task. Do **not** replace it with a duplicate switcher.
- `selectTaskForFocus` is the picker-level selector exposed by `task-focus.js` (line 280). It is the correct target for the `focusFlexTask` buttons rendered inside the Task Focus picker (`task-focus.js` line 123).
- Use optional chaining (`?.`) to match the existing style of the map and avoid throwing if a module is not loaded.

### 2. Fix string/number ID mismatch in `flexible-tasks.js`
Update `getFlexibleTaskById` to normalize incoming IDs before strict-equality comparison:

```javascript
function getFlexibleTaskById(id) {
    const numId = Number(id);
    return flexibleTasks.find(t => t.id === numId) || null;
}
```

This is the minimal, centralized fix. It also covers `deleteFlexibleTask`, `updateFlexibleTaskRemaining`, `markFlexibleTaskComplete`, and `toggleFlexibleTaskManual`, all of which call `getFlexibleTaskById`.

### 3. Verify Task Focus layout in Timer view
Confirm the following are already true (no source change required unless something is off):
- `index.html` places `#taskFocusShell` immediately after `#pomodoroShell`, both inside `.simple-timer-card`.
- `#taskFocusShell` carries `class="task-focus-shell pomodoro-shell"`, inheriting `.pomodoro-shell` layout (centered, max-width 500px, hidden by default).
- `pomodoro.js` initializes `taskFocusBtn` (`#taskFocusModeBtn`) and `taskFocusShell` references, and `switchPomodoroMode('taskFocus')` handles visibility.
- `task-focus.js` initializes its own state, ring geometry, picker/session screens, and exposes the required globals.

If anything is misaligned, fix it; otherwise this step is verification-only.

### 4. Clean up the `+ Add` button
Verify that `index.html` line 779 renders `<button ...>+ Add</button>` with no stray icon markup. If clean, no change needed.

### 5. Fix `startIdleTrackingOnLoad()` in `session-tracker.js`
Change the initialization to avoid resetting the idle clock on every view switch:

```javascript
function startIdleTrackingOnLoad() {
    if (!lastActivityTime) {
        lastActivityTime = Date.now();
    }

    // Start activity detection
    setupActivityDetection();

    // Check idle state every second
    if (!activityCheckInterval) {
        activityCheckInterval = setInterval(checkIdleState, 1000);
    }

    // Also for current session
    if (!isRunning && !sessionIdleStartTime) {
        sessionIdleStartTime = Date.now();
        sessionIdleTimeAtStart = sessionIdleSeconds;
    }
}
```

Notes:
- Keep the first-load behavior (establish `lastActivityTime` if missing).
- Do **not** overwrite `lastActivityTime` on every `viewChanged` call; that resets the idle detection unfairly.

### 6. Auto-save current session on `beforeunload` in `session-tracker.js`
Add a `beforeunload` listener inside `initTracker()` so closing/refreshing the page persists the in-progress session:

```javascript
window.addEventListener('beforeunload', function() {
    if (typeof saveCompletedSession === 'function') saveCompletedSession();
    if (typeof saveAccumulatedTime === 'function') saveAccumulatedTime();
});
```

Notes:
- This only runs when the page is actually unloading; normal view switching or tab backgrounding is unaffected.
- If the user returns later, `loadAccumulatedTime()` restores the persisted daily totals on the next load.
- Do not reset live counters after auto-saving here; only `endSession()` should reset counters.

### 7. Expose `saveCompletedSession` globally
Add at the bottom of `session-tracker.js` alongside the other `window.*` exposures:

```javascript
window.saveCompletedSession = saveCompletedSession;
```

This allows other modules (like `task-focus.js`) or future buttons to trigger session persistence consistently without duplicating logic.

## Files to modify
- `WorkspaceCore/app.js` — add 7 entries to the `actionHandlers` map.
- `WorkspaceFeatures/schedule/flexible-tasks.js` — normalize `id` in `getFlexibleTaskById`.
- `WorkspaceFeatures/timer/session-tracker.js` — fix `startIdleTrackingOnLoad()`, add `beforeunload` auto-save, expose `saveCompletedSession`.
- `public/WorkspaceCore/app.js` — mirrored copy (keep in sync).
- `public/WorkspaceFeatures/schedule/flexible-tasks.js` — mirrored copy (keep in sync).
- `public/WorkspaceFeatures/timer/session-tracker.js` — mirrored copy (keep in sync).

## Validation
- Click `+ Add` → form toggles open.
- Click `Cancel` → form closes and inputs clear.
- Click `Add Task` → task is created, list refreshes, success toast shows.
- Click `▶ Focus` on a flexible task → switches to Timer view / Task Focus mode and opens that task’s session.
- Click `🗑` → task is removed.
- Click checkbox → task toggles complete/incomplete.
- Click a task in the Task Focus picker → timer screen opens for that task (no more "task isn't there anymore" error).
- Open browser dev tools, start a focus session, then reload the page → completed session should still appear in “Today’s Sessions” and the total timer should reflect the persisted time.
- Idle tracking should no longer reset its baseline when switching into the timer view.
