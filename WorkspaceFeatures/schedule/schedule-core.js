// ============================================================
// schedule-core.js — Full wheel‑picker version (0-59 minutes)
// ============================================================

const DEFAULT_EVENT_COLOR = 'default';

function saveEvents() {
    localStorage.setItem("scheduleEvents", JSON.stringify(events));
    if (typeof updateDashboardLiveSession === 'function') updateDashboardLiveSession();
    if (typeof updateDashboardStats === 'function') updateDashboardStats();
    if (typeof updateDailyStats === 'function') updateDailyStats();
}

function autoCompletePastEvents() {
    const { todayName, currentHHMM, currentDayIndex } = getTimeMetrics();
    const nowMinutes = timeToMinutes(currentHHMM);
    const GRACE_PERIOD = 5; // minutes - don't auto-complete if task ended less than 5 minutes ago
    const currentWeekId = getWeekId(new Date());
    let changed = false;
    events = events.map(event => {
        // Reset completed status for new week (for recurring tasks)
        if (event.completed && event.weekId && event.weekId !== currentWeekId) {
            changed = true;
            return { ...event, completed: false, userToggled: false, weekId: currentWeekId };
        }

        // Skip if user manually toggled this task (respect user choice)
        if (event.userToggled) return event;
        if (event.completed) return event;
        const dayIdx = DAYS.indexOf(event.day);
        const eventEndMinutes = timeToMinutes(event.end);

        // Only auto-complete if viewing today's events and time has passed
        // Don't auto-complete when viewing past/future days in the modal
        // Add grace period to allow manual unchecking
        if (event.day === todayName && nowMinutes > eventEndMinutes + GRACE_PERIOD) {
            changed = true;
            return { ...event, completed: true, weekId: currentWeekId };
        }
        return event;
    });
    if (changed) saveEvents();
    return changed;
}

// Generate a unique week identifier (year + week number)
function getWeekId(date) {
    const year = date.getFullYear();
    const firstDayOfYear = new Date(year, 0, 1);
    const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
    const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    return `${year}-W${weekNumber}`;
}

function deleteEvent(id) {
    events = events.filter(event => event.id !== id);
    saveEvents();
    renderSchedule();
    showToast('Task deleted', 'info');
    if (currentOpenDay) {
        openDayDiagram(currentOpenDay);
    }
}

function toggleTaskComplete(id, day) {
    const currentWeekId = getWeekId(new Date());
    events = events.map(ev => {
        if (ev.id === id) {
            const newCompleted = !ev.completed;
            // Mark as user-toggled so auto-complete respects the choice
            // Clear the flag if user manually completes it
            return {
                ...ev,
                completed: newCompleted,
                userToggled: !newCompleted,  // Only set flag when unchecking
                weekId: newCompleted ? currentWeekId : ev.weekId  // Set weekId when completing
            };
        }
        return ev;
    });
    saveEvents();
    renderSchedule();
    openDayDiagram(day);
    const task = events.find(ev => ev.id === id);
    showToast(task.completed ? 'Task completed! 🎉' : 'Task marked as active', 'info');
}

// Migrate existing events to add weekId if missing
function migrateEventsWithWeekId() {
    const currentWeekId = getWeekId(new Date());
    let changed = false;
    events = events.map(event => {
        if (!event.weekId) {
            changed = true;
            return { ...event, weekId: currentWeekId };
        }
        return event;
    });
    if (changed) {
        saveEvents();
        console.log('Migrated events to include weekId');
    }
}

