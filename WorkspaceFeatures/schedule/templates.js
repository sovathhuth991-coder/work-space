// ============================================================
// TASK TEMPLATES MODULE
// ============================================================

let taskTemplates = JSON.parse(localStorage.getItem('taskTemplates') || '[]');

// ---- Save templates ----
function saveTaskTemplates() {
    localStorage.setItem('taskTemplates', JSON.stringify(taskTemplates));
}

// ---- Get all templates ----
function getTaskTemplates() {
    return taskTemplates;
}

// ---- Save current day's events as a template ----
function saveDayAsTemplate(day, templateName) {
    const dayEvents = events.filter(e => e.day === day);
    if (dayEvents.length === 0) {
        showToast('No tasks to save on this day.', 'warning');
        return;
    }

    // Validate template name
    if (!templateName || templateName.trim() === '') {
        showToast('Please enter a template name.', 'warning');
        return;
    }

    // Check for duplicate name
    const existing = taskTemplates.find(t => t.name === templateName);
    if (existing) {
        if (!confirm(`Template "${templateName}" already exists. Overwrite?`)) return;
        // Remove old one
        taskTemplates = taskTemplates.filter(t => t.name !== templateName);
    }

    // Create template (strip day, id, completed, reminderShown)
    const template = {
        id: `template_${Date.now()}`,
        name: templateName,
        createdAt: new Date().toISOString(),
        tasks: dayEvents.map(e => ({
            title: e.title,
            category: e.category || 'study',
            start: e.start,
            end: e.end,
            notes: e.notes || '',
            link: e.link || '',
            color: e.color || 'default',
            reminderEnabled: e.reminderEnabled || false,
            reminderMinutes: e.reminderMinutes || 15,
        }))
    };

    taskTemplates.push(template);
    saveTaskTemplates();
    showToast(`Template "${templateName}" saved!`, 'success');
    renderTemplateDropdown();
}

// ---- Load a template into a day ----
function loadTemplateIntoDay(templateId, targetDay) {
    const template = taskTemplates.find(t => t.id === templateId);
    if (!template) {
        showToast('Template not found.', 'error');
        return;
    }

    // Check for conflicts
    const existingEvents = events.filter(e => e.day === targetDay);
    if (existingEvents.length > 0) {
        if (!confirm(`This day already has ${existingEvents.length} tasks. Clear them first?`)) return;
        // Remove existing events for this day
        events = events.filter(e => e.day !== targetDay);
    }

    // Add template tasks
    template.tasks.forEach(task => {
        events.push({
            id: Date.now() + Math.random() * 1000,
            title: task.title,
            category: task.category,
            start: task.start,
            end: task.end,
            notes: task.notes || '',
            link: task.link || '',
            color: task.color || 'default',
            day: targetDay,
            completed: false,
            reminderEnabled: task.reminderEnabled || false,
            reminderMinutes: task.reminderMinutes || 15,
            reminderShown: false,
            recurrence: null
        });
    });

    saveEvents();
    renderSchedule();
    openDayDiagram(targetDay);
    showToast(`Template "${template.name}" loaded into ${targetDay}`, 'success');
}

// ---- Delete a template ----
function deleteTemplate(templateId) {
    if (!confirm('Delete this template?')) return;
    taskTemplates = taskTemplates.filter(t => t.id !== templateId);
    saveTaskTemplates();
    renderTemplateDropdown();
    showToast('Template deleted.', 'info');
}

// ---- Render template dropdown ----
function renderTemplateDropdown() {
    const container = document.getElementById('templateDropdownContainer');
    if (!container) return;

    if (taskTemplates.length === 0) {
        container.innerHTML = `
            <div class="template-empty">
                <span style="color:var(--text-muted);font-size:0.75rem;">No templates saved yet.</span>
            </div>
        `;
        return;
    }

    // Build dropdown
    let html = `
        <div class="template-dropdown-row">
            <select id="templateSelect" class="template-select">
                <option value="">— Load a template —</option>
                ${taskTemplates.map(t => `<option value="${t.id}">${t.name} (${t.tasks.length} tasks)</option>`).join('')}
            </select>
            <button class="template-load-btn" onclick="handleLoadTemplate()">Load</button>
        </div>
        <div class="template-saved-list">
            ${taskTemplates.map(t => `
                <div class="template-badge">
                    <span>📋 ${t.name} (${t.tasks.length})</span>
                    <button class="template-delete-btn" onclick="deleteTemplate('${t.id}')">×</button>
                </div>
            `).join('')}
        </div>
    `;

    container.innerHTML = html;
}

// ---- Handle load template ----
function handleLoadTemplate() {
    const select = document.getElementById('templateSelect');
    if (!select || !select.value) {
        showToast('Please select a template.', 'warning');
        return;
    }
    const day = currentOpenDay || getTodayName();
    loadTemplateIntoDay(select.value, day);
}

// ---- Handle save template ----
function handleSaveTemplate(day) {
    const name = prompt('Enter a name for this template:', `${day} Template`);
    if (!name || !name.trim()) return;
    saveDayAsTemplate(day, name.trim());
}

// ---- Add template UI to the modal ----
function addTemplateUI(day) {
    // Find the modal form zone
    const formZone = document.querySelector('.modal-form-zone');
    if (!formZone) return;

    // Check if already added
    if (document.getElementById('templateSection')) return;

    const section = document.createElement('div');
    section.id = 'templateSection';
    section.style.cssText = 'margin-top:16px;padding-top:16px;border-top:1px solid var(--border-color);';

    section.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;flex-wrap:wrap;">
            <span style="font-size:0.75rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;">📋 Templates</span>
            <button class="template-save-btn" onclick="handleSaveTemplate('${day}')">💾 Save as Template</button>
        </div>
        <div id="templateDropdownContainer"></div>
    `;

    formZone.appendChild(section);
    renderTemplateDropdown();
}

// ---- Expose globally ----
window.taskTemplates = taskTemplates;
window.getTaskTemplates = getTaskTemplates;
window.saveDayAsTemplate = saveDayAsTemplate;
window.loadTemplateIntoDay = loadTemplateIntoDay;
window.deleteTemplate = deleteTemplate;
window.renderTemplateDropdown = renderTemplateDropdown;
window.handleLoadTemplate = handleLoadTemplate;
window.handleSaveTemplate = handleSaveTemplate;
window.addTemplateUI = addTemplateUI;

console.log('📋 Task Templates module loaded');
