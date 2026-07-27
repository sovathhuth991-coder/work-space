// This file contains the main schedule renderer and day diagram logic.

// Edit-state: id of the event currently being edited, or null in Add mode.
// Single source of truth shared across schedule-planner.js and schedule-core.js.
window.editingEventId = null;


function renderSchedule() {
    autoCompletePastEvents();
    const calendar = document.getElementById("calendar");
    if (!calendar) return;
    calendar.innerHTML = "";
    const { todayName, currentHHMM, currentDayIndex } = getTimeMetrics();
    DAYS.forEach((day, index) => {
        const dayBox = document.createElement("div");
        dayBox.className = "day";
        if (day === todayName) {
            dayBox.classList.add("today-highlight");
            dayBox.id = "todayDayBox";
        }
        dayBox.setAttribute("onclick", `openDayDiagram('${day}')`);
        dayBox.addEventListener("contextmenu", (e) => { e.preventDefault(); e.stopPropagation(); showContextMenu(e, day); });
        const dayEvents = events.filter(e => e.day === day).sort((a, b) => a.start.localeCompare(b.start));
        const eventCount = dayEvents.length;
        const hasOverlaps = dayHasTimeOverlaps(dayEvents);
        dayBox.innerHTML = `
            <h3>${day.slice(0, 3)}${day === todayName ? ' &middot; TODAY' : ''}</h3>
            ${hasOverlaps ? '<span class="day-overlap-flag"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:11px;height:11px;"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/></svg>CONFLICT</span>' : ''}
            <div class="mini-preview-list">
                ${dayEvents.slice(0, 3).map(ev => `
                    <div class="mini-dot ${ev.completed ? 'mini-done' : ''}">
                        <span class="mini-dot-marker cat-${escapeHtml(ev.category || 'study')}"></span>
                        <span class="mini-dot-time">${escapeHtml(ev.start || '')}</span>
                        <span class="mini-dot-title">${escapeHtml(ev.title)}</span>
                    </div>
                `).join('')}
                ${eventCount > 3 ? '<div class="mini-dot extra">...and more</div>' : ''}
            </div>
        `;
        calendar.appendChild(dayBox);
    });
    renderScheduleQuickNav();
    if (typeof initScheduleKeyboardNav === 'function') initScheduleKeyboardNav();
}

// ============================================================
// QUICK DAY NAVIGATION BAR
// ============================================================

function renderScheduleQuickNav() {
    const pillsEl = document.getElementById("scheduleQuickNavPills");
    if (!pillsEl) return;
    const { todayName } = getTimeMetrics();
    pillsEl.innerHTML = DAYS.map((day, i) => {
        const count = getDayEventCount(day);
        const isToday = day === todayName;
        return `<button class="qn-pill ${isToday ? 'today' : ''}" data-day="${day}" data-index="${i}" title="Open ${day}">
            <span class="qn-pill-name">${day.slice(0, 3)}</span>
            <span class="qn-pill-count"${count === 0 ? ' data-empty="1"' : ''}>${count}</span>
        </button>`;
    }).join("");
    pillsEl.querySelectorAll('.qn-pill').forEach(pill => {
        pill.addEventListener('click', () => openDayDiagram(pill.dataset.day));
    });
}

// Jump to today: open schedule view, scroll the current day into view, pulse it
function jumpToTodaySchedule() {
    const { todayName } = getTimeMetrics();
    if (typeof switchView === 'function' && !document.getElementById('schedule-view').classList.contains('active')) {
        switchView('schedule-view');
    }
    renderSchedule();
    const todayBox = document.getElementById("todayDayBox");
    if (todayBox) {
        todayBox.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        todayBox.classList.remove('day-flash');
        void todayBox.offsetWidth; // reflow to restart animation
        todayBox.classList.add('day-flash');
    }
    if (typeof showToast === 'function') showToast(todayName, 'info');
}

// Add a task directly to today
function addTaskToday() {
    const { todayName } = getTimeMetrics();
    if (typeof switchView === 'function' && !document.getElementById('schedule-view').classList.contains('active')) {
        switchView('schedule-view');
    }
    openDayDiagram(todayName);
}

// Helper: convert 24-hour hour (0-23) to 12-hour hour (1-12) as a 2‑digit string
function to12Hour(h24) {
    let h = parseInt(h24);
    if (isNaN(h) || h < 0) h = 12;
    if (h === 0) h = 12;
    else if (h > 12) h -= 12;
    return String(h).padStart(2, '0');
}

// ============================================================
// DAY DIAGRAM (Modal) — Refactored into small functions
// ============================================================

function openDayDiagram(day) {
    if (!DAYS.includes(day)) return;
    // Every open/refresh/day-switch starts in Add mode (form is rebuilt below)
    window.editingEventId = null;
    autoCompletePastEvents();
    currentOpenDay = day;

    const modal = ensurePlannerModalShell();
    const dayEvents = getDayEvents(day);

    // Build and set HTML once
    modal.innerHTML = buildModalHTML(day, dayEvents);
    modal.style.display = 'flex';
    modal.scrollTop = 0;

    // Initialize wheel pickers after a short delay to ensure DOM is ready
    setTimeout(() => {
        if (typeof initWheelPickers === 'function') {
            initWheelPickers();
        } else {
            console.warn('initWheelPickers not available');
        }
        // Sync recurrence-count row visibility with the current recurrence value
        if (typeof toggleRecurrenceCountUI === 'function') {
            const recEl = document.getElementById('recurrence');
            toggleRecurrenceCountUI(recEl ? recEl.value : 'none');
        }
    }, 100);

    if (typeof addTemplateUI === 'function') addTemplateUI(day);
    if (typeof updateUndoRedoButtons === 'function') updateUndoRedoButtons();
}

function getDayEvents(day) {
    return events.filter(e => e.day === day).sort((a, b) => a.start.localeCompare(b.start));
}

function buildModalHTML(day, dayEvents) {
    const { todayName, currentHHMM } = getTimeMetrics();
    const defaults = getDefaultWheelTimes();
    const overlapMap = getOverlapMap(dayEvents);
    const conflictCount = overlapMap.size;

    return `
        <div class="modal-content">
            ${buildModalHeader(day, dayEvents)}
            ${buildModalTitle(day, todayName)}
            <div class="modal-layout">
                ${buildFormZone(day, defaults)}
                ${buildTimelineZone(dayEvents, todayName, currentHHMM, overlapMap)}
            </div>
        </div>
    `;
}

