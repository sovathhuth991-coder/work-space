﻿﻿﻿﻿﻿// This file contains the main schedule renderer and day diagram logic.

function renderSchedule() {
    autoCompletePastEvents();
    const calendar = document.getElementById("calendar");
    if (!calendar) return;
    calendar.innerHTML = "";
    const { todayName, currentHHMM, currentDayIndex } = getTimeMetrics();
    DAYS.forEach((day, index) => {
        const dayBox = document.createElement("div");
        dayBox.className = "day";
        if (day === todayName) dayBox.classList.add("today-highlight");
        dayBox.setAttribute("onclick", `openDayDiagram('${day}')`);
        dayBox.addEventListener("contextmenu", (e) => { e.preventDefault(); e.stopPropagation(); showContextMenu(e, day); });
        const dayEvents = events.filter(e => e.day === day);
        const eventCount = dayEvents.length;
        const hasOverlaps = dayHasTimeOverlaps(dayEvents);
        let progress = 0;
        if (eventCount > 0) {
            const done = dayEvents.filter(e => e.completed).length;
            progress = Math.round((done / eventCount) * 100);
        }
        dayBox.innerHTML = `
            <h3>${day} ${day === todayName ? '⭐️' : ''}</h3>
            <div class="day-summary">
                <span class="pulse-dot"></span>
                ${eventCount} ${eventCount === 1 ? 'Task' : 'Tasks'} Scheduled
                ${hasOverlaps ? '<span class="day-overlap-flag">⚠ Time conflict</span>' : ''}
            </div>
            <div class="mini-preview-list">
                ${dayEvents.slice(0, 3).map(ev => `<div class="mini-dot color-${escapeHtml(ev.category || 'study')} ${ev.completed ? 'mini-done' : ''}">▪️ ${escapeHtml(ev.title)}</div>`).join('')}
                ${eventCount > 3 ? '<div class="mini-dot extra">...and more</div>' : ''}
            </div>
            <div class="progress-track"><div class="progress-bar" style="width: ${progress}%"></div></div>
        `;
        calendar.appendChild(dayBox);
    });
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
    }, 100);

    if (typeof addTemplateUI === 'function') addTemplateUI(day);
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
            <button class="modal-close-btn" onclick="closeDayDiagram()">✕</button>
            <span class="modal-header-title">${day}</span>
            ${conflictCount > 0 ? `<span class="modal-conflict-badge">⚠ ${conflictCount} conflict${conflictCount > 1 ? 's' : ''}</span>` : ''}
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
                        <option value="study">📚 Study</option>
                        <option value="work">💼 Work</option>
                        <option value="personal">🧘 Personal</option>
                        <option value="fitness">🏋️ Fitness</option>
                        <option value="social">🎉 Social</option>
                        <option value="other">📌 Other</option>
                    </select>
                </div>
                <div class="form-row">
                    <label style="display:block;margin-bottom:4px;font-size:0.85rem;color:var(--text-muted);">🔗 Link to Lesson Page</label>
                    <select id="linked-lesson-page" class="form-select">
                        ${getLessonPageOptions('')}
                    </select>
                </div>
                <!-- ===== RECURRENCE DROPDOWN ===== -->
                <div class="form-row">
                    <label style="display:block;margin-bottom:4px;font-size:0.85rem;color:var(--text-muted);">🔄 Repeat</label>
                    <select id="recurrence" class="form-select">
                        <option value="none">No Repeat</option>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                    </select>
                </div>

                <!-- ===== NEW: DAY SELECTION ===== -->
                <div class="form-row">
                    <label style="display:block;margin-bottom:4px;font-size:0.85rem;color:var(--text-muted);">📅 Add to Days</label>
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
                <div id="modal-form-feedback" class="modal-form-feedback"></div>
                <div class="form-row form-actions">
                    <button type="submit" class="btn-primary">➕ Add Task</button>
                    <button type="button" class="btn-preset" onclick="injectPreset('study')">🧠 Study</button>
                    <button type="button" class="btn-preset" onclick="injectPreset('break')">☕ Break</button>
                </div>
            </form>
        </div>
    `;
}

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

function buildTimelineItem(ev, todayName, currentHHMM, overlaps) {
    const isPast = ev.day === todayName && ev.end < currentHHMM;
    const isNow = ev.day === todayName && ev.start <= currentHHMM && ev.end >= currentHHMM;
    const linkedPage = ev.linkedPageId && hubState?.pages?.[ev.linkedPageId];
    const safeTitle = escapeHtml(ev.title);
    const safeCategory = escapeHtml(ev.category || 'study');
    const safeOverlaps = overlaps.map(o => escapeHtml(o)).join(', ');
    const safeLinkedTitle = linkedPage ? escapeHtml(linkedPage.title) : '';
    return `
        <div class="timeline-item ${ev.completed ? 'completed' : ''} ${isNow ? 'active' : ''} ${isPast ? 'past' : ''}" data-event-id="${ev.id}" onclick="selectTimelineTask(${ev.id}, '${ev.day}')" draggable="true">
            <div class="timeline-item-time">${escapeHtml(ev.start)} – ${escapeHtml(ev.end)}</div>
            <div class="timeline-item-title">${ev.completed ? '✅ ' : ''}${safeTitle}</div>
            <span class="timeline-item-cat badge-${safeCategory}">${safeCategory.toUpperCase()}</span>
            ${overlaps.length > 0 ? `<span class="timeline-overlap-badge" title="Overlaps with: ${safeOverlaps}">⚠</span>` : ''}
            ${linkedPage ? `<button class="timeline-btn lesson-link" onclick="event.stopPropagation(); openLinkedLesson('${ev.linkedPageId}')" title="Open linked lesson: ${safeLinkedTitle}">📄</button>` : ''}
            <div class="timeline-item-actions" onclick="event.stopPropagation();">
                <!-- ===== TIMER BUTTON (uses startTimerWithTask) ===== -->
                <button class="timeline-btn timer-link" onclick="event.stopPropagation(); startTimerWithTask('${safeTitle.replace(/'/g, "\\'")}', '${ev.start}', '${ev.end}')" title="Start Focus Timer">⏱</button>
                <button class="timeline-btn complete" onclick="event.stopPropagation(); toggleTaskComplete('${ev.id}', '${ev.day}')" title="${ev.completed ? 'Undo' : 'Complete'}">${ev.completed ? '↩' : '✓'}</button>
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
            console.log('📋 Selected task:', event.title);

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

                showToast(`✏️ Editing: ${event.title}`, 'info');
            }
        }
    }
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

