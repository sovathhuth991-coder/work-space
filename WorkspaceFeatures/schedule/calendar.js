// calendar.js – uses DAYS from config.js
let calendarMonthOffset = 0;
let calendarSelectedDate = null;

function renderCalendarMonth() {
    const titleEl = document.getElementById("calendarMonthTitle");
    const gridEl = document.getElementById("calendarMonthGrid");
    if (!titleEl || !gridEl) return;
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + calendarMonthOffset;
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    const today = new Date();
    const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    titleEl.textContent = `${monthNames[month]} ${year}`;

    const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    let html = dayHeaders.map(d => `<div class="cal-day-header">${d}</div>`).join("");

    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
        html += `<div class="cal-day other-month"><span class="day-number">${prevMonthLastDay - i}</span></div>`;
    }
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;
        const dayOfWeek = new Date(year, month, d).getDay();
        const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek];
        const dayEvents = events.filter(ev => ev.day === dayName);
        html += `<div class="cal-day ${isToday ? 'today' : ''}" onclick="selectCalendarDate('${dateStr}', '${dayName}')">
            <span class="day-number">${d}</span>
            ${dayEvents.length ? `<div class="day-dots">${dayEvents.slice(0,4).map(ev => `<span class="day-dot ${ev.category || 'study'}"></span>`).join('')}</div>` : ''}
        </div>`;
    }
    const totalCells = startDayOfWeek + daysInMonth;
    const remaining = 7 - (totalCells % 7);
    if (remaining < 7) {
        for (let d = 1; d <= remaining; d++) {
            html += `<div class="cal-day other-month"><span class="day-number">${d}</span></div>`;
        }
    }
    gridEl.innerHTML = html;
    if (calendarSelectedDate) {
        const parts = calendarSelectedDate.split("-");
        const selDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        const selDayOfWeek = selDate.getDay();
        const selDayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][selDayOfWeek];
        showCalendarDayEvents(selDayName, calendarSelectedDate);
    }
}

function changeMonth(delta) {
    calendarMonthOffset += delta;
    renderCalendarMonth();
}

function selectCalendarDate(dateStr, dayName) {
    calendarSelectedDate = dateStr;
    renderCalendarMonth();
    showCalendarDayEvents(dayName, dateStr);

    if (typeof startCountdown === 'function') {
        const selectedDate = new Date(dateStr + "T12:00:00");
        const now = new Date();
        const diffMs = selectedDate - now;
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        if (diffDays > 30) {
            startCountdown(selectedDate);
        }
    } else {
        // Store for later if startCountdown not yet defined
        window._pendingCountdownDate = new Date(dateStr + "T12:00:00");
    }
}

function showCalendarDayEvents(dayName, dateStr) {
    const dateLabel = document.getElementById("calendarSelectedDate");
    const eventsList = document.getElementById("calendarEventsList");
    if (!dateLabel || !eventsList) return;
    const displayDate = new Date(dateStr + "T12:00:00");
    dateLabel.textContent = displayDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const dayEvents = events.filter(ev => ev.day === dayName).sort((a, b) => a.start.localeCompare(b.start));
    if (!dayEvents.length) { eventsList.innerHTML = '<p class="empty-state">No events scheduled for this day</p>'; return; }
    eventsList.innerHTML = dayEvents.map(ev => `
        <div class="calendar-event-item">
            <span class="event-time">${ev.start} - ${ev.end}</span>
            <span class="event-title">${ev.completed ? '✅ ' : ''}${escapeHtml(ev.title)}</span>
            <span class="event-cat badge-${ev.category || 'study'}">${(ev.category || 'study').toUpperCase()}</span>
        </div>
    `).join('');
}

// If startCountdown becomes available later, use pending date
document.addEventListener('DOMContentLoaded', function() {
    if (typeof startCountdown === 'function' && window._pendingCountdownDate) {
        startCountdown(window._pendingCountdownDate);
        delete window._pendingCountdownDate;
    }
});