function buildModalHeader(day, dayEvents) {
    const conflictCount = getOverlapMap(dayEvents).size;
    return `
        <div class="modal-header-bar">
            <button class="modal-close-btn" onclick="closeDayDiagram()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            <span class="modal-header-title">${day}</span>
            ${conflictCount > 0 ? `<span class="modal-conflict-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:11px;height:11px;"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/></svg>${conflictCount} conflict${conflictCount > 1 ? 's' : ''}</span>` : ''}
        </div>
    `;
}

function buildModalTitle(day, todayName) {
    return `
        <div class="modal-title-section">
            ${buildPlannerDayNav(day)}
        </div>
    `;
}

// ==================== FIXED ====================
function getLessonPageOptions(selectedId) {
    if (typeof hubState === 'undefined' || !hubState) return '<option value="">No lessons available</option>';
    let options = '<option value="">— None —</option>';
    // hubState.folders is an object; iterate over its values
    Object.values(hubState.folders).forEach(folder => {
        if (!folder.children) return;
        folder.children.forEach(childId => {
            if (childId.startsWith('page_')) {
                const pageId = childId.replace('page_', '');
                const page = hubState.pages[pageId];
                if (!page) return;
                const sel = pageId === selectedId ? 'selected' : '';
                options += `<option value="${pageId}" ${sel}>${escapeHtml(folder.title)} › ${escapeHtml(page.title)}</option>`;
            }
        });
    });
    return options;
}
// =============================================

function buildFormZone(day, defaults) {
    return `
        <div class="modal-form-zone">
            <form id="modalScheduleForm" data-planner-day="${day}" onsubmit="handleModalSubmit(event, '${day}')">
                <div class="form-row">
                    <input type="text" id="title" placeholder="Task title..." required class="form-input" />
                </div>
                <div class="form-row">
                    <select id="category" class="form-select">
                        <option value="study">Study</option>
                        <option value="work">Work</option>
                        <option value="personal">Personal</option>
                        <option value="fitness">Fitness</option>
                        <option value="social">Social</option>
                        <option value="other">Other</option>
                    </select>
                </div>

                <!-- ===== TASK TYPE TOGGLE: fixed clock time vs. flexible duration ===== -->
                <div class="form-row">
                    <div class="task-type-toggle" id="taskTypeToggle">
                        <button type="button" class="task-type-btn active" data-task-type="fixed" onclick="setTaskType('fixed')">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                            Fixed Time
                        </button>
                        <button type="button" class="task-type-btn" data-task-type="flexible" onclick="setTaskType('flexible')">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/></svg>
                            Flexible Duration
                        </button>
                    </div>
                </div>

                <div id="fixedTimeFields">
                    <div class="form-row">
                        <label style="display:block;margin-bottom:4px;font-size:0.85rem;color:var(--text-muted);">Link to Lesson Page</label>
                        <select id="linked-lesson-page" class="form-select">
                            ${getLessonPageOptions('')}
                        </select>
                    </div>
                    <!-- ===== RECURRENCE DROPDOWN ===== -->
                    <div class="form-row" id="recurrenceRow">
                        <label style="display:block;margin-bottom:4px;font-size:0.85rem;color:var(--text-muted);">Repeat</label>
                        <select id="recurrence" class="form-select" onchange="toggleRecurrenceCountUI(this.value)">
                            <option value="none">No Repeat</option>
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                        </select>
                    </div>

                    <!-- ===== RECURRENCE OCCURRENCE COUNT (inline) ===== -->
                    <div class="form-row" id="recurrenceCountRow" style="display:none;">
                        <label style="display:block;margin-bottom:4px;font-size:0.85rem;color:var(--text-muted);">How many occurrences?</label>
                        <input type="number" id="recurrenceCount" class="form-input" min="2" value="4" />
                    </div>

                    <!-- ===== DAY SELECTION ===== -->
                    <div class="form-row">
                        <label style="display:block;margin-bottom:4px;font-size:0.85rem;color:var(--text-muted);">Add to Days</label>
                        <div id="daySelection" style="display:flex;flex-wrap:wrap;gap:6px;">
                            ${DAYS.map(d => `
                                <label style="display:flex;align-items:center;gap:4px;font-size:0.8rem;cursor:pointer;background:var(--bg-primary);padding:4px 10px;border-radius:99px;border:1px solid var(--border-color);">
                                    <input type="checkbox" class="day-select" value="${d}" ${d === day ? 'checked' : ''}>
                                    ${d.slice(0,3)}
                                </label>
                            `).join('')}
                        </div>
                        <span style="font-size:0.65rem;color:var(--text-muted);margin-top:4px;">Select one or multiple days</span>
                    </div>

                    <div class="form-row time-picker-row">
                        ${buildTimePickerGroup('start', 'Start', to12Hour(defaults.startHour), defaults.startMin, parseInt(defaults.startHour) >= 12 ? 'PM' : 'AM')}
                        ${buildTimePickerGroup('end', 'End', to12Hour(defaults.endHour), defaults.endMin, parseInt(defaults.endHour) >= 12 ? 'PM' : 'AM')}
                    </div>

                    <!-- ===== DURATION QUICK-SET: sets End from Start + N minutes ===== -->
                    <div class="form-row duration-quickset">
                        <span class="duration-quickset-label">Quick duration:</span>
                        <button type="button" class="duration-quickset-btn" onclick="setDurationFromStart(30)">30m</button>
                        <button type="button" class="duration-quickset-btn" onclick="setDurationFromStart(60)">1h</button>
                        <button type="button" class="duration-quickset-btn" onclick="setDurationFromStart(90)">1h30</button>
                        <button type="button" class="duration-quickset-btn" onclick="setDurationFromStart(120)">2h</button>
                    </div>
                </div>

                <div id="flexibleDurationFields" style="display:none;">
                    <div class="form-row">
                        <label style="display:block;margin-bottom:4px;font-size:0.85rem;color:var(--text-muted);">How long does it need?</label>
                        <div style="display:flex;gap:8px;">
                            <input type="number" id="flexDurationHours" class="form-input" placeholder="Hours" min="0" max="23">
                            <input type="number" id="flexDurationMinutes" class="form-input" placeholder="Minutes" min="0" max="59">
                        </div>
                        <span style="font-size:0.65rem;color:var(--text-muted);margin-top:4px;display:block;">No fixed clock time — pick it up anytime from the Flexible Tasks card or the Timer page.</span>
                    </div>
                </div>

                <div id="modal-form-feedback" class="modal-form-feedback"></div>
                <div class="form-row form-actions">
                    <button type="submit" id="submitTaskBtn" class="btn-primary"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Add Task</button>
                    <button type="button" id="cancelEditBtn" class="btn-preset" style="display:none;" onclick="exitEditMode()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>Cancel</button>
                    <button type="button" class="btn-preset" onclick="injectPreset('study')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;"><path d="M12 3 2 9l10 6 10-6-10-6z"/><path d="M2 15l10 6 10-6"/></svg>Study</button>
                    <button type="button" class="btn-preset" onclick="injectPreset('break')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;"><path d="M4 9h12a3 3 0 0 1 0 6h-1"/><path d="M4 9v6a3 3 0 0 0 3 3h5a3 3 0 0 0 3-3V9"/></svg>Break</button>
                </div>
            </form>
        </div>
    `;
}

