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

    function showTaskFocusPicker() {
        if (elements.picker) elements.picker.style.display = 'block';
        if (elements.session) elements.session.style.display = 'none';
        currentTask = null;
        renderTaskFocusPicker();
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

    function selectTaskForFocus(id) {
        const task = typeof getFlexibleTaskById === 'function' ? getFlexibleTaskById(id) : null;
        if (!task) {
            if (typeof showToast === 'function') showToast("That task isn't there anymore — pick another", 'warning');
            showTaskFocusPicker();
            return;
        }
        currentTask = task;
        remainingSeconds = task.remainingSeconds != null ? task.remainingSeconds : task.durationSeconds;
        currentTotal = task.durationSeconds;
        isRunning = false;
        phaseStartTime = null;

        if (elements.picker) elements.picker.style.display = 'none';
        if (elements.session) elements.session.style.display = 'block';
        if (elements.taskName) elements.taskName.textContent = task.title;
        if (elements.startBtn) {
            elements.startBtn.style.display = 'inline-block';
            elements.startBtn.textContent = remainingSeconds < task.durationSeconds ? 'Resume' : 'Start';
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
    }

    function tick() {
        if (!phaseStartTime) return;
        const elapsed = Math.floor((Date.now() - phaseStartTime) / 1000);
        remainingSeconds = phaseRemainingAtStart - elapsed;

        if (remainingSeconds <= 0) {
            remainingSeconds = 0;
            updateDisplay();
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
        if (typeof updateFlexibleTaskRemaining === 'function') {
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
    }

    // Exposed for pomodoro.js's mode switcher, so leaving this mode while
    // running doesn't silently drop unsaved elapsed time.
    function pauseTaskFocusIfRunning() {
        if (isRunning) pauseTaskFocus();
    }

    function completeTask() {
        clearInterval(tfInterval);
        tfInterval = null;
        isRunning = false;
        phaseStartTime = null;

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
        if (task && typeof markFlexibleTaskComplete === 'function') markFlexibleTaskComplete(task.id);
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

        const task = currentTask;
        if (typeof markFlexibleTaskComplete === 'function') markFlexibleTaskComplete(task.id);
        if (typeof showToast === 'function') showToast(`"${task.title}" marked done`, 'success');
        currentTask = null;
        showTaskFocusPicker();
    }

    function backToPicker() {
        pauseTaskFocusIfRunning();
        showTaskFocusPicker();
    }

    // ----- EXPOSE GLOBALLY -----
    window.showTaskFocusPicker = showTaskFocusPicker;
    window.renderTaskFocusPicker = renderTaskFocusPicker;
    window.selectTaskForFocus = selectTaskForFocus;
    window.pauseTaskFocusIfRunning = pauseTaskFocusIfRunning;
    window.initTaskFocus = initTaskFocus;

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
