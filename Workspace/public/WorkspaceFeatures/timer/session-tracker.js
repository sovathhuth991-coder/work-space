// ============================================================
// SESSION TRACKER  –  tracks Focus / Break / Idle across all
// three timer modes: Countdown, Pomodoro, Task Focus.
// ============================================================

(function () {
    'use strict';

    // ── DOM refs ────────────────────────────────────────────
    const focusDisplay          = document.getElementById('focusTimeDisplay');
    const breakDisplay          = document.getElementById('breakTimeDisplay');
    const idleDisplay           = document.getElementById('idleTimeDisplay');
    const totalDisplay          = document.getElementById('totalTimeDisplay');
    const progressFocusSeg      = document.querySelector('.progress-focus');
    const progressBreakSeg      = document.querySelector('.progress-break');
    const progressIdleSeg       = document.querySelector('.progress-idle');
    const headerFocusTime       = document.getElementById('headerFocusTime');
    const headerBreakTime       = document.getElementById('headerBreakTime');
    const headerIdleTime        = document.getElementById('headerIdleTime');
    const sessionFocusDisplay   = document.getElementById('sessionFocusDisplay');
    const sessionBreakDisplay   = document.getElementById('sessionBreakDisplay');
    const sessionIdleDisplay    = document.getElementById('sessionIdleDisplay');
    const sessionTotalDisplay   = document.getElementById('sessionTotalDisplay');
    const currentSessionTaskName = document.getElementById('currentSessionTaskName');
    const currentSessionTaskTime = document.getElementById('currentSessionTaskTime');
    // These elements no longer exist in index.html but are guarded everywhere,
    // so keeping them as null constants avoids ReferenceErrors.
    const currentTaskDisplay    = document.getElementById('currentTaskDisplay');
    const scheduledInput        = document.getElementById('trackerScheduled');
    const autoLabelBadge        = document.getElementById('autoLabelBadge');

    // ── Schedule state ───────────────────────────────────────
    let currentTaskData  = null;
    let todayTasksCache  = [];
    let previousTaskId   = null;
    let sessionTaskName  = '';
    let sessionTaskStart = '';
    let sessionTaskEnd   = '';

    // ── Phase model  ─────────────────────────────────────────
    // There is exactly one active phase at a time: 'focus', 'break', or
    // 'idle'. Transitions happen via setPhase(). Accumulated seconds only
    // grow; they never shrink until resetSession() is called. This single-
    // variable model is impossible to double-count or desynchronise.
    let phase      = 'idle';        // current phase
    let phaseStart = Date.now();    // when the current phase began
    let accum      = { focus: 0, break: 0, idle: 0 };

    function commitPhase() {
        const elapsed = Math.floor((Date.now() - phaseStart) / 1000);
        if (elapsed > 0) accum[phase] += elapsed;
        phaseStart = Date.now();
    }

    function setPhase(newPhase) {
        commitPhase();
        phase = newPhase;
    }

    function live(bucket) {
        return accum[bucket] + (phase === bucket
            ? Math.floor((Date.now() - phaseStart) / 1000) : 0);
    }

    function resetSession() {
        phase      = 'idle';
        phaseStart = Date.now();
        accum      = { focus: 0, break: 0, idle: 0 };
    }

    // ── Ownership ────────────────────────────────────────────
    // While any FocusSession is active, the schedule's own auto-detection
    // must not reset or relabel Current Session out from under it.
    let activeFocusSource        = null;
    let activeSessionOnIdlePause = null;

    // ── Display ticker ───────────────────────────────────────
    let sessionInterval = null;
    function ensureInterval() {
        if (sessionInterval) return;
        sessionInterval = setInterval(function () {
            updateCurrentSessionDisplay();
            updateTotalTimerFromHistory();
        }, 100);
    }

    // ── AFK detection ────────────────────────────────────────
    let lastActivityTime = Date.now();
    let afkDetected      = false;
    const IDLE_THRESHOLD = 300000; // 5 min

    // ── Helpers ──────────────────────────────────────────────
    function fmt(sec) {
        sec = Math.max(0, sec);
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = sec % 60;
        return h > 0
            ? `${pad(h)}:${pad(m)}:${pad(s)}`
            : `${pad(m)}:${pad(s)}`;
    }
    function pad(n) { return String(n).padStart(2, '0'); }

    function toMin(t) {
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
    }

    function nowHHMM() {
        const d = new Date();
        return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }

    function todayName() {
        return new Date().toLocaleDateString('en-US', { weekday: 'long' });
    }

    // ── Persistence ──────────────────────────────────────────
    function saveSessionState() {
        try {
            // Snapshot live values (don't call commitPhase — that would
            // mutate accum; instead read the live total directly).
            const snap = {
                focus: live('focus'), break_: live('break'), idle: live('idle'),
            };
            localStorage.setItem('currentSessionState', JSON.stringify({
                focusSeconds:  snap.focus,
                breakSeconds:  snap.break_,
                idleSeconds:   snap.idle,
                sessionTaskName, sessionTaskStart, sessionTaskEnd,
                previousTaskId,
                timestamp: Date.now(),
            }));
        } catch (e) {}
    }

    function loadSessionState() {
        try {
            const raw = localStorage.getItem('currentSessionState');
            if (!raw) return;
            const data = JSON.parse(raw);
            if (new Date(data.timestamp).toDateString() !== new Date().toDateString()) return;
            accum.focus  = data.focusSeconds || 0;
            accum.break  = data.breakSeconds || 0;
            accum.idle   = data.idleSeconds  || 0;
            sessionTaskName  = data.sessionTaskName  || '';
            sessionTaskStart = data.sessionTaskStart || '';
            sessionTaskEnd   = data.sessionTaskEnd   || '';
            previousTaskId   = data.previousTaskId   || null;
        } catch (e) {}
    }

    // ── Display ──────────────────────────────────────────────
    function updateCurrentSessionDisplay() {
        const f = live('focus'), b = live('break'), i = live('idle');
        if (sessionFocusDisplay) sessionFocusDisplay.textContent = fmt(f);
        if (sessionBreakDisplay) sessionBreakDisplay.textContent = fmt(b);
        if (sessionIdleDisplay)  sessionIdleDisplay.textContent  = fmt(i);
        if (sessionTotalDisplay) sessionTotalDisplay.textContent = fmt(f + b + i);
    }

    function updateCurrentSessionTaskInfo(name, start, end) {
        sessionTaskName  = name  || 'No active task';
        sessionTaskStart = start || '';
        sessionTaskEnd   = end   || '';
        if (currentSessionTaskName) currentSessionTaskName.textContent = sessionTaskName;
        if (currentSessionTaskTime) {
            currentSessionTaskTime.textContent = (start && end) ? `${start} – ${end}` : '';
        }
    }

    function getTodayHistoryTotals() {
        try {
            const sessions = JSON.parse(localStorage.getItem('completedSessions') || '[]');
            const today = new Date().toDateString();
            let f = 0, b = 0, i = 0;
            for (const s of sessions) {
                if (new Date(s.timestamp).toDateString() === today) {
                    f += s.focusSeconds || 0;
                    b += s.breakSeconds || 0;
                    i += s.idleSeconds  || 0;
                }
            }
            return { focus: f, break: b, idle: i };
        } catch (e) {
            return { focus: 0, break: 0, idle: 0 };
        }
    }

    function updateTotalTimerFromHistory() {
        const hist  = getTodayHistoryTotals();
        const f     = hist.focus + live('focus');
        const b     = hist.break + live('break');
        const i     = hist.idle  + live('idle');
        const total = f + b + i;

        if (focusDisplay) focusDisplay.textContent = fmt(f);
        if (breakDisplay) breakDisplay.textContent = fmt(b);
        if (idleDisplay)  idleDisplay.textContent  = fmt(i);
        if (totalDisplay) totalDisplay.textContent = fmt(total);
        if (headerFocusTime) headerFocusTime.textContent = fmt(f);
        if (headerBreakTime) headerBreakTime.textContent = fmt(b);
        if (headerIdleTime)  headerIdleTime.textContent  = fmt(i);

        if (total > 0) {
            if (progressFocusSeg) progressFocusSeg.style.width = (f / total * 100) + '%';
            if (progressBreakSeg) progressBreakSeg.style.width = (b / total * 100) + '%';
            if (progressIdleSeg)  progressIdleSeg.style.width  = (i / total * 100) + '%';
        }
    }

    function updateSessionTrackerState() {
        const el = document.getElementById('sessionTracker');
        if (!el) return;
        el.classList.remove('focus-mode-active', 'break-mode-active');
        if (phase === 'focus') el.classList.add('focus-mode-active');
        if (phase === 'break') el.classList.add('break-mode-active');
    }

    function updateUI() {
        updateCurrentSessionDisplay();
        updateSessionTrackerState();
        updateTotalTimerFromHistory();
    }

    // ── Schedule auto-detection ──────────────────────────────
    function getTodayTasks() {
        if (typeof events === 'undefined' || !Array.isArray(events)) return [];
        return events.filter(e => e.day === todayName()).sort((a, b) => a.start.localeCompare(b.start));
    }

    function saveCompletedSession() {
        const f = live('focus'), b = live('break'), i = live('idle');
        if (f + b + i < 5) return;
        const sessions = JSON.parse(localStorage.getItem('completedSessions') || '[]');
        sessions.push({
            taskName: sessionTaskName, taskStart: sessionTaskStart, taskEnd: sessionTaskEnd,
            focusSeconds: f, breakSeconds: b, idleSeconds: i,
            totalSeconds: f + b + i, timestamp: Date.now(),
        });
        localStorage.setItem('completedSessions', JSON.stringify(sessions));
        if (typeof renderSessionHistory === 'function') renderSessionHistory();
        document.dispatchEvent(new CustomEvent('sessionCompleted', { detail: { taskName: sessionTaskName } }));
    }

    function resetCurrentSession() {
        saveCompletedSession();
        resetSession();
        updateCurrentSessionDisplay();
        saveSessionState();
    }

    function handleTaskChange(newTaskId) {
        if (activeFocusSource) { previousTaskId = newTaskId; return; }
        if (newTaskId && newTaskId !== previousTaskId && previousTaskId !== null) {
            resetCurrentSession();
        }
        previousTaskId = newTaskId;
        saveSessionState();
        if (currentTaskData) {
            updateCurrentSessionTaskInfo(currentTaskData.title, currentTaskData.start, currentTaskData.end);
        }
        ensureInterval();
    }

    function applyCurrentTask(task) {
        const newId   = task.id || (task.title + task.start);
        const changed = !currentTaskData || currentTaskData.id !== newId;
        currentTaskData = { id: newId, title: task.title, start: task.start, end: task.end };

        if (currentTaskDisplay) {
            const marker = task.isActive ? ' 🔴' : (task.isUpcoming ? ' ⏳' : '');
            currentTaskDisplay.textContent = `${task.title} (${task.start}–${task.end})${marker}`;
        }
        const dur = toMin(task.end) - toMin(task.start);
        if (dur > 0 && scheduledInput) scheduledInput.value = dur;
        if (autoLabelBadge) { autoLabelBadge.textContent = '✅ Linked to task'; autoLabelBadge.style.color = '#2ecc71'; }
        if (changed) { handleTaskChange(newId); updateUI(); }
    }

    function updateCurrentTaskDisplay() {
        const tasks = getTodayTasks();
        todayTasksCache = tasks;
        if (tasks.length === 0) {
            currentTaskData = null;
            if (currentTaskDisplay) currentTaskDisplay.textContent = 'No tasks scheduled for today';
            if (autoLabelBadge) { autoLabelBadge.textContent = '📭 No tasks'; autoLabelBadge.style.color = '#888'; }
            updateCurrentSessionTaskInfo('No tasks today', '', '');
            return;
        }
        const nowMin = toMin(nowHHMM());
        let selected  = null;
        for (const task of tasks) {
            const s = toMin(task.start), e = toMin(task.end);
            if (nowMin >= s && nowMin < e) { selected = { ...task, isActive: true,  isUpcoming: false }; break; }
            if (nowMin < s && !selected)    selected = { ...task, isActive: false, isUpcoming: true  };
        }
        if (!selected) selected = { ...tasks[0], isActive: false, isUpcoming: false };
        applyCurrentTask(selected);
    }

    // ── AFK / idle detection ─────────────────────────────────
    function setupActivityDetection() {
        ['mousedown','mousemove','keydown','scroll','touchstart','click'].forEach(ev => {
            document.addEventListener(ev, () => { lastActivityTime = Date.now(); }, { passive: true });
        });
    }

    function checkIdleState() {
        const isAFK = (Date.now() - lastActivityTime) >= IDLE_THRESHOLD;

        if (isAFK && !afkDetected) {
            afkDetected = true;
            // Only sources that registered onIdlePause (Pomodoro) get
            // auto-paused when AFK. Countdown and Task Focus keep running.
            if (activeFocusSource && typeof activeSessionOnIdlePause === 'function') {
                setPhase('idle');
                activeSessionOnIdlePause();
            }
        } else if (!isAFK && afkDetected) {
            afkDetected = false;
            // Pomodoro resumes by the user clicking its own Start button
            // (which calls FocusSession.begin() again). Nothing to do here.
        }

        updateUI();
    }

    // ── Day / week change ────────────────────────────────────
    let lastCheckedDate = new Date().toDateString();

    function checkDayChange() {
        if (new Date().toDateString() === lastCheckedDate) return;
        lastCheckedDate = new Date().toDateString();
        resetSession();
        activeFocusSource = null; activeSessionOnIdlePause = null;
        previousTaskId = null;
        saveSessionState(); updateCurrentSessionDisplay();
        console.log('🕛 Daily reset at midnight');
    }

    function checkWeekChange() {
        if (typeof getWeekId !== 'function') return;
        const cur    = getWeekId(new Date());
        const stored = localStorage.getItem('sessionHistoryWeekId');
        if (stored !== cur) {
            if (stored !== null) { localStorage.removeItem('completedSessions'); console.log('📅 New week — session history reset'); }
            localStorage.setItem('sessionHistoryWeekId', cur);
            if (typeof renderSessionHistory === 'function') renderSessionHistory();
        }
    }

    function autoAdvanceTask() {
        if (!currentTaskData || todayTasksCache.length <= 1) return;
        if (toMin(nowHHMM()) < toMin(currentTaskData.end)) return;
        const idx = todayTasksCache.findIndex(t => (t.id || t.title + t.start) === currentTaskData.id);
        for (let i = idx + 1; i < todayTasksCache.length; i++) {
            applyCurrentTask({ ...todayTasksCache[i], isActive: true, isUpcoming: false }); break;
        }
    }

    // ── Public API ───────────────────────────────────────────

    // FocusSession — one interface for all three timer modes.
    //
    //   begin({ source, label, phase, onIdlePause })
    //     source   : 'simpleTimer' | 'pomodoro' | 'taskFocus'
    //     label    : text for Current Session card
    //     phase    : 'focus' (default) | 'break'  (for Pomodoro break phase)
    //     onIdlePause: called on 5-min AFK; only Pomodoro registers this.
    //                  Countdown and Task Focus keep counting through AFK.
    //
    //   pause()    : deliberate user pause = break time (not idle)
    //
    //   release()  : session is over; hand Current Session back to the
    //                schedule's own auto-detection.
    //
    window.FocusSession = {
        begin({ source, label, phase: ph, onIdlePause } = {}) {
            setPhase(ph === 'break' ? 'break' : 'focus');
            activeFocusSource        = source || 'unknown';
            activeSessionOnIdlePause = onIdlePause || null;
            afkDetected              = false;
            if (label) updateCurrentSessionTaskInfo(label, '', '');
            ensureInterval();
            updateUI();
        },
        pause() {
            // A deliberate user pause counts as break time, not idle.
            // AFK-detected inactivity is handled separately by checkIdleState().
            setPhase('break');
            updateUI();
        },
        release() {
            setPhase('idle');
            activeFocusSource        = null;
            activeSessionOnIdlePause = null;
            afkDetected              = false;
            updateUI();
            // Restore the schedule's own label on the Current Session card.
            updateCurrentTaskDisplay();
        },
        isActive() { return activeFocusSource; },
    };

    window.logCompletedSession = function ({ taskName, taskStart, taskEnd, focusSeconds: fSecs, breakSeconds: bSecs, idleSeconds: iSecs, source, targetSeconds }) {
        const total = (fSecs || 0) + (bSecs || 0) + (iSecs || 0);
        if (total < 5) return;

        const sessions = JSON.parse(localStorage.getItem('completedSessions') || '[]');
        sessions.push({
            taskName:      taskName  || 'Untitled',
            taskStart:     taskStart || '',
            taskEnd:       taskEnd   || '',
            focusSeconds:  fSecs    || 0,
            breakSeconds:  bSecs    || 0,
            idleSeconds:   iSecs    || 0,
            totalSeconds:  total,
            timestamp:     Date.now(),
            source:        source        || 'timer',
            targetSeconds: targetSeconds || 0,
        });
        localStorage.setItem('completedSessions', JSON.stringify(sessions));

        // Move accumulated time to history and start fresh.
        resetSession();
        updateCurrentSessionDisplay();
        if (typeof renderSessionHistory === 'function') renderSessionHistory();
        updateTotalTimerFromHistory();
        document.dispatchEvent(new CustomEvent('sessionCompleted', { detail: { taskName } }));
    };

    window.saveCompletedSession        = saveCompletedSession;
    window.updateTotalTimerFromHistory = updateTotalTimerFromHistory;
    window.refreshSessionTrackerTotals = updateTotalTimerFromHistory;
    window.getCompletedSessions        = () => JSON.parse(localStorage.getItem('completedSessions') || '[]');
    window.getCurrentSessionData       = function () {
        return {
            taskName:     sessionTaskName,
            taskStart:    sessionTaskStart,
            taskEnd:      sessionTaskEnd,
            focusSeconds: live('focus'),
            breakSeconds: live('break'),
            idleSeconds:  live('idle'),
            totalSeconds: live('focus') + live('break') + live('idle'),
        };
    };

    // ── Init ─────────────────────────────────────────────────
    function initTracker() {
        // Remove any old "Simple Timer" entries that were mistakenly written
        // to completedSessions in older versions.
        try {
            const sessions  = JSON.parse(localStorage.getItem('completedSessions') || '[]');
            const filtered  = sessions.filter(s => s.taskName !== 'Simple Timer');
            if (filtered.length !== sessions.length) {
                localStorage.setItem('completedSessions', JSON.stringify(filtered));
            }
        } catch (e) {}

        // View History toggle
        const viewHistoryBtn     = document.getElementById('viewHistoryBtn');
        const sessionHistoryCard = document.getElementById('sessionHistoryCard');
        if (viewHistoryBtn && sessionHistoryCard) {
            viewHistoryBtn.addEventListener('click', function () {
                const hidden = sessionHistoryCard.style.display === 'none';
                sessionHistoryCard.style.display = hidden ? 'block' : 'none';
                viewHistoryBtn.innerHTML = (hidden ? 'Hide History' : 'View History') +
                    ' <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;vertical-align:-1px;display:inline;"><polyline points="2 12 7 12 10 20 14 4 17 12 22 12"/></svg>';
                if (hidden && typeof renderSessionHistory === 'function') renderSessionHistory();
            });
        }

        loadSessionState();

        if (!window.sessionSaveInterval)    window.sessionSaveInterval    = setInterval(saveSessionState, 1000);
        if (!window.activityCheckInterval)  window.activityCheckInterval  = setInterval(checkIdleState,   1000);
        if (!window.dayCheckInterval)       window.dayCheckInterval       = setInterval(() => { checkDayChange(); checkWeekChange(); }, 60000);
        if (!window.taskAdvanceInterval)    window.taskAdvanceInterval    = setInterval(autoAdvanceTask,   60000);

        setupActivityDetection();
        checkDayChange();
        checkWeekChange();
        updateCurrentTaskDisplay();
        ensureInterval();
        updateUI();

        if (typeof renderSessionHistory === 'function') renderSessionHistory();

        // Keyboard shortcuts (Space = start/pause, R = reset)
        document.addEventListener('keydown', function (e) {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
            const tv = document.getElementById('timer-view');
            if (!tv || !tv.classList.contains('active')) return;

            if (e.code === 'Space' && !e.metaKey && !e.ctrlKey && !e.altKey) {
                e.preventDefault();
                const pomShell = document.getElementById('pomodoroShell');
                const tfShell  = document.getElementById('taskFocusShell');
                const pomVis   = pomShell && pomShell.style.display !== 'none';
                const tfVis    = tfShell  && tfShell.style.display  !== 'none';
                if (pomVis) {
                    const pb = document.getElementById('pomodoroPauseBtn'), sb = document.getElementById('pomodoroStartBtn');
                    if (pb && pb.style.display !== 'none') pb.click(); else if (sb) sb.click();
                } else if (tfVis) {
                    const pb = document.getElementById('taskFocusPauseBtn'), sb = document.getElementById('taskFocusStartBtn');
                    if (pb && pb.style.display !== 'none') pb.click(); else if (sb) sb.click();
                } else {
                    const pb = document.getElementById('pauseBtn'), sb = document.getElementById('startBtn');
                    if (pb && pb.style.display !== 'none') pb.click(); else if (sb) sb.click();
                }
            }
            if (e.code === 'KeyR' && !e.metaKey && !e.ctrlKey && !e.altKey) {
                e.preventDefault();
                const pomShell = document.getElementById('pomodoroShell');
                const tfShell  = document.getElementById('taskFocusShell');
                const pomVis   = pomShell && pomShell.style.display !== 'none';
                const tfVis    = tfShell  && tfShell.style.display  !== 'none';
                if      (pomVis)    { const rb = document.getElementById('pomodoroResetBtn'); if (rb) rb.click(); }
                else if (!tfVis)    { const rb = document.getElementById('resetBtn');         if (rb) rb.click(); }
            }
        });

        document.addEventListener('viewChanged', function (e) {
            if (e.detail.viewId === 'timer-view') { updateCurrentTaskDisplay(); updateUI(); }
        });

        console.log('✅ Session Tracker initialized');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTracker);
    } else {
        initTracker();
    }

})();