// Toggles between "Fixed Time" (a normal scheduleEvents entry) and
// "Flexible Duration" (a flexibleTasks entry, no clock time) — swaps which
// field group is visible and which button reads active.
function setTaskType(type) {
    const toggle = document.getElementById('taskTypeToggle');
    if (toggle) {
        toggle.querySelectorAll('.task-type-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.taskType === type);
        });
    }
    const fixedFields = document.getElementById('fixedTimeFields');
    const flexFields = document.getElementById('flexibleDurationFields');
    if (fixedFields) fixedFields.style.display = type === 'fixed' ? 'block' : 'none';
    if (flexFields) flexFields.style.display = type === 'flexible' ? 'block' : 'none';

    // Carry the duration across instead of losing it: if a start and end
    // were already dialed in on the Fixed side, pre-fill the Flexible
    // duration fields with that same length so switching the toggle
    // doesn't mean re-entering it from scratch.
    if (type === 'flexible') {
        const startMin = readWheelMinutes('start');
        const endMin = readWheelMinutes('end');
        if (startMin !== null && endMin !== null) {
            const duration = ((endMin - startMin) % 1440 + 1440) % 1440;
            if (duration > 0) {
                const hoursEl = document.getElementById('flexDurationHours');
                const minsEl = document.getElementById('flexDurationMinutes');
                if (hoursEl && !hoursEl.value) hoursEl.value = Math.floor(duration / 60) || '';
                if (minsEl && !minsEl.value) minsEl.value = duration % 60 || '';
            }
        }
    }

    const submitBtn = document.getElementById('submitTaskBtn');
    if (submitBtn) {
        submitBtn.innerHTML = type === 'flexible'
            ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Add Flexible Task'
            : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Add Task';
    }
    const feedback = document.getElementById('modal-form-feedback');
    if (feedback) feedback.innerHTML = '';
}
window.setTaskType = setTaskType;

function buildTimelineZone(dayEvents, todayName, currentHHMM, overlapMap) {
    return `
        <div class="modal-timeline-zone">
            <div class="timeline-header">
                <span>Timeline</span>
                <span class="timeline-count">${dayEvents.length} task${dayEvents.length !== 1 ? 's' : ''}</span>
            </div>
            <div class="timeline-list">
                ${dayEvents.length === 0 ? '<div class="timeline-empty">No tasks yet. Add one above.</div>' : ''}
                ${dayEvents.map(ev => buildTimelineItem(ev, todayName, currentHHMM, overlapMap.get(ev.id) || [])).join('')}
            </div>
        </div>
    `;
}

// ============================================================
// PLANNED VS ACTUAL — cross-references this task's scheduled duration
// against real elapsed time already logged by the Timer feature
// (completedSessions, from Simple Timer / Pomodoro / Task Focus), matched
// by title + same day. Purely additive: reads data the Timer feature
// already writes for its own purposes, writes nothing new.
// ============================================================
function getScheduledMinutes(ev) {
    const [sh, sm] = ev.start.split(':').map(Number);
    const [eh, em] = ev.end.split(':').map(Number);
    let mins = (eh * 60 + em) - (sh * 60 + sm);
    if (mins < 0) mins += 1440;
    return mins;
}

function getTodayActualMinutesForTitle(title) {
    try {
        const completedSessions = JSON.parse(localStorage.getItem('completedSessions') || '[]');
        const today = new Date().toDateString();
        // Trimmed + case-insensitive: "Physics" and "physics " (a slightly
        // different capitalization/spacing between the schedule task and
        // whatever the timer session got named) should still match rather
        // than silently showing no actual time at all.
        const normalizedTarget = String(title).trim().toLowerCase();
        let totalSec = 0;
        let found = false;
        completedSessions.forEach(s => {
            const normalizedName = String(s.taskName || '').trim().toLowerCase();
            if (normalizedName === normalizedTarget && new Date(s.timestamp).toDateString() === today) {
                totalSec += s.totalSeconds || 0;
                found = true;
            }
        });
        return found ? Math.round(totalSec / 60) : null;
    } catch (e) {
        return null;
    }
}

function formatMinutesShort(mins) {
    mins = Math.max(0, Math.round(mins));
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
}

