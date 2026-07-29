# Timer UI Cleanup & Pomodoro Swap Fix

## Problem
1. `#sessionTracker` still shows task selector, linked badge, scheduled minutes input, and a 📌 pin emoji.
2. Total Timer shows live in-memory counters that don't include completed sessions in history.
3. Reset/End buttons are unnecessary for a total/read-only timer.
4. Clicking Pomodoro moves the shell below the focus timer, causing page scroll/jump.

## Sanity Checks (Confirmed)
- ✅ `localStorage` key is **`completedSessions`** — used everywhere in `session-tracker.js` and `dashboard.js`. `sessionHistory` is legacy-only.
- ✅ HTML IDs match existing JS variables: `focusTimeDisplay` → `focusDisplay`, `breakTimeDisplay` → `breakDisplay`, `idleTimeDisplay` → `idleDisplay`, `totalTimeDisplay` → `totalDisplay`.
- ✅ `#pomodoroShell` has inline style `margin: 0 auto 40px` (40px bottom). Once moved inside `.simple-timer-card`, set `margin-bottom: 0` to avoid awkward spacing.
- ✅ **Critical catch**: hiding `.simple-timer-card` would also hide the mode toggle + pomodoro shell inside it. Fix: wrap only countdown content in `.countdown-content` and hide/show that wrapper.

## Scope Confirmed
- Total Timer cleanup
- Total Timer includes completed session totals from `completedSessions`
- Remove Reset/End buttons
- Move mode toggle + pomodoro shell inside `.simple-timer-card`
- Add 300ms fade swap on the card, but swap visibility on `.countdown-content`
- Orphan CSS removal
- Null guards
- Sync to `public/`

Out of scope: state refactor, notifications, keyboard shortcuts, analytics, theme toggle, stats redesign.

## Files to Change
- `Workspace/index.html`, `public/index.html`
- `Workspace/WorkspaceFeatures/timer/timer-enhancements.css`, `public/...`
- `Workspace/WorkspaceFeatures/timer/session-tracker.js`, `public/...`
- `Workspace/WorkspaceFeatures/timer/pomodoro.js`, `public/...`
- `Workspace/WorkspaceFeatures/timer/pomodoro.css`, `public/...`

## Steps

### 1. HTML cleanup (`index.html`, `public/index.html`)
In `#sessionTracker > .session-tracker-header`, delete `<div class="task-selector-wrapper">` and `<div class="scheduled-input-wrapper">`. Delete `.session-actions` (Reset/End buttons). Keep only the title.

### 2. Add `simple-timer-card` to focus timer wrapper
```html
<div class="focus-timer-section simple-timer-card" ...>
```

### 3. Wrap countdown content in `.countdown-content` and move pomodoro mode toggle + shell inside `.simple-timer-card`

Inside `.simple-timer-card`, restructure:

```html
<div class="focus-timer-section simple-timer-card" ...>

    <!-- COUNTDOWN CONTENT (hidden when Pomodoro active) -->
    <div class="countdown-content">
        <!-- Progress Ring, countdown display, Start/Pause/Reset, presets, custom timers -->
    </div>

    <!-- MODE TOGGLE (always visible) -->
    <div class="pomodoro-mode-toggle" style="display:flex;gap:8px;justify-content:center;margin:20px auto;max-width:500px;">
        <button id="pomodoroCountdownBtn" class="pomodoro-mode-btn active">⏱ Countdown</button>
        <button id="pomodoroPomoBtn" class="pomodoro-mode-btn">🍅 Pomodoro</button>
    </div>

    <!-- POMODORO SHELL (always visible in DOM, display:none when inactive) -->
    <div id="pomodoroShell" class="pomodoro-shell" style="max-width:500px;margin:0 auto;display:none;">
        <!-- existing pomodoro markup -->
    </div>
</div>
```

Remove the original `.pomodoro-mode-toggle` and `#pomodoroShell` from their current position outside `.focus-timer-section`.

### 4. pomodoroShell CSS margin (`pomodoro.css`)
Since it's now inside the card, ensure it doesn't add extra spacing:
```css
.pomodoro-shell {
    margin-bottom: 0;
}
```

### 5. Total Timer spacing (`timer-enhancements.css`)
- `.time-block`: padding `20px`
- `.time-value`: `font-size: 2rem`
- `.session-time-display`: gap `16px`

### 6. `initPomodoro()` focus panel selector (`pomodoro.js`)
Change from `.timer-panel-focus` to `.simple-timer-card`:
```js
const focusPanel = document.querySelector('.simple-timer-card');
```

