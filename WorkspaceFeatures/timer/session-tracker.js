// ============================================================
// SESSION TRACKER – Auto‑links to today's schedule
// ============================================================

(function() {
    'use strict';

    // ----- DOM refs (Daily Totals) -----
    const taskSelector = document.getElementById('taskSelector');
    const scheduledInput = document.getElementById('trackerScheduled');
    const focusDisplay = document.getElementById('focusTimeDisplay');
    const breakDisplay = document.getElementById('breakTimeDisplay');
    const idleDisplay = document.getElementById('idleTimeDisplay');
    const totalDisplay = document.getElementById('totalTimeDisplay');
    const progressFill = document.getElementById('progressFill');
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

                // If it's a new day, reset the times
                if (savedDate !== today) {
                    focusSeconds = 0;
                    breakSeconds = 0;
                    idleSeconds = 0;
                    idleStartTime = null;
                    saveAccumulatedTime();
                    // Also clear completed sessions for the new day
                    localStorage.removeItem('completedSessions');
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

        // Update current session task info
        const opt = taskSelector.options[taskSelector.selectedIndex];
        if (opt && opt.value) {
            const taskTitle = opt.dataset.title || opt.textContent.split(' (')[0];
            const taskStart = opt.dataset.start || '';
            const taskEnd = opt.dataset.end || '';
            updateCurrentSessionTaskInfo(taskTitle, taskStart, taskEnd);
        }

        // Start/resume current session tracking
        if (!sessionInterval) {
            startCurrentSessionTracking();
        }
    }

    // ----- Populate the task dropdown -----
    function populateTaskDropdown() {
        const tasks = getTodayTasks();
        taskSelector.innerHTML = '<option value="">— Select a task —</option>';

        if (tasks.length === 0) {
            taskSelector.innerHTML += '<option value="" disabled>No tasks scheduled for today</option>';
            autoLabelBadge.textContent = '📭 No tasks';
            autoLabelBadge.style.color = '#888';
            updateCurrentSessionTaskInfo('No tasks today', '', '');
            return;
        }

        const nowHHMM = getCurrentHHMM();
        const nowMinutes = timeToMinutes(nowHHMM);
        let autoSelectId = null;
        let autoSelectIndex = 0;

        tasks.forEach((task, index) => {
            const startM = timeToMinutes(task.start);
            const endM = timeToMinutes(task.end);
            const isActive = (nowMinutes >= startM && nowMinutes < endM);
            const isUpcoming = (nowMinutes < startM);
            const label = `${task.title} (${task.start}–${task.end})${isActive ? ' 🔴' : ''}${isUpcoming ? ' ⏳' : ''}`;
            const opt = document.createElement('option');
            opt.value = task.id || 'task-' + index;
            opt.textContent = label;
            opt.dataset.start = task.start;
            opt.dataset.end = task.end;
            opt.dataset.title = task.title;
            opt.dataset.duration = endM - startM;
            taskSelector.appendChild(opt);

            if (isActive && autoSelectId === null) {
                autoSelectId = opt.value;
                autoSelectIndex = index;
            } else if (isUpcoming && autoSelectId === null) {
                autoSelectId = opt.value;
                autoSelectIndex = index;
            }
        });

        if (autoSelectId === null && tasks.length > 0) {
            autoSelectId = taskSelector.options[1]?.value || null;
            autoSelectIndex = 0;
        }

        if (autoSelectId) {
            taskSelector.value = autoSelectId;
            const selectedOpt = taskSelector.querySelector(`option[value="${autoSelectId}"]`);
            if (selectedOpt) {
                const dur = parseInt(selectedOpt.dataset.duration);
                if (dur > 0) scheduledInput.value = dur;
                autoLabelBadge.textContent = '✅ Auto‑linked';
                autoLabelBadge.style.color = '#2ecc71';
            }
            // Initialize the current session for auto-selected task
            handleTaskChange(autoSelectId);
        } else {
            autoLabelBadge.textContent = 'No matching task';
            autoLabelBadge.style.color = '#888';
        }
    }

    // ----- Update UI (Daily Totals) -----
    function updateUI() {
        focusDisplay.textContent = formatTime(focusSeconds);
        breakDisplay.textContent = formatTime(breakSeconds);
        if (idleDisplay) idleDisplay.textContent = formatTime(idleSeconds);

        const totalSeconds = focusSeconds + breakSeconds + idleSeconds;
        if (totalDisplay) totalDisplay.textContent = formatTime(totalSeconds);

        const scheduled = parseInt(scheduledInput.value) || 120;
        const scheduledSecs = scheduled * 60;
        const total = focusSeconds + breakSeconds;
        const pct = scheduledSecs > 0 ? Math.min((total / scheduledSecs) * 100, 100) : 0;
        progressFill.style.width = pct + '%';
        progressPercent.textContent = Math.round(pct) + '%';
        scheduledDisplay.textContent = scheduled;

        // Update header stats
        if (headerFocusTime) headerFocusTime.textContent = formatTime(focusSeconds);
        if (headerBreakTime) headerBreakTime.textContent = formatTime(breakSeconds);
        if (headerIdleTime) headerIdleTime.textContent = formatTime(idleSeconds);

        // Update current session display as well
        updateCurrentSessionDisplay();

        // Update session tracker visual state
        updateSessionTrackerState();
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

    // ----- Check for day change and reset if needed -----
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
            // Clear completed sessions for new day
            localStorage.removeItem('completedSessions');
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
            console.log('🕛 Daily reset at midnight - timers cleared');
        }
    }

    // ----- Auto-advance to next task when current task expires -----
    function autoAdvanceTask() {
        if (!taskSelector || taskSelector.options.length <= 1) return;

        const nowHHMM = getCurrentHHMM();
        const nowMinutes = timeToMinutes(nowHHMM);
        const currentIndex = taskSelector.selectedIndex;
        const currentOpt = taskSelector.options[currentIndex];
        if (!currentOpt || !currentOpt.dataset.end) return;

        const currentEndMinutes = timeToMinutes(currentOpt.dataset.end);

        if (nowMinutes >= currentEndMinutes) {
            let nextIndex = currentIndex + 1;
            while (nextIndex < taskSelector.options.length) {
                const nextOpt = taskSelector.options[nextIndex];
                if (nextOpt.value && !nextOpt.disabled) {
                    // Save current session before switching
                    handleTaskChange(nextOpt.value);

                    taskSelector.selectedIndex = nextIndex;

                    const event = new Event('change');
                    taskSelector.dispatchEvent(event);

                    console.log('⏭ Auto-advanced to next task:', nextOpt.textContent);
                    break;
                }
                nextIndex++;
            }
        }
    }

    // ----- Start periodic day change check -----
    function startDayChangeMonitor() {
        checkDayChange();

        if (!window.dayCheckInterval) {
            window.dayCheckInterval = setInterval(checkDayChange, 60000);
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
            window.dayCheckInterval = setInterval(checkDayChange, 60000);
        }
    }

    // ----- Start idle time tracking on page load -----
    function startIdleTrackingOnLoad() {
        // Reset last activity time to now when page loads
        // This ensures idle timer starts counting from page load, not from when script was parsed
        lastActivityTime = Date.now();

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
        const selectedOpt = taskSelector.options[taskSelector.selectedIndex];
        const label = selectedOpt?.dataset?.title || taskSelector.value || 'Untitled';
        const scheduled = parseInt(scheduledInput.value) || 0;
        const focusMins = Math.floor(focusSeconds / 60);
        const focusSecs = focusSeconds % 60;
        const breakMins = Math.floor(breakSeconds / 60);
        const breakSecs = breakSeconds % 60;
        const idleMins = Math.floor(idleSeconds / 60);
        const idleSecs = idleSeconds % 60;
        const scheduledSecs = scheduled * 60;
        const totalSecs = focusSeconds + breakSeconds + idleSeconds;
        const efficiency = scheduledSecs > 0 ? Math.round((focusSeconds / scheduledSecs) * 100) : 0;
        const focusPercentage = totalSecs > 0 ? Math.round((focusSeconds / totalSecs) * 100) : 0;

        const summary = `📊 SESSION COMPLETE: ${label}\n` +
                        `📅 Scheduled: ${scheduled} min\n` +
                        `⏱ Focus: ${focusMins}m ${focusSecs}s (${focusPercentage}%)\n` +
                        `☕ Break: ${breakMins}m ${breakSecs}s\n` +
                        `⏸ Idle: ${idleMins}m ${idleSecs}s\n` +
                        `🎯 Efficiency: ${efficiency}%`;

        alert(summary);

        const history = JSON.parse(localStorage.getItem('sessionHistory') || '[]');
        history.push({
            label,
            scheduled,
            focusSeconds,
            breakSeconds,
            idleSeconds,
            efficiency,
            timestamp: Date.now()
        });
        localStorage.setItem('sessionHistory', JSON.stringify(history));

        resetTracker();
    }

    // ===== Get completed sessions for dashboard =====
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

        if (endSessionBtn) {
            endSessionBtn.addEventListener('click', endSession);
        }

        if (scheduledInput) {
            scheduledInput.addEventListener('input', updateUI);
        }

        // When task selector changes, update scheduled time AND handle session switch
        taskSelector.addEventListener('change', function() {
            const opt = this.options[this.selectedIndex];
            if (opt && opt.dataset.duration) {
                const dur = parseInt(opt.dataset.duration);
                if (dur > 0) scheduledInput.value = dur;
                autoLabelBadge.textContent = '✅ Linked to task';
                autoLabelBadge.style.color = '#2ecc71';
            }
            // Handle task switch (save old session, start new one)
            handleTaskChange(this.value);
            updateUI();
        });

        // Load accumulated time from localStorage
        loadAccumulatedTime();

        // Start monitoring for day changes
        startDayChangeMonitor();

        // Start idle time tracking if timer is not running
        startIdleTrackingOnLoad();

        // Start accumulation if timer was running before refresh
        if (isRunning) {
            startAccumulation();
        }

        // Initial population and UI
        populateTaskDropdown();
        updateUI();

        // Also refresh when switching to timer view
        document.addEventListener('viewChanged', function(e) {
            if (e.detail.viewId === 'timer-view') {
                populateTaskDropdown();
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
