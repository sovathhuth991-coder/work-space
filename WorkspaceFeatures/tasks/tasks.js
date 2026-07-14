let myTasks = [];
let activeTaskCategory = "all";
let tasksUnsub = null;

function loadMyTasks() {
    if (window.TinyBaseStore) {
        myTasks = window.TinyBaseStore.getTable('myTasks').map(row => {
            const { _id, ...rest } = row;
            return rest;
        }) || [];
    } else {
        myTasks = JSON.parse(localStorage.getItem("myTasks") || "[]");
    }
}

function saveMyTasks() {
    const data = myTasks.map(item => ({ ...item, _id: item.id }));
    if (window.TinyBaseStore) {
        window.TinyBaseStore.setTable('myTasks', data);
    } else {
        localStorage.setItem("myTasks", JSON.stringify(myTasks));
    }
    updateTaskCategoryCounts();
    updateDashboardStats();
}

function updateTaskCategoryCounts() {
    ["all", "codes", "teachers", "fun", "general"].forEach(cat => {
        const el = document.getElementById(`cat-count-${cat}`);
        if (!el) return;
        const count = cat === "all" ? myTasks.length : myTasks.filter(t => t.category === cat).length;
        el.textContent = count;
    });
}

function switchTaskCategory(category) {
    activeTaskCategory = category;
    document.querySelectorAll(".task-category").forEach(el => el.classList.toggle("active", el.dataset.cat === category));
    renderMyTasks();
}

function renderMyTasks() {
    const container = document.getElementById("tasksListContainer");
    if (!container) return;
    const filtered = activeTaskCategory === "all" ? myTasks : myTasks.filter(t => t.category === activeTaskCategory);
    if (!filtered.length) { container.innerHTML = `<div class="empty-state">No tasks in this category.</div>`; return; }
    container.innerHTML = filtered.map(task => `
        <div class="task-item ${task.completed ? 'completed' : ''}">
            <input type="checkbox" class="task-check" ${task.completed ? 'checked' : ''} onchange="toggleMyTask('${task.id}')" />
            <div class="task-info">
                <div class="task-title">${escapeHtml(task.title)}</div>
                <div class="task-meta">
                    <span class="task-cat-badge">${escapeHtml(task.category)}</span>
                    <span class="task-priority ${escapeHtml(task.priority)}">${escapeHtml(task.priority)}</span>
                    ${task.due ? `<span>📅 ${escapeHtml(task.due)}</span>` : ''}
                </div>
            </div>
            <button class="task-delete-btn" onclick="deleteMyTask('${task.id}')">✕</button>
        </div>
    `).join("");
    updateTaskCategoryCounts();
}

function addMyTask() {
    const input = document.getElementById("new-task-input");
    const category = document.getElementById("new-task-category");
    const priority = document.getElementById("new-task-priority");
    const due = document.getElementById("new-task-due");
    if (!input?.value?.trim()) return;
    myTasks.push({ id: `mytask_${Date.now()}`, title: input.value.trim(), category: category.value, priority: priority.value, due: due.value || null, completed: false, createdAt: new Date().toISOString() });
    input.value = "";
    if (due) due.value = "";
    saveMyTasks();
    renderMyTasks();
}

function toggleMyTask(id) {
    myTasks = myTasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
    saveMyTasks();
    renderMyTasks();
}

function deleteMyTask(id) {
    myTasks = myTasks.filter(t => t.id !== id);
    saveMyTasks();
    renderMyTasks();
}

function initTasksStore() {
    loadMyTasks();
    if (window.TinyBaseStore) {
        tasksUnsub = window.TinyBaseStore.on('myTasks', () => {
            loadMyTasks();
            renderMyTasks();
        });
    }
}

function destroyTasksStore() {
    if (tasksUnsub) { tasksUnsub(); tasksUnsub = null; }
}

// Expose functions globally
window.renderMyTasks = renderMyTasks;
window.addMyTask = addMyTask;
window.toggleMyTask = toggleMyTask;
window.deleteMyTask = deleteMyTask;
window.initTasksStore = initTasksStore;
window.destroyTasksStore = destroyTasksStore;
window.loadMyTasks = loadMyTasks;
