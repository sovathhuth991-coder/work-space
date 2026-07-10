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
            pomodoroBtn: document.getElementById('pomodoroPomoBtn')
        };

        if (!elements.shell) return;

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
            remainingSeconds = 0;
            updateDisplay();
            phaseComplete();
        }
    }

    function phaseComplete() {
        // Play notification sound via flash/visual
        const ringEl = elements.ringContainer;
        if (ringEl) {
            ringEl.style.animation = 'timerComplete 0.6s ease';
            setTimeout(() => { ringEl.style.animation = ''; }, 700);
        }

        // Flash the title
        document.title = '⏰ Phase Complete! - Workspace Hub';
        setTimeout(() => { document.title = 'Workspace Hub'; }, 3000);

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

    // ----- MODE SWITCHING (between countdown and pomodoro) -----
    function switchPomodoroMode(mode) {
        // Reset pomodoro state first
        clearInterval(pomoInterval);
        pomoInterval = null;
        isRunning = false;
        phaseStartTime = null;

        const countdownShell = document.querySelector('.simple-timer-card');
        const pomodoroShell = document.getElementById('pomodoroShell');
        const countdownBtn = document.getElementById('pomodoroCountdownBtn');
        const pomodoroBtn = document.getElementById('pomodoroPomoBtn');

        if (mode === 'pomodoro') {
            if (countdownShell) countdownShell.style.display = 'none';
            if (pomodoroShell) pomodoroShell.classList.add('active');
            if (countdownBtn) countdownBtn.classList.remove('active');
            if (pomodoroBtn) pomodoroBtn.classList.add('active');
            // Reset pomodoro state
            resetPomodoro();
        } else {
            if (countdownShell) countdownShell.style.display = 'block';
            if (pomodoroShell) pomodoroShell.classList.remove('active');
            if (countdownBtn) countdownBtn.classList.add('active');
            if (pomodoroBtn) pomodoroBtn.classList.remove('active');
        }
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
