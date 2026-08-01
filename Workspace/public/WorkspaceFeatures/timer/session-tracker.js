// ============================================================
// SESSION TRACKER – Auto‑links to today's schedule
// ============================================================

(function() {
    'use strict';

    // ----- DOM refs -----
    // currentTaskDisplay/scheduledInput/autoLabelBadge/endSessionBtn/
    // resetTrackerBtn/scheduledDisplay have no matching elements anywhere
    // in index.html (confirmed) — leftover refs from an earlier
    // manual-task-picker UI that's since been replaced by the read-only
    // auto-detected display below. Kept as (always-null) declarations
    // because they're still referenced behind existing if-guards further
    // down — removing the declarations entirely would turn those into
    // ReferenceErrors instead of harmless no-ops.
    const currentTaskDisplay = document.getElementById('currentTaskDisplay');
    const scheduledInput = document.getElementById('trackerScheduled');
    const autoLabelBadge = document.getElementById('autoLabelBadge');
    const resetTrackerBtn = document.getElementById('resetTrackerBtn');
    const endSessionBtn = document.getElementById('endSessionBtn');
    const focusDisplay = document.getElementById('focusTimeDisplay');
    const breakDisplay = document.getElementById('breakTimeDisplay');
    const idleDisplay = document.getElementById('idleTimeDisplay');
    const totalDisplay = document.getElementById('totalTimeDisplay');
    const progressFocusSegment = document.querySelector('.progress-focus');
    const progressBreakSegment = document.querySelector('.progress-break');
    const progressIdleSegment = document.querySelector('.progress-idle');
    const headerFocusTime = document.getElementById('headerFocusTime');
    const headerBreakTime = document.getElementById('headerBreakTime');
    const headerIdleTime = document.getElementById('headerIdleTime');

    // ----- DOM refs (Current Session) -----
    const sessionFocusDisplay = document.getElementById('sessionFocusDisplay');
    const sessionBreakDisplay = document.getElementById('sessionBreakDisplay');
    const sessionIdleDisplay = document.getElementById('sessionIdleDisplay');
    const sessionTotalDisplay = document.getElementById('sessionTotalDisplay');
    const currentSessionTaskName = document.getElementById('currentSessionTaskName');
    const currentSessionTaskTime = document.getElementById('currentSessionTaskTime');

    // The current task is now read-only — always whatever the schedule says
    // is active/next, no manual override. currentTaskData replaces what
    // used to be read off the selected <option>; todayTasksCache is the
    // ordered list autoAdvanceTask() walks through.
    let currentTaskData = null;
    let todayTasksCache = [];

    // ----- State -----
    // isRunning/isBreak are the single canonical "what's happening right
    // now" flags — true only while a Pomodoro or Task Focus session (see
    // FocusSession below) is actively running. Countdown/Simple Timer
    // intentionally never touches these — it keeps its own fully separate
    // state and history (see initTracker's note).
    let isBreak = false;
    let isRunning = false;
    let idleStartTime = null;
    let lastCheckedDate = new Date().toDateString();

    // Ownership: which mode currently controls the Current Session card,
    // and what to call if it should pause itself when the user goes idle
    // (Pomodoro: yes; Task Focus: deliberately no — see FocusSession.begin).
    // While this is set, the schedule's own auto-detection (handleTaskChange)
    // must not reset/relabel Current Session out from under it.
    let activeFocusSource = null;
    let activeSessionOnIdlePause = null;

    // ----- Load current session state from localStorage (survives refresh) -----
    // Without this, previousTaskId/sessionFocusSeconds reset to null/0 on
    // every reload, which makes the tracker treat the same still-active
    // schedule task as "just switched to," fragmenting one real session
    // into a new tiny completedSessions entry on every page load.
    function loadSessionState() {
        try {
            const saved = localStorage.getItem('currentSessionState');
            if (!saved) return;
            const data = JSON.parse(saved);
            const savedDate = new Date(data.timestamp).toDateString();
            const today = new Date().toDateString();
            if (savedDate !== today) return; // new day — checkDayChange() handles the reset
            sessionFocusSeconds = data.sessionFocusSeconds || 0;
            sessionBreakSeconds = data.sessionBreakSeconds || 0;
            sessionIdleSeconds = data.sessionIdleSeconds || 0;
            sessionTaskName = data.sessionTaskName || '';
            sessionTaskStart = data.sessionTaskStart || '';
            sessionTaskEnd = data.sessionTaskEnd || '';
            previousTaskId = data.previousTaskId || null;
        } catch (e) {
            console.warn('Could not load session state:', e);
        }
    }

    // ----- Save current session state to localStorage -----
    function saveSessionState() {
        try {
            localStorage.setItem('currentSessionState', JSON.stringify({
                sessionFocusSeconds,
                sessionBreakSeconds,
                sessionIdleSeconds,
                sessionTaskName,
                sessionTaskStart,
                sessionTaskEnd,
                previousTaskId,
                timestamp: Date.now()
            }));
        } catch (e) {
            console.warn('Could not save session state:', e);
        }
    }

    let lastActivityTime = Date.now();
    const IDLE_THRESHOLD = 300000; // 5 minutes of inactivity = idle
    let activityCheckInterval = null;

    // ----- State (Current Session - resets per task) -----
    let sessionFocusSeconds = 0;
    let sessionBreakSeconds = 0;
    let sessionIdleSeconds = 0;
    let sessionTaskName = '';
    let sessionTaskStart = '';
    let sessionTaskEnd = '';
    let previousTaskId = null;
    let sessionFocusStartTime = null;
    let sessionBreakStartTime = null;
    let sessionIdleStartTime = null;
    let sessionFocusTimeAtStart = 0;
    let sessionBreakTimeAtStart = 0;
    let sessionIdleTimeAtStart = 0;
    let sessionInterval = null;

    // ----- Activity Detection -----
    function setupActivityDetection() {
        // Update last activity time on user interaction
        const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];

        activityEvents.forEach(event => {
            document.addEventListener(event, () => {
                lastActivityTime = Date.now();
            }, { passive: true });
        });
    }

    function checkIdleState() {
        const timeSinceActivity = Date.now() - lastActivityTime;
        const shouldBeIdle = timeSinceActivity >= IDLE_THRESHOLD;

        // If user becomes idle and we're not already tracking idle time
        if (shouldBeIdle && !idleStartTime) {
            idleStartTime = Date.now();
            if (isRunning) {
                // Pause session focus/break timers when idle
                if (sessionFocusStartTime) {
                    const elapsed = Math.floor((Date.now() - sessionFocusStartTime) / 1000);
                    sessionFocusSeconds = sessionFocusTimeAtStart + elapsed;
                    sessionFocusStartTime = null;
                }
                if (sessionBreakStartTime) {
                    const elapsed = Math.floor((Date.now() - sessionBreakStartTime) / 1000);
                    sessionBreakSeconds = sessionBreakTimeAtStart + elapsed;
                    sessionBreakStartTime = null;
                }
            }
            // Let the active session decide whether it wants to pause itself
            // on idle — Pomodoro does, Task Focus deliberately doesn't (an
            // intentional work session that should keep counting down until
            // explicitly paused or completed). See FocusSession.begin().
            if (typeof activeSessionOnIdlePause === 'function') activeSessionOnIdlePause();
        }
        // If user becomes active again
        else if (!shouldBeIdle && idleStartTime) {
            idleStartTime = null;

            // Resume session focus/break timers if they were running
            if (isRunning && !isBreak && !sessionFocusStartTime) {
                sessionFocusStartTime = Date.now();
                sessionFocusTimeAtStart = sessionFocusSeconds;
            } else if (isRunning && isBreak && !sessionBreakStartTime) {
                sessionBreakStartTime = Date.now();
                sessionBreakTimeAtStart = sessionBreakSeconds;
            }
        }

        // Repaint every tick regardless of whether a transition just
        // happened — updateUI() reads the *live* idle value below, not
        // the raw variable, so this is what actually makes idle time
        // visibly count up instead of only updating once you move the
        // mouse again.
        updateUI();
    }

    // ----- Helpers -----
    function formatTime(sec) {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = sec % 60;
        if (h > 0) {
            return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
        }
        return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    }

    function formatTimeDetailed(sec) {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = sec % 60;
        if (h > 0) {
            return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
        }
        return `${m}m ${String(s).padStart(2, '0')}s`;
    }

    function getTodayName() {
        return new Date().toLocaleDateString('en-US', { weekday: 'long' });
    }

    function getCurrentHHMM() {
        const now = new Date();
        return String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    }

    function timeToMinutes(timeStr) {
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
    }

    // ----- Get today's tasks from the global `events` array -----
    function getTodayTasks() {
        const today = getTodayName();
        if (typeof events === 'undefined' || !Array.isArray(events)) return [];
        return events
            .filter(e => e.day === today)
            .sort((a, b) => a.start.localeCompare(b.start));
    }

    // ----- Save completed session to localStorage -----
    function saveCompletedSession() {
        const totalSecs = sessionFocusSeconds + sessionBreakSeconds + sessionIdleSeconds;
        if (totalSecs < 5) return; // Don't save sessions less than 5 seconds

        const completedSessions = JSON.parse(localStorage.getItem('completedSessions') || '[]');
        completedSessions.push({
            taskName: sessionTaskName,
            taskStart: sessionTaskStart,
            taskEnd: sessionTaskEnd,
            focusSeconds: sessionFocusSeconds,
            breakSeconds: sessionBreakSeconds,
            idleSeconds: sessionIdleSeconds,
            totalSeconds: totalSecs,
            timestamp: Date.now()
        });
        localStorage.setItem('completedSessions', JSON.stringify(completedSessions));
        if (typeof renderSessionHistory === 'function') renderSessionHistory();

        // Also dispatch an event so the dashboard can update
        document.dispatchEvent(new CustomEvent('sessionCompleted', {
            detail: { taskName: sessionTaskName }
        }));
    }

    // ----- Reset current session timers -----
    function resetCurrentSession() {
        // Save the old session before resetting
        saveCompletedSession();

        // Stop session interval
        if (sessionInterval) {
            clearInterval(sessionInterval);
            sessionInterval = null;
        }

        // Reset all session state
        sessionFocusSeconds = 0;
        sessionBreakSeconds = 0;
        sessionIdleSeconds = 0;
        sessionFocusStartTime = null;
        sessionBreakStartTime = null;
        sessionIdleStartTime = null;
        sessionFocusTimeAtStart = 0;
        sessionBreakTimeAtStart = 0;
        sessionIdleTimeAtStart = 0;

        // Update the current session UI
        updateCurrentSessionDisplay();
        saveSessionState();
    }

    // ----- Start current session tracking -----
    function startCurrentSessionTracking() {
        if (sessionInterval) {
            clearInterval(sessionInterval);
            sessionInterval = null;
        }

        // Track whether the user was idle when they left, so we
        // don't restart focus/break session timers on page load.
        let wasIdle = false;

        // Initialize session timestamps based on daily tracker state
        if (isRunning && !isBreak && !sessionFocusStartTime) {
            if (sessionIdleStartTime) {
                const idleElapsed = Math.floor((Date.now() - sessionIdleStartTime) / 1000);
                sessionIdleSeconds = sessionIdleTimeAtStart + idleElapsed;
                sessionIdleStartTime = null;
                wasIdle = true;
            }
            if (!wasIdle) {
                sessionFocusStartTime = Date.now();
                sessionFocusTimeAtStart = sessionFocusSeconds;
            }
        } else if (isRunning && isBreak && !sessionBreakStartTime) {
            if (sessionIdleStartTime) {
                const idleElapsed = Math.floor((Date.now() - sessionIdleStartTime) / 1000);
                sessionIdleSeconds = sessionIdleTimeAtStart + idleElapsed;
                sessionIdleStartTime = null;
                wasIdle = true;
            }
            if (!wasIdle) {
                sessionBreakStartTime = Date.now();
                sessionBreakTimeAtStart = sessionBreakSeconds;
            }
        } else if (!isRunning && !sessionIdleStartTime) {
            sessionIdleStartTime = Date.now();
            sessionIdleTimeAtStart = sessionIdleSeconds;
        }

        sessionInterval = setInterval(function() {
            if (isRunning && !isBreak && sessionFocusStartTime) {
                const elapsed = Math.floor((Date.now() - sessionFocusStartTime) / 1000);
                sessionFocusSeconds = sessionFocusTimeAtStart + elapsed;
            } else if (isRunning && isBreak && sessionBreakStartTime) {
                const elapsed = Math.floor((Date.now() - sessionBreakStartTime) / 1000);
                sessionBreakSeconds = sessionBreakTimeAtStart + elapsed;
            } else if (!isRunning && sessionIdleStartTime) {
                const elapsed = Math.floor((Date.now() - sessionIdleStartTime) / 1000);
                sessionIdleSeconds = sessionIdleTimeAtStart + elapsed;
            }
            updateCurrentSessionDisplay();
        }, 100);
    }

    // ----- Update current session UI -----
    function updateCurrentSessionDisplay() {
        if (sessionFocusDisplay) sessionFocusDisplay.textContent = formatTime(sessionFocusSeconds);
        if (sessionBreakDisplay) sessionBreakDisplay.textContent = formatTime(sessionBreakSeconds);
        if (sessionIdleDisplay) sessionIdleDisplay.textContent = formatTime(sessionIdleSeconds);
        const total = sessionFocusSeconds + sessionBreakSeconds + sessionIdleSeconds;
        if (sessionTotalDisplay) sessionTotalDisplay.textContent = formatTime(total);

        // Note: session history is refreshed by saveCompletedSession() /
        // saveTaskFocusSession() / viewHistoryBtn instead; re-rendering it
        // here on every tick causes hover twitching.
    }

    // ----- Update current session task info -----
    function updateCurrentSessionTaskInfo(taskName, start, end) {
        sessionTaskName = taskName || 'No active task';
        sessionTaskStart = start || '';
        sessionTaskEnd = end || '';
        if (currentSessionTaskName) {
            currentSessionTaskName.textContent = sessionTaskName;
        }
        if (currentSessionTaskTime) {
            if (start && end) {
                currentSessionTaskTime.textContent = `${start} – ${end}`;
            } else {
                currentSessionTaskTime.textContent = '';
            }
        }
    }

    // ===== DETECT TASK SWITCH =====
    function handleTaskChange(newTaskId) {
        // Don't let the schedule's own auto-detected "current task" reset or
        // relabel an active Pomodoro/Task Focus session out from under it —
        // FocusSession owns Current Session exclusively while one is running.
        if (activeFocusSource) {
            previousTaskId = newTaskId;
            return;
        }

        if (newTaskId && newTaskId !== previousTaskId && previousTaskId !== null) {
            // Task changed - save current session and reset
            resetCurrentSession();
        }

        previousTaskId = newTaskId;
        saveSessionState();

        // Update current session task info
        if (currentTaskData) {
            updateCurrentSessionTaskInfo(currentTaskData.title, currentTaskData.start, currentTaskData.end);
        }

        // Start/resume current session tracking
        if (!sessionInterval) {
            startCurrentSessionTracking();
        }
    }

    // ----- Apply a task as "current" — updates the read-only display,
    // scheduled-minutes field, badge, and fires handleTaskChange only if
    // the task actually changed (avoids resetting the session every tick) -----
    function applyCurrentTask(task) {
        const newId = task.id || (task.title + task.start);
        const changed = !currentTaskData || currentTaskData.id !== newId;

        currentTaskData = { id: newId, title: task.title, start: task.start, end: task.end };

        if (currentTaskDisplay) {
            const marker = task.isActive ? ' 🔴' : (task.isUpcoming ? ' ⏳' : '');
            currentTaskDisplay.textContent = `${task.title} (${task.start}–${task.end})${marker}`;
        }

        const startM = timeToMinutes(task.start);
        const endM = timeToMinutes(task.end);
        const dur = endM - startM;
        if (dur > 0 && scheduledInput) scheduledInput.value = dur;
        if (autoLabelBadge) {
            autoLabelBadge.textContent = '✅ Linked to task';
            autoLabelBadge.style.color = '#2ecc71';
        }

        if (changed) {
            handleTaskChange(newId);
            updateUI();
        }
    }

    // ----- Determine and display the current task (read-only, no manual
    // switching — always follows the clock against today's schedule) -----
    function updateCurrentTaskDisplay() {
        const tasks = getTodayTasks();
        todayTasksCache = tasks;

        if (tasks.length === 0) {
            currentTaskData = null;
            if (currentTaskDisplay) currentTaskDisplay.textContent = 'No tasks scheduled for today';
            if (autoLabelBadge) {
                autoLabelBadge.textContent = '📭 No tasks';
                autoLabelBadge.style.color = '#888';
            }
            updateCurrentSessionTaskInfo('No tasks today', '', '');
            return;
        }

        const nowHHMM = getCurrentHHMM();
        const nowMinutes = timeToMinutes(nowHHMM);
        let selected = null;

        for (const task of tasks) {
            const startM = timeToMinutes(task.start);
            const endM = timeToMinutes(task.end);
            const isActive = (nowMinutes >= startM && nowMinutes < endM);
            const isUpcoming = (nowMinutes < startM);
            if (isActive) {
                selected = { ...task, isActive: true, isUpcoming: false };
                break;
            }
            if (isUpcoming && !selected) {
                selected = { ...task, isActive: false, isUpcoming: true };
            }
        }
        if (!selected) selected = { ...tasks[0], isActive: false, isUpcoming: false };

        applyCurrentTask(selected);
    }

    // ----- Get today's totals from history -----
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
        // Use session* values (same as Current Session) so the Total Timer
        // ticks up in real-time together with Current Session, and when a
        // session finishes the accumulated time moves to history preserving
        // the total.
        const totalFocus = history.focus + (sessionFocusSeconds || 0);
        const totalBreak = history.break + (sessionBreakSeconds || 0);
        const totalIdle = history.idle + (sessionIdleSeconds || 0);
        const totalAll = totalFocus + totalBreak + totalIdle;
        if (focusDisplay) focusDisplay.textContent = formatTime(totalFocus);
        if (breakDisplay) breakDisplay.textContent = formatTime(totalBreak);
        if (idleDisplay) idleDisplay.textContent = formatTime(totalIdle);
        if (totalDisplay) totalDisplay.textContent = formatTime(totalAll);
        if (headerFocusTime) headerFocusTime.textContent = formatTime(totalFocus);
        if (headerBreakTime) headerBreakTime.textContent = formatTime(totalBreak);
        if (headerIdleTime) headerIdleTime.textContent = formatTime(totalIdle);
    }

    // ----- Update UI (Daily Totals) -----
    // idleSeconds itself is only finalized at a state transition (see
    // checkIdleState) — while still idle, this adds the time elapsed
    // since idleStartTime so the display reflects "right now," not
    // "as of the last time you moved the mouse."
    function updateUI() {
        const totalSeconds = sessionFocusSeconds + sessionBreakSeconds + sessionIdleSeconds;

        const focusPct = totalSeconds > 0 ? (sessionFocusSeconds / totalSeconds) * 100 : 0;
        const breakPct = totalSeconds > 0 ? (sessionBreakSeconds / totalSeconds) * 100 : 0;
        const idlePct = totalSeconds > 0 ? (sessionIdleSeconds / totalSeconds) * 100 : 0;
        if (progressFocusSegment) progressFocusSegment.style.width = focusPct + '%';
        if (progressBreakSegment) progressBreakSegment.style.width = breakPct + '%';
        if (progressIdleSegment) progressIdleSegment.style.width = idlePct + '%';

        // Update current session display as well
        updateCurrentSessionDisplay();

        // Update session tracker visual state
        updateSessionTrackerState();

        // This is the single source of truth for Focus/Break/Idle/Total displays
        // and header stats — uses history + live values for consistency.
        updateTotalTimerFromHistory();
    }

    // ----- Update session tracker visual state -----
    function updateSessionTrackerState() {
        const tracker = document.getElementById('sessionTracker');
        if (!tracker) return;

        tracker.classList.remove('focus-mode-active', 'break-mode-active');

        if (isRunning && !isBreak) {
            tracker.classList.add('focus-mode-active');
        } else if (isRunning && isBreak) {
            tracker.classList.add('break-mode-active');
        }
    }

    // ----- Check for day change and reset TODAY'S TOTALS if needed -----
    // (completedSessions history is handled separately by checkWeekChange —
    // it used to get wiped here every single day, which is why weekly
    // features elsewhere in the dashboard, like the streak sparkline and
    // month calendar, never had more than one day of real data to work
    // with.)
    function checkDayChange() {
        const currentDate = new Date().toDateString();
        if (currentDate !== lastCheckedDate) {
            lastCheckedDate = currentDate;
            idleStartTime = null;
            isBreak = false;
            isRunning = false;
            activeFocusSource = null;
            activeSessionOnIdlePause = null;
            updateUI();
            if (typeof updateTotalTimerFromHistory === 'function') updateTotalTimerFromHistory();
            // Reset current session
            if (sessionInterval) {
                clearInterval(sessionInterval);
                sessionInterval = null;
            }
            sessionFocusSeconds = 0;
            sessionBreakSeconds = 0;
            sessionIdleSeconds = 0;
            sessionFocusStartTime = null;
            sessionBreakStartTime = null;
            sessionIdleStartTime = null;
            previousTaskId = null;
            saveSessionState();
            updateCurrentSessionDisplay();
            console.log('🕛 Daily reset at midnight - today\'s totals cleared (session history persists for the week)');
        }
    }

    // ----- Check for week change and reset session HISTORY if needed -----
    function checkWeekChange() {
        if (typeof getWeekId !== 'function') return;
        const currentWeekId = getWeekId(new Date());
        const storedWeekId = localStorage.getItem('sessionHistoryWeekId');
        if (storedWeekId !== currentWeekId) {
            // Only clear if a previous week was actually stored — first run
            // ever shouldn't wipe anything, it just establishes a baseline.
            if (storedWeekId !== null) {
                localStorage.removeItem('completedSessions');
                console.log('📅 New week — session history reset');
            }
            localStorage.setItem('sessionHistoryWeekId', currentWeekId);
            if (typeof renderSessionHistory === 'function') renderSessionHistory();
        }
    }

    // ----- Auto-advance to next task when current task expires -----
    function autoAdvanceTask() {
        if (!currentTaskData || todayTasksCache.length <= 1) return;

        const nowHHMM = getCurrentHHMM();
        const nowMinutes = timeToMinutes(nowHHMM);
        const currentEndMinutes = timeToMinutes(currentTaskData.end);

        if (nowMinutes >= currentEndMinutes) {
            const currentIndex = todayTasksCache.findIndex(t => (t.id || t.title + t.start) === currentTaskData.id);
            for (let i = currentIndex + 1; i < todayTasksCache.length; i++) {
                const next = todayTasksCache[i];
                applyCurrentTask({ ...next, isActive: true, isUpcoming: false });
                console.log('⏭ Auto-advanced to next task:', next.title);
                break;
            }
        }
    }

    // ----- Start periodic day change check -----
    function startDayChangeMonitor() {
        checkDayChange();
        checkWeekChange();

        if (!window.dayCheckInterval) {
            window.dayCheckInterval = setInterval(function() {
                checkDayChange();
                checkWeekChange();
            }, 60000);
        }

        if (!window.taskAdvanceInterval) {
            window.taskAdvanceInterval = setInterval(autoAdvanceTask, 60000);
        }
    }

    // ----- Start idle time tracking on page load -----
    function startIdleTrackingOnLoad() {
        if (lastActivityTime === undefined) {
            lastActivityTime = Date.now();
        }

        // Start activity detection
        setupActivityDetection();

        // Check idle state every second
        if (!activityCheckInterval) {
            activityCheckInterval = setInterval(checkIdleState, 1000);
        }

        // Only start idle tracking if a schedule-linked timer (Pomodoro/Task Focus)
        // is actually running. Do NOT auto-start idle tracking on page load,
        // otherwise the Total Timer will show idle time accumulating even when
        // the user hasn't started any timer — this was causing confusion with
        // the Simple Timer which is now independent.
        if (isRunning && !sessionIdleStartTime) {
            sessionIdleStartTime = Date.now();
            sessionIdleTimeAtStart = sessionIdleSeconds;
        }
    }

    // ===== FocusSession — the one interface Pomodoro and Task Focus both
    // call the same way, replacing the old scattered trio (startFocusAccumulation
    // / pauseFocusAccumulation / stopFocusAccumulation) plus the separate
    // setCurrentSessionTaskLabel call every begin() used to need alongside it.
    //
    // Also replaces a second, parallel "daily totals" accumulator
    // (focusSeconds/breakSeconds/idleSeconds, driven by a separate interval)
    // that used to run alongside sessionFocusSeconds/etc doing the same job —
    // it turned out nothing visible actually read it any more (the Total
    // Timer/header and Current Session card both already read the session*
    // numbers below via updateTotalTimerFromHistory()), so keeping it in
    // sync was pure duplicated bookkeeping and a source of drift. This is
    // now the single source of truth for Focus/Break/Idle time, whichever
    // of Pomodoro or Task Focus is running.
    //
    // begin({source, label, phase, onIdlePause}):
    //   source        'pomodoro' | 'taskFocus' — who owns Current Session
    //   label         text shown in the Current Session card / "Now" row
    //   phase         'focus' | 'break'
    //   onIdlePause   optional — called if the user goes idle while this
    //                 session is running, so the mode can pause its own
    //                 UI/countdown. Pomodoro passes window.pausePomodoro;
    //                 Task Focus deliberately passes nothing — it's an
    //                 intentional work session that keeps counting down
    //                 through idle until explicitly paused or completed.
    // pause():  settle counters, stop ticking, KEEP ownership (so a resume
    //           picks back up where it left off, and the schedule tracker
    //           still won't clobber the label while paused).
    // release(): settle counters, stop ticking, and hand Current Session
    //            back to the schedule's own auto-detection. Call this once
    //            you're done with the session (whether or not you also log
    //            it — see logCompletedSession, called separately with the
    //            mode's own precise numbers).
    window.FocusSession = {
        begin({ source, label, phase, onIdlePause } = {}) {
            isRunning = true;
            isBreak = phase === 'break';
            idleStartTime = null;
            activeFocusSource = source || 'unknown';
            activeSessionOnIdlePause = onIdlePause || null;
            if (label) updateCurrentSessionTaskInfo(label, '', '');
            beginSessionRun(isBreak);
            updateUI();
        },
        pause() {
            isRunning = false;
            idleStartTime = Date.now();
            pauseSessionRun();
            updateUI();
        },
        release() {
            isRunning = false;
            idleStartTime = Date.now();
            pauseSessionRun();
            activeFocusSource = null;
            activeSessionOnIdlePause = null;
            updateUI();
            // Hand the label back to whatever the schedule says is current
            // right now, instead of leaving the just-finished session's
            // label showing until the next 60s auto-advance tick.
            updateCurrentTaskDisplay();
        },
        isActive() {
            return activeFocusSource;
        }
    };

    function beginSessionRun(isBreakPhase) {
        if (sessionIdleStartTime) {
            const idleElapsed = Math.floor((Date.now() - sessionIdleStartTime) / 1000);
            sessionIdleSeconds = sessionIdleTimeAtStart + idleElapsed;
            sessionIdleStartTime = null;
        }
        if (!isBreakPhase) {
            if (sessionBreakStartTime) {
                const elapsed = Math.floor((Date.now() - sessionBreakStartTime) / 1000);
                sessionBreakSeconds = sessionBreakTimeAtStart + elapsed;
                sessionBreakStartTime = null;
            }
            if (!sessionFocusStartTime) {
                sessionFocusStartTime = Date.now();
                sessionFocusTimeAtStart = sessionFocusSeconds;
            }
        } else {
            if (sessionFocusStartTime) {
                const elapsed = Math.floor((Date.now() - sessionFocusStartTime) / 1000);
                sessionFocusSeconds = sessionFocusTimeAtStart + elapsed;
                sessionFocusStartTime = null;
            }
            if (!sessionBreakStartTime) {
                sessionBreakStartTime = Date.now();
                sessionBreakTimeAtStart = sessionBreakSeconds;
            }
        }
        // In case no schedule task has ever triggered the session interval
        // (e.g. nothing scheduled today), make sure it's actually running.
        if (!sessionInterval) startCurrentSessionTracking();
    }

    function pauseSessionRun() {
        if (sessionFocusStartTime) {
            const elapsed = Math.floor((Date.now() - sessionFocusStartTime) / 1000);
            sessionFocusSeconds = sessionFocusTimeAtStart + elapsed;
            sessionFocusStartTime = null;
        }
        if (sessionBreakStartTime) {
            const elapsed = Math.floor((Date.now() - sessionBreakStartTime) / 1000);
            sessionBreakSeconds = sessionBreakTimeAtStart + elapsed;
            sessionBreakStartTime = null;
        }
        if (!sessionIdleStartTime) {
            sessionIdleStartTime = Date.now();
            sessionIdleTimeAtStart = sessionIdleSeconds;
        }
    }

    window.logCompletedSession = function({ taskName, taskStart, taskEnd, focusSeconds: fSecs, breakSeconds: bSecs, idleSeconds: iSecs, source, targetSeconds }) {
        const totalSecs = (fSecs || 0) + (bSecs || 0) + (iSecs || 0);
        if (totalSecs < 5) return; // same floor saveCompletedSession() uses
        const completedSessions = JSON.parse(localStorage.getItem('completedSessions') || '[]');
        completedSessions.push({
            taskName: taskName || 'Untitled Session',
            taskStart: taskStart || '',
            taskEnd: taskEnd || '',
            focusSeconds: fSecs || 0,
            breakSeconds: bSecs || 0,
            idleSeconds: iSecs || 0,
            totalSeconds: totalSecs,
            timestamp: Date.now(),
            source: source || 'timer',
            targetSeconds: targetSeconds || 0
        });
        localStorage.setItem('completedSessions', JSON.stringify(completedSessions));

        if (typeof renderSessionHistory === 'function') renderSessionHistory();
        updateTotalTimerFromHistory();
        document.dispatchEvent(new CustomEvent('sessionCompleted', { detail: { taskName } }));

        // Stop the session interval so it doesn't keep counting after
        // the timer has finished — the time was just moved to history.
        if (sessionInterval) {
            clearInterval(sessionInterval);
            sessionInterval = null;
        }
        sessionFocusSeconds = 0;
        sessionBreakSeconds = 0;
        sessionIdleSeconds = 0;
        sessionFocusStartTime = null;
        sessionBreakStartTime = null;
        sessionIdleStartTime = null;
        sessionFocusTimeAtStart = 0;
        sessionBreakTimeAtStart = 0;
        sessionIdleTimeAtStart = 0;
        updateCurrentSessionDisplay();
    };

    // ===== Recompute the Total Timer card (Focus/Break/Idle/Total) on demand —
    // used by dashboard.js after deleting a completedSessions entry, so the
    // numbers update immediately instead of waiting for the next tick =====
    window.refreshSessionTrackerTotals = function() {
        updateTotalTimerFromHistory();
    };

    window.saveCompletedSession = saveCompletedSession;
    window.updateTotalTimerFromHistory = updateTotalTimerFromHistory;

    window.getCompletedSessions = function() {
        return JSON.parse(localStorage.getItem('completedSessions') || '[]');
    };

    window.getCurrentSessionData = function() {
        return {
            taskName: sessionTaskName,
            taskStart: sessionTaskStart,
            taskEnd: sessionTaskEnd,
            focusSeconds: sessionFocusSeconds,
            breakSeconds: sessionBreakSeconds,
            idleSeconds: sessionIdleSeconds,
            totalSeconds: sessionFocusSeconds + sessionBreakSeconds + sessionIdleSeconds
        };
    };

    // ----- Hook into schedule-linked timer buttons (Pomodoro & Task Focus only) -----
    function initTracker() {
        // NOTE: The Simple Timer (Countdown mode) no longer hooks into the
        // session tracker. Simple Timer sessions are tracked separately in
        // simple-timer.js under its own "Simple Timer History" section.
        // Only Pomodoro and Task Focus modes feed into the Total Timer /
        // Current Session / Today's Sessions.

        // Migration: Remove old "Simple Timer" entries from completedSessions
        // (they were previously logged here but are now tracked separately
        // in simpleTimerSessions). This runs once to clean up stale data.
        try {
            const sessions = JSON.parse(localStorage.getItem('completedSessions') || '[]');
            const filtered = sessions.filter(s => s.taskName !== 'Simple Timer');
            if (filtered.length !== sessions.length) {
                localStorage.setItem('completedSessions', JSON.stringify(filtered));
                console.log('[Session Tracker] Cleaned up old Simple Timer entries from completedSessions');
            }
        } catch (e) {
            console.warn('Could not migrate completedSessions:', e);
        }

        if (scheduledInput) {
            scheduledInput.addEventListener('input', updateUI);
        }

        // Toggle the history panel open/closed
        const viewHistoryBtn = document.getElementById('viewHistoryBtn');
        const sessionHistoryCard = document.getElementById('sessionHistoryCard');
        if (viewHistoryBtn && sessionHistoryCard) {
            viewHistoryBtn.addEventListener('click', function() {
                const isHidden = sessionHistoryCard.style.display === 'none';
                sessionHistoryCard.style.display = isHidden ? 'block' : 'none';
                viewHistoryBtn.innerHTML = (isHidden ? 'Hide History' : 'View History') +
                    ' <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;vertical-align:-1px;display:inline;"><polyline points="2 12 7 12 10 20 14 4 17 12 22 12"/></svg>';
                if (isHidden && typeof renderSessionHistory === 'function') renderSessionHistory();
            });
        }

        loadSessionState();

        // Keep the in-progress session snapshot current so a refresh
        // resumes it instead of restarting from zero (see loadSessionState).
        if (!window.sessionSaveInterval) {
            window.sessionSaveInterval = setInterval(saveSessionState, 1000);
        }

        // Start monitoring for day changes
        startDayChangeMonitor();

        // Start idle time tracking if timer is not running
        startIdleTrackingOnLoad();

        // Initial population and UI
        updateCurrentTaskDisplay();
        updateUI();

        // Render session history on load (Bug 4 fix)
        if (typeof renderSessionHistory === 'function') renderSessionHistory();

        // Keyboard shortcuts: Space = start/pause, R = reset
        // Only fires when the timer view is visible and no input is focused.
        document.addEventListener('keydown', function(e) {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
            const timerView = document.getElementById('timer-view');
            if (!timerView || !timerView.classList.contains('active')) return;

            if (e.code === 'Space' && !e.metaKey && !e.ctrlKey && !e.altKey) {
                e.preventDefault();
                // Determine which mode is active and toggle start/pause
                const pomodoroShell = document.getElementById('pomodoroShell');
                const taskFocusShell = document.getElementById('taskFocusShell');
                const pomodoroVisible = pomodoroShell && pomodoroShell.style.display !== 'none';
                const taskFocusVisible = taskFocusShell && taskFocusShell.style.display !== 'none';

                if (pomodoroVisible) {
                    const pauseBtn = document.getElementById('pomodoroPauseBtn');
                    const startBtn = document.getElementById('pomodoroStartBtn');
                    if (pauseBtn && pauseBtn.style.display !== 'none') pauseBtn.click();
                    else if (startBtn && startBtn.style.display !== 'none') startBtn.click();
                } else if (taskFocusVisible) {
                    const pauseBtn = document.getElementById('taskFocusPauseBtn');
                    const startBtn = document.getElementById('taskFocusStartBtn');
                    if (pauseBtn && pauseBtn.style.display !== 'none') pauseBtn.click();
                    else if (startBtn && startBtn.style.display !== 'none') startBtn.click();
                } else {
                    // Countdown mode — Simple Timer is now independent, but
                    // keep keyboard shortcut for convenience (Space to start/pause)
                    const pauseBtn = document.getElementById('pauseBtn');
                    const startBtn = document.getElementById('startBtn');
                    if (pauseBtn && pauseBtn.style.display !== 'none') pauseBtn.click();
                    else if (startBtn && startBtn.style.display !== 'none') startBtn.click();
                }
            }

            if ((e.code === 'KeyR') && !e.metaKey && !e.ctrlKey && !e.altKey) {
                e.preventDefault();
                const pomodoroShell = document.getElementById('pomodoroShell');
                const taskFocusShell = document.getElementById('taskFocusShell');
                const pomodoroVisible = pomodoroShell && pomodoroShell.style.display !== 'none';
                const taskFocusVisible = taskFocusShell && taskFocusShell.style.display !== 'none';

                if (pomodoroVisible) {
                    const resetBtn = document.getElementById('pomodoroResetBtn');
                    if (resetBtn) resetBtn.click();
                } else if (!taskFocusVisible) {
                    // Countdown mode only (Task Focus has no reset, it has Back)
                    const resetBtn = document.getElementById('resetBtn');
                    if (resetBtn) resetBtn.click();
                }
            }
        });

        // Also refresh when switching to timer view
        document.addEventListener('viewChanged', function(e) {
            if (e.detail.viewId === 'timer-view') {
                updateCurrentTaskDisplay();
                updateUI();
                startIdleTrackingOnLoad();
            }
        });

        console.log('✅ Session Tracker (linked to schedule) initialized');
    }

    // Run when DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTracker);
    } else {
        initTracker();
    }
})();
