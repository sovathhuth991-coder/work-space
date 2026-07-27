// ============================================================
// SESSION TRACKER – Auto‑links to today's schedule
// ============================================================

(function() {
    'use strict';

    // ----- DOM refs (Daily Totals) -----
    const currentTaskDisplay = document.getElementById('currentTaskDisplay');
    const scheduledInput = document.getElementById('trackerScheduled');
    const focusDisplay = document.getElementById('focusTimeDisplay');
    const breakDisplay = document.getElementById('breakTimeDisplay');
    const idleDisplay = document.getElementById('idleTimeDisplay');
    const totalDisplay = document.getElementById('totalTimeDisplay');
    const progressFocusSegment = document.getElementById('progressFocusSegment');
    const progressBreakSegment = document.getElementById('progressBreakSegment');
    const progressIdleSegment = document.getElementById('progressIdleSegment');
    const progressPercent = document.getElementById('progressPercent');
    const scheduledDisplay = document.getElementById('scheduledDisplay');
    const resetTrackerBtn = document.getElementById('resetTrackerBtn');
    const endSessionBtn = document.getElementById('endSessionBtn');
    const autoLabelBadge = document.getElementById('autoLabelBadge');
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

    // ----- State (Daily Totals) -----
    let focusSeconds = 0;
    let breakSeconds = 0;
    let idleSeconds = 0;
    let isBreak = false;
    let trackerInterval = null;
    let isRunning = false;
    let currentTaskId = null;
    let lastCheckedDate = new Date().toDateString();

    // Timestamp-based timing to prevent browser throttling issues
    let focusStartTime = null;
    let breakStartTime = null;
    let idleStartTime = null;
    let focusTimeAtStart = 0;
    let breakTimeAtStart = 0;
    let idleTimeAtStart = 0;

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

    // ----- Activity Detection for Idle Time -----
    let lastActivityTime = Date.now();
    const IDLE_THRESHOLD = 30000; // 30 seconds of inactivity = idle
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

    // ----- Load accumulated time from localStorage (Daily Totals) -----
    function loadAccumulatedTime() {
        try {
            const saved = localStorage.getItem('accumulatedFocusTime');
            if (saved) {
                const data = JSON.parse(saved);
                const savedDate = new Date(data.timestamp).toDateString();
                const today = new Date().toDateString();

                // If it's a new day, reset today's totals (session history
                // persists across the week — see checkWeekChange())
                if (savedDate !== today) {
                    focusSeconds = 0;
                    breakSeconds = 0;
                    idleSeconds = 0;
                    idleStartTime = null;
                    saveAccumulatedTime();
                } else {
                    focusSeconds = data.focusSeconds || 0;
                    breakSeconds = data.breakSeconds || 0;
                    idleSeconds = data.idleSeconds || 0;

                    // Restore timer state
                    isRunning = data.isRunning || false;
                    isBreak = data.isBreak || false;

                    // Restore focus timer if it was running
                    if (isRunning && !isBreak && data.focusStartTime && data.focusStartTime > 0) {
                        const timeSinceFocusStart = Date.now() - data.focusStartTime;
                        // Only restore if less than 1 hour has passed
                        if (timeSinceFocusStart < 3600000) {
                            focusStartTime = data.focusStartTime;
                            focusTimeAtStart = data.focusTimeAtStart || focusSeconds;
                        } else {
                            // Too much time has passed, reset focus timer
                            focusStartTime = null;
                            isRunning = false;
                        }
                    }

                    // Restore break timer if it was running
                    if (isRunning && isBreak && data.breakStartTime && data.breakStartTime > 0) {
                        const timeSinceBreakStart = Date.now() - data.breakStartTime;
                        // Only restore if less than 1 hour has passed
                        if (timeSinceBreakStart < 3600000) {
                            breakStartTime = data.breakStartTime;
                            breakTimeAtStart = data.breakTimeAtStart || breakSeconds;
                        } else {
                            // Too much time has passed, reset break timer
                            breakStartTime = null;
                            isRunning = false;
                            isBreak = false;
                        }
                    }

                    // Restore idle start time if it was saved
                    if (data.idleStartTime && data.idleStartTime > 0) {
                        const timeSinceIdleStart = Date.now() - data.idleStartTime;
                        // Only restore if less than 1 hour has passed (to avoid counting old idle time)
                        if (timeSinceIdleStart < 3600000) {
                            idleStartTime = data.idleStartTime;
                            idleTimeAtStart = idleSeconds;
                        } else {
                            // Too much time has passed, reset idle timer
                            idleStartTime = null;
                        }
                    }
                }
            }
        } catch (e) {
            console.warn('Could not load accumulated time:', e);
        }
    }

    // ----- Save accumulated time to localStorage (Daily Totals) -----
    function saveAccumulatedTime() {
        try {
            const data = {
                focusSeconds: focusSeconds,
                breakSeconds: breakSeconds,
                idleSeconds: idleSeconds,
                idleStartTime: idleStartTime,
                isRunning: isRunning,
                isBreak: isBreak,
                focusStartTime: focusStartTime,
                breakStartTime: breakStartTime,
                focusTimeAtStart: focusTimeAtStart,
                breakTimeAtStart: breakTimeAtStart,
                timestamp: Date.now()
            };
            localStorage.setItem('accumulatedFocusTime', JSON.stringify(data));
        } catch (e) {
            console.warn('Could not save accumulated time:', e);
        }
    }

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
        const wasIdle = idleStartTime !== null;
        const shouldBeIdle = timeSinceActivity >= IDLE_THRESHOLD;

        // If user becomes idle and we're not already tracking idle time
        if (shouldBeIdle && !idleStartTime) {
            idleStartTime = Date.now();
            idleTimeAtStart = idleSeconds;
            if (isRunning) {
                // Pause focus/break timers when idle
                if (focusStartTime) {
                    const elapsed = Math.floor((Date.now() - focusStartTime) / 1000);
                    focusSeconds = focusTimeAtStart + elapsed;
                    focusStartTime = null;
                }
                if (breakStartTime) {
                    const elapsed = Math.floor((Date.now() - breakStartTime) / 1000);
                    breakSeconds = breakTimeAtStart + elapsed;
                    breakStartTime = null;
                }
            }
            // Broadcast idle to other timers (Bug 5 fix)
            if (typeof window.pausePomodoro === 'function') window.pausePomodoro();
            if (typeof window.pauseTaskFocus === 'function') window.pauseTaskFocus();
        }
        // If user becomes active again
        else if (!shouldBeIdle && idleStartTime) {
            const idleElapsed = Math.floor((Date.now() - idleStartTime) / 1000);
            idleSeconds = idleTimeAtStart + idleElapsed;
            idleStartTime = null;

            // Resume focus/break timers if they were running
            if (isRunning && !isBreak) {
                focusStartTime = Date.now();
                focusTimeAtStart = focusSeconds;
            } else if (isRunning && isBreak) {
                breakStartTime = Date.now();
                breakTimeAtStart = breakSeconds;
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

        // Initialize session timestamps based on daily tracker state
        if (isRunning && !isBreak && !sessionFocusStartTime) {
            if (sessionIdleStartTime) {
                const idleElapsed = Math.floor((Date.now() - sessionIdleStartTime) / 1000);
                sessionIdleSeconds = sessionIdleTimeAtStart + idleElapsed;
                sessionIdleStartTime = null;
            }
            sessionFocusStartTime = Date.now();
            sessionFocusTimeAtStart = sessionFocusSeconds;
        } else if (isRunning && isBreak && !sessionBreakStartTime) {
            if (sessionIdleStartTime) {
                const idleElapsed = Math.floor((Date.now() - sessionIdleStartTime) / 1000);
                sessionIdleSeconds = sessionIdleTimeAtStart + idleElapsed;
                sessionIdleStartTime = null;
            }
            sessionBreakStartTime = Date.now();
            sessionBreakTimeAtStart = sessionBreakSeconds;
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
            currentTaskDisplay.textContent = 'No tasks scheduled for today';
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
        const totalFocus = history.focus + (focusSeconds || 0);
        const totalBreak = history.break + (breakSeconds || 0);
        const totalIdle = history.idle + getLiveIdleSeconds();
        const totalAll = totalFocus + totalBreak + totalIdle;
        if (focusDisplay) focusDisplay.textContent = formatTime(totalFocus);
        if (breakDisplay) breakDisplay.textContent = formatTime(totalBreak);
        if (idleDisplay) idleDisplay.textContent = formatTime(totalIdle);
        if (totalDisplay) totalDisplay.textContent = formatTime(totalAll);
        // Header stats must also use history+live (was live-only, which caused
        // the header to drop to ~0 after a session was logged)
        if (headerFocusTime) headerFocusTime.textContent = formatTime(totalFocus);
        if (headerBreakTime) headerBreakTime.textContent = formatTime(totalBreak);
        if (headerIdleTime) headerIdleTime.textContent = formatTime(totalIdle);
    }

    // ----- Update UI (Daily Totals) -----
    // idleSeconds itself is only finalized at a state transition (see
    // checkIdleState) — while still idle, this adds the time elapsed
    // since idleStartTime so the display reflects "right now," not
    // "as of the last time you moved the mouse."
    function getLiveIdleSeconds() {
        if (idleStartTime) return idleTimeAtStart + Math.floor((Date.now() - idleStartTime) / 1000);
        return idleSeconds;
    }

    function updateUI() {
        const liveIdleSeconds = getLiveIdleSeconds();

        const totalSeconds = focusSeconds + breakSeconds + liveIdleSeconds;

        const focusPct = totalSeconds > 0 ? (focusSeconds / totalSeconds) * 100 : 0;
        const breakPct = totalSeconds > 0 ? (breakSeconds / totalSeconds) * 100 : 0;
        const idlePct = totalSeconds > 0 ? (liveIdleSeconds / totalSeconds) * 100 : 0;
        if (progressFocusSegment) progressFocusSegment.style.width = focusPct + '%';
        if (progressBreakSegment) progressBreakSegment.style.width = breakPct + '%';
        if (progressIdleSegment) progressIdleSegment.style.width = idlePct + '%';

        const scheduled = scheduledInput ? (parseInt(scheduledInput.value) || 120) : 120;

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
            focusSeconds = 0;
            breakSeconds = 0;
            idleSeconds = 0;
            idleStartTime = null;
            isBreak = false;
            isRunning = false;
            stopAccumulation();
            saveAccumulatedTime();
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

    // ----- Accumulation (Daily Totals) -----
    function startAccumulation() {
        if (trackerInterval) return;

        // Resume from idle if needed
        if (idleStartTime) {
            const idleElapsed = Math.floor((Date.now() - idleStartTime) / 1000);
            idleSeconds = idleTimeAtStart + idleElapsed;
            idleStartTime = null;
        }

        if (isRunning && !isBreak && !focusStartTime) {
            focusStartTime = Date.now();
            focusTimeAtStart = focusSeconds;
        } else if (isRunning && isBreak && !breakStartTime) {
            breakStartTime = Date.now();
            breakTimeAtStart = breakSeconds;
        }

        trackerInterval = setInterval(function() {
            if (isRunning && !isBreak && focusStartTime) {
                const elapsed = Math.floor((Date.now() - focusStartTime) / 1000);
                focusSeconds = focusTimeAtStart + elapsed;
            } else if (isRunning && isBreak && breakStartTime) {
                const elapsed = Math.floor((Date.now() - breakStartTime) / 1000);
                breakSeconds = breakTimeAtStart + elapsed;
            }
            // Note: idle time is now handled by checkIdleState()
            updateUI();
        }, 100);

        if (!window.saveInterval) {
            window.saveInterval = setInterval(saveAccumulatedTime, 5000);
        }

        if (!window.dayCheckInterval) {
            window.dayCheckInterval = setInterval(function() {
                checkDayChange();
                checkWeekChange();
            }, 60000);
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

        // Also for current session
        if (!isRunning && !sessionIdleStartTime) {
            sessionIdleStartTime = Date.now();
            sessionIdleTimeAtStart = sessionIdleSeconds;
        }
    }

    function stopAccumulation() {
        if (trackerInterval) {
            clearInterval(trackerInterval);
            trackerInterval = null;
        }
    }

    // ----- Reset (Daily Totals) -----
    function resetTracker() {
        stopAccumulation();
        isBreak = false;
        isRunning = false;
        focusStartTime = null;
        breakStartTime = null;
        idleStartTime = null;
        focusTimeAtStart = 0;
        breakTimeAtStart = 0;
        idleTimeAtStart = 0;
        lastActivityTime = Date.now();
        updateUI();
    }

    // ----- End Session -----
    function endSession() {
        const label = currentTaskData?.title || 'Untitled';
        const scheduled = scheduledInput ? (parseInt(scheduledInput.value) || 0) : 0;
        const scheduledSecs = scheduled * 60;
        const totalSecs = focusSeconds + breakSeconds + idleSeconds;
        const efficiency = scheduledSecs > 0 ? Math.round((focusSeconds / scheduledSecs) * 100) : 0;

        if (totalSecs >= 5) {
            const completedSessions = JSON.parse(localStorage.getItem('completedSessions') || '[]');
            completedSessions.push({
                taskName: label,
                taskStart: currentTaskData?.start || '',
                taskEnd: currentTaskData?.end || '',
                focusSeconds, breakSeconds, idleSeconds,
                totalSeconds: totalSecs,
                timestamp: Date.now()
            });
            localStorage.setItem('completedSessions', JSON.stringify(completedSessions));
            if (typeof renderSessionHistory === 'function') renderSessionHistory();
            updateTotalTimerFromHistory();
        }

        if (typeof showToast === 'function') {
            showToast(`✅ ${label} logged — ${formatTime(focusSeconds)} focus (${efficiency}% of scheduled)`, 'success', 6000);
        } else {
            alert(`SESSION COMPLETE: ${label}\nFocus: ${formatTime(focusSeconds)} · Break: ${formatTime(breakSeconds)} · Idle: ${formatTime(idleSeconds)}\nEfficiency: ${efficiency}%`);
        }

        const history = JSON.parse(localStorage.getItem('sessionHistory') || '[]');
        history.push({
            label,
            scheduled,
            focusSeconds,
            breakSeconds,
            idleSeconds,
            totalSeconds: totalSecs
        });
        localStorage.setItem('sessionHistory', JSON.stringify(history));

        focusSeconds = 0;
        breakSeconds = 0;
        idleSeconds = 0;
        idleStartTime = null;
        focusStartTime = null;
        breakStartTime = null;
        lastActivityTime = Date.now();
        updateUI();
    }

    // ===== Get completed sessions for dashboard =====
    // ===== Shared write path for other timer engines — Simple Timer uses
    // saveCompletedSession() above (reads its own session* state); Pomodoro
    // and Task Focus keep separate state entirely, so they call this
    // directly with explicit numbers instead. Same schema either way. =====
    // ===== External sync hooks for Pomodoro/Task Focus =====
    // These now genuinely tick the same live focusSeconds/breakSeconds
    // counters the Simple Timer uses (via startAccumulation(), the same
    // function its own Start button calls) — that's what makes the Total
    // Timer/header numbers move in real time during a Pomodoro phase or a
    // Task Focus session, not just once it's finished.
    //
    // The double-count risk that created: once that time is *also* logged
    // to completedSessions on completion, it would otherwise be counted
    // twice (once live, once in history). logCompletedSession() below
    // closes that by subtracting back out whatever it just logged, so the
    // handoff from "live" to "history" is seamless.
    window.startFocusAccumulation = function(isBreakPhase) {
        isRunning = true;
        isBreak = !!isBreakPhase;
        idleStartTime = null;
        startAccumulation();
        updateUI();
    };
    window.pauseFocusAccumulation = function() {
        if (focusStartTime) {
            focusSeconds = focusTimeAtStart + Math.floor((Date.now() - focusStartTime) / 1000);
            focusStartTime = null;
        }
        if (breakStartTime) {
            breakSeconds = breakTimeAtStart + Math.floor((Date.now() - breakStartTime) / 1000);
            breakStartTime = null;
        }
        isRunning = false;
        idleStartTime = Date.now();
        idleTimeAtStart = idleSeconds;
        updateUI();
    };
    window.stopFocusAccumulation = window.pauseFocusAccumulation;

    window.logCompletedSession = function({ taskName, taskStart, taskEnd, focusSeconds: fSecs, breakSeconds: bSecs, idleSeconds: iSecs }) {
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
            timestamp: Date.now()
        });
        localStorage.setItem('completedSessions', JSON.stringify(completedSessions));

        // Hand off: this chunk just moved from "live" to "history" —
        // remove it from the live counters so the next repaint (history +
        // live) doesn't add it in twice. pauseFocusAccumulation() already
        // ran before this in every call site, so focusSeconds/breakSeconds
        // here are the settled totals, not still-ticking ones.
        focusSeconds = Math.max(0, focusSeconds - (fSecs || 0));
        breakSeconds = Math.max(0, breakSeconds - (bSecs || 0));
        focusTimeAtStart = focusSeconds;
        breakTimeAtStart = breakSeconds;

        if (typeof renderSessionHistory === 'function') renderSessionHistory();
        updateTotalTimerFromHistory();
        document.dispatchEvent(new CustomEvent('sessionCompleted', { detail: { taskName } }));
    };

    // ===== Recompute the Total Timer card (Focus/Break/Idle/Total) on demand —
    // used by dashboard.js after deleting a completedSessions entry, so the
    // numbers update immediately instead of waiting for the next tick =====
    window.refreshSessionTrackerTotals = function() {
        updateTotalTimerFromHistory();
    };

    window.saveCompletedSession = saveCompletedSession;
    window.updateTotalTimerFromHistory = updateTotalTimerFromHistory;

    window.resetDailyTotals = function() {
        focusSeconds = 0;
        breakSeconds = 0;
        idleSeconds = 0;
        idleStartTime = null;
        focusStartTime = null;
        breakStartTime = null;
        focusTimeAtStart = 0;
        breakTimeAtStart = 0;
        idleTimeAtStart = 0;
    };

    window.getCompletedSessions = function() {
        return JSON.parse(localStorage.getItem('completedSessions') || '[]');
    };

    // ===== Get current session data for dashboard =====
    // ===== Set current session task info externally (Simple Timer, Pomodoro, Task Focus) =====
    window.setCurrentSessionTask = function(taskName, start, end) {
        updateCurrentSessionTaskInfo(taskName, start, end);
        // Reset current session timers for the new task
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
        saveSessionState();
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

    // ----- Hook into simple timer buttons -----
    function initTracker() {
        const startBtn = document.getElementById('startBtn');
        const pauseBtn = document.getElementById('pauseBtn');
        const resetBtn = document.getElementById('resetBtn');

        if (startBtn) {
            startBtn.addEventListener('click', function() {
                if (isRunning && isBreak) {
                    isBreak = false;
                    breakStartTime = null;
                    focusStartTime = Date.now();
                    focusTimeAtStart = focusSeconds;
                    // Update session tracking
                    if (sessionBreakStartTime) {
                        const elapsed = Math.floor((Date.now() - sessionBreakStartTime) / 1000);
                        sessionBreakSeconds = sessionBreakTimeAtStart + elapsed;
                        sessionBreakStartTime = null;
                    }
                    sessionFocusStartTime = Date.now();
                    sessionFocusTimeAtStart = sessionFocusSeconds;
                } else if (!isRunning) {
                    isRunning = true;
                    isBreak = false;
                    focusStartTime = Date.now();
                    focusTimeAtStart = focusSeconds;
                    startAccumulation();
                    // Start session tracking
                    if (sessionIdleStartTime) {
                        const idleElapsed = Math.floor((Date.now() - sessionIdleStartTime) / 1000);
                        sessionIdleSeconds = sessionIdleTimeAtStart + idleElapsed;
                        sessionIdleStartTime = null;
                    }
                    if (!sessionInterval) {
                        startCurrentSessionTracking();
                    } else {
                        sessionFocusStartTime = Date.now();
                        sessionFocusTimeAtStart = sessionFocusSeconds;
                    }
                }
            });
        }

        if (pauseBtn) {
            pauseBtn.addEventListener('click', function() {
                if (isRunning && !isBreak) {
                    isBreak = true;
                    focusStartTime = null;
                    breakStartTime = Date.now();
                    breakTimeAtStart = breakSeconds;
                    // Update session tracking
                    if (sessionFocusStartTime) {
                        const elapsed = Math.floor((Date.now() - sessionFocusStartTime) / 1000);
                        sessionFocusSeconds = sessionFocusTimeAtStart + elapsed;
                        sessionFocusStartTime = null;
                    }
                    sessionBreakStartTime = Date.now();
                    sessionBreakTimeAtStart = sessionBreakSeconds;
                }
            });
        }

        if (resetBtn) {
            resetBtn.addEventListener('click', function() {
                resetTracker();
                // Also reset current session timestamps but keep accumulated values
                sessionFocusStartTime = null;
                sessionBreakStartTime = null;
                sessionIdleStartTime = Date.now();
                sessionIdleTimeAtStart = sessionIdleSeconds;
            });
        }

        if (resetTrackerBtn) {
            resetTrackerBtn.addEventListener('click', function() {
                resetTracker();
                sessionFocusStartTime = null;
                sessionBreakStartTime = null;
                sessionIdleStartTime = Date.now();
                sessionIdleTimeAtStart = sessionIdleSeconds;
            });
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

        // Load accumulated time from localStorage
        loadAccumulatedTime();
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

        // Start accumulation if timer was running before refresh
        if (isRunning) {
            startAccumulation();
        }

        // Initial population and UI
        updateCurrentTaskDisplay();
        updateUI();

        // Render session history on load (Bug 4 fix)
        if (typeof renderSessionHistory === 'function') renderSessionHistory();

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
