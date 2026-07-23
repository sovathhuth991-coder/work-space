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

        // Update state indicator
        updateTimerState('running');

        // Initialize timestamp-based timing
        timerStartTime = Date.now();
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

        // Keep the remaining seconds as they are (already calculated by timestamp)
        timerStartTime = null;

        // Update state indicator
        updateTimerState('paused');
        saveTimerState();

        if (startBtn) {
            startBtn.style.display = 'inline-block';
            startBtn.textContent = 'Resume';
        }
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

        // Update state indicator
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

    function setPreset(minutes) {
        clearInterval(timerInterval);
        timerInterval = null;
        isRunning = false;
        totalSeconds = minutes * 60;
        remainingSeconds = totalSeconds;
        localStorage.removeItem('simpleTimerPersisted');
        updateDisplay();

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

    // ----- INITIALIZE -----
    loadCustomTimers();
    initProgressRing();
    updateDisplay();
    loadTimerState();
    if (pauseBtn) pauseBtn.style.display = 'none';

})();