// ------------------------------------------------------------
// 🛞  WHEEL TIME PICKER – FULL 0-59 MINUTES
// ------------------------------------------------------------
function buildTimePickerGroup(prefix, label, defaultHour = '09', defaultMinute = '00', defaultAmPm = 'AM') {
    return `
        <div class="time-field-block">
            <label>${label}</label>
            <div class="time-picker-wheel" data-time-prefix="${prefix}">
                <input type="hidden" id="${prefix}Hour" value="${defaultHour}">
                <input type="hidden" id="${prefix}Min" value="${defaultMinute}">
                <input type="hidden" id="${prefix}AmPm" value="${defaultAmPm}">

                <div class="wheel-container">
                    <!-- Hour Wheel (1-12) -->
                    <div class="wheel-column">
                        <div class="wheel-scroll" data-wheel-type="hour" data-prefix="${prefix}">
                            <div class="wheel-spacer"></div>
                            ${Array.from({ length: 12 }, (_, i) => {
                                const val = String(i + 1).padStart(2, '0');
                                return `<div class="wheel-item" data-value="${val}">${val}</div>`;
                            }).join('')}
                            <div class="wheel-spacer"></div>
                        </div>
                    </div>

                    <div class="wheel-separator">:</div>

                    <!-- Minute Wheel (0-59) – FULL RANGE -->
                    <div class="wheel-column">
                        <div class="wheel-scroll" data-wheel-type="minute" data-prefix="${prefix}">
                            <div class="wheel-spacer"></div>
                            ${Array.from({ length: 60 }, (_, i) => {
                                const val = String(i).padStart(2, '0');
                                return `<div class="wheel-item" data-value="${val}">${val}</div>`;
                            }).join('')}
                            <div class="wheel-spacer"></div>
                        </div>
                    </div>

                    <!-- AM/PM Wheel -->
                    <div class="wheel-column ampm-column">
                        <div class="wheel-scroll" data-wheel-type="ampm" data-prefix="${prefix}">
                            <div class="wheel-spacer"></div>
                            <div class="wheel-item" data-value="AM">AM</div>
                            <div class="wheel-item" data-value="PM">PM</div>
                            <div class="wheel-spacer"></div>
                        </div>
                    </div>
                </div>

                <!-- Selection indicator bar -->
                <div class="wheel-selection-bar"></div>
            </div>
        </div>
    `;
}

// ------------------------------------------------------------
// 🛞  WHEEL INITIALISATION – attaches scroll & click events
// ------------------------------------------------------------
function initWheelPickers() {
    console.log('🛞 initWheelPickers called');
    const wheels = document.querySelectorAll('.time-picker-wheel');
    if (wheels.length === 0) {
        console.warn('No wheel pickers found, retrying...');
        setTimeout(() => {
            const retryWheels = document.querySelectorAll('.time-picker-wheel');
            if (retryWheels.length > 0) {
                console.log('Retry succeeded, initialising wheels');
                initWheelPickersInternal(retryWheels);
            } else {
                console.warn('Still no wheel pickers, giving up');
            }
        }, 50);
        return;
    }
    initWheelPickersInternal(wheels);
}

function initWheelPickersInternal(wheels) {
    wheels.forEach(wheel => {
        if (wheel.dataset.wheelBound === '1') return;
        wheel.dataset.wheelBound = '1';

        const prefix = wheel.dataset.timePrefix;
        const scrolls = wheel.querySelectorAll('.wheel-scroll');

        scrolls.forEach(scroll => {
            const type = scroll.dataset.wheelType;
            const items = scroll.querySelectorAll('.wheel-item');
            const hiddenInput = document.getElementById(
                type === 'hour' ? `${prefix}Hour` :
                type === 'minute' ? `${prefix}Min` :
                `${prefix}AmPm`
            );

            if (!hiddenInput) return;

            // Scroll to the initial value using index * itemHeight
            const initialValue = hiddenInput.value;
            const itemHeight = 40;
            const initialIndex = Array.from(items).findIndex(item => item.dataset.value === initialValue);
            if (initialIndex >= 0) {
                setTimeout(() => {
                    scroll.scrollTop = initialIndex * itemHeight;
                    updateActiveItems(scroll);
                }, 10);
            }

            // Update hidden input on scroll
            scroll.addEventListener('scroll', function() {
                updateActiveItems(this);
                const activeItem = this.querySelector('.wheel-item.is-active');
                if (activeItem) {
                    hiddenInput.value = activeItem.dataset.value;
                    const form = document.getElementById('modalScheduleForm');
                    const day = form?.dataset.plannerDay || currentOpenDay;
                    if (day) updateModalFormFeedback(day);
                }
            }, { passive: true });

            // Click to snap
            items.forEach(item => {
                item.addEventListener('click', function() {
                    const index = Array.from(items).indexOf(this);
                    scroll.scrollTo({
                        top: index * 40,
                        behavior: 'smooth'
                    });
                });
            });

            // Keyboard support for wheel picker
            scroll.setAttribute('tabindex', '0');
            scroll.addEventListener('keydown', function(e) {
                const currentIndex = Math.round(scroll.scrollTop / 40);
                const clampedIndex = Math.max(0, Math.min(currentIndex, items.length - 1));

                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    let newIndex;
                    if (e.key === 'ArrowDown') {
                        newIndex = Math.min(clampedIndex + 1, items.length - 1);
                    } else {
                        newIndex = Math.max(clampedIndex - 1, 0);
                    }
                    scroll.scrollTo({
                        top: newIndex * 40,
                        behavior: 'smooth'
                    });
                } else if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    const activeItem = items[clampedIndex];
                    if (activeItem) {
                        activeItem.click();
                    }
                }
            });
        });
    });
}