function buildTimelineItem(ev, todayName, currentHHMM, overlaps) {
    const isPast = ev.day === todayName && ev.end < currentHHMM;
    const isNow = ev.day === todayName && ev.start <= currentHHMM && ev.end >= currentHHMM;
    const linkedPage = ev.linkedPageId && hubState?.pages?.[ev.linkedPageId];
    const safeTitle = escapeHtml(ev.title);
    const safeCategory = escapeHtml(ev.category || 'study');
    const safeOverlaps = overlaps.map(o => escapeHtml(o)).join(', ');
    const safeLinkedTitle = linkedPage ? escapeHtml(linkedPage.title) : '';
    const actualMinutes = ev.completed ? getTodayActualMinutesForTitle(ev.title) : null;
    let plannedVsActualHtml = '';
    if (actualMinutes !== null) {
        const plannedMinutes = getScheduledMinutes(ev);
        const ratio = plannedMinutes > 0 ? actualMinutes / plannedMinutes : 1;
        // Close to plan reads as neutral; meaningfully over or under gets a
        // color so the pattern is visible at a glance across a whole day,
        // not just readable one task at a time.
        let statusClass = 'on-track';
        if (ratio > 1.25) statusClass = 'ran-over';
        else if (ratio < 0.75) statusClass = 'finished-early';
        plannedVsActualHtml = `
        <div class="timeline-item-actual ${statusClass}" title="Time actually logged for this task today, from the Timer feature">
            Planned ${formatMinutesShort(plannedMinutes)} · Actual ${formatMinutesShort(actualMinutes)}
        </div>`;
    }
    return `
        <div class="timeline-item ${ev.completed ? 'completed' : ''} ${isNow ? 'active' : ''} ${isPast ? 'past' : ''}" data-event-id="${ev.id}" onclick="enterEditMode(${ev.id})" draggable="true">
            <div class="timeline-item-time">${escapeHtml(ev.start)} – ${escapeHtml(ev.end)}</div>
            <div class="timeline-item-title-wrap">
                <div class="timeline-item-title">${ev.completed ? '<svg class="wh-icon" style="margin-right:3px;width:13px;height:13px;color:var(--status-online,#10b981);" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' : ''}${safeTitle}</div>
                ${plannedVsActualHtml}
            </div>
            <span class="timeline-item-cat badge-${safeCategory}">${safeCategory.toUpperCase()}</span>
            ${overlaps.length > 0 ? `<span class="timeline-overlap-badge" title="Overlaps with: ${safeOverlaps}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/></svg></span>` : ''}
            ${linkedPage ? `<button class="timeline-btn lesson-link" onclick="event.stopPropagation(); openLinkedLesson('${ev.linkedPageId}')" title="Open linked lesson: ${safeLinkedTitle}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></button>` : ''}
            <div class="timeline-item-actions" onclick="event.stopPropagation();">
                <!-- Start Focus: launches Task Focus (Timer page) pre-loaded
                     with this exact schedule task and its remaining duration. -->
                <button class="timeline-btn timer-link" onclick="event.stopPropagation(); window.startFocusForTask(${ev.id}, 'schedule')" title="Start Focus Timer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/></svg></button>
                <button class="timeline-btn complete" onclick="event.stopPropagation(); toggleTaskComplete('${ev.id}', '${ev.day}')" title="${ev.completed ? 'Undo' : 'Complete'}">${ev.completed ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>' : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;"><polyline points="20 6 9 17 4 12"/></svg>'}</button>
                <button class="node-del-btn" onclick="event.stopPropagation(); deleteEvent(${ev.id})">Remove</button>
            </div>
        </div>
    `;
}

function openLinkedLesson(pageId) {
    if (typeof hubState === 'undefined' || !hubState) return;
    hubState.activePageId = pageId;
    saveHubState();
    closeDayDiagram();
    switchView('lessons-view');
    if (typeof refreshWorkspace === 'function') refreshWorkspace();
}

// ----- Select a task from the timeline -----
function selectTimelineTask(eventId, day) {
    // Remove previous selection
    const prevSelected = document.querySelector('.timeline-item.selected');
    if (prevSelected) prevSelected.classList.remove('selected');

    // Add selection to clicked item
    const selectedItem = document.querySelector(`.timeline-item[data-event-id="${eventId}"]`);
    if (selectedItem) {
        selectedItem.classList.add('selected');

        // Find the event data
        const event = events.find(e => e.id === eventId);
        if (event) {
            console.log('Selected task:', event.title);

            // Scroll to the form and populate it with the task data
            const form = document.getElementById('modalScheduleForm');
            if (form) {
                // Populate title
                const titleInput = document.getElementById('title');
                if (titleInput) titleInput.value = event.title;

                // Populate category
                const categorySelect = document.getElementById('category');
                if (categorySelect) categorySelect.value = event.category || 'study';

                // Populate times
                const startHour = document.getElementById('startHour');
                const startMin = document.getElementById('startMin');
                const startAmPm = document.getElementById('startAmPm');
                const endHour = document.getElementById('endHour');
                const endMin = document.getElementById('endMin');
                const endAmPm = document.getElementById('endAmPm');

                if (startHour && startMin && startAmPm) {
                    const startTime = convert24To12Hour(event.start);
                    startHour.value = startTime.hour;
                    startMin.value = startTime.minute;
                    startAmPm.value = startTime.ampm;
                }

                if (endHour && endMin && endAmPm) {
                    const endTime = convert24To12Hour(event.end);
                    endHour.value = endTime.hour;
                    endMin.value = endTime.minute;
                    endAmPm.value = endTime.ampm;
                }

                // Refresh wheel pickers
                if (typeof refreshWheelDisplay === 'function') {
                    refreshWheelDisplay('start');
                    refreshWheelDisplay('end');
                }

                // Scroll to form
                form.scrollIntoView({ behavior: 'smooth', block: 'start' });

                showToast(`Editing: ${event.title}`, 'info');
            }
        }
    }
}

// ============================================================
// EDIT MODE — enter / exit
// ============================================================

// Enter edit mode for an existing event: populate the form and switch the UI.
function enterEditMode(id) {
    const ev = events.find(e => e.id === id);
    if (!ev) return;

    // Populate title, category, and start/end wheels (existing helper)
    selectTimelineTask(id, ev.day);

    // Fields selectTimelineTask does not populate:
    const linkedSelect = document.getElementById('linked-lesson-page');
    if (linkedSelect) linkedSelect.value = ev.linkedPageId || '';
    const recurrenceSelect = document.getElementById('recurrence');
    if (recurrenceSelect) recurrenceSelect.value = 'none';
    if (typeof toggleRecurrenceCountUI === 'function') toggleRecurrenceCountUI('none');

    // Day checkboxes = single "move to day": check only this event's day
    document.querySelectorAll('.day-select').forEach(cb => {
        cb.checked = (cb.value === ev.day);
    });

    window.editingEventId = id;

    // Switch UI into edit mode
    const submitBtn = document.getElementById('submitTaskBtn');
    if (submitBtn) submitBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>Update Task';
    const cancelBtn = document.getElementById('cancelEditBtn');
    if (cancelBtn) cancelBtn.style.display = '';
    // Recurrence is a single-occurrence concept while editing — hide it
    const recurrenceRow = document.getElementById('recurrenceRow');
    if (recurrenceRow) recurrenceRow.style.display = 'none';
    const recurrenceCountRow = document.getElementById('recurrenceCountRow');
    if (recurrenceCountRow) recurrenceCountRow.style.display = 'none';
}

// Exit edit mode: rebuild the form to a clean Add state (clears edited values).
function exitEditMode() {
    window.editingEventId = null;
    if (currentOpenDay) openDayDiagram(currentOpenDay);
}

// Show/hide the recurrence occurrence-count field based on the recurrence value.
function toggleRecurrenceCountUI(value) {
    const row = document.getElementById('recurrenceCountRow');
    if (!row) return;
    row.style.display = (value && value !== 'none') ? '' : 'none';
}


// ----- Helper: Convert 24-hour time to 12-hour format -----
function convert24To12Hour(time24) {
    const [hour24, minute] = time24.split(':').map(Number);
    const ampm = hour24 >= 12 ? 'PM' : 'AM';
    const hour12 = hour24 % 12 || 12;
    return {
        hour: String(hour12).padStart(2, '0'),
        minute: String(minute).padStart(2, '0'),
        ampm: ampm
    };
}

// Convert 12-hour time string (e.g. "09:15 PM") to 24-hour format (e.g. "21:15")
function formatTime24h(time12) {
    if (!time12) return '';
    const match = time12.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return time12; // fallback: return as-is if format doesn't match
    let hour = parseInt(match[1], 10);
    const minute = match[2];
    const ampm = match[3].toUpperCase();
    if (ampm === 'PM' && hour !== 12) hour += 12;
    if (ampm === 'AM' && hour === 12) hour = 0;
    return `${String(hour).padStart(2, '0')}:${minute}`;
}

function ensurePlannerModalShell() {
    let modal = document.getElementById('diagramModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'diagramModal';
    modal.className = 'diagram-modal';
    modal.addEventListener('click', (e) => { if (e.target === modal) closeDayDiagram(); });
    document.body.appendChild(modal);
    document.addEventListener('keydown', handlePlannerKeydown);
    attachPlannerSwipeHandlers(modal);
    return modal;
}

function handlePlannerKeydown(e) {
    const modal = document.getElementById('diagramModal');
    if (!modal || modal.style.display !== 'flex' || !currentOpenDay) return;
    if (e.key === 'Escape') { e.preventDefault(); closeDayDiagram(); return; }
    const active = document.activeElement;
    const editing = active && modal.contains(active) && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT' || active.isContentEditable);
    if (editing) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); openDayDiagram(getAdjacentDay(currentOpenDay, -1)); }
    if (e.key === 'ArrowRight') { e.preventDefault(); openDayDiagram(getAdjacentDay(currentOpenDay, 1)); }

    // Undo/Redo — the buttons work standalone, but Ctrl+Z is what people
    // reach for first. Ctrl+Y as an alternate redo binding since that's
    // the Windows-convention muscle memory some people have instead of
    // Ctrl+Shift+Z.
    const cmd = e.ctrlKey || e.metaKey;
    if (cmd && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (typeof undo === 'function') undo();
    } else if (cmd && ((e.key.toLowerCase() === 'z' && e.shiftKey) || e.key.toLowerCase() === 'y')) {
        e.preventDefault();
        if (typeof redo === 'function') redo();
    }
}

function attachPlannerSwipeHandlers(modal) {
    if (modal.dataset.swipeBound === '1') return;
    modal.dataset.swipeBound = '1';
    const state = { startX: 0, startY: 0, tracking: false };
    modal.addEventListener('touchstart', (e) => {
        if (modal.style.display !== 'flex' || e.touches.length !== 1) return;
        state.startX = e.touches[0].clientX;
        state.startY = e.touches[0].clientY;
        state.tracking = true;
    }, { passive: true });
    modal.addEventListener('touchend', (e) => {
        if (!state.tracking || !currentOpenDay) return;
        state.tracking = false;
        const dx = e.changedTouches[0].clientX - state.startX;
        const dy = e.changedTouches[0].clientY - state.startY;
        if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
        if (dx > 0) openDayDiagram(getAdjacentDay(currentOpenDay, -1));
        else openDayDiagram(getAdjacentDay(currentOpenDay, 1));
    }, { passive: true });
}

// Total scheduled minutes for a day — used for the density bar on each
// nav pill, a quick visual read on how packed a day already is before
// opening it.
function getDayScheduledMinutes(day) {
    return events.filter(e => e.day === day).reduce((sum, e) => {
        const [sh, sm] = e.start.split(':').map(Number);
        const [eh, em] = e.end.split(':').map(Number);
        let mins = (eh * 60 + em) - (sh * 60 + sm);
        if (mins < 0) mins += 1440;
        return sum + mins;
    }, 0);
}

function handleCopyDayClick(sourceDay) {
    const select = document.getElementById('copyDayTarget');
    const target = select?.value;
    if (!target) {
        showToast('Pick a day to copy to first', 'warning');
        return;
    }
    if (target === '__ALL__') {
        if (typeof copyDayToMultiple === 'function') {
            copyDayToMultiple(sourceDay, DAYS.filter(d => d !== sourceDay));
        }
    } else {
        copyDayTo(sourceDay, target);
    }
    if (select) select.value = '';
}
window.handleCopyDayClick = handleCopyDayClick;

function buildPlannerDayNav(day) {
    const { todayName } = getTimeMetrics();
    const prev = getAdjacentDay(day, -1);
    const next = getAdjacentDay(day, 1);
    const pills = DAYS.map(d => {
        const count = getDayEventCount(d);
        const active = d === day;
        const today = d === todayName;
        // 12h (720min) reads as "fully packed" for the density bar — an
        // approximation, not a hard cap.
        const densityPct = Math.min(100, Math.round((getDayScheduledMinutes(d) / 720) * 100));
        return `<button class="day-nav-pill ${active ? 'active' : ''} ${today ? 'today' : ''}" onclick="openDayDiagram('${d}')"><span class="pill-name">${d.slice(0,3)}</span>${count > 0 ? `<span class="pill-count">${count}</span>` : ''}${densityPct > 0 ? `<span class="pill-density" style="width:${densityPct}%"></span>` : ''}</button>`;
    }).join('');
    return `
        <div class="planner-nav-bar">
            <div class="planner-nav-controls">
                <button class="day-nav-arrow" onclick="openDayDiagram('${prev}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;"><polyline points="15 18 9 12 15 6"/></svg><span class="arrow-label">${prev}</span></button>
                <button class="day-nav-today" onclick="openDayDiagram('${todayName}')" ${day === todayName ? 'disabled' : ''}>Jump to Today</button>
                <button class="day-nav-arrow" onclick="openDayDiagram('${next}')"><span class="arrow-label">${next}</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;"><polyline points="9 18 15 12 9 6"/></svg></button>
                <div class="planner-copy-day">
                    <select id="copyDayTarget" title="Copy ${day}'s tasks to another day">
                        <option value="">Copy to…</option>
                        ${DAYS.filter(d => d !== day).map(d => `<option value="${d}">${d}</option>`).join('')}
                        <option value="__ALL__">— All other days —</option>
                    </select>
                    <button type="button" class="day-nav-copy-btn" onclick="handleCopyDayClick('${day}')" title="Copy this day's tasks">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    </button>
                    <button type="button" id="undo-btn" class="day-nav-copy-btn" onclick="undo()" title="Undo last change" disabled>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>
                    </button>
                    <button type="button" id="redo-btn" class="day-nav-copy-btn" onclick="redo()" title="Redo" disabled>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;"><path d="m15 14 5-5-5-5"/><path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5 5.5 5.5 0 0 0 9.5 20H13"/></svg>
                    </button>
                </div>
            </div>
            <div class="day-nav-strip">${pills}</div>
            <p class="planner-nav-hint">Use ← → arrow keys · Ctrl+Z to undo · Esc to close</p>
        </div>
    `;
}

// ============================================================
// MODAL FORM SUBMIT — With validation + recurrence
// ============================================================

function handleModalSubmit(e, day) {
    e.preventDefault();

    // ─── Flexible Duration branch: skip all fixed-time/day logic below,
    // this is a duration-only task with no clock slot ──────────────────
    const activeType = document.querySelector('#taskTypeToggle .task-type-btn.active')?.dataset.taskType;
    if (activeType === 'flexible') {
        const titleEl = document.getElementById('title');
        const title = (titleEl?.value || '').trim();
        const hours = parseInt(document.getElementById('flexDurationHours')?.value, 10) || 0;
        const minutes = parseInt(document.getElementById('flexDurationMinutes')?.value, 10) || 0;
        const totalMinutes = hours * 60 + minutes;
        if (!title) {
            showToast('Give the task a name first', 'error');
            return;
        }
        if (totalMinutes <= 0) {
            showToast('Set how long it needs', 'error');
            return;
        }
        if (typeof createFlexibleTask !== 'function') {
            showToast('Flexible tasks are not available right now', 'error');
            return;
        }
        createFlexibleTask(title, totalMinutes);
        showToast('Flexible task added — find it on the Schedule page or Timer page', 'success');
        closeDayDiagram();
        return;
    }

    // ─── Get selected days ──────────────────────────────
    const dayCheckboxes = document.querySelectorAll('.day-select:checked');
    const selectedDays = Array.from(dayCheckboxes).map(el => el.value);

    if (selectedDays.length === 0) {
        showToast('Please select at least one day.', 'error');
        return;
    }

    // ─── Get wheel times ────────────────────────────────
    const startTime = getWheelTime('start');
    const endTime = getWheelTime('end');

    const startHour = startTime.hour;
    const startMin = startTime.minute;
    const startAmPm = startTime.ampm;

    const endHour = endTime.hour;
    const endMin = endTime.minute;
    const endAmPm = endTime.ampm;

    if (!startHour || !startMin || !endHour || !endMin) {
        showToast('Please select both start and end times.', 'error');
        return;
    }

    const start24 = formatTime24h(`${startHour}:${startMin} ${startAmPm}`);
    const end24 = formatTime24h(`${endHour}:${endMin} ${endAmPm}`);

    if (start24 === end24) {
        showToast('Start and end times cannot be the same.', 'error');
        return;
    }

    const title = document.getElementById('title')?.value?.trim();
    if (!title) {
        showToast('Please enter a task title.', 'error');
        return;
    }

    const category = document.getElementById('category')?.value || 'study';
    const linkedPageId = document.getElementById('linked-lesson-page')?.value || '';
    const recurrence = document.getElementById('recurrence')?.value || 'none';

    // ─── EDIT MODE: update the existing event in place ──────
    if (window.editingEventId != null) {
        const idx = events.findIndex(ev => ev.id === window.editingEventId);
        if (idx === -1) {
            showToast('Task not found.', 'error');
            window.editingEventId = null;
            return;
        }
        saveStateForUndo();
        const targetDay = selectedDays[0]; // "move to one day"; extras ignored
        events[idx] = {
            ...events[idx],          // preserve notes, link, color, reminder*, completed, weekId, id
            title,
            category,
            start: start24,
            end: end24,
            day: targetDay,
            linkedPageId: linkedPageId || undefined,
            recurrence: null
        };
        saveEvents();
        renderSchedule();
        window.editingEventId = null;
        openDayDiagram(targetDay);   // rebuilds form -> back to Add mode
        showToast('Task updated', 'success');
        return;
    }

    // ─── Prepare base event data ────────────────────────
    const currentWeekId = getWeekId(new Date());
    const baseEvent = {
        title,
        category,
        start: start24,
        end: end24,
        completed: false,
        notes: '',
        link: '',
        color: 'default',
        reminderEnabled: false,
        reminderMinutes: 15,
        reminderShown: false,
        linkedPageId: linkedPageId || undefined,
        recurrence: null,  // We'll handle recurrence per day only if single day selected
        weekId: currentWeekId
    };

    saveStateForUndo();

    // ─── Create events for each selected day ────────────
    selectedDays.forEach((selectedDay, index) => {
        const event = {
            ...baseEvent,
            id: Date.now() + index,
            day: selectedDay
        };

        // Apply recurrence only if exactly one day selected
        if (selectedDays.length === 1 && recurrence !== 'none') {
            event.recurrence = recurrence;
        }

        events.push(event);
    });

    // ─── Handle recurrence for single day ──────────────
    if (selectedDays.length === 1 && recurrence !== 'none') {
        const count = parseInt(document.getElementById('recurrenceCount')?.value, 10);
        if (!Number.isNaN(count) && count > 1) {
            const baseDay = selectedDays[0];
            const baseDayIndex = DAYS.indexOf(baseDay);
            const lastEvent = events[events.length - 1]; // the base event we just added

            for (let i = 1; i < count; i++) {
                const newEventCopy = { ...lastEvent, id: Date.now() + i };
                // Override day based on recurrence type
                if (recurrence === 'daily') {
                    const d = new Date();
                    d.setDate(d.getDate() + i);
                    newEventCopy.day = d.toLocaleDateString('en-US', { weekday: 'long' });
                } else if (recurrence === 'weekly') {
                    const d = new Date();
                    d.setDate(d.getDate() + (i * 7));
                    newEventCopy.day = d.toLocaleDateString('en-US', { weekday: 'long' });
                } else if (recurrence === 'monthly') {
                    const d = new Date();
                    d.setMonth(d.getMonth() + i);
                    newEventCopy.day = d.toLocaleDateString('en-US', { weekday: 'long' });
                }
                events.push(newEventCopy);
            }
        } else {
            showToast('Occurrences must be at least 2.', 'warning');
        }
    }

    saveEvents();
    renderSchedule();

    // Re‑open the diagram on the first selected day to refresh the timeline
    openDayDiagram(selectedDays[0]);
    showToast(`Task added to ${selectedDays.length} day${selectedDays.length > 1 ? 's' : ''}!`, 'success');
}

// ============================================================
// ADJACENT DAY HELPER
// ============================================================

function getAdjacentDay(currentDay, direction) {
    const currentIndex = DAYS.indexOf(currentDay);
    if (currentIndex === -1) return DAYS[0];

    let newIndex = currentIndex + direction;

    // Wrap around if we go past the array bounds
    if (newIndex < 0) {
        newIndex = DAYS.length - 1;
    } else if (newIndex >= DAYS.length) {
        newIndex = 0;
    }

    return DAYS[newIndex];
}

function getDayEventCount(day) {
    return events.filter(e => e.day === day).length;
}

// ============================================================
// OVERLAP MAP HELPER
// ============================================================

function getOverlapMap(dayEvents) {
    const overlapMap = new Map();

    for (let i = 0; i < dayEvents.length; i++) {
        for (let j = i + 1; j < dayEvents.length; j++) {
            const eventA = dayEvents[i];
            const eventB = dayEvents[j];

            // Check if events overlap
            if (eventA.start < eventB.end && eventB.start < eventA.end) {
                // Add B to A's overlaps
                if (!overlapMap.has(eventA.id)) {
                    overlapMap.set(eventA.id, []);
                }
                overlapMap.get(eventA.id).push(eventB.title);

                // Add A to B's overlaps
                if (!overlapMap.has(eventB.id)) {
                    overlapMap.set(eventB.id, []);
                }
                overlapMap.get(eventB.id).push(eventA.title);
            }
        }
    }

    return overlapMap;
}

// ============================================================
// DEFAULT WHEEL TIMES
// ============================================================

function getDefaultWheelTimes() {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = String(now.getMinutes()).padStart(2, '0');

    // Default start time: current time
    const startHour = currentHour;
    const startMin = currentMinute;

    // Default end time: 1 hour from now
    let endHour = (currentHour + 1) % 24;
    const endMin = currentMinute;

    return {
        startHour: String(startHour).padStart(2, '0'),
        startMin: startMin,
        endHour: String(endHour).padStart(2, '0'),
        endMin: endMin
    };
}

// ============================================================
// PRESET INJECTION
// ============================================================

function injectPreset(type) {
    const now = new Date();
    let h = now.getHours();
    const m = String(now.getMinutes()).padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = String(h % 12 || 12).padStart(2, '0');

    // Set start time
    document.getElementById('startHour').value = h12;
    document.getElementById('startMin').value = m;
    document.getElementById('startAmPm').value = ampm;

    // Refresh wheel display
    refreshWheelDisplay('start');

    if (type === 'study') {
        document.getElementById('title').value = 'Subject Core Review';
        document.getElementById('category').value = 'study';
        const endH = (h + 1) % 24;
        const endAmpm = endH >= 12 ? 'PM' : 'AM';
        const endH12 = String(endH % 12 || 12).padStart(2, '0');
        document.getElementById('endHour').value = endH12;
        document.getElementById('endMin').value = m;
        document.getElementById('endAmPm').value = endAmpm;
        refreshWheelDisplay('end');
    } else if (type === 'break') {
        document.getElementById('title').value = 'Break Time';
        document.getElementById('category').value = 'personal';
        let endM = now.getMinutes() + 15;
        let endH = h;
        let endAmpm2 = ampm;
        if (endM >= 60) {
            endM -= 60;
            endH += 1;
            endAmpm2 = endH >= 12 ? 'PM' : 'AM';
        }
        const endH12_2 = String(endH % 12 || 12).padStart(2, '0');
        document.getElementById('endHour').value = endH12_2;
        document.getElementById('endMin').value = String(endM).padStart(2, '0');
        document.getElementById('endAmPm').value = endAmpm2;
        refreshWheelDisplay('end');
    }

    const form = document.getElementById('modalScheduleForm');
    const day = form?.dataset.plannerDay || currentOpenDay;
    if (day) updateModalFormFeedback(day);
}

// Sets one wheel (start or end) from a raw minutes-since-midnight value,
// wrapping across midnight, then refreshes both the wheel display and the
// conflict-check feedback — the shared plumbing behind the duration
// quick-set buttons and the one-click conflict resolution buttons below.
function applyWheelMinutes(prefix, totalMinRaw) {
    const totalMin = ((totalMinRaw % 1440) + 1440) % 1440;
    const h24 = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    const ampm = h24 >= 12 ? 'PM' : 'AM';
    const h12 = String(h24 % 12 || 12).padStart(2, '0');
    const hourEl = document.getElementById(`${prefix}Hour`);
    const minEl = document.getElementById(`${prefix}Min`);
    const ampmEl = document.getElementById(`${prefix}AmPm`);
    if (!hourEl || !minEl || !ampmEl) return;
    hourEl.value = h12;
    minEl.value = String(m).padStart(2, '0');
    ampmEl.value = ampm;
    refreshWheelDisplay(prefix);
    const form = document.getElementById('modalScheduleForm');
    const day = form?.dataset.plannerDay || currentOpenDay;
    if (day) updateModalFormFeedback(day);
}

// Reads a wheel's current value as minutes-since-midnight, or null if
// nothing's set yet.
function readWheelMinutes(prefix) {
    const h = document.getElementById(`${prefix}Hour`)?.value;
    const m = document.getElementById(`${prefix}Min`)?.value;
    const ampm = document.getElementById(`${prefix}AmPm`)?.value;
    if (!h || !m || !ampm) return null;
    let h24 = parseInt(h, 10) % 12;
    if (ampm === 'PM') h24 += 12;
    return h24 * 60 + parseInt(m, 10);
}

// Duration-first entry: set just the start time, then click "+1h" etc.
// instead of dialing in the end wheel separately.
function setDurationFromStart(minutesToAdd) {
    const startMin = readWheelMinutes('start');
    if (startMin === null) {
        if (typeof showToast === 'function') showToast('Set a start time first', 'warning');
        return;
    }
    applyWheelMinutes('end', startMin + minutesToAdd);
}
window.setDurationFromStart = setDurationFromStart;

// One-click conflict resolution — called from the buttons
// updateModalFormFeedback() renders next to an overlap warning.
function resolveConflictShift(conflictEndTime24) {
    const startMin = readWheelMinutes('start');
    const endMin = readWheelMinutes('end');
    if (startMin === null || endMin === null) return;
    const duration = ((endMin - startMin) % 1440 + 1440) % 1440;
    const [ceH, ceM] = conflictEndTime24.split(':').map(Number);
    const newStart = ceH * 60 + ceM;
    applyWheelMinutes('start', newStart);
    applyWheelMinutes('end', newStart + duration);
    if (typeof showToast === 'function') showToast('Shifted to start right after the conflict', 'info');
}
window.resolveConflictShift = resolveConflictShift;

function resolveConflictShrink(conflictStartTime24) {
    const [csH, csM] = conflictStartTime24.split(':').map(Number);
    applyWheelMinutes('end', csH * 60 + csM);
    if (typeof showToast === 'function') showToast('Shortened to end before the conflict', 'info');
}
window.resolveConflictShrink = resolveConflictShrink;

// Scans the whole day's existing events for the first gap (from
// searchFromMinutes onward) big enough to fit durationMinutes — smarter
// than just jumping past the one conflicting task, which on a busy day
// could just land you in a second conflict right after the first.
function findNextFreeSlot(day, durationMinutes, searchFromMinutes) {
    const dayEvents = events
        .filter(e => e.day === day && e.id !== (window.editingEventId ?? null))
        .map(e => {
            const [sh, sm] = e.start.split(':').map(Number);
            const [eh, em] = e.end.split(':').map(Number);
            return { start: sh * 60 + sm, end: eh * 60 + em };
        })
        .sort((a, b) => a.start - b.start);

    let candidate = searchFromMinutes;
    for (const ev of dayEvents) {
        if (candidate + durationMinutes <= ev.start) return candidate;
        if (candidate < ev.end) candidate = ev.end;
    }
    return (candidate + durationMinutes <= 1440) ? candidate : null;
}

function resolveConflictFindSlot(day) {
    const startMin = readWheelMinutes('start');
    const endMin = readWheelMinutes('end');
    if (startMin === null || endMin === null) return;
    const duration = ((endMin - startMin) % 1440 + 1440) % 1440;
    const slot = findNextFreeSlot(day, duration, startMin);
    if (slot === null) {
        if (typeof showToast === 'function') showToast("No free gap that size left today — try a different day", 'warning');
        return;
    }
    applyWheelMinutes('start', slot);
    applyWheelMinutes('end', slot + duration);
    if (typeof showToast === 'function') showToast('Moved to the next open slot that fits', 'info');
}
window.resolveConflictFindSlot = resolveConflictFindSlot;

function refreshWheelDisplay(prefix) {
    const hourVal = document.getElementById(`${prefix}Hour`).value;
    const minVal = document.getElementById(`${prefix}Min`).value;
    const ampmVal = document.getElementById(`${prefix}AmPm`).value;

    const wheel = document.querySelector(`.time-picker-wheel[data-time-prefix="${prefix}"]`);
    if (!wheel) return;

    wheel.querySelectorAll('.wheel-scroll').forEach(scroll => {
        const type = scroll.dataset.wheelType;
        const targetValue = type === 'hour' ? hourVal : type === 'minute' ? minVal : ampmVal;
        const items = scroll.querySelectorAll('.wheel-item');
        const targetIndex = Array.from(items).findIndex(item => item.dataset.value === targetValue);
        if (targetIndex >= 0) {
            scroll.scrollTo({
                top: targetIndex * 40,
                behavior: 'smooth'
            });
        }
    });
}

function setTimePickerValue(prefix, hour, minute, ampm) {
    const hourEl = document.querySelector(`[data-prefix="${prefix}"][data-type="hour"]`);
    const minEl = document.querySelector(`[data-prefix="${prefix}"][data-type="minute"]`);
    const ampmEl = document.querySelector(`[data-prefix="${prefix}"][data-type="ampm"]`);
    if (hourEl) hourEl.value = hour;
    if (minEl) minEl.value = minute;
    if (ampmEl) ampmEl.value = ampm;
}

// ============================================================
// SCHEDULE VIEW KEYBOARD NAVIGATION
// ============================================================

function initScheduleKeyboardNav() {
    if (window._scheduleKbdBound) return;
    window._scheduleKbdBound = true;

    document.addEventListener('keydown', (e) => {
        // Only when Schedule view is active
        const scheduleView = document.getElementById('schedule-view');
        if (!scheduleView || !scheduleView.classList.contains('active')) return;

        // Don't hijack typing
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT' || active.isContentEditable)) return;

        // Don't conflict with the open day diagram modal (handled separately)
        const modal = document.getElementById('diagramModal');
        if (modal && modal.style.display === 'flex') return;

        if (e.key >= '1' && e.key <= '7') {
            e.preventDefault();
            const idx = parseInt(e.key, 10) - 1;
            if (DAYS[idx]) openDayDiagram(DAYS[idx]);
        } else if (e.key === 't' || e.key === 'T') {
            e.preventDefault();
            jumpToTodaySchedule();
        }
    });

    // Auto-scroll to today when entering the Schedule view (once per visit)
    document.addEventListener('viewChanged', (e) => {
        if (e?.detail?.viewId !== 'schedule-view') return;
        const todayBox = document.getElementById("todayDayBox");
        if (todayBox) todayBox.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    });
}

// Expose functions to global scope
window.renderScheduleQuickNav = renderScheduleQuickNav;
window.jumpToTodaySchedule = jumpToTodaySchedule;
window.addTaskToday = addTaskToday;
window.initScheduleKeyboardNav = initScheduleKeyboardNav;
window.openDayDiagram = openDayDiagram;
window.getDefaultWheelTimes = getDefaultWheelTimes;
window.getOverlapMap = getOverlapMap;
window.getAdjacentDay = getAdjacentDay;
window.getDayEventCount = getDayEventCount;
window.selectTimelineTask = selectTimelineTask;
window.enterEditMode = enterEditMode;
window.exitEditMode = exitEditMode;
window.toggleRecurrenceCountUI = toggleRecurrenceCountUI;
window.convert24To12Hour = convert24To12Hour;
window.handleModalSubmit = handleModalSubmit;
window.formatTime24h = formatTime24h;
window.injectPreset = injectPreset;
window.refreshWheelDisplay = refreshWheelDisplay;
window.buildPlannerDayNav = buildPlannerDayNav;
