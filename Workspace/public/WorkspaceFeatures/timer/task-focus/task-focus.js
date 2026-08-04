// ============================================================
// TASK FOCUS — timer for named, duration-based focus sessions.
// Works with schedule events, flexible tasks, or quick custom
// sessions. Integrates with the shared session tracker.
// ============================================================
(function () {
    'use strict';

    // ── State ─────────────────────────────────────────────────
    var currentTask   = null; // { kind, id?, day?, title, totalSecs, remainingSecs }
    var timerRunning  = false;
    var timerInterval = null;
    var startedAt     = null;
    var remAtStart    = 0;
    var focusAccum    = 0; // focus seconds accumulated (pauses included)

    // ── Helpers ───────────────────────────────────────────────
    function el(id) { return document.getElementById(id); }

    function fmt(sec) {
        sec = Math.max(0, Math.floor(sec));
        var h = Math.floor(sec / 3600);
        var m = Math.floor((sec % 3600) / 60);
        var s = sec % 60;
        function p(n) { return String(n).padStart(2, '0'); }
        return h > 0 ? p(h) + ':' + p(m) + ':' + p(s) : p(m) + ':' + p(s);
    }

    function escHtml(str) {
        return String(str || '')
            .replace(/&/g,'&amp;').replace(/</g,'&lt;')
            .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    function toMin(t) {
        var p = t.split(':').map(Number);
        return p[0] * 60 + p[1];
    }

    function nowHHMM() {
        var d = new Date();
        return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
    }

    function todayName() {
        return new Date().toLocaleDateString('en-US', { weekday: 'long' });
    }

    function durLabel(secs) {
        var m = Math.round(secs / 60);
        return m >= 60
            ? Math.floor(m / 60) + 'h' + (m % 60 ? ' ' + (m % 60) + 'm' : '')
            : m + 'm';
    }

    // ── Ring animation ────────────────────────────────────────
    var CIRC = 2 * Math.PI * 130; // 816.8

    function updateRing(frac) {
        var fill = el('taskFocusRingFill');
        var glow = el('taskFocusRingGlow');
        var offset = CIRC * (1 - Math.max(0, Math.min(1, frac)));
        if (fill) { fill.style.strokeDasharray = CIRC; fill.style.strokeDashoffset = offset; }
        if (glow) { glow.style.strokeDasharray = CIRC; glow.style.strokeDashoffset = offset; }
    }

    // ── Schedule-task progress persistence ───────────────────
    // Progress is day-scoped so last Monday's Biology leftover
    // doesn't bleed into this Monday's session.
    function getSchedMap() {
        try {
            var raw = JSON.parse(localStorage.getItem('tfSchedProgress') || 'null');
            if (!raw || raw.date !== new Date().toDateString()) return {};
            return raw.map || {};
        } catch (e) { return {}; }
    }
    function saveSchedProg(id, secs) {
        var map = getSchedMap(); map[id] = secs;
        try { localStorage.setItem('tfSchedProgress', JSON.stringify({ date: new Date().toDateString(), map: map })); } catch (e) {}
    }
    function clearSchedProg(id) {
        var map = getSchedMap(); delete map[id];
        try { localStorage.setItem('tfSchedProgress', JSON.stringify({ date: new Date().toDateString(), map: map })); } catch (e) {}
    }

    // ── Picker: Schedule tab ──────────────────────────────────
    function renderScheduleList() {
        var list = el('taskFocusScheduleList');
        if (!list) return;
        var allEvents = Array.isArray(window.events) ? window.events : [];
        var today = todayName();
        var tasks = allEvents
            .filter(function (e) { return e.day === today && !e.completed; })
            .sort(function (a, b) { return a.start.localeCompare(b.start); });

        if (tasks.length === 0) {
            list.innerHTML = '<p class="task-focus-empty">No incomplete tasks on today\'s schedule.</p>';
            return;
        }

        var nowMin  = toMin(nowHHMM());
        var progMap = getSchedMap();

        list.innerHTML = tasks.map(function (ev) {
            var durSecs  = (toMin(ev.end) - toMin(ev.start)) * 60;
            var saved    = progMap[ev.id];
            var hasProgr = typeof saved === 'number' && saved > 0 && saved < durSecs;
            var isNow    = nowMin >= toMin(ev.start) && nowMin < toMin(ev.end);
            var cat      = ev.category || 'study';
            var timeInfo = ev.start + '–' + ev.end + ' · ' + (hasProgr ? fmt(saved) + ' left' : durLabel(durSecs));
            return '<div class="task-focus-schedule-item">'
                + '<div class="task-focus-schedule-info">'
                + '<div class="task-focus-schedule-title-row">'
                + '<span class="mini-dot-marker cat-' + escHtml(cat) + '" title="' + escHtml(cat) + '"></span>'
                + '<span class="task-focus-schedule-title">' + escHtml(ev.title) + '</span>'
                + (isNow ? '<span class="task-focus-now-badge">Now</span>' : '')
                + '</div>'
                + '<span class="task-focus-schedule-time">' + timeInfo + '</span>'
                + '</div>'
                + '<button class="task-focus-pick-btn" data-kind="schedule" data-id="' + escHtml(ev.id) + '">'
                + (hasProgr ? 'Resume' : 'Focus') + '</button>'
                + '</div>';
        }).join('');

        list.querySelectorAll('.task-focus-pick-btn').forEach(function (btn) {
            btn.addEventListener('click', function () { pickSchedule(btn.dataset.id); });
        });
    }

    // ── Picker: Flexible tab ──────────────────────────────────
    function renderFlexList() {
        var list = el('taskFocusPickList');
        if (!list) return;
        var tasks = (typeof window.getIncompleteFlexibleTasks === 'function')
            ? window.getIncompleteFlexibleTasks() : [];

        if (tasks.length === 0) {
            list.innerHTML = '<p class="task-focus-empty">No flexible tasks yet — add one below or in the Tasks view.</p>';
            return;
        }

        list.innerHTML = tasks.map(function (t) {
            var rem   = (typeof t.remainingSeconds === 'number' && t.remainingSeconds > 0) ? t.remainingSeconds : (t.durationSeconds || 0);
            var total = t.durationSeconds || rem;
            var hasPr = rem < total && rem > 0;
            var lbl   = hasPr ? fmt(rem) + ' left' : durLabel(total);
            return '<div class="task-focus-pick-item">'
                + '<div class="task-focus-pick-info">'
                + '<span class="task-focus-pick-title">' + escHtml(t.title) + '</span>'
                + '<span class="task-focus-pick-duration">' + lbl + '</span>'
                + '</div>'
                + '<button class="task-focus-pick-btn" data-kind="flex" data-id="' + escHtml(t.id) + '">'
                + (hasPr ? 'Resume' : 'Focus') + '</button>'
                + '</div>';
        }).join('');

        list.querySelectorAll('.task-focus-pick-btn').forEach(function (btn) {
            btn.addEventListener('click', function () { pickFlex(btn.dataset.id); });
        });
    }

    // ── Picker: History tab ───────────────────────────────────
    function renderHistoryList() {
        var list = el('taskFocusHistoryList');
        if (!list) return;
        var sessions = [];
        try { sessions = JSON.parse(localStorage.getItem('completedSessions') || '[]'); } catch (e) {}
        var tf = sessions.filter(function (s) { return s.source === 'taskFocus'; }).slice(-30).reverse();
        if (tf.length === 0) {
            list.innerHTML = '<p class="task-focus-empty">No Task Focus sessions yet.</p>';
            return;
        }
        list.innerHTML = tf.map(function (s) {
            var t   = new Date(s.timestamp);
            var ts  = t.toLocaleDateString() + ', ' + t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            var eff = s.targetSeconds > 0 ? Math.round((s.focusSeconds / s.targetSeconds) * 100) : null;
            var effTag = eff !== null
                ? '<span class="tf-hist-eff ' + (eff >= 90 ? 'eff-fast' : eff >= 60 ? 'eff-neutral' : 'eff-slow') + '">' + eff + '%</span>'
                : '';
            return '<div class="task-focus-history-item">'
                + '<div class="tf-hist-main">'
                + '<span class="tf-hist-title">' + escHtml(s.taskName || 'Session') + '</span>'
                + effTag
                + '</div>'
                + '<div class="tf-hist-stats">'
                + '<div class="tf-hist-stat"><span class="lbl">Focus</span><span class="val">' + fmt(s.focusSeconds) + '</span></div>'
                + '<div class="tf-hist-stat"><span class="lbl">Target</span><span class="val">' + (s.targetSeconds ? fmt(s.targetSeconds) : '—') + '</span></div>'
                + '<span class="tf-hist-date">' + ts + '</span>'
                + '</div>'
                + '</div>';
        }).join('');
    }

    // ── Task picking ──────────────────────────────────────────
    function pickSchedule(id) {
        var evts = Array.isArray(window.events) ? window.events : [];
        var ev   = evts.find(function (e) { return e.id === id; });
        if (!ev) return;
        var durSecs = (toMin(ev.end) - toMin(ev.start)) * 60;
        var prog    = getSchedMap();
        var rem     = (typeof prog[id] === 'number' && prog[id] > 0 && prog[id] < durSecs) ? prog[id] : durSecs;
        currentTask = { kind: 'schedule', id: id, day: ev.day, title: ev.title, totalSecs: durSecs, remainingSecs: rem };
        showSessionScreen();
    }

    function pickFlex(id) {
        var tasks = (typeof window.getIncompleteFlexibleTasks === 'function') ? window.getIncompleteFlexibleTasks() : [];
        var task  = tasks.find(function (t) { return t.id === id; });
        if (!task) return;
        var rem  = (typeof task.remainingSeconds === 'number' && task.remainingSeconds > 0) ? task.remainingSeconds : (task.durationSeconds || 1800);
        var total = task.durationSeconds || rem;
        currentTask = { kind: 'flex', id: id, title: task.title, totalSecs: total, remainingSecs: rem };
        showSessionScreen();
    }

    function startQuickTask() {
        var titleEl = el('taskFocusQuickTitle');
        var hrsEl   = el('taskFocusQuickHours');
        var minsEl  = el('taskFocusQuickMinutes');
        if (!titleEl) return;
        var title = (titleEl.value || '').trim();
        if (!title) { titleEl.focus(); return; }
        var h = parseInt((hrsEl && hrsEl.value) || 0) || 0;
        var m = parseInt((minsEl && minsEl.value) || 25) || 25;
        var secs = h * 3600 + m * 60;
        if (secs < 60) secs = 25 * 60;
        currentTask = { kind: 'quick', title: title, totalSecs: secs, remainingSecs: secs };
        titleEl.value = '';
        if (hrsEl)  hrsEl.value  = '';
        if (minsEl) minsEl.value = '';
        showSessionScreen();
    }

    // ── Screen transitions ────────────────────────────────────
    function showPickerScreen() {
        var picker  = el('taskFocusPicker');
        var session = el('taskFocusSession');
        if (picker)  picker.style.display  = '';
        if (session) session.style.display = 'none';
        renderScheduleList();
        renderFlexList();
    }

    function showSessionScreen() {
        if (!currentTask) return;
        var picker  = el('taskFocusPicker');
        var session = el('taskFocusSession');
        if (picker)  picker.style.display  = 'none';
        if (session) session.style.display = '';

        var nameEl = el('taskFocusTaskName');
        var dispEl = el('taskFocusDisplay');
        if (nameEl) nameEl.textContent = currentTask.title;
        if (dispEl) dispEl.textContent = fmt(currentTask.remainingSecs);
        updateRing(currentTask.remainingSecs / currentTask.totalSecs);
        setState('Ready');

        timerRunning = false;
        focusAccum   = 0;
        clearInterval(timerInterval); timerInterval = null;
        startedAt    = null;

        var startBtn = el('taskFocusStartBtn');
        var pauseBtn = el('taskFocusPauseBtn');
        if (startBtn) { startBtn.style.display = 'inline-block'; startBtn.textContent = 'Start'; }
        if (pauseBtn) { pauseBtn.style.display  = 'none'; }
    }

    // ── Timer controls ────────────────────────────────────────
    function startTask() {
        if (timerRunning || !currentTask) return;
        timerRunning = true;
        startedAt    = Date.now();
        remAtStart   = currentTask.remainingSecs;
        setState('Running');

        var startBtn = el('taskFocusStartBtn');
        var pauseBtn = el('taskFocusPauseBtn');
        if (startBtn) startBtn.style.display = 'none';
        if (pauseBtn) { pauseBtn.style.display = 'inline-block'; pauseBtn.textContent = 'Pause'; }

        if (window.FocusSession) {
            window.FocusSession.begin({ source: 'taskFocus', label: currentTask.title, phase: 'focus' });
        }

        timerInterval = setInterval(function () {
            var elapsed              = Math.floor((Date.now() - startedAt) / 1000);
            currentTask.remainingSecs = Math.max(0, remAtStart - elapsed);
            var dispEl = el('taskFocusDisplay');
            if (dispEl) dispEl.textContent = fmt(currentTask.remainingSecs);
            updateRing(currentTask.remainingSecs / currentTask.totalSecs);
            persistProgress();
            if (currentTask.remainingSecs <= 0) { completeTask(); }
        }, 100);
    }

    function pauseTask() {
        if (!timerRunning) return;
        var elapsed = Math.floor((Date.now() - startedAt) / 1000);
        focusAccum  += elapsed;
        currentTask.remainingSecs = Math.max(0, remAtStart - elapsed);
        clearInterval(timerInterval); timerInterval = null;
        timerRunning = false; startedAt = null;
        setState('Paused');

        var startBtn = el('taskFocusStartBtn');
        var pauseBtn = el('taskFocusPauseBtn');
        if (startBtn) { startBtn.style.display = 'inline-block'; startBtn.textContent = 'Resume'; }
        if (pauseBtn) { pauseBtn.style.display  = 'none'; }

        if (window.FocusSession) window.FocusSession.pause();
        persistProgress();
    }

    function completeTask() {
        var elapsed = timerRunning ? Math.floor((Date.now() - startedAt) / 1000) : 0;
        focusAccum  += elapsed;
        clearInterval(timerInterval); timerInterval = null;
        timerRunning = false; startedAt = null;
        currentTask.remainingSecs = 0;

        var dispEl = el('taskFocusDisplay');
        if (dispEl) dispEl.textContent = '00:00';
        updateRing(0);
        setState('Complete!');

        if (window.FocusSession) window.FocusSession.release();
        logAndMarkDone(true);

        if (typeof playChime      === 'function') playChime();
        if (typeof showToast      === 'function') showToast('"' + currentTask.title + '" complete! ✓', 'success', 5000);
        if (typeof sendNotification === 'function') sendNotification('Task Focus', '"' + currentTask.title + '" is done.', '✓', 'tf-complete');

        setTimeout(function () { backToPicker(); }, 2500);
    }

    function markDoneEarly() {
        var elapsed = timerRunning ? Math.floor((Date.now() - startedAt) / 1000) : 0;
        focusAccum  += elapsed;
        clearInterval(timerInterval); timerInterval = null;
        timerRunning = false; startedAt = null;

        if (window.FocusSession) window.FocusSession.release();
        logAndMarkDone(true);
        if (typeof showToast === 'function') showToast('"' + currentTask.title + '" marked done', 'success');
        backToPicker();
    }

    function backToPicker() {
        if (timerRunning) {
            var elapsed = Math.floor((Date.now() - startedAt) / 1000);
            focusAccum  += elapsed;
            clearInterval(timerInterval); timerInterval = null;
            timerRunning = false; startedAt = null;
        }
        persistProgress(); // save partial progress before leaving
        if (window.FocusSession) window.FocusSession.release();
        currentTask = null;
        focusAccum  = 0;
        showPickerScreen();
    }

    // ── Session logging ───────────────────────────────────────
    function logAndMarkDone(markComplete) {
        if (!currentTask) return;
        if (focusAccum >= 5 && typeof window.logCompletedSession === 'function') {
            window.logCompletedSession({
                taskName:      currentTask.title,
                focusSeconds:  focusAccum,
                breakSeconds:  0,
                idleSeconds:   0,
                source:        'taskFocus',
                targetSeconds: currentTask.totalSecs,
            });
        }
        if (markComplete) {
            clearProgressForCurrent();
            if (currentTask.kind === 'schedule' && typeof toggleTaskComplete === 'function') {
                toggleTaskComplete(currentTask.id, currentTask.day);
            } else if (currentTask.kind === 'flex' && typeof window.markFlexibleTaskComplete === 'function') {
                window.markFlexibleTaskComplete(currentTask.id);
            }
        }
    }

    // ── Progress persistence ──────────────────────────────────
    function persistProgress() {
        if (!currentTask) return;
        if (currentTask.kind === 'schedule') {
            saveSchedProg(currentTask.id, currentTask.remainingSecs);
        } else if (currentTask.kind === 'flex' && typeof window.updateFlexibleTaskRemaining === 'function') {
            window.updateFlexibleTaskRemaining(currentTask.id, currentTask.remainingSecs);
        }
    }

    function clearProgressForCurrent() {
        if (!currentTask) return;
        if (currentTask.kind === 'schedule') clearSchedProg(currentTask.id);
    }

    // ── State indicator ───────────────────────────────────────
    function setState(text) {
        var stEl = el('taskFocusStateText');
        if (stEl) stEl.textContent = text;
        var dot = el('taskFocusStateIndicator') && el('taskFocusStateIndicator').querySelector('.state-dot');
        if (dot) {
            dot.style.background =
                text === 'Running'   ? 'var(--cat-personal)' :
                text === 'Paused'    ? 'var(--cat-fitness)'  :
                text === 'Complete!' ? 'var(--cat-study)'    : '#888';
        }
    }

    // ── Sub-tab switching ─────────────────────────────────────
    function switchSubTab(tab) {
        document.querySelectorAll('.task-focus-subtab').forEach(function (b) {
            b.classList.toggle('active', b.dataset.tfSubtab === tab);
        });
        var sched = el('taskFocusScheduleList');
        var flex  = el('taskFocusFlexWrap');
        var hist  = el('taskFocusHistoryWrap');
        if (sched) sched.style.display = tab === 'schedule' ? 'block' : 'none';
        if (flex)  flex.style.display  = tab === 'flexible' ? 'block' : 'none';
        if (hist)  hist.style.display  = tab === 'history'  ? 'block' : 'none';
        if (tab === 'history')  renderHistoryList();
        if (tab === 'flexible') renderFlexList();
    }

    // ── Public surface ────────────────────────────────────────
    window.activateTaskFocusMode = function () {
        var shell = el('taskFocusShell');
        if (shell) shell.style.display = '';
        if (currentTask) showSessionScreen();
        else             showPickerScreen();
    };

    window.deactivateTaskFocusMode = function () {
        if (timerRunning) pauseTask();
        var shell = el('taskFocusShell');
        if (shell) shell.style.display = 'none';
    };

    window.pauseTaskFocusIfRunning  = function () { if (timerRunning) pauseTask(); };
    window.showTaskFocusPicker      = showPickerScreen;
    window.initTaskFocus            = init;

    // ── Init ─────────────────────────────────────────────────
    function init() {
        var startBtn  = el('taskFocusStartBtn');
        var pauseBtn  = el('taskFocusPauseBtn');
        var doneBtn   = el('taskFocusDoneBtn');
        var backBtn   = el('taskFocusBackBtn');
        var quickBtn  = el('taskFocusQuickStartBtn');
        var quickTitl = el('taskFocusQuickTitle');

        if (startBtn)  startBtn.addEventListener('click',  startTask);
        if (pauseBtn)  pauseBtn.addEventListener('click',  pauseTask);
        if (doneBtn)   doneBtn.addEventListener('click',   markDoneEarly);
        if (backBtn)   backBtn.addEventListener('click',   backToPicker);
        if (quickBtn)  quickBtn.addEventListener('click',  startQuickTask);
        if (quickTitl) quickTitl.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') startQuickTask();
        });

        document.querySelectorAll('.task-focus-subtab').forEach(function (btn) {
            btn.addEventListener('click', function () {
                switchSubTab(btn.dataset.tfSubtab || 'schedule');
            });
        });

        console.log('✅ Task Focus initialized');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