function updateActiveItems(scroll) {
    const items = scroll.querySelectorAll('.wheel-item');
    const scrollTop = scroll.scrollTop;
    const itemHeight = 40;
    const centerIndex = Math.round(scrollTop / itemHeight);
    const clampedIndex = Math.max(0, Math.min(centerIndex, items.length - 1));

    items.forEach((item, index) => {
        item.classList.toggle('is-active', index === clampedIndex);
    });
}

// ------------------------------------------------------------
//  HELPER – read wheel values
// ------------------------------------------------------------
function getWheelTime(prefix) {
    const hourInput = document.getElementById(`${prefix}Hour`);
    const minInput = document.getElementById(`${prefix}Min`);
    const ampmInput = document.getElementById(`${prefix}AmPm`);
    return {
        hour: hourInput ? hourInput.value : '12',
        minute: minInput ? minInput.value : '00',
        ampm: ampmInput ? ampmInput.value : 'AM'
    };
}

// ------------------------------------------------------------
//  VALIDATION & MODAL FEEDBACK
// ------------------------------------------------------------
function validateTaskTimes(startTime, endTime, day, excludeId = null) {
    const issues = [];
    if (!startTime || !endTime) {
        issues.push({ type: 'error', message: 'Start and end times are required.' });
        return issues;
    }
    if (startTime >= endTime) {
        issues.push({ type: 'error', message: 'End time must be after start time.' });
    }
    const dayEvents = events.filter(e => e.day === day && e.id !== excludeId);
    dayEvents.forEach(existing => {
        if (startTime < existing.end && endTime > existing.start) {
            issues.push({
                type: 'warning',
                message: `Overlaps with "${existing.title}" (${existing.start}–${existing.end})`
            });
        }
    });
    return issues;
}

function updateModalFormFeedback(day) {
    const feedback = document.getElementById("modal-form-feedback");
    const sh = document.getElementById("startHour");
    const sm = document.getElementById("startMin");
    const eh = document.getElementById("endHour");
    const em = document.getElementById("endMin");
    if (!feedback || !sh || !sm || !eh || !em) return;
    const start = `${sh.value}:${sm.value}`;
    const end = `${eh.value}:${em.value}`;
    const issues = validateTaskTimes(start, end, day);
    feedback.innerHTML = issues.length ? issues.map(i => `<p class="form-feedback-${i.type}">${i.message}</p>`).join("") : "";
}

function closeDayDiagram() {
    const modal = document.getElementById("diagramModal");
    if (modal) modal.style.display = "none";
    currentOpenDay = null;
}

// Ensure the function is globally accessible
window.initWheelPickers = initWheelPickers;
window.getWeekId = getWeekId;
window.migrateEventsWithWeekId = migrateEventsWithWeekId;
