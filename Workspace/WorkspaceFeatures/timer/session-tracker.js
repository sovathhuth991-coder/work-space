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
    }

    // ----- Helpers -----
    function formatTime(sec) {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
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
        const totalIdle = history.idle + (idleSeconds || 0);
        if (focusDisplay) focusDisplay.textContent = formatTime(totalFocus);
        if (breakDisplay) breakDisplay.textContent = formatTime(totalBreak);
        if (idleDisplay) idleDisplay.textContent = formatTime(totalIdle);
        if (totalDisplay) totalDisplay.textContent = formatTime(totalFocus + totalBreak + totalIdle);
    }

    // ----- Update UI (Daily Totals) -----
    function updateUI() {
        if (focusDisplay) focusDisplay.textContent = formatTime(focusSeconds);
        if (breakDisplay) breakDisplay.textContent = formatTime(breakSeconds);
        if (idleDisplay) idleDisplay.textContent = formatTime(idleSeconds);

        const totalSeconds = focusSeconds + breakSeconds + idleSeconds;
        if (totalDisplay) totalDisplay.textContent = formatTime(totalSeconds);

        const focusPct = totalSeconds > 0 ? (focusSeconds / totalSeconds) * 100 : 0;
        const breakPct = totalSeconds > 0 ? (breakSeconds / totalSeconds) * 100 : 0;
        const idlePct = totalSeconds > 0 ? (idleSeconds / totalSeconds) * 100 : 0;
        if (progressFocusSegment) progressFocusSegment.style.width = focusPct + '%';
        if (progressBreakSegment) progressBreakSegment.style.width = breakPct + '%';
        if (progressIdleSegment) progressIdleSegment.style.width = idlePct + '%';

        const scheduled = scheduledInput ? (parseInt(scheduledInput.value) || 120) : 120;

        // Update header stats
        if (headerFocusTime) headerFocusTime.textContent = formatTime(focusSeconds);
        if (headerBreakTime) headerBreakTime.textContent = formatTime(breakSeconds);
        if (headerIdleTime) headerIdleTime.textContent = formatTime(idleSeconds);

        // Update current session display as well
        updateCurrentSessionDisplay();

        // Update session tracker visual state
        updateSessionTrackerState();

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
            alert(`📊 SESSION COMPLETE: ${label}\nFocus: ${formatTime(focusSeconds)} · Break: ${formatTime(breakSeconds)} · Idle: ${formatTime(idleSeconds)}\nEfficiency: ${efficiency}%`);
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
    // Task Focus (and Pomodoro, via its own logCompletedSession calls)
    // already log their own elapsed time to completedSessions when a
    // session finishes — that's the authoritative record. These hooks only
    // flip isRunning/idleStartTime so idle time doesn't wrongly accrue
    // here while one of those is actively running elsewhere; they
    // deliberately don't touch focusSeconds/focusStartTime, since doing
    // that AND separately logging the completed session would double-count
    // the same minutes.
    window.startFocusAccumulation = function() {
        isRunning = true;
        isBreak = false;
        idleStartTime = null;
        updateUI();
    };
    window.pauseFocusAccumulation = function() {
        isRunning = false;
        idleStartTime = Date.now();
        updateUI();
    };
    window.stopFocusAccumulation = window.pauseFocusAccumulation;

    window.logCompletedSession = function({ taskName, taskStart, taskEnd, focusSeconds, breakSeconds, idleSeconds }) {
        const totalSecs = (focusSeconds || 0) + (breakSeconds || 0) + (idleSeconds || 0);
        if (totalSecs < 5) return; // same floor saveCompletedSession() uses
        const completedSessions = JSON.parse(localStorage.getItem('completedSessions') || '[]');
        completedSessions.push({
            taskName: taskName || 'Untitled Session',
            taskStart: taskStart || '',
            taskEnd: taskEnd || '',
            focusSeconds: focusSeconds || 0,
            breakSeconds: breakSeconds || 0,
            idleSeconds: idleSeconds || 0,
            totalSeconds: totalSecs,
            timestamp: Date.now()
        });
        localStorage.setItem('completedSessions', JSON.stringify(completedSessions));
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
                viewHistoryBtn.textContent = isHidden ? '📊 Hide History' : '📊 View History';
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