### 7. Fade swap CSS + JS (FIXED)
In `timer-enhancements.css`, add to `.simple-timer-card`:
```css
transition: opacity 0.3s ease, transform 0.3s ease;
```
And:
```css
.simple-timer-card.swapping {
    opacity: 0;
    transform: scale(0.95);
}
```

In `pomodoro.js`, rewrite `switchPomodoroMode(mode)`:
```js
let swapTimeout;
function switchPomodoroMode(mode) {
    const card = document.querySelector('.simple-timer-card');
    const countdownContent = card ? card.querySelector('.countdown-content') : null;
    const pomodoroShell = document.getElementById('pomodoroShell');
    const countdownBtn = document.getElementById('pomodoroCountdownBtn');
    const pomodoroBtn = document.getElementById('pomodoroPomoBtn');

    if (swapTimeout) clearTimeout(swapTimeout);
    if (card) card.classList.add('swapping');

    swapTimeout = setTimeout(() => {
        clearInterval(pomoInterval);
        pomoInterval = null;
        isRunning = false;
        phaseStartTime = null;
        elements.ringContainer?.classList.remove('pomodoro-running');

        if (mode === 'pomodoro') {
            if (countdownContent) countdownContent.style.display = 'none';
            if (pomodoroShell) {
                pomodoroShell.style.display = 'block';
                pomodoroShell.classList.add('active');
            }
            if (countdownBtn) countdownBtn.classList.remove('active');
            if (pomodoroBtn) pomodoroBtn.classList.add('active');
            resetPomodoro();
        } else {
            if (countdownContent) countdownContent.style.display = 'block';
            if (pomodoroShell) {
                pomodoroShell.style.display = 'none';
                pomodoroShell.classList.remove('active');
            }
            if (countdownBtn) countdownBtn.classList.add('active');
            if (pomodoroBtn) pomodoroBtn.classList.remove('active');
        }

        if (card) card.classList.remove('swapping');
        swapTimeout = null;
    }, 300);
}
```

### 8. Total Timer history integration (`session-tracker.js`)
```js
function getTodayHistoryTotals() {
    try {
        const completedSessions = JSON.parse(localStorage.getItem('completedSessions') || '[]');
        const today = new Date().toDateString();
        let focus = 0, break_ = 0, idle = 0;
        for (const session of completedSessions) {
            if (new Date(session.timestamp).toDateString() === today) {
                focus += session.focusSeconds || 0;
                break_ += session.breakSeconds || 0;
                idle += session.idleSeconds || 0;
            }
        }
        return { focus, break: break_, idle, total: focus + break_ + idle };
    } catch (e) {
        return { focus: 0, break: 0, idle: 0, total: 0 };
    }
}

function updateTotalTimerFromHistory() {
    const history = getTodayHistoryTotals();
    const totalFocus = history.focus + (focusSeconds || 0);
    const totalBreak = history.break + (breakSeconds || 0);
    const totalIdle = history.idle + (idleSeconds || 0);
    if (focusDisplay) focusDisplay.textContent = formatTime(totalFocus);
    if (breakDisplay) breakDisplay.textContent = formatTime(totalBreak);
    if (idleDisplay) idleDisplay.textContent = formatTime(totalIdle);
    if (totalDisplay) totalDisplay.textContent = formatTime(totalFocus + totalBreak + totalIdle);
}
```
Call in: `updateUI()`, `endSession()`, `checkDayChange()`, and after any `renderSessionHistory()` call.

### 9. Remove orphan CSS (`timer-enhancements.css`)
Delete:
- `.session-tracker-title::before { content: '📌'; ... }`
- `.task-selector-wrapper`, `.task-selector-wrapper select`, `.task-selector-wrapper select:focus`
- `.auto-link-badge`, `.auto-link-badge::before`
- `.scheduled-input-wrapper`, `.scheduled-input-wrapper label`, `.scheduled-input-wrapper input`, `.scheduled-input-wrapper input:focus`, `.scheduled-input-wrapper span`
- `.session-actions` and `.session-btn-*` rules
- The responsive `.task-selector-wrapper` block in `@media (max-width: 768px)`

### 10. Sync to `public/`
Overwrite all modified files into `public/`.

## Validation
- [ ] `#sessionTracker` shows title + 4 time blocks only.
- [ ] Total = sum of today's completed sessions + live session.
- [ ] No task selector, scheduled input, linked badge, or 📌 in DOM.
- [ ] `.countdown-content` is the only element hidden/shown during mode swap.
- [ ] Mode toggle and pomodoro shell stay visible during swap.
- [ ] Pomodoro/Countdown swap without scroll jump.
- [ ] 300ms fade+scale during swap.
- [ ] No console errors from missing DOM refs.
- [ ] `npm run lint:css` passes.
