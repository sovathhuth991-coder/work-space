// ============================================================
// TASK FOCUS ENGINE — pick a flexible task, get a countdown sized
// to exactly how long it needs. Third mode alongside Countdown
// and Pomodoro, toggled by pomodoro.js's switchPomodoroMode().
// ============================================================
(function() {
    'use strict';

    // ----- STATE -----
    let tfInterval = null;
    let currentTask = null; // the flexible task object currently loaded
    let remainingSeconds = 0;
    let currentTotal = 0;
    let isRunning = false;
    let phaseStartTime = null;
    let phaseRemainingAtStart = 0;
    let lastPersistedAt = 0;

    const CIRCUMFERENCE = 2 * Math.PI * 130; // matches the 130-radius ring used elsewhere

    let elements = {};

    function initTaskFocus() {
        elements = {
            shell: document.getElementById('taskFocusShell'),
            picker: document.getElementById('taskFocusPicker'),
            pickList: document.getElementById('taskFocusPickList'),
            quickTitle: document.getElementById('taskFocusQuickTitle'),
            quickHours: document.getElementById('taskFocusQuickHours'),
            quickMinutes: document.getElementById('taskFocusQuickMinutes'),
            quickStartBtn: document.getElementById('taskFocusQuickStartBtn'),
            session: document.getElementById('taskFocusSession'),
            ringContainer: document.getElementById('taskFocusRingContainer'),
            ringFill: document.getElementById('taskFocusRingFill'),
            ringGlow: document.getElementById('taskFocusRingGlow'),
            display: document.getElementById('taskFocusDisplay'),
            taskName: document.getElementById('taskFocusTaskName'),
            stateIndicator: document.getElementById('taskFocusStateIndicator'),
            stateText: document.getElementById('taskFocusStateText'),
            startBtn: document.getElementById('taskFocusStartBtn'),
            pauseBtn: document.getElementById('taskFocusPauseBtn'),
            doneBtn: document.getElementById('taskFocusDoneBtn'),
            backBtn: document.getElementById('taskFocusBackBtn')
        };

        if (!elements.shell) return;

        initRing();

        if (elements.startBtn) elements.startBtn.addEventListener('click', startTaskFocus);
        if (elements.pauseBtn) elements.pauseBtn.addEventListener('click', pauseTaskFocus);
        if (elements.doneBtn) elements.doneBtn.addEventListener('click', markDoneEarly);
        if (elements.backBtn) elements.backBtn.addEventListener('click', backToPicker);
        if (elements.quickStartBtn) elements.quickStartBtn.addEventListener('click', submitQuickTask);

        // Sub-tab switching
        document.querySelectorAll('.task-focus-subtab').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tfSubtab;
                if (tab && typeof switchTaskFocusSubTab === 'function') switchTaskFocusSubTab(tab);
            });
        });
    }

    function initRing() {
        [elements.ringFill, elements.ringGlow].forEach(ring => {
            if (!ring) return;
            ring.style.strokeDasharray = CIRCUMFERENCE;
            ring.style.strokeDashoffset = 0;
        });
    }

    function updateRing() {
        if (!elements.ringFill || !elements.ringGlow) return;
        const progress = currentTotal > 0 ? remainingSeconds / currentTotal : 0;
        const offset = CIRCUMFERENCE * (1 - progress);
        elements.ringFill.style.strokeDashoffset = offset;
        elements.ringGlow.style.strokeDashoffset = offset;
    }

    // "05:00" under an hour, "1:05:00" once a task needs an hour or more
    function formatClock(totalSeconds) {
        totalSeconds = Math.max(0, Math.round(totalSeconds));
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;
        if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    function updateDisplay() {
        if (elements.display) elements.display.textContent = formatClock(remainingSeconds);
        updateRing();
    }

    function setState(state) {
        if (elements.stateIndicator) {
            elements.stateIndicator.classList.remove('running', 'paused');
            if (state === 'running' || state === 'paused') elements.stateIndicator.classList.add(state);
        }
        if (elements.stateText) {
            elements.stateText.textContent = state === 'running' ? 'Focusing' : state === 'paused' ? 'Paused' : 'Ready';
        }
    }

    // ----- PICKER SCREEN -----

    function getTodayScheduleTasks() {
        if (typeof events === 'undefined' || !Array.isArray(events)) return [];
        const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
        return events
            .filter(e => e.day === today && !e.completed)
            .sort((a, b) => a.start.localeCompare(b.start));
    }

    function eventDurationMinutes(ev) {
        const [sh, sm] = ev.start.split(':').map(Number);
        const [eh, em] = ev.end.split(':').map(Number);
        return (eh * 60 + em) - (sh * 60 + sm);
    }

    function renderTaskFocusScheduleList() {
        const el = document.getElementById('taskFocusScheduleList');
        if (!el) return;
        const tasks = getTodayScheduleTasks();
        if (tasks.length === 0) {
            el.innerHTML = '<p class="task-focus-empty">No incomplete tasks on today\'s schedule.</p>';
            return;
        }
        el.innerHTML = tasks.map(ev => {
            const dur = eventDurationMinutes(ev);
            const durLabel = dur >= 60
                ? `${Math.floor(dur / 60)}h ${dur % 60 ? dur % 60 + 'm' : ''}`.trim()
                : `${dur}m`;
            return `
            <div class="task-focus-schedule-item">
                <div class="task-focus-schedule-info">
                    <span class="task-focus-schedule-title">${escapeHtml(ev.title)}</span>
                    <span class="task-focus-schedule-time">${ev.start}–${ev.end} · ${durLabel}</span>
                </div>
                <button class="task-focus-pick-btn" data-action="focusScheduleTask" data-id="${ev.id}" data-kind="schedule">Focus</button>
            </div>`;
        }).join('');
    }

    function switchTaskFocusSubTab(tab) {
        pauseTaskFocusIfRunning();

        const scheduleBtn = document.querySelector('.task-focus-subtab[data-tf-subtab="schedule"]');
        const flexibleBtn = document.querySelector('.task-focus-subtab[data-tf-subtab="flexible"]');
        const scheduleList = document.getElementById('taskFocusScheduleList');
        const flexWrap = document.getElementById('taskFocusFlexWrap');

        if (scheduleBtn) scheduleBtn.classList.toggle('active', tab === 'schedule');
        if (flexibleBtn) flexibleBtn.classList.toggle('active', tab === 'flexible');
        if (scheduleList) scheduleList.style.display = tab === 'schedule' ? 'block' : 'none';
        if (flexWrap) flexWrap.style.display = tab === 'flexible' ? 'block' : 'none';
    }

    function showTaskFocusPicker() {
        if (elements.picker) elements.picker.style.display = 'block';
        if (elements.session) elements.session.style.display = 'none';
        currentTask = null;

        renderTaskFocusScheduleList();
        renderTaskFocusPicker();

        const scheduleTasks = getTodayScheduleTasks();
        const flexTasks = typeof getIncompleteFlexibleTasks === 'function' ? getIncompleteFlexibleTasks() : [];
        const defaultTab = scheduleTasks.length > 0 ? 'schedule' : (flexTasks.length > 0 ? 'flexible' : 'schedule');
        switchTaskFocusSubTab(defaultTab);
    }

    function renderTaskFocusPicker() {
        if (!elements.pickList) return;
        const tasks = typeof getIncompleteFlexibleTasks === 'function' ? getIncompleteFlexibleTasks() : [];
        if (tasks.length === 0) {
            elements.pickList.innerHTML = '<p class="task-focus-empty">No flexible tasks yet. Add one below, or from the Schedule page.</p>';
            return;
        }
        elements.pickList.innerHTML = tasks.map(t => {
            const inProgress = t.remainingSeconds < t.durationSeconds;
            const durLabel = typeof formatDurationShort === 'function' ? formatDurationShort(t.durationMinutes) : `${t.durationMinutes}m`;
            return `
            <div class="task-focus-pick-item">
                <div class="task-focus-pick-info">
                    <span class="task-focus-pick-title">${escapeHtml(t.title)}</span>
                    <span class="task-focus-pick-duration">${durLabel}${inProgress ? ' · in progress' : ''}</span>
                </div>
                <button class="task-focus-pick-btn" data-action="focusFlexTask" data-id="${t.id}">${inProgress ? 'Resume' : 'Focus'}</button>
            </div>`;
        }).join('');
    }

    function submitQuickTask() {
        const title = (elements.quickTitle?.value || '').trim();
        const hours = parseInt(elements.quickHours?.value, 10) || 0;
        const mins = parseInt(elements.quickMinutes?.value, 10) || 0;
        const totalMinutes = hours * 60 + mins;
        if (!title) { if (typeof showToast === 'function') showToast('Give the task a name first', 'warning'); return; }
        if (totalMinutes <= 0) { if (typeof showToast === 'function') showToast('Set how long it needs', 'warning'); return; }
        if (typeof createFlexibleTask !== 'function') return;
        const task = createFlexibleTask(title, totalMinutes);
        if (elements.quickTitle) elements.quickTitle.value = '';
        if (elements.quickHours) elements.quickHours.value = '';
        if (elements.quickMinutes) elements.quickMinutes.value = '';
        selectTaskForFocus(task.id);
    }

    // ----- SESSION SCREEN -----

    function selectTaskForFocus(id, kind) {
        kind = kind || 'flexible';
        if (kind === 'schedule') {
            const tasks = getTodayScheduleTasks();
            const ev = tasks.find(e => e.id === id) || null;
            if (!ev) {
                if (typeof showToast === 'function') showToast("That task isn't there anymore — pick another", 'warning');
                showTaskFocusPicker();
                return;
            }
            const dur = eventDurationMinutes(ev);
            currentTask = {
                kind: 'schedule',
                id: ev.id,
                day: ev.day,
                title: ev.title,
                durationSeconds: dur * 60,
                remainingSeconds: dur * 60
            };
        } else {
            const task = typeof getFlexibleTaskById === 'function' ? getFlexibleTaskById(id) : null;
            if (!task) {
                if (typeof showToast === 'function') showToast("That task isn't there anymore — pick another", 'warning');
                showTaskFocusPicker();
                return;
            }
            currentTask = task;
        }
        remainingSeconds = currentTask.remainingSeconds != null ? currentTask.remainingSeconds : currentTask.durationSeconds;
        currentTotal = currentTask.durationSeconds;
        isRunning = false;
        phaseStartTime = null;

        if (elements.picker) elements.picker.style.display = 'none';
        if (elements.session) elements.session.style.display = 'block';
        if (elements.taskName) elements.taskName.textContent = currentTask.title;
        if (elements.startBtn) {
            elements.startBtn.style.display = 'inline-block';
            elements.startBtn.textContent = remainingSeconds < currentTask.durationSeconds ? 'Resume' : 'Start';
        }
        if (elements.pauseBtn) elements.pauseBtn.style.display = 'none';

        setState('ready');
        updateDisplay();
    }

    function startTaskFocus() {
        if (isRunning || !currentTask) return;
        isRunning = true;
        phaseStartTime = Date.now();
        phaseRemainingAtStart = remainingSeconds;
        lastPersistedAt = Date.now();
        setState('running');
        if (elements.startBtn) elements.startBtn.style.display = 'none';
        if (elements.pauseBtn) elements.pauseBtn.style.display = 'inline-block';
        tfInterval = setInterval(tick, 100);

        // Sync with total timer / session tracker
        if (typeof startFocusAccumulation === 'function') startFocusAccumulation();
    }

    function tick() {
        if (!phaseStartTime) return;
        const elapsed = Math.floor((Date.now() - phaseStartTime) / 1000);
        remainingSeconds = phaseRemainingAtStart - elapsed;

        if (remainingSeconds <= 0) {
            remainingSeconds = 0;
            updateDisplay();
            if (currentTask) currentTask.remainingSeconds = 0;
            completeTask();
            return;
        }
        updateDisplay();

        // Persist progress roughly every 10s so a refresh mid-session
        // doesn't lose much on a multi-hour task.
        if (Date.now() - lastPersistedAt >= 10000) {
            persistProgress();
            lastPersistedAt = Date.now();
        }
    }

    function persistProgress() {
        if (!currentTask) return;
        currentTask.remainingSeconds = remainingSeconds;
        if (currentTask.kind === 'flexible' && typeof updateFlexibleTaskRemaining === 'function') {
            updateFlexibleTaskRemaining(currentTask.id, remainingSeconds);
        }
    }

    function pauseTaskFocus() {
        if (!isRunning) return;
        clearInterval(tfInterval);
        tfInterval = null;
        isRunning = false;
        phaseStartTime = null;
        persistProgress();
        setState('paused');
        if (elements.startBtn) {
            elements.startBtn.style.display = 'inline-block';
            elements.startBtn.textContent = 'Resume';
        }
        if (elements.pauseBtn) elements.pauseBtn.style.display = 'none';

        // Pause total timer sync
        if (typeof pauseFocusAccumulation === 'function') pauseFocusAccumulation();
    }

    // Exposed for pomodoro.js's mode switcher, so leaving this mode while
    // running doesn't silently drop unsaved elapsed time.
    function pauseTaskFocusIfRunning() {
        if (isRunning) pauseTaskFocus();
    }

    function saveTaskFocusSession() {
        const task = currentTask;
        if (!task) return;
        const elapsed = task.durationSeconds - (task.remainingSeconds || 0);
        if (elapsed < 5) return;

        const completedSessions = JSON.parse(localStorage.getItem('completedSessions') || '[]');
        completedSessions.push({
            taskName: task.title,
            taskStart: '',
            taskEnd: '',
            focusSeconds: elapsed,
            breakSeconds: 0,
            idleSeconds: 0,
            totalSeconds: elapsed,
            timestamp: Date.now()
        });
        localStorage.setItem('completedSessions', JSON.stringify(completedSessions));

        document.dispatchEvent(new CustomEvent('sessionCompleted', {
            detail: { taskName: task.title }
        }));

        if (typeof renderSessionHistory === 'function') renderSessionHistory();
        if (typeof updateTotalTimerFromHistory === 'function') updateTotalTimerFromHistory();
    }

    function completeTask() {
        clearInterval(tfInterval);
        tfInterval = null;
        isRunning = false;
        phaseStartTime = null;

        // Stop total timer sync — this saves accumulated time and pauses the session tracker
        if (typeof stopFocusAccumulation === 'function') stopFocusAccumulation();

        const task = currentTask;
        if (elements.ringContainer) {
            elements.ringContainer.style.animation = 'timerComplete 0.6s ease';
            setTimeout(() => { if (elements.ringContainer) elements.ringContainer.style.animation = ''; }, 700);
        }
        document.title = '🎯 Task Complete! - Workspace Hub';
        setTimeout(() => { document.title = 'Workspace Hub'; }, 3000);

        if (typeof playChime === 'function') playChime();
        if (typeof sendNotification === 'function' && task) {
            sendNotification('🎯 Focus Session', `"${task.title}" is done — nice work.`, '🎯', 'task-focus-notification');
        }

        // Save to completedSessions history BEFORE resetting daily totals,
        // so renderSessionHistory() can show finished sessions independent of live counts.
        saveTaskFocusSession();

        // Reset daily totals without triggering resetTracker's extra updateUI(),
        // then do one final updateUI() ourselves so the display shows the new totals.
        if (typeof window.resetDailyTotals === 'function') {
            window.resetDailyTotals();
        }

        // Final UI refresh to show cleared totals + history in the Total Timer
        if (typeof window.updateTotalTimerFromHistory === 'function') window.updateTotalTimerFromHistory();

        if (task) {
            if (task.kind === 'schedule') {
                if (typeof toggleTaskComplete === 'function') toggleTaskComplete(task.id, task.day);
            } else {
                if (typeof markFlexibleTaskComplete === 'function') markFlexibleTaskComplete(task.id);
            }
        }
        if (task && typeof showToast === 'function') showToast(`"${task.title}" complete! 🎉`, 'success');

        setState('ready');
        currentTask = null;
        setTimeout(showTaskFocusPicker, 900);
    }

    function markDoneEarly() {
        if (!currentTask) return;
        clearInterval(tfInterval);
        tfInterval = null;
        isRunning = false;
        phaseStartTime = null;

        // Stop total timer sync — this saves accumulated time
        if (typeof stopFocusAccumulation === 'function') stopFocusAccumulation();

        const task = currentTask;
        saveTaskFocusSession();

        // Reset daily totals without double-counting, then update UI once.
        if (typeof window.resetDailyTotals === 'function') {
            window.resetDailyTotals();
        }

        // Final UI refresh to show cleared totals + history in the Total Timer
        if (typeof window.updateTotalTimerFromHistory === 'function') window.updateTotalTimerFromHistory();

        if (task) {
            if (task.kind === 'schedule') {
                if (typeof toggleTaskComplete === 'function') toggleTaskComplete(task.id, task.day);
            } else {
                if (typeof markFlexibleTaskComplete === 'function') markFlexibleTaskComplete(task.id);
            }
        }
        if (typeof showToast === 'function') showToast(`"${task.title}" marked done`, 'success');
        currentTask = null;
        showTaskFocusPicker();
    }

    function backToPicker() {
        pauseTaskFocusIfRunning();
        if (typeof stopFocusAccumulation === 'function') stopFocusAccumulation();
        showTaskFocusPicker();
    }

    // ----- EXPOSE GLOBALLY -----
    window.showTaskFocusPicker = showTaskFocusPicker;
    window.renderTaskFocusPicker = renderTaskFocusPicker;
    window.selectTaskForFocus = selectTaskForFocus;
    window.pauseTaskFocusIfRunning = pauseTaskFocusIfRunning;
    window.initTaskFocus = initTaskFocus;
    window.switchTaskFocusSubTab = switchTaskFocusSubTab;

    // Switches to the Timer view's Task Focus mode and lands directly on a
    // given task's session screen — used by the "▶ Focus" button on the
    // Schedule page's Flexible Tasks card.
    window.startFocusForTask = function(id) {
        if (typeof switchView === 'function') switchView('timer-view');
        if (typeof window.switchPomodoroMode === 'function') window.switchPomodoroMode('taskFocus');
        setTimeout(() => selectTaskForFocus(id), 320);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTaskFocus);
    } else {
        setTimeout(initTaskFocus, 100);
    }

})();
