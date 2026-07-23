// ============================================================
// flexible-tasks.js — Duration-based tasks ("needs 2 hours", not
// a fixed clock slot). These are a separate list from
// `scheduleEvents` since they have no day/start/end — just a
// title and how long they take. Rendered as a card on the
// Schedule view, and pickable from the Timer view's Task Focus
// mode (task-focus.js), which owns the actual countdown.
// ============================================================

let flexibleTasks = [];
try {
    flexibleTasks = JSON.parse(localStorage.getItem('flexibleTasks') || '[]');
} catch (e) {
    flexibleTasks = [];
}

function saveFlexibleTasks() {
    localStorage.setItem('flexibleTasks', JSON.stringify(flexibleTasks));
}

// "125" -> "2h 5m", "60" -> "1h", "45" -> "45m"
function formatDurationShort(minutes) {
    minutes = Math.max(0, Math.round(minutes));
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
}

function createFlexibleTask(title, durationMinutes) {
    const task = {
        id: Date.now(),
        title: String(title).trim().slice(0, 80),
        durationMinutes,
        durationSeconds: durationMinutes * 60,
        remainingSeconds: durationMinutes * 60,
        completed: false,
        createdAt: Date.now(),
        completedAt: null
    };
    flexibleTasks.push(task);
    saveFlexibleTasks();
    renderFlexibleTasksPanel();
    if (typeof renderTaskFocusPicker === 'function') renderTaskFocusPicker();
    return task;
}

function deleteFlexibleTask(id) {
    flexibleTasks = flexibleTasks.filter(t => t.id !== id);
    saveFlexibleTasks();
    renderFlexibleTasksPanel();
    if (typeof renderTaskFocusPicker === 'function') renderTaskFocusPicker();
    if (typeof showToast === 'function') showToast('Task removed', 'info');
}

function getFlexibleTaskById(id) {
    return flexibleTasks.find(t => t.id === id) || null;
}

function getIncompleteFlexibleTasks() {
    return flexibleTasks.filter(t => !t.completed).sort((a, b) => a.createdAt - b.createdAt);
}

// Called by the Task Focus timer whenever it pauses (or periodically while
// running), so progress on a multi-sitting task survives a refresh.
function updateFlexibleTaskRemaining(id, remainingSeconds) {
    const task = getFlexibleTaskById(id);
    if (!task) return;
    task.remainingSeconds = Math.max(0, Math.round(remainingSeconds));
    saveFlexibleTasks();
    renderFlexibleTasksPanel();
}

function markFlexibleTaskComplete(id) {
    const task = getFlexibleTaskById(id);
    if (!task) return;
    task.completed = true;
    task.remainingSeconds = 0;
    task.completedAt = Date.now();
    saveFlexibleTasks();
    renderFlexibleTasksPanel();
    if (typeof renderTaskFocusPicker === 'function') renderTaskFocusPicker();
}

// Manual checkbox toggle from the Schedule view (not via the timer).
function toggleFlexibleTaskManual(id) {
    const task = getFlexibleTaskById(id);
    if (!task) return;
    task.completed = !task.completed;
    task.completedAt = task.completed ? Date.now() : null;
    if (!task.completed) task.remainingSeconds = task.durationSeconds; // reopening starts fresh
    saveFlexibleTasks();
    renderFlexibleTasksPanel();
    if (typeof renderTaskFocusPicker === 'function') renderTaskFocusPicker();
    if (typeof showToast === 'function') showToast(task.completed ? 'Task completed! 🎉' : 'Task reopened', 'info');
}

// ============================================================
// SCHEDULE VIEW — "Flexible Tasks" card
// ============================================================

