// ============================================================
// FOCUS TIMER  —  session-tracker.js
// Countdown UI + session tracking in one self-contained file.
// Other timer modes (Pomodoro, Task Focus) are stubs for now.
// ============================================================
(function () {
    'use strict';

    // ── Countdown state ──────────────────────────────────────
    var DEFAULT_MINS    = 25;
    var totalSeconds    = DEFAULT_MINS * 60;
    var remaining       = totalSeconds;
    var timerRunning    = false;
    var timerInterval   = null;
    var startedAt       = null;   // Date.now() when Start was last clicked
    var remainingAtStart = totalSeconds;
    var sessionLabel    = 'Focus Timer — ' + DEFAULT_MINS + ' min';

    // ── Session phase model ──────────────────────────────────
    // One phase at a time. Transitions via setPhase().
    // Accumulated seconds only ever grow until logAndReset().
    var phase      = 'idle';
    var phaseStart = Date.now();
    var accum      = { focus: 0, break: 0, idle: 0 };

    function commitPhase() {
        var elapsed = Math.floor((Date.now() - phaseStart) / 1000);
        if (elapsed > 0) accum[phase] += elapsed;
        phaseStart = Date.now();
    }
    function setPhase(p) { commitPhase(); phase = p; }
    function live(bucket) {
        return accum[bucket] + (phase === bucket
            ? Math.floor((Date.now() - phaseStart) / 1000) : 0);
    }
    function logAndReset(focusSecs) {
        if (focusSecs < 5) { resetAccum(); return; }
        var sessions = [];
        try { sessions = JSON.parse(localStorage.getItem('completedSessions') || '[]'); } catch (e) {}
        sessions.push({
            taskName: sessionLabel, focusSeconds: focusSecs,
            breakSeconds: live('break'), idleSeconds: live('idle'),
            totalSeconds: focusSecs + live('break') + live('idle'),
            timestamp: Date.now(), source: 'focusTimer',
        });
        try { localStorage.setItem('completedSessions', JSON.stringify(sessions)); } catch (e) {}
        resetAccum();
        renderSessionHistory();
        renderSimpleHistory(focusSecs);
        updateTotalTimer();
    }
    function resetAccum() {
        phase = 'idle'; phaseStart = Date.now();
        accum = { focus: 0, break: 0, idle: 0 };
    }

    // ── Helpers ──────────────────────────────────────────────
    function fmt(sec) {
        sec = Math.max(0, Math.floor(sec));
        var h = Math.floor(sec / 3600);
        var m = Math.floor((sec % 3600) / 60);
        var s = sec % 60;
        function p(n) { return n < 10 ? '0' + n : '' + n; }
        return h > 0 ? p(h) + ':' + p(m) + ':' + p(s) : p(m) + ':' + p(s);
    }
    function el(id) { return document.getElementById(id); }
    function qs(sel) { return document.querySelector(sel); }
    function todayStr() { return new Date().toDateString(); }

    // ── Ring animation ───────────────────────────────────────
    var RADIUS = 130;
    var CIRC   = 2 * Math.PI * RADIUS;  // ~816.81

    function updateRing(frac) {
        var fill = el('timerRingFill');
        if (!fill) return;
        var offset = CIRC * (1 - Math.max(0, Math.min(1, frac)));
        fill.style.strokeDasharray  = CIRC;
        fill.style.strokeDashoffset = offset;
    }

    // ── Display ──────────────────────────────────────────────
    function setText(id, val) { var e = el(id); if (e) e.textContent = val; }

    function updateCountdownDisplay() {
        setText('countdownDisplay', fmt(remaining));
        updateRing(remaining / totalSeconds);
    }

    function updateCurrentSession() {
        var f = live('focus'), b = live('break'), i = live('idle');
        setText('sessionFocusDisplay', fmt(f));
        setText('sessionBreakDisplay', fmt(b));
        setText('sessionIdleDisplay',  fmt(i));
        setText('sessionTotalDisplay', fmt(f + b + i));
    }

    function updateTotalTimer() {
        var hist = { focus: 0, break: 0, idle: 0 };
        try {
            var sessions = JSON.parse(localStorage.getItem('completedSessions') || '[]');
            var today = todayStr();
            for (var i = 0; i < sessions.length; i++) {
                if (new Date(sessions[i].timestamp).toDateString() === today) {
                    hist.focus += sessions[i].focusSeconds || 0;
                    hist.break += sessions[i].breakSeconds || 0;
                    hist.idle  += sessions[i].idleSeconds  || 0;
                }
            }
        } catch (e) {}
        var f = hist.focus + live('focus');
        var b = hist.break + live('break');
        var id = hist.idle  + live('idle');
        var t  = f + b + id;
        setText('focusTimeDisplay', fmt(f));
        setText('breakTimeDisplay', fmt(b));
        setText('idleTimeDisplay',  fmt(id));
        setText('totalTimeDisplay', fmt(t));
        setText('headerFocusTime',  fmt(f));
        setText('headerBreakTime',  fmt(b));
        setText('headerIdleTime',   fmt(id));
        if (t > 0) {
            var pfx = qs('.progress-focus');
            var pbr = qs('.progress-break');
            var pid = qs('.progress-idle');
            if (pfx) pfx.style.width = (f  / t * 100) + '%';
            if (pbr) pbr.style.width = (b  / t * 100) + '%';
            if (pid) pid.style.width = (id / t * 100) + '%';
        }
    }

    function updateAll() {
        updateCountdownDisplay();
        updateCurrentSession();
        updateTotalTimer();
        updateSessionTrackerState();
    }

    function updateSessionTrackerState() {
        var tracker = el('sessionTracker');
        if (!tracker) return;
        tracker.classList.remove('focus-mode-active', 'break-mode-active');
        if (phase === 'focus') tracker.classList.add('focus-mode-active');
        if (phase === 'break') tracker.classList.add('break-mode-active');
    }

    function setStateText(text) {
        setText('timerStateText', text);
        var dot = qs('.state-dot');
        if (dot) {
            dot.style.background = text === 'Running'  ? 'var(--cat-personal)' :
                                   text === 'Paused'   ? 'var(--cat-fitness)'  :
                                   '#888';
        }
    }

    // ── Session history ──────────────────────────────────────
    function renderSessionHistory() {
        var list = el('sessionHistoryList');
        if (!list) return;
        var sessions = [];
        try { sessions = JSON.parse(localStorage.getItem('completedSessions') || '[]'); } catch (e) {}
        var today = todayStr();
        var todaySessions = sessions.filter(function(s) {
            return new Date(s.timestamp).toDateString() === today;
        }).reverse();

        if (todaySessions.length === 0) {
            list.innerHTML = '<p style="color:var(--text-muted);font-size:0.8rem;padding:8px 0;">No sessions yet today.</p>';
            return;
        }
        list.innerHTML = todaySessions.map(function(s) {
            var t = new Date(s.timestamp);
            var timeStr = t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return '<div class="session-history-item" style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border-color);">' +
                '<span style="font-size:0.75rem;color:var(--text-muted);min-width:54px;">' + timeStr + '</span>' +
                '<span style="font-weight:600;flex:1;font-size:0.85rem;">' + (s.taskName || 'Focus Timer') + '</span>' +
                '<span style="font-size:0.75rem;color:var(--cat-study);">&#9679; ' + fmt(s.focusSeconds) + '</span>' +
                '</div>';
        }).join('');
    }

    function renderSimpleHistory(focusSecs) {
        var list = el('simpleTimerHistoryList');
        if (!list) return;
        var key = 'simpleTimerHistory';
        var history = [];
        try { history = JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) {}
        history.unshift({ seconds: focusSecs, timestamp: Date.now() });
        if (history.length > 10) history = history.slice(0, 10);
        try { localStorage.setItem(key, JSON.stringify(history)); } catch (e) {}
        list.innerHTML = history.map(function(h) {
            var t = new Date(h.timestamp);
            var mins = Math.floor(h.seconds / 60), secs = h.seconds % 60;
            var label = mins + 'm ' + (secs > 0 ? secs + 's' : '0s');
            return '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border-color);">' +
                '<span style="font-weight:600;">' + label + '</span>' +
                '<span style="font-size:0.75rem;color:var(--text-muted);">' +
                    t.toLocaleDateString() + ', ' + t.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) +
                '</span></div>';
        }).join('') || '<p class="simple-timer-history-empty">No simple timer sessions yet.</p>';
    }

    // ── Timer controls ───────────────────────────────────────
    function startTimer() {
        if (timerRunning) return;
        timerRunning    = true;
        startedAt       = Date.now();
        remainingAtStart = remaining;

        setPhase('focus');
        setText('currentSessionTaskName', sessionLabel);
        setStateText('Running');

        var startBtn = el('startBtn'), pauseBtn = el('pauseBtn');
        if (startBtn) { startBtn.style.display = 'none'; }
        if (pauseBtn) { pauseBtn.style.display = 'inline-block'; pauseBtn.disabled = false; pauseBtn.textContent = 'Pause'; }

        timerInterval = setInterval(function () {
            var elapsed = Math.floor((Date.now() - startedAt) / 1000);
            remaining = Math.max(0, remainingAtStart - elapsed);
            updateAll();
            if (remaining <= 0) { completeTimer(); }
        }, 100);
    }

    function pauseTimer() {
        if (!timerRunning) return;
        clearInterval(timerInterval); timerInterval = null;
        timerRunning = false;
        startedAt    = null;

        setPhase('break');  // deliberate pause = break time
        setStateText('Paused');

        var startBtn = el('startBtn'), pauseBtn = el('pauseBtn');
        if (startBtn) { startBtn.style.display = 'inline-block'; startBtn.textContent = 'Resume'; }
        if (pauseBtn) { pauseBtn.style.display = 'none'; }
        saveTimerState();
        updateAll();
    }

    function resetTimer() {
        clearInterval(timerInterval); timerInterval = null;
        timerRunning = false; startedAt = null;
        remaining = totalSeconds;

        // Release without logging (user abandoned the session)
        resetAccum();
        setStateText('Ready');

        var startBtn = el('startBtn'), pauseBtn = el('pauseBtn');
        if (startBtn) { startBtn.style.display = 'inline-block'; startBtn.textContent = 'Start'; }
        if (pauseBtn) { pauseBtn.style.display = 'none'; pauseBtn.disabled = true; }
        setText('currentSessionTaskName', 'No active task');
        clearTimerState();
        updateAll();
    }

    function completeTimer() {
        clearInterval(timerInterval); timerInterval = null;
        timerRunning = false; startedAt = null;
        remaining = 0;
        updateAll();

        if (typeof playChime === 'function') playChime();
        if (typeof sendNotification === 'function') sendNotification('⏰ Timer', 'Timer complete!', '⏰', 'simple-timer-notification');
        if (typeof showToast === 'function') showToast('⏰ Timer complete!', 'success', 5000);

        var focusElapsed = live('focus');
        logAndReset(focusElapsed);

        var startBtn = el('startBtn'), pauseBtn = el('pauseBtn');
        if (startBtn) { startBtn.style.display = 'inline-block'; startBtn.textContent = 'Start'; }
        if (pauseBtn) { pauseBtn.style.display = 'none'; pauseBtn.disabled = true; }
        setText('currentSessionTaskName', 'No active task');
        setStateText('Ready');
        remaining = totalSeconds;
        clearTimerState();
        updateAll();
    }

    // ── Preset handling ──────────────────────────────────────
    function setPreset(minutes) {
        if (timerRunning) pauseTimer();
        resetAccum();
        totalSeconds = minutes * 60;
        remaining    = totalSeconds;
        sessionLabel = 'Focus Timer — ' + minutes + ' min';
        setText('currentSessionTaskName', 'No active task');
        setStateText('Ready');
        var startBtn = el('startBtn'), pauseBtn = el('pauseBtn');
        if (startBtn) { startBtn.style.display = 'inline-block'; startBtn.textContent = 'Start'; }
        if (pauseBtn) { pauseBtn.style.display = 'none'; pauseBtn.disabled = true; }
        document.querySelectorAll('.preset-btn').forEach(function (b) {
            b.classList.toggle('active', parseInt(b.dataset.time) === minutes);
        });
        clearTimerState();
        updateAll();
    }

    // ── Custom timers ─────────────────────────────────────────
    function loadCustomTimers() {
        var timers = [];
        try { timers = JSON.parse(localStorage.getItem('customTimers') || '[]'); } catch (e) {}
        var container = el('customTimersContainer');
        if (!container) return;
        container.innerHTML = '';
        timers.forEach(function (mins) {
            var btn = document.createElement('button');
            btn.className = 'preset-btn';
            btn.dataset.time = mins;
            btn.textContent = mins + ' min';
            btn.addEventListener('click', function () { setPreset(mins); });
            container.appendChild(btn);
        });
    }

    function addCustomTimer() {
        var input = el('customTimerInput');
        if (!input) return;
        var mins = parseInt(input.value);
        if (!mins || mins < 1 || mins > 999) return;
        var timers = [];
        try { timers = JSON.parse(localStorage.getItem('customTimers') || '[]'); } catch (e) {}
        if (!timers.includes(mins)) {
            timers.push(mins);
            try { localStorage.setItem('customTimers', JSON.stringify(timers)); } catch (e) {}
        }
        input.value = '';
        loadCustomTimers();
        setPreset(mins);
    }

    // ── State persistence (survive refresh while paused) ────
    function saveTimerState() {
        try {
            localStorage.setItem('focusTimerState', JSON.stringify({
                remaining: remaining, total: totalSeconds,
                label: sessionLabel, phase: phase,
                accumFocus: accum.focus, accumBreak: accum.break, accumIdle: accum.idle,
                ts: Date.now(),
            }));
        } catch (e) {}
    }
    function clearTimerState() {
        try { localStorage.removeItem('focusTimerState'); } catch (e) {}
    }
    function loadTimerState() {
        try {
            var raw = localStorage.getItem('focusTimerState');
            if (!raw) return;
            var s = JSON.parse(raw);
            if (!s || new Date(s.ts).toDateString() !== todayStr()) return;
            totalSeconds  = s.total    || totalSeconds;
            remaining     = s.remaining || totalSeconds;
            sessionLabel  = s.label    || sessionLabel;
            phase         = s.phase    || 'idle';
            accum.focus   = s.accumFocus || 0;
            accum.break   = s.accumBreak || 0;
            accum.idle    = s.accumIdle  || 0;
            phaseStart    = Date.now();
            if (phase !== 'idle') {
                setText('currentSessionTaskName', sessionLabel);
                var startBtn = el('startBtn');
                if (startBtn) startBtn.textContent = 'Resume';
                setStateText('Paused');
            }
            var mins = Math.round(totalSeconds / 60);
            document.querySelectorAll('.preset-btn').forEach(function (b) {
                b.classList.toggle('active', parseInt(b.dataset.time) === mins);
            });
        } catch (e) {}
    }

    // ── AFK / idle detection ─────────────────────────────────
    var lastActivity = Date.now();
    var afkActive    = false;
    var AFK_THRESHOLD = 300000; // 5 min

    function setupActivity() {
        ['mousedown','mousemove','keydown','scroll','touchstart'].forEach(function (ev) {
            document.addEventListener(ev, function () { lastActivity = Date.now(); }, { passive: true });
        });
    }

    function checkAFK() {
        var isAFK = (Date.now() - lastActivity) >= AFK_THRESHOLD;
        if (isAFK && !afkActive && !timerRunning) {
            // Already idle (not running) — switch to idle phase so idle time counts
            afkActive = true;
            if (phase !== 'idle') setPhase('idle');
        } else if (!isAFK && afkActive) {
            afkActive = false;
        }
        updateAll();
    }

    // ── Daily reset ───────────────────────────────────────────
    var lastDate = todayStr();
    function checkDayChange() {
        if (todayStr() === lastDate) return;
        lastDate = todayStr();
        if (timerRunning) { clearInterval(timerInterval); timerInterval = null; timerRunning = false; }
        remaining = totalSeconds;
        resetAccum();
        clearTimerState();
        updateAll();
    }

    // ── Current session task name display ─────────────────────
    // The schedule auto-detection from other parts of the app may write to
    // currentSessionTaskName. Keep a ref so we don't clobber it while running.

    // ── Mode toggle — Countdown is the only active mode for now ─
    function initModeToggle() {
        var countdownBtn = el('pomodoroCountdownBtn');
        var pomoBtn      = el('pomodoroPomoBtn');
        var tfBtn        = el('taskFocusModeBtn');
        var pomShell     = el('pomodoroShell');
        var tfShell      = el('taskFocusShell');
        var cdContent    = qs('.countdown-content');

        function showCountdown() {
            if (cdContent) cdContent.style.display = '';
            if (pomShell)  pomShell.style.display   = 'none';
            if (tfShell)   tfShell.style.display    = 'none';
            if (countdownBtn) countdownBtn.classList.add('active');
            if (pomoBtn)      pomoBtn.classList.remove('active');
            if (tfBtn)        tfBtn.classList.remove('active');
        }
        function showComingSoon(name) {
            if (typeof showToast === 'function') showToast(name + ' coming soon!', 'info', 3000);
        }

        if (countdownBtn) countdownBtn.addEventListener('click', showCountdown);
        if (pomoBtn)      pomoBtn.addEventListener('click', function () { showComingSoon('Pomodoro'); });
        if (tfBtn)        tfBtn.addEventListener('click',  function () { showComingSoon('Task Focus'); });

        showCountdown();
    }

    // ── Init ──────────────────────────────────────────────────
    function init() {
        loadCustomTimers();
        loadTimerState();
        initModeToggle();

        // Session history initial render
        renderSessionHistory();
        var stHistory = [];
        try { stHistory = JSON.parse(localStorage.getItem('simpleTimerHistory') || '[]'); } catch (e) {}
        var histList = el('simpleTimerHistoryList');
        if (histList && stHistory.length > 0) {
            histList.innerHTML = stHistory.map(function (h) {
                var t = new Date(h.timestamp);
                var mins = Math.floor(h.seconds / 60), secs = h.seconds % 60;
                return '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border-color);"><span style="font-weight:600;">' +
                    mins + 'm ' + (secs > 0 ? secs + 's' : '0s') + '</span><span style="font-size:0.75rem;color:var(--text-muted);">' +
                    t.toLocaleDateString() + ', ' + t.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) + '</span></div>';
            }).join('');
        }

        // Wire buttons
        var startBtn = el('startBtn'), pauseBtn = el('pauseBtn'), resetBtn = el('resetBtn');
        if (startBtn) startBtn.addEventListener('click', startTimer);
        if (pauseBtn) pauseBtn.addEventListener('click', pauseTimer);
        if (resetBtn) resetBtn.addEventListener('click', resetTimer);

        // Preset buttons
        document.querySelectorAll('.preset-btn').forEach(function (btn) {
            btn.addEventListener('click', function () { setPreset(parseInt(btn.dataset.time)); });
        });

        // Custom timer
        var addBtn   = el('addCustomTimerBtn');
        var custInput = el('customTimerInput');
        if (addBtn)    addBtn.addEventListener('click', addCustomTimer);
        if (custInput) custInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') addCustomTimer();
        });

        // Space = start/pause, R = reset
        document.addEventListener('keydown', function (e) {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            var tv = el('timer-view');
            if (!tv || !tv.classList.contains('active')) return;
            if (e.code === 'Space' && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                if (timerRunning) pauseTimer(); else startTimer();
            }
            if (e.code === 'KeyR' && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                resetTimer();
            }
        });

        // View-change hook
        document.addEventListener('viewChanged', function (e) {
            if (e.detail && e.detail.viewId === 'timer-view') { updateAll(); }
        });

        // AFK + day-change polling
        setupActivity();
        setInterval(checkAFK, 1000);
        setInterval(checkDayChange, 30000);

        // Main display interval — runs every 100ms regardless of running state
        // so idle and break time always tick in real time on the display.
        setInterval(updateAll, 100);

        // Expose globals other parts of the app may depend on
        window.updateTotalTimerFromHistory  = updateTotalTimer;
        window.refreshSessionTrackerTotals  = updateTotalTimer;
        window.getCompletedSessions         = function () {
            try { return JSON.parse(localStorage.getItem('completedSessions') || '[]'); } catch(e) { return []; }
        };
        window.getCurrentSessionData = function () {
            return {
                taskName: sessionLabel,
                focusSeconds: live('focus'), breakSeconds: live('break'), idleSeconds: live('idle'),
                totalSeconds: live('focus') + live('break') + live('idle'),
            };
        };

        updateAll();
        console.log('✅ Focus Timer initialized');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
