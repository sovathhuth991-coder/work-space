// ============================================================
// SIMPLE COUNTDOWN TIMER
// ============================================================

(function() {
    'use strict';

    // ----- STATE -----
    let timerInterval = null;
    let totalSeconds = 25 * 60; // 25 minutes default
    let remainingSeconds = totalSeconds;
    let isRunning = false;

    // Timestamp-based timing to prevent browser throttling
    let timerStartTime = null;
    let timerRemainingAtStart = 0;

    // ----- Simple Timer History (separate from schedule-linked sessions) -----
    function getSimpleTimerHistory() {
        try {
            return JSON.parse(localStorage.getItem('simpleTimerSessions') || '[]');
        } catch (e) {
            return [];
        }
    }

    function saveSimpleTimerSession(focusSeconds) {
        if (focusSeconds < 5) return; // Don't save sessions less than 5 seconds
        try {
            const history = getSimpleTimerHistory();
            history.push({
                taskName: 'Simple Timer',
                focusSeconds: focusSeconds,
                totalSeconds: focusSeconds,
                timestamp: Date.now()
            });
            localStorage.setItem('simpleTimerSessions', JSON.stringify(history));
            renderSimpleTimerHistory();
        } catch (e) {
            console.warn('Could not save simple timer session:', e);
        }
    }

    function renderSimpleTimerHistory() {
        const container = document.getElementById('simpleTimerHistoryList');
        if (!container) return;
        const sessions = getSimpleTimerHistory().reverse();
        if (sessions.length === 0) {
            container.innerHTML = '<p class="simple-timer-history-empty">No simple timer sessions yet.</p>';
            return;
        }
        container.innerHTML = sessions.map(s => {
            const mins = Math.floor((s.focusSeconds || 0) / 60);
            const secs = (s.focusSeconds || 0) % 60;
            const timeStr = mins >= 60
                ? `${Math.floor(mins/60)}h ${mins%60}m ${secs}s`
                : `${mins}m ${secs}s`;
            const date = new Date(s.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
            return `
            <div class="simple-timer-history-item">
                <span class="simple-timer-history-time">${timeStr}</span>
                <span class="simple-timer-history-date">${date}</span>
                <button class="simple-timer-history-del" onclick="deleteSimpleTimerSession(${s.timestamp})" title="Delete">✕</button>
            </div>`;
        }).join('');
    }

    window.deleteSimpleTimerSession = function(timestamp) {
        let sessions = getSimpleTimerHistory();
        sessions = sessions.filter(s => s.timestamp !== timestamp);
        localStorage.setItem('simpleTimerSessions', JSON.stringify(sessions));
        renderSimpleTimerHistory();
    };

    window.renderSimpleTimerHistory = renderSimpleTimerHistory;

    // ----- PERSISTENCE (survives refresh) -----
    function saveTimerState() {
        try {
            localStorage.setItem('simpleTimerPersisted', JSON.stringify({
                totalSeconds,
                remainingSeconds,
                isRunning,
                timerStartTime,
                timerRemainingAtStart
            }));
        } catch (e) {
            console.warn('Could not save timer state:', e);
        }
    }

    function loadTimerState() {
        try {
            const saved = localStorage.getItem('simpleTimerPersisted');
            if (!saved) return;
            const state = JSON.parse(saved);
            if (state.remainingSeconds > 0) {
                totalSeconds = state.totalSeconds || totalSeconds;
                remainingSeconds = state.remainingSeconds;
                if (state.isRunning && state.timerStartTime) {
                    const elapsed = Math.floor((Date.now() - state.timerStartTime) / 1000);
                    remainingSeconds = Math.max(0, (state.timerRemainingAtStart || remainingSeconds) - elapsed);
                }
                updateDisplay();
                if (state.isRunning && remainingSeconds > 0) {
                    startTimer(false);
                    // Improvement 3 fix: update the state pill after restoring a
                    // running timer; startTimer sets isRunning but doesn't call
                    // updateTimerState when skipSave is false.
                    updateTimerState('running');
                } else if (remainingSeconds > 0) {
                    // Restored a paused timer
                    updateTimerState('paused');
                    if (startBtn) {
                        startBtn.style.display = 'inline-block';
                        startBtn.textContent = 'Resume';
                    }
                }
            }
        } catch (e) {
            console.warn('Could not load timer state:', e);
        }
    }

    // ----- DOM ELEMENTS -----
    const display = document.getElementById('countdownDisplay');
    const startBtn = document.getElementById('startBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const resetBtn = document.getElementById('resetBtn');
    const presetBtns = document.querySelectorAll('.preset-btn');
    const customTimersContainer = document.getElementById('customTimersContainer');
    const addCustomTimerBtn = document.getElementById('addCustomTimerBtn');
    const customTimerInput = document.getElementById('customTimerInput');

    // Progress ring elements
    let progressRing = null;
    let ringFill = null;
    let ringGlow = null;
    let timerCard = null;

    // ----- CUSTOM TIMERS -----
    let customTimers = [];

    // ----- PROGRESS RING -----
    const CIRCUMFERENCE = 2 * Math.PI * 130; // radius = 130

    function initProgressRing() {
        timerCard = document.querySelector('.simple-timer-card');
        // Note: progressRing is not used, we directly use ringFill and ringGlow
        progressRing = document.getElementById('timerRingFill'); // Use ringFill as reference
        ringFill = document.getElementById('timerRingFill');
        ringGlow = document.getElementById('timerRingGlow');

        if (ringFill) {
            ringFill.style.strokeDasharray = CIRCUMFERENCE;
            ringFill.style.strokeDashoffset = 0;
        }
        if (ringGlow) {
            ringGlow.style.strokeDasharray = CIRCUMFERENCE;
            ringGlow.style.strokeDashoffset = 0;
        }
    }

    function updateProgressRing() {
        if (!ringFill || !ringGlow) return;

        const progress = totalSeconds > 0 ? remainingSeconds / totalSeconds : 0;
        const offset = CIRCUMFERENCE * (1 - progress);

        ringFill.style.strokeDashoffset = offset;
        if (ringGlow) {
            ringGlow.style.strokeDashoffset = offset;
        }
    }

    function loadCustomTimers() {
        try {
            const stored = localStorage.getItem('customTimers');
            if (stored) {
                customTimers = JSON.parse(stored);
            }
        } catch (e) {
            console.error('Error loading custom timers:', e);
            customTimers = [];
        }
        renderCustomTimers();
    }

    function saveCustomTimers() {
        try {
            localStorage.setItem('customTimers', JSON.stringify(customTimers));
        } catch (e) {
            console.error('Error saving custom timers:', e);
        }
    }

    function addCustomTimer(minutes) {
        const mins = parseInt(minutes);
        if (isNaN(mins) || mins <= 0 || mins > 999) {
            if (typeof showToast === 'function') {
                showToast('Please enter a valid number of minutes (1-999)', 'warning');
            } else {
                alert('Please enter a valid number of minutes (1-999)');
            }
            return;
        }

        const customTimer = {
            id: Date.now(),
            minutes: mins,
            label: `${mins} min`
        };

        customTimers.push(customTimer);
        saveCustomTimers();
        renderCustomTimers();

        // Auto-select the new timer
        setPreset(mins);
    }

    function deleteCustomTimer(id) {
        customTimers = customTimers.filter(t => t.id !== id);
        saveCustomTimers();
        renderCustomTimers();
    }

    function renderCustomTimers() {
        if (!customTimersContainer) return;

        if (customTimers.length === 0) {
            customTimersContainer.innerHTML = '';
            return;
        }

        const timersHTML = customTimers.map(timer => `
            <button class="preset-btn custom-timer-btn" data-time="${timer.minutes}" data-id="${timer.id}">
                ${timer.label}
                <span class="delete-timer-btn" onclick="event.stopPropagation(); deleteCustomTimer(${timer.id})" title="Delete timer">✕</span>
            </button>
        `).join('');

        customTimersContainer.innerHTML = timersHTML;

        // Add event listeners to custom timer buttons
        customTimersContainer.querySelectorAll('.custom-timer-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const minutes = parseInt(this.dataset.time);
                if (!isNaN(minutes)) {
                    setPreset(minutes);
                }
            });
        });
    }

    // ----- FUNCTIONS -----
    function updateDisplay() {
        const mins = Math.floor(remainingSeconds / 60);
        const secs = remainingSeconds % 60;
        const timeString = String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
        if (display) {
            display.textContent = timeString;
        }
        updateProgressRing();
    }

    function updateTimerState(state) {
        const indicator = document.getElementById('timerStateIndicator');
        const stateText = document.getElementById('timerStateText');
        if (!indicator || !stateText) return;

        // Remove all state classes
        indicator.classList.remove('running', 'paused');

        // Add appropriate class and text
        switch(state) {
            case 'running':
                indicator.classList.add('running');
                stateText.textContent = 'Running';
                break;
            case 'paused':
                indicator.classList.add('paused');
                stateText.textContent = 'Paused';
                break;
            default:
                stateText.textContent = 'Ready';
        }
    }

    function startTimer(skipSave) {
        if (isRunning) return;

        isRunning = true;
        if (!skipSave) saveTimerState();
        if (startBtn) startBtn.style.display = 'none';
        if (pauseBtn) {
            pauseBtn.style.display = 'inline-block';
            pauseBtn.disabled = false;
        }

        updateTimerState('running');

        // Connect to shared session tracker so Countdown counts towards
        // Total Timer / Current Session / Today's Sessions.
        if (typeof window.FocusSession === 'object') {
            const mins  = Math.round(totalSeconds / 60);
            const label = typeof window.getSimpleTimerLabel === 'function'
                ? window.getSimpleTimerLabel()
                : `Focus Timer — ${mins} min`;
            window.FocusSession.begin({ source: 'simpleTimer', label: label, phase: 'focus' });
        }

        timerStartTime        = Date.now();
        timerRemainingAtStart = remainingSeconds;

        timerInterval = setInterval(function() {
            // Use timestamp-based calculation to prevent throttling
            const elapsed = Math.floor((Date.now() - timerStartTime) / 1000);
            remainingSeconds = timerRemainingAtStart - elapsed;

            updateDisplay();

            if (remainingSeconds <= 0) {
                clearInterval(timerInterval);
                timerInterval = null;
                isRunning = false;
                remainingSeconds = 0;
                timerStartTime = null;
                localStorage.removeItem('simpleTimerPersisted');
                updateDisplay();

                // Sound + system notification so this is noticeable even if
                // the tab isn't focused, plus a non-blocking toast instead
                // of alert() — alert() freezes the whole page and, like the
                // old signal, is silent if you're not already looking here.
                if (typeof playChime === 'function') playChime();
                if (typeof sendNotification === 'function') {
                    sendNotification('⏰ Timer', 'Timer complete!', '⏰', 'simple-timer-notification');
                }
                if (typeof showToast === 'function') {
                    showToast('⏰ Timer complete!', 'success', 5000);
                }

                // Log to Simple Timer's own history
                saveSimpleTimerSession(totalSeconds);

                // Also log to shared Today's Sessions / Total Timer
                if (typeof window.logCompletedSession === 'function') {
                    const mins  = Math.round(totalSeconds / 60);
                    const label = typeof window.getSimpleTimerLabel === 'function'
                        ? window.getSimpleTimerLabel()
                        : `Focus Timer — ${mins} min`;
                    window.logCompletedSession({
                        taskName: label, focusSeconds: totalSeconds,
                        breakSeconds: 0, idleSeconds: 0, source: 'simpleTimer',
                    });
                } else if (typeof window.FocusSession === 'object') {
                    window.FocusSession.release();
                }

                // Reset to initial state
                updateTimerState('ready');
                if (startBtn) {
                    startBtn.style.display = 'inline-block';
                    startBtn.textContent = 'Start';
                }
                if (pauseBtn) {
                    pauseBtn.style.display = 'none';
                    pauseBtn.disabled = true;
                }
            }
        }, 100);
    }

    function pauseTimer() {
        if (!isRunning) return;
        clearInterval(timerInterval);
        timerInterval = null;
        isRunning = false;
        timerStartTime = null;
        updateTimerState('paused');
        saveTimerState();
        // Deliberate pause counts as break time in Total Timer / Current Session
        if (typeof window.FocusSession === 'object') window.FocusSession.pause();
        if (startBtn) { startBtn.style.display = 'inline-block'; startBtn.textContent = 'Resume'; }
        if (pauseBtn) pauseBtn.style.display = 'none';
    }

    function resetTimer() {
        clearInterval(timerInterval);
        timerInterval = null;
        isRunning = false;
        remainingSeconds = totalSeconds;
        timerStartTime = null;
        timerRemainingAtStart = 0;
        localStorage.removeItem('simpleTimerPersisted');
        updateDisplay();
        updateTimerState('ready');
        // Release session tracker ownership (logs nothing — user abandoned the timer)
        if (typeof window.FocusSession === 'object' && window.FocusSession.isActive() === 'simpleTimer') {
            window.FocusSession.release();
        }
        if (startBtn) { startBtn.style.display = 'inline-block'; startBtn.textContent = 'Start'; }
        if (pauseBtn) { pauseBtn.style.display = 'none'; pauseBtn.disabled = true; }
    }

    function setPreset(minutes) {
        // If timer was mid-session, release the tracker without logging
        if (typeof window.FocusSession === 'object' && window.FocusSession.isActive() === 'simpleTimer') {
            window.FocusSession.release();
        }
        clearInterval(timerInterval);
        timerInterval = null;
        isRunning = false;
        totalSeconds = minutes * 60;
        remainingSeconds = totalSeconds;
        localStorage.removeItem('simpleTimerPersisted');
        updateDisplay();

        // Bug 6 fix: reset the state indicator pill when a new preset is picked,
        // otherwise it can stay showing "Running" or "Paused" from the old timer.
        updateTimerState('ready');

        // Update active preset button
        presetBtns.forEach(function(btn) {
            btn.classList.remove('active');
            if (parseInt(btn.dataset.time) === minutes) {
                btn.classList.add('active');
            }
        });

        // Reset button states
        if (startBtn) {
            startBtn.style.display = 'inline-block';
            startBtn.textContent = 'Start';
        }
        if (pauseBtn) {
            pauseBtn.style.display = 'none';
            pauseBtn.disabled = true;
        }
    }

    // ----- EVENT LISTENERS -----
    if (startBtn) {
        startBtn.addEventListener('click', startTimer);
    }

    if (pauseBtn) {
        pauseBtn.addEventListener('click', pauseTimer);
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', resetTimer);
    }

    presetBtns.forEach(function(btn) {
        btn.addEventListener('click', function() {
            const minutes = parseInt(this.dataset.time);
            if (!isNaN(minutes)) {
                setPreset(minutes);
            }
        });
    });

    // Custom timer input
    if (addCustomTimerBtn && customTimerInput) {
        addCustomTimerBtn.addEventListener('click', function() {
            const value = customTimerInput.value.trim();
            if (value) {
                addCustomTimer(value);
                customTimerInput.value = '';
            }
        });

        customTimerInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                const value = customTimerInput.value.trim();
                if (value) {
                    addCustomTimer(value);
                    customTimerInput.value = '';
                }
            }
        });
    }

    // Expose so the inline delete button's onclick can reach it (same pattern as pomodoro.js)
    window.deleteCustomTimer = deleteCustomTimer;

    // Expose pause function so other timer modes can pause this one when switching (Bug 6 fix)
    window.pauseSimpleTimer = pauseTimer;

    window.getSimpleTimerLabel = function() {
        const minutes = Math.round(totalSeconds / 60);
        const customMatch = customTimers.find(t => t.minutes === minutes);
        if (customMatch) return customMatch.label;
        const presetLabels = { 5: '5 min', 25: '25 min', 50: '50 min' };
        if (presetLabels[minutes]) return presetLabels[minutes];
        return 'Focus Timer';
    };

    // ----- INITIALIZE -----
    loadCustomTimers();
    initProgressRing();
    updateDisplay();
    loadTimerState();
    if (pauseBtn) pauseBtn.style.display = 'none';
    renderSimpleTimerHistory();

})();