function renderFlexibleTasksPanel() {
    const listEl = document.getElementById('flexibleTasksList');
    if (!listEl) return;
    const sorted = [...flexibleTasks].sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return a.createdAt - b.createdAt;
    });
    if (sorted.length === 0) {
        listEl.innerHTML = '<p class="flexible-tasks-empty">No flexible tasks yet — add one for anything that just needs a chunk of time, not a fixed slot.</p>';
        return;
    }
    listEl.innerHTML = sorted.map(t => {
        const inProgress = !t.completed && t.remainingSeconds < t.durationSeconds;
        const durLabel = formatDurationShort(t.durationMinutes);
        return `
        <div class="flex-task-item ${t.completed ? 'flex-task-done' : ''}">
            <button class="flex-task-check" data-action="toggleFlexTask" data-id="${t.id}" title="${t.completed ? 'Reopen' : 'Mark complete'}">${t.completed ? '✓' : ''}</button>
            <div class="flex-task-info">
                <span class="flex-task-title">${escapeHtml(t.title)}</span>
                <span class="flex-task-meta">${durLabel}${inProgress ? ' · in progress' : ''}</span>
            </div>
            ${!t.completed ? `<button class="flex-task-start-btn" data-action="startFlexTaskFocus" data-id="${t.id}">▶ Focus</button>` : ''}
            <button class="flex-task-delete" data-action="deleteFlexTask" data-id="${t.id}" title="Delete">🗑</button>
        </div>`;
    }).join('');
}

function toggleAddFlexibleTaskForm() {
    const form = document.getElementById('addFlexTaskForm');
    if (!form) return;
    const showing = form.style.display === 'block';
    form.style.display = showing ? 'none' : 'block';
    if (!showing) {
        const titleInput = document.getElementById('newFlexTaskTitle');
        if (titleInput) titleInput.focus();
    }
}

function cancelAddFlexTask() {
    const form = document.getElementById('addFlexTaskForm');
    if (form) form.style.display = 'none';
    ['newFlexTaskTitle', 'newFlexTaskHours', 'newFlexTaskMinutes'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
}

function submitNewFlexTask() {
    const title = (document.getElementById('newFlexTaskTitle')?.value || '').trim();
    const hours = parseInt(document.getElementById('newFlexTaskHours')?.value, 10) || 0;
    const mins = parseInt(document.getElementById('newFlexTaskMinutes')?.value, 10) || 0;
    const totalMinutes = hours * 60 + mins;
    if (!title) { if (typeof showToast === 'function') showToast('Give the task a name first', 'warning'); return; }
    if (totalMinutes <= 0) { if (typeof showToast === 'function') showToast('Set how long it needs', 'warning'); return; }
    createFlexibleTask(title, totalMinutes);
    cancelAddFlexTask();
    if (typeof showToast === 'function') showToast('Flexible task added', 'success');
}

// ----- EXPOSE GLOBALLY -----
window.createFlexibleTask = createFlexibleTask;
window.deleteFlexibleTask = deleteFlexibleTask;
window.getFlexibleTaskById = getFlexibleTaskById;
window.getIncompleteFlexibleTasks = getIncompleteFlexibleTasks;
window.updateFlexibleTaskRemaining = updateFlexibleTaskRemaining;
window.markFlexibleTaskComplete = markFlexibleTaskComplete;
window.toggleFlexibleTaskManual = toggleFlexibleTaskManual;
window.formatDurationShort = formatDurationShort;
window.renderFlexibleTasksPanel = renderFlexibleTasksPanel;

function initFlexibleTasksUI() {
    renderFlexibleTasksPanel();
    const addBtn = document.getElementById('flexAddToggleBtn');
    const cancelBtn = document.getElementById('flexCancelBtn');
    const submitBtn = document.getElementById('flexSubmitBtn');
    if (addBtn) addBtn.addEventListener('click', toggleAddFlexibleTaskForm);
    if (cancelBtn) cancelBtn.addEventListener('click', cancelAddFlexTask);
    if (submitBtn) submitBtn.addEventListener('click', submitNewFlexTask);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFlexibleTasksUI);
} else {
    initFlexibleTasksUI();
}
