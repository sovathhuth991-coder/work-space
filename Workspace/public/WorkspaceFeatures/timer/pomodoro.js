// ============================================================
// POMODORO ENGINE — Structured Focus/Break Cycles
// ============================================================
(function() {
    'use strict';

    // ----- CONFIG -----
    const FOCUS_MINUTES = 25;
    const SHORT_BREAK_MINUTES = 5;
    const LONG_BREAK_MINUTES = 15;
    const CYCLES_BEFORE_LONG_BREAK = 4;
    const TOTAL_CYCLES = 4; // 4 focus sessions per full pomodoro set

    // ----- STATE -----
    let pomoInterval = null;
    let currentPhase = 'ready'; // ready, focus, break, long-break
    let cycleCount = 0; // how many focus sessions completed (resets after long break)
    let totalPomodorosToday = 0;
    let totalFocusSeconds = 0;
    let remainingSeconds = FOCUS_MINUTES * 60;
    let currentTotal = FOCUS_MINUTES * 60;
    let isRunning = false;

    // Timestamp-based timing
    let phaseStartTime = null;
    let phaseRemainingAtStart = 0;

    // ----- DOM ELEMENTS (populated in init) -----
    let elements = {};

    const CIRCUMFERENCE = 2 * Math.PI * 130; // radius = 130

    // ----- LOCAL STORAGE -----
    function loadPomodoroStats() {
        try {
            const today = new Date().toDateString();
            const stored = JSON.parse(localStorage.getItem('pomodoroStats') || '{}');
            if (stored.date === today) {
                totalPomodorosToday = stored.count || 0;
                totalFocusSeconds = stored.focusSeconds || 0;
            } else {
                totalPomodorosToday = 0;
                totalFocusSeconds = 0;
                // Reset for new day
                localStorage.setItem('pomodoroStats', JSON.stringify({ date: today, count: 0, focusSeconds: 0 }));
            }
        } catch (e) {
            totalPomodorosToday = 0;
            totalFocusSeconds = 0;
        }
    }

    function savePomodoroStats() {
        try {
            const today = new Date().toDateString();
            localStorage.setItem('pomodoroStats', JSON.stringify({
                date: today,
                count: totalPomodorosToday,
                focusSeconds: totalFocusSeconds
            }));
        } catch (e) { /* ignore */ }
    }

    // ----- INIT -----
    function initPomodoro() {
        elements = {
            shell: document.getElementById('pomodoroShell'),
            display: document.getElementById('pomodoroDisplay'),
            label: document.getElementById('pomodoroLabel'),
            phaseEl: document.getElementById('pomodoroPhase'),
            startBtn: document.getElementById('pomodoroStartBtn'),
            pauseBtn: document.getElementById('pomodoroPauseBtn'),
            resetBtn: document.getElementById('pomodoroResetBtn'),
            cycleBar: document.getElementById('pomodoroCycleBar'),
            ringFill: document.getElementById('pomodoroRingFill'),
            ringGlow: document.getElementById('pomodoroRingGlow'),
            ringContainer: document.getElementById('pomodoroRingContainer'),
            statCycles: document.getElementById('pomoStatCycles'),
            statFocus: document.getElementById('pomoStatFocus'),
            statToday: document.getElementById('pomoStatToday'),
            countdownBtn: document.getElementById('pomodoroCountdownBtn'),
            pomodoroBtn: document.getElementById('pomodoroPomoBtn'),
            taskFocusBtn: document.getElementById('taskFocusModeBtn')
        };

        if (!elements.shell) return;

        // Ensure #pomodoroShell is inside .simple-timer-card so it shares the
        // same visual container. If it was placed outside the card in the HTML,
        // move it to the right spot.
        const focusPanel = document.querySelector('.simple-timer-card');
        if (focusPanel && elements.shell.parentElement !== focusPanel) {
            focusPanel.appendChild(elements.shell);
        }

        loadPomodoroStats();
        initRing();
        updateDisplay();
        updateCycleBar();
        updateStats();

        // --- Event listeners ---
        if (elements.startBtn) {
            elements.startBtn.addEventListener('click', startPomodoro);
        }
        if (elements.pauseBtn) {
            elements.pauseBtn.addEventListener('click', pausePomodoro);
        }
        if (elements.resetBtn) {
            elements.resetBtn.addEventListener('click', resetPomodoro);
        }
        if (elements.countdownBtn) {
            elements.countdownBtn.addEventListener('click', () => switchPomodoroMode('countdown'));
        }
        if (elements.pomodoroBtn) {
            elements.pomodoroBtn.addEventListener('click', () => switchPomodoroMode('pomodoro'));
        }
        if (elements.taskFocusBtn) {
            elements.taskFocusBtn.addEventListener('click', () => switchPomodoroMode('taskFocus'));
        }

        // Set initial phase display
        setPhase('ready');
    }

    function initRing() {
        if (elements.ringFill) {
            elements.ringFill.style.strokeDasharray = CIRCUMFERENCE;
            elements.ringFill.style.strokeDashoffset = 0;
        }
        if (elements.ringGlow) {
            elements.ringGlow.style.strokeDasharray = CIRCUMFERENCE;
            elements.ringGlow.style.strokeDashoffset = 0;
        }
    }

    function updateRing() {
        if (!elements.ringFill || !elements.ringGlow) return;
        const progress = currentTotal > 0 ? remainingSeconds / currentTotal : 0;
        const offset = CIRCUMFERENCE * (1 - progress);
        elements.ringFill.style.strokeDashoffset = offset;
        elements.ringGlow.style.strokeDashoffset = offset;
    }

    // ----- PHASE MANAGEMENT -----
    function setPhase(phase) {
        currentPhase = phase;
        if (!elements.phaseEl) return;

        // Remove all phase classes
        elements.phaseEl.classList.remove('focus', 'break', 'long-break', 'ready');

        switch (phase) {
            case 'focus':
                elements.phaseEl.classList.add('focus');
                elements.phaseEl.innerHTML = '<span class="state-dot"></span> Focus Time';
                if (elements.label) elements.label.textContent = 'Focus';
                // Red gradient for ring
                elements.ringContainer?.classList.remove('pomodoro-break-ring', 'pomodoro-long-break-ring');
                break;
            case 'break':
                elements.phaseEl.classList.add('break');
                elements.phaseEl.innerHTML = '<span class="state-dot"></span> Short Break';
                if (elements.label) elements.label.textContent = 'Short Break';
                elements.ringContainer?.classList.add('pomodoro-break-ring');
                elements.ringContainer?.classList.remove('pomodoro-long-break-ring');
                break;
            case 'long-break':
                elements.phaseEl.classList.add('long-break');
                elements.phaseEl.innerHTML = '<span class="state-dot"></span> Long Break';
                if (elements.label) elements.label.textContent = 'Long Break';
                elements.ringContainer?.classList.remove('pomodoro-break-ring');
                elements.ringContainer?.classList.add('pomodoro-long-break-ring');
                break;
            default:
                elements.phaseEl.classList.add('ready');
                elements.phaseEl.innerHTML = '<span class="state-dot"></span> Ready';
                if (elements.label) elements.label.textContent = 'Pomodoro';
                elements.ringContainer?.classList.remove('pomodoro-break-ring', 'pomodoro-long-break-ring');
        }
    }

    function updateDisplay() {
        const mins = Math.floor(remainingSeconds / 60);
        const secs = remainingSeconds % 60;
        const timeString = String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
        if (elements.display) {
            elements.display.textContent = timeString;
        }
        updateRing();
    }

    function updateCycleBar() {
        if (!elements.cycleBar) return;
        let dots = '';
        for (let i = 0; i < TOTAL_CYCLES; i++) {
            let cls = 'pomodoro-cycle-dot';
            if (i < cycleCount) cls += ' completed';
            else if (i === cycleCount && (currentPhase === 'focus' || isRunning)) cls += ' current';
            dots += `<span class="${cls}"></span>`;
        }
        elements.cycleBar.innerHTML = dots;
    }

    function updateStats() {
        if (elements.statCycles) elements.statCycles.textContent = cycleCount;
        if (elements.statFocus) {
            const mins = Math.floor(totalFocusSeconds / 60);
            elements.statFocus.textContent = `${mins}m`;
        }
        if (elements.statToday) elements.statToday.textContent = totalPomodorosToday;
    }

    // ----- TIMER LOGIC -----
    function startPomodoro() {
        if (isRunning) return;

        // If in ready state, start first focus
        if (currentPhase === 'ready') {
            cycleCount = 0;
            preparePhase('focus');
        }

        isRunning = true;
        phaseStartTime = Date.now();
        phaseRemainingAtStart = remainingSeconds;
        elements.ringContainer?.classList.add('pomodoro-running');

        if (elements.startBtn) {
            elements.startBtn.style.display = 'none';
            elements.startBtn.disabled = true;
        }
        if (elements.pauseBtn) {
            elements.pauseBtn.style.display = 'inline-block';
            elements.pauseBtn.disabled = false;
        }

        pomoInterval = setInterval(tick, 100);
    }

    function tick() {
        if (!phaseStartTime) return;
        const elapsed = Math.floor((Date.now() - phaseStartTime) / 1000);
        remainingSeconds = phaseRemainingAtStart - elapsed;

        updateDisplay();
        updateCycleBar();

        if (remainingSeconds <= 0) {
            clearInterval(pomoInterval);
            pomoInterval = null;
            isRunning = false;
            elements.ringContainer?.classList.remove('pomodoro-running');
            remainingSeconds = 0;
            updateDisplay();
            phaseComplete();
        }
    }

    function phaseComplete() {
        const completedPhase = currentPhase;

        // Play notification sound via flash/visual
        const ringEl = elements.ringContainer;
        if (ringEl) {
            ringEl.style.animation = 'timerComplete 0.6s ease';
            setTimeout(() => { ringEl.style.animation = ''; }, 700);
        }

        // Flash the title
        document.title = '⏰ Phase Complete! - Workspace Hub';
        setTimeout(() => { document.title = 'Workspace Hub'; }, 3000);

        // Sound + system notification — a focus timer is only useful if you
        // notice it ended, and the title/ring flash above are both silent
        // and easy to miss the moment you're not looking at this tab.
        if (typeof playChime === 'function') playChime();
        if (typeof sendNotification === 'function') {
            const msg = completedPhase === 'focus'
                ? 'Focus session complete — time for a break.'
                : "Break's over — back to focus.";
            sendNotification('⏰ Pomodoro', msg, '🍅', 'pomodoro-notification');
        }

        if (currentPhase === 'focus') {
            // Focus session completed
            totalPomodorosToday++;
            cycleCount++;
            totalFocusSeconds += FOCUS_MINUTES * 60;
            savePomodoroStats();
            updateStats();

            if (cycleCount >= CYCLES_BEFORE_LONG_BREAK) {
                preparePhase('long-break');
            } else {
                preparePhase('break');
            }
        } else {
            // Break completed — start next focus
            preparePhase('focus');
        }

        // Auto-start next phase
        phaseStartTime = Date.now();
        phaseRemainingAtStart = remainingSeconds;
        isRunning = true;

        if (elements.startBtn) {
            elements.startBtn.style.display = 'none';
            elements.startBtn.disabled = true;
        }
        if (elements.pauseBtn) {
            elements.pauseBtn.style.display = 'inline-block';
            elements.pauseBtn.disabled = false;
        }

        pomoInterval = setInterval(tick, 100);
    }

    function preparePhase(phase) {
        setPhase(phase);

        switch (phase) {
            case 'focus':
                remainingSeconds = FOCUS_MINUTES * 60;
                currentTotal = FOCUS_MINUTES * 60;
                break;
            case 'break':
                remainingSeconds = SHORT_BREAK_MINUTES * 60;
                currentTotal = SHORT_BREAK_MINUTES * 60;
                break;
            case 'long-break':
                remainingSeconds = LONG_BREAK_MINUTES * 60;
                currentTotal = LONG_BREAK_MINUTES * 60;
                // Reset cycle counter after long break
                cycleCount = 0;
                break;
        }

        updateDisplay();
        updateCycleBar();
        updateStats();
    }

    function pausePomodoro() {
        if (!isRunning) return;

        clearInterval(pomoInterval);
        pomoInterval = null;
        isRunning = false;
        phaseStartTime = null;
        elements.ringContainer?.classList.remove('pomodoro-running');

        if (elements.startBtn) {
            elements.startBtn.style.display = 'inline-block';
            elements.startBtn.textContent = 'Resume';
            elements.startBtn.disabled = false;
        }
        if (elements.pauseBtn) {
            elements.pauseBtn.style.display = 'none';
            elements.pauseBtn.disabled = true;
        }
    }

    function resetPomodoro() {
        clearInterval(pomoInterval);
        pomoInterval = null;
        isRunning = false;
        phaseStartTime = null;
        cycleCount = 0;
        elements.ringContainer?.classList.remove('pomodoro-running');

        preparePhase('ready');
        setPhase('ready');

        if (elements.startBtn) {
            elements.startBtn.style.display = 'inline-block';
            elements.startBtn.textContent = 'Start';
            elements.startBtn.disabled = false;
        }
        if (elements.pauseBtn) {
            elements.pauseBtn.style.display = 'none';
            elements.pauseBtn.disabled = true;
        }

        updateCycleBar();
        updateStats();
    }

    // ----- MODE SWITCHING (between countdown, pomodoro, and task focus) -----
    let swapTimeout;
    function switchPomodoroMode(mode) {
        const card = document.querySelector('.simple-timer-card');
        const countdownContent = card ? card.querySelector('.countdown-content') : null;
        const pomodoroShell = document.getElementById('pomodoroShell');
        const taskFocusShell = document.getElementById('taskFocusShell');
        const countdownBtn = document.getElementById('pomodoroCountdownBtn');
        const pomodoroBtn = document.getElementById('pomodoroPomoBtn');
        const taskFocusBtn = document.getElementById('taskFocusModeBtn');

        if (swapTimeout) clearTimeout(swapTimeout);
        if (card) card.classList.add('swapping');

        swapTimeout = setTimeout(() => {
            clearInterval(pomoInterval);
            pomoInterval = null;
            isRunning = false;
            phaseStartTime = null;
            elements.ringContainer?.classList.remove('pomodoro-running');

            // Task Focus manages its own countdown loop, independent of this
            // one — if we're leaving its mode, let it pause & save its own
            // progress rather than reaching into its state from here.
            if (mode !== 'taskFocus' && typeof window.pauseTaskFocusIfRunning === 'function') {
                window.pauseTaskFocusIfRunning();
            }

            const panels = [
                { el: countdownContent, btn: countdownBtn, match: 'countdown' },
                { el: pomodoroShell, btn: pomodoroBtn, match: 'pomodoro' },
                { el: taskFocusShell, btn: taskFocusBtn, match: 'taskFocus' }
            ];
            panels.forEach(p => {
                const active = mode === p.match;
                if (p.el) p.el.style.display = active ? 'block' : 'none';
                if (p.btn) p.btn.classList.toggle('active', active);
            });

            if (mode === 'pomodoro') resetPomodoro();
            if (mode === 'taskFocus' && typeof window.showTaskFocusPicker === 'function') {
                window.showTaskFocusPicker();
            }

            if (card) card.classList.remove('swapping');
            swapTimeout = null;
        }, 300);
    }

    // ----- EXPOSE GLOBALLY -----
    window.switchPomodoroMode = switchPomodoroMode;
    window.initPomodoro = initPomodoro;

    // Auto-init when DOM is ready and timer view is loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPomodoro);
    } else {
        // Delay slightly to ensure DOM elements exist
        setTimeout(initPomodoro, 100);
    }

})();