function buildPlannerDayNav(day) {
    const { todayName } = getTimeMetrics();
    const prev = getAdjacentDay(day, -1);
    const next = getAdjacentDay(day, 1);
    const pills = DAYS.map(d => {
        const count = getDayEventCount(d);
        const active = d === day;
        const today = d === todayName;
        return `<button class="day-nav-pill ${active ? 'active' : ''} ${today ? 'today' : ''}" onclick="openDayDiagram('${d}')"><span class="pill-name">${d.slice(0,3)}</span>${count > 0 ? `<span class="pill-count">${count}</span>` : ''}</button>`;
    }).join('');
    return `
        <div class="planner-nav-bar">
            <div class="planner-nav-controls">
                <button class="day-nav-arrow" onclick="openDayDiagram('${prev}')"><span class="arrow-icon">←</span><span class="arrow-label">${prev}</span></button>
                <button class="day-nav-today" onclick="openDayDiagram('${todayName}')" ${day === todayName ? 'disabled' : ''}>Jump to Today</button>
                <button class="day-nav-arrow" onclick="openDayDiagram('${next}')"><span class="arrow-label">${next}</span><span class="arrow-icon">→</span></button>
            </div>
            <div class="day-nav-strip">${pills}</div>
            <p class="planner-nav-hint">Use ← → arrow keys · Esc to close</p>
        </div>
    `;
}

// ============================================================
// MODAL FORM SUBMIT — With validation + recurrence
// ============================================================

function handleModalSubmit(e, day) {
    e.preventDefault();

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
        const countPrompt = prompt('How many occurrences? (e.g. 4 for 4 weeks)', '4');
        if (countPrompt && !isNaN(countPrompt) && parseInt(countPrompt) > 1) {
            const count = parseInt(countPrompt);
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
        }
    }

    saveEvents();
    renderSchedule();

    // Re‑open the diagram on the first selected day to refresh the timeline
    openDayDiagram(selectedDays[0]);
    showToast(`✅ Task added to ${selectedDays.length} day${selectedDays.length > 1 ? 's' : ''}!`, 'success');
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
        document.getElementById('title').value = 'Subject Core Review 🧠';
        document.getElementById('category').value = 'study';
        const endH = (h + 1) % 24;
        const endAmpm = endH >= 12 ? 'PM' : 'AM';
        const endH12 = String(endH % 12 || 12).padStart(2, '0');
        document.getElementById('endHour').value = endH12;
        document.getElementById('endMin').value = m;
        document.getElementById('endAmPm').value = endAmpm;
        refreshWheelDisplay('end');
    } else if (type === 'break') {
        document.getElementById('title').value = '☕ Break Time';
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

// Expose functions to global scope
window.openDayDiagram = openDayDiagram;
window.getDefaultWheelTimes = getDefaultWheelTimes;
window.getOverlapMap = getOverlapMap;
window.getAdjacentDay = getAdjacentDay;
window.getDayEventCount = getDayEventCount;
window.selectTimelineTask = selectTimelineTask;
window.convert24To12Hour = convert24To12Hour;
window.handleModalSubmit = handleModalSubmit;
window.formatTime24h = formatTime24h;
window.injectPreset = injectPreset;
window.refreshWheelDisplay = refreshWheelDisplay;
window.buildPlannerDayNav = buildPlannerDayNav;
