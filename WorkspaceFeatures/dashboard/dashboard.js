const DEFAULT_DASH_TODOS = [
    { id: "todo_1", text: "Open today's lesson page", done: false },
    { id: "todo_2", text: "Add one study block", done: false },
    { id: "todo_3", text: "Check off completed tasks", done: false }
];
let dashTodos = JSON.parse(localStorage.getItem("dashTodos") || "null") || DEFAULT_DASH_TODOS;

function saveDashTodos() { localStorage.setItem("dashTodos", JSON.stringify(dashTodos)); }

function renderDashTodos() {
    document.querySelectorAll("#dashStrikeList, #todoStrikeList").forEach(container => {
        if (!container) return;
        container.innerHTML = dashTodos.map(todo => `
            <li class="todo-item" data-todo-id="${todo.id}">
                <label class="strike-item">
                    <input type="checkbox" data-todo-id="${todo.id}" ${todo.done ? "checked" : ""}>
                    <span class="checkmark"></span>
                    <span class="task-text">${escapeHtml(todo.text)}</span>
                </label>
                <button class="todo-delete-btn" title="Delete task">✕</button>
            </li>
        `).join("");

        // Attach event listeners after rendering
        container.querySelectorAll('.todo-item').forEach(item => {
            const todoId = item.dataset.todoId;
            const checkbox = item.querySelector('input[type="checkbox"]');
            const deleteBtn = item.querySelector('.todo-delete-btn');

            if (checkbox) {
                checkbox.addEventListener('change', () => toggleDashTodo(todoId));
            }
            if (deleteBtn) {
                deleteBtn.addEventListener('click', () => deleteDashTodo(todoId));
            }
        });
    });
}

function toggleDashTodo(id) {
    dashTodos = dashTodos.map(t => t.id === id ? { ...t, done: !t.done } : t);
    saveDashTodos();
    renderDashTodos();
    updateDashProgress();
}

function deleteDashTodo(id) {
    if (!confirm('Delete this task?')) return;
    dashTodos = dashTodos.filter(t => t.id !== id);
    saveDashTodos();
    renderDashTodos();
    updateDashProgress();
}

function addDashTodo() {
    const modal = document.getElementById('taskAddModal');
    const input = document.getElementById('taskAddInput');
    if (!modal || !input) return;
    input.value = '';
    modal.style.display = 'flex';
    setTimeout(() => input.focus(), 100);
    window._pendingAddDashTodo = true;
}

function confirmAddTask() {
    const input = document.getElementById('taskAddInput');
    const modal = document.getElementById('taskAddModal');
    if (!input || !modal) return;
    const text = input.value.trim();
    if (!text) return;
    dashTodos.push({ id: `todo_${Date.now()}`, text: text, done: false });
    saveDashTodos();
    renderDashTodos();
    updateDashProgress();
    modal.style.display = 'none';
    window._pendingAddDashTodo = false;
}

function closeTaskModal() {
    const modal = document.getElementById('taskAddModal');
    if (modal) {
        modal.style.display = 'none';
        window._pendingAddDashTodo = false;
    }
}

function updateDashProgress(saveFromDom = true) {
    if (saveFromDom) {
        document.querySelectorAll("input[type='checkbox'][data-todo-id]").forEach(box => {
            const id = box.dataset.todoId;
            const todo = dashTodos.find(t => t.id === id);
            if (todo) todo.done = box.checked;
        });
        saveDashTodos();
    }
    const todayEvents = (events || []).filter(e => e.day === getTimeMetrics().todayName);
    const done = dashTodos.filter(t => t.done).length;
    const total = dashTodos.length;
    let pct = 0, label = `${done} / ${total}`;
    if (todayEvents.length > 0) {
        const sd = todayEvents.filter(e => e.completed).length;
        pct = Math.round((sd / todayEvents.length) * 100);
        label = `${sd} / ${todayEvents.length} today`;
    } else if (total > 0) {
        pct = Math.round((done / total) * 100);
    }
    const fill = document.getElementById("dashProgressBar");
    const pctLabel = document.getElementById("dashProgressPercent");
    const stat = document.getElementById("statTasksDone");
    const count = document.getElementById("todoCount");
    const doneCount = document.getElementById("todoDoneCount");
    const pctEl = document.getElementById("todoPercent");
    if (fill) fill.style.width = `${pct}%`;
    if (pctLabel) pctLabel.textContent = `${pct}%`;
    if (stat) stat.textContent = label;
    if (count) count.textContent = String(total);
    if (doneCount) doneCount.textContent = String(done);
    if (pctEl) pctEl.textContent = `${pct}%`;
    if (typeof updateStreakDisplay === 'function') {
        setTimeout(updateStreakDisplay, 50);
    }
}

function updateDashboardLiveSession() {
    const { current, next, todayEvents } = getSessionSnapshot();
    renderAllSessions(current, next, todayEvents);
    updateHubSessionsWidget(current, next, todayEvents);
    updateQuickJumpLinks();
    if (typeof updateFocusTimerTaskLink === 'function') updateFocusTimerTaskLink();
    updateDashboardStats();
    updateDashProgress(false);
    if (typeof updateDailyStats === 'function') updateDailyStats();
}

function updateHubSessionsWidget(current, next, todayEvents) {
    const container = document.getElementById('hubSessionsContent');
    if (!container) return;
    const completedSessions = JSON.parse(localStorage.getItem('completedSessions') || '[]');
    const today = new Date().toDateString();
    const todaySessions = completedSessions.filter(session => {
        const sessionDate = new Date(session.timestamp).toDateString();
        return sessionDate === today;
    });
    todaySessions.sort((a, b) => b.timestamp - a.timestamp);
    const recentSessions = todaySessions.slice(0, 3);
    const formatTimeShort = (sec) => {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };
    const formatTimeRange = (timestamp) => {
        const time = new Date(timestamp);
        const hours = time.getHours();
        const minutes = time.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const formattedHours = hours % 12 || 12;
        const formattedMinutes = String(minutes).padStart(2, '0');
        return `${formattedHours}:${formattedMinutes} ${ampm}`;
    };
    let html = '';
    if (current) {
        html += `
            <div class="session-item current-session" style="padding: 10px; font-size: 0.85rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <span style="font-size: 0.75rem; color: #34d399; font-weight: 600;">● ACTIVE</span>
                    <span style="font-size: 0.7rem; color: var(--text-muted);">NOW</span>
                </div>
                <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(current.title)}</div>
                <div style="display: flex; gap: 8px; font-size: 0.75rem; color: var(--text-muted);">
                    <span style="color: #34d399;">⏱ Active</span>
                </div>
            </div>
        `;
    }
    if (recentSessions.length > 0) {
        recentSessions.forEach((session) => {
            const timeStr = formatTimeRange(session.timestamp);
            const taskName = session.taskName || 'Untitled Session';
            const focusTime = formatTimeShort(session.focusSeconds || 0);
            html += `
                <div class="session-item" style="padding: 10px; font-size: 0.85rem; border-left: 2px solid var(--accent-1);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <span style="font-size: 0.7rem; color: var(--text-muted); font-weight: 600;">${timeStr}</span>
                    </div>
                    <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(taskName)}</div>
                    <div style="display: flex; gap: 8px; font-size: 0.75rem; color: var(--text-muted);">
                        <span style="color: #34d399;">⏱ ${focusTime}</span>
                    </div>
                </div>
            `;
        });
    }
    if (!current && recentSessions.length === 0) {
        html = `
            <div class="session-history-empty" style="padding: 16px 8px;">
                <div style="font-size: 1.2rem; margin-bottom: 4px;">📊</div>
                <div style="color: var(--text-muted); font-size: 0.75rem;">No sessions yet</div>
            </div>
        `;
    }
    container.innerHTML = html;
}

function renderAllSessions(current, next, todayEvents) {
    const container = document.getElementById('allSessionsContainer');
    if (!container) return;
    const completedSessions = JSON.parse(localStorage.getItem('completedSessions') || '[]');
    const today = new Date().toDateString();
    const todaySessions = completedSessions.filter(session => {
        const sessionDate = new Date(session.timestamp).toDateString();
        return sessionDate === today;
    });
    todaySessions.sort((a, b) => b.timestamp - a.timestamp);
    const formatTime = (sec) => {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = sec % 60;
        if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
        return `${m}m ${String(s).padStart(2, '0')}s`;
    };
    const formatTimeShort = (sec) => {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };
    const formatTimeRange = (timestamp) => {
        const time = new Date(timestamp);
        const hours = time.getHours();
        const minutes = time.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const formattedHours = hours % 12 || 12;
        const formattedMinutes = String(minutes).padStart(2, '0');
        const timeStr = `${formattedHours}:${formattedMinutes} ${ampm}`;
        const session = todaySessions.find(s => s.timestamp === timestamp);
        if (session && session.totalSeconds) {
            const endTime = new Date(timestamp + (session.totalSeconds * 1000));
            const endHours = endTime.getHours();
            const endMinutes = endTime.getMinutes();
            const endAmpm = endHours >= 12 ? 'PM' : 'AM';
            const endFormattedHours = endHours % 12 || 12;
            const endFormattedMinutes = String(endMinutes).padStart(2, '0');
            return `${timeStr} – ${endFormattedHours}:${endFormattedMinutes} ${endAmpm}`;
        }
        return timeStr;
    };
    let html = '';
    if (current) {
        const currentStart = current.start || 'Now';
        const currentEnd = current.end || '';
        const timeRange = currentEnd ? `${currentStart} – ${currentEnd}` : currentStart;
        html += `
            <div class="session-item current-session" data-action="showSessionDetailsModal" title="Click to view current session details">
                <div class="session-time-range">${timeRange}</div>
                <div class="session-info">
                    <div class="session-name">${escapeHtml(current.title)}</div>
                    <div class="session-stats">
                        <span class="session-stat focus">⏱ Active</span>
                    </div>
                </div>
                <span class="session-badge">NOW</span>
                <div class="session-arrow">→</div>
            </div>
        `;
    }
    if (todaySessions.length > 0) {
        todaySessions.forEach((session, index) => {
            const timeRange = formatTimeRange(session.timestamp);
            const taskName = session.taskName || 'Untitled Session';
            const focusTime = formatTimeShort(session.focusSeconds || 0);
            const breakTime = formatTimeShort(session.breakSeconds || 0);
            const totalDuration = formatTimeShort(session.totalSeconds || 0);
            html += `
                <div class="session-item" data-session-timestamp="${session.timestamp}" data-session-index="${index}" title="Click to view session details">
                    <div class="session-time-range">${timeRange}</div>
                    <div class="session-info">
                        <div class="session-name">${escapeHtml(taskName)}</div>
                        <div class="session-stats">
                            <span class="session-stat focus">⏱ ${focusTime}</span>
                            <span class="session-stat break">☕ ${breakTime}</span>
                            <span class="session-stat total">⏳ ${totalDuration}</span>
                        </div>
                    </div>
                    <div class="session-arrow">→</div>
                </div>
            `;
        });
    }
    if (!current && todaySessions.length === 0) {
        html = `
            <div class="session-history-empty">
                <div style="font-size: 2rem; margin-bottom: 8px;">📊</div>
                <div style="color: var(--text-muted); font-size: 0.9rem;">No sessions yet today</div>
                <div style="color: var(--text-muted); font-size: 0.8rem; margin-top: 4px;">Start a focus session to see your progress</div>
            </div>
        `;
    }
    container.innerHTML = html;
    container.querySelectorAll('.session-item').forEach(item => {
        item.addEventListener('click', function() {
            const timestamp = this.dataset.sessionTimestamp;
            if (timestamp) {
                showSessionDetailsModal(parseInt(timestamp));
            } else {
                showSessionDetailsModal();
            }
        });
    });
}

function updateQuickJumpLinks() {
    const recentLessons = document.getElementById("dashRecentLessons");
    const recentLibs = document.getElementById("dashRecentLibs");
    const activePage = (typeof hubState !== 'undefined' && hubState?.pages) ? hubState.pages[hubState.activePageId] : null;
    if (recentLessons && activePage) recentLessons.innerHTML = `<span style="color:#e2e8f0;">📄 ${escapeHtml(activePage.title)}</span>`;
    else if (recentLessons) recentLessons.innerHTML = `<span style="color:#475569;">No open lesson</span>`;
    if (recentLibs && libraryItems.length > 0) {
        const recent = libraryItems.slice(-3).reverse();
        recentLibs.innerHTML = recent.map(item => `<a href="${escapeHtml(item.url)}" target="_blank" style="color:#38bdf8;display:block;padding:2px 0;">🔗 ${escapeHtml(item.title)}</a>`).join('');
    } else if (recentLibs) {
        recentLibs.innerHTML = `<span style="color:#475569;">No bookmarks yet</span>`;
    }
}

function updateDashboardStats() {
    const folderStat = document.getElementById("statLessonFolders");
    const todayStat = document.getElementById("statTodayTasks");
    const libStat = document.getElementById("statLibraryItems");
    const todayEvents = (events || []).filter(e => e.day === getTimeMetrics().todayName);
    if (folderStat && typeof hubState !== 'undefined') folderStat.textContent = String(hubState.folders.length);
    if (todayStat) todayStat.textContent = String(todayEvents.length);
    if (libStat) libStat.textContent = String(libraryItems.length);
}

function updateDailyStats() {
    const el = document.getElementById('daily-stats');
    if (!el) return;
    const todayEvents = (events || []).filter(e => e.day === getTimeMetrics().todayName);
    const safeEvents = Array.isArray(todayEvents) ? todayEvents : [];
    const total = safeEvents.length;
    const done = safeEvents.filter(e => e && e.completed).length;
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);
    el.style.display = 'inline-flex';
    el.style.visibility = 'visible';
    el.style.opacity = '1';
    el.style.minWidth = '180px';
    el.style.textAlign = 'center';
    if (total === 0) {
        el.textContent = 'No tasks scheduled for today';
    } else {
        el.textContent = `⭐ ${pct}% complete · ${done}/${total} today`;
    }
}

function renderSessionHistory() {
    const container = document.getElementById('sessionHistoryList');
    if (!container) return;
    const completedSessions = JSON.parse(localStorage.getItem('completedSessions') || '[]');
    const today = new Date().toDateString();
    const todaySessions = completedSessions.filter(session => {
        const sessionDate = new Date(session.timestamp).toDateString();
        return sessionDate === today;
    });
    todaySessions.sort((a, b) => b.timestamp - a.timestamp);
    if (todaySessions.length === 0) {
        container.innerHTML = `
            <div class="session-history-empty">
                <div style="font-size: 2rem; margin-bottom: 8px;">📊</div>
                <div style="color: var(--text-muted); font-size: 0.9rem;">No completed sessions yet today</div>
                <div style="color: var(--text-muted); font-size: 0.8rem; margin-top: 4px;">Start a focus session to see your history</div>
            </div>
        `;
        return;
    }
    const formatTimeShort = (sec) => {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };
    container.innerHTML = todaySessions.map((session, index) => {
        const time = new Date(session.timestamp);
        const timeStr = time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        const taskName = session.taskName || 'Untitled Session';
        const focusTime = formatTimeShort(session.focusSeconds || 0);
        const breakTime = formatTimeShort(session.breakSeconds || 0);
        const totalDuration = formatTimeShort(session.totalSeconds || 0);
        return `
            <div class="session-history-item" data-session-timestamp="${session.timestamp}" data-session-index="${index}" title="Click to view details">
                <div class="session-history-time">${timeStr}</div>
                <div class="session-history-info">
                    <div class="session-history-task-name">${escapeHtml(taskName)}</div>
                    <div class="session-history-duration">
                        <span class="focus-time">⏱ ${focusTime}</span>
                        <span class="break-time">☕ ${breakTime}</span>
                        <span>⏳ ${totalDuration}</span>
                    </div>
                </div>
                <div class="session-history-arrow">→</div>
            </div>
        `;
    }).join('');
    container.querySelectorAll('.session-history-item').forEach(item => {
        item.addEventListener('click', function() {
            const timestamp = parseInt(this.dataset.sessionTimestamp);
            showSessionDetailsModal(timestamp);
        });
    });
}

// Override showSessionDetailsModal to accept optional timestamp parameter
const originalShowSessionDetailsModal = window.showSessionDetailsModal;
window.showSessionDetailsModal = function(sessionTimestamp) {
    const modal = document.getElementById('sessionDetailsModal');
    const content = document.getElementById('sessionDetailsContent');
    if (!modal || !content) return;
    const history = JSON.parse(localStorage.getItem('sessionHistory') || '[]');
    const today = new Date().toDateString();
    const todaySessions = history.filter(s => {
        const sessionDate = new Date(s.timestamp).toDateString();
        return sessionDate === today;
    });
    const savedTime = localStorage.getItem('accumulatedFocusTime');
    let currentFocus = 0, currentBreak = 0, currentIdle = 0;
    if (savedTime) {
        try {
            const data = JSON.parse(savedTime);
            const savedDate = new Date(data.timestamp).toDateString();
            if (savedDate === today) {
                currentFocus = data.focusSeconds || 0;
                currentBreak = data.breakSeconds || 0;
                currentIdle = data.idleSeconds || 0;
            }
        } catch (e) {
            console.warn('Could not parse accumulated time:', e);
        }
    }
    if (sessionTimestamp) {
        const clickedSession = todaySessions.find(s => s.timestamp === sessionTimestamp);
        if (!clickedSession) return;
        const formatTimeShort = (sec) => {
            const m = Math.floor(sec / 60);
            const s = sec % 60;
            return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        };
        const time = new Date(clickedSession.timestamp);
        const timeStr = time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        const efficiency = clickedSession.scheduled > 0 ? Math.round((clickedSession.focusSeconds / (clickedSession.scheduled * 60)) * 100) : 0;
        const totalDuration = clickedSession.focusSeconds + clickedSession.breakSeconds + clickedSession.idleSeconds;
        const focusPercentage = totalDuration > 0 ? Math.round((clickedSession.focusSeconds / totalDuration) * 100) : 0;
        let html = `
            <div style="background: var(--bg-primary); padding: 20px; border-radius: var(--radius-md); border: 1px solid var(--border-color); margin-bottom: 20px;">
                <div style="font-size: 1.2rem; font-weight: 700; color: var(--text-primary); margin-bottom: 8px;">${escapeHtml(clickedSession.taskName)}</div>
                <div style="font-size: 0.9rem; color: var(--text-muted);">${timeStr}</div>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 20px;">
                <div style="background: var(--bg-primary); padding: 16px; border-radius: var(--radius-md); border: 1px solid var(--border-color); text-align: center;">
                    <div style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); margin-bottom: 6px;">Focus Time</div>
                    <div style="font-size: 1.6rem; font-weight: 700; color: #34d399;">${formatTimeShort(clickedSession.focusSeconds)}</div>
                </div>
                <div style="background: var(--bg-primary); padding: 16px; border-radius: var(--radius-md); border: 1px solid var(--border-color); text-align: center;">
                    <div style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); margin-bottom: 6px;">Break Time</div>
                    <div style="font-size: 1.6rem; font-weight: 700; color: #fbbf24;">${formatTimeShort(clickedSession.breakSeconds)}</div>
                </div>
                <div style="background: var(--bg-primary); padding: 16px; border-radius: var(--radius-md); border: 1px solid var(--border-color); text-align: center;">
                    <div style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); margin-bottom: 6px;">Idle Time</div>
                    <div style="font-size: 1.6rem; font-weight: 700; color: #95a5a6;">${formatTimeShort(clickedSession.idleSeconds || 0)}</div>
                </div>
                <div style="background: var(--bg-primary); padding: 16px; border-radius: var(--radius-md); border: 1px solid var(--border-color); text-align: center;">
                    <div style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); margin-bottom: 6px;">Total Duration</div>
                    <div style="font-size: 1.6rem; font-weight: 700; color: var(--text-primary);">${formatTimeShort(totalDuration)}</div>
                </div>
            </div>
            <div style="background: var(--bg-primary); padding: 16px; border-radius: var(--radius-md); border: 1px solid var(--border-color); text-align: center;">
                <div style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); margin-bottom: 6px;">Focus Efficiency</div>
                <div style="font-size: 1.6rem; font-weight: 700; color: var(--accent-1);">${focusPercentage}%</div>
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">of total session time</div>
            </div>
        `;
        content.innerHTML = html;
        modal.style.display = 'flex';
        return;
    }
    const totalFocusToday = todaySessions.reduce((sum, s) => sum + (s.focusSeconds || 0), 0) + currentFocus;
    const totalBreakToday = todaySessions.reduce((sum, s) => sum + (s.breakSeconds || 0), 0) + currentBreak;
    const totalIdleToday = todaySessions.reduce((sum, s) => sum + (s.idleSeconds || 0), 0) + currentIdle;
    const totalSessions = todaySessions.length + (currentFocus > 0 || currentBreak > 0 ? 1 : 0);
    const totalTimeToday = totalFocusToday + totalBreakToday + totalIdleToday;
    const focusPercentage = totalTimeToday > 0 ? Math.round((totalFocusToday / totalTimeToday) * 100) : 0;
    const breakPercentage = totalTimeToday > 0 ? Math.round((totalBreakToday / totalTimeToday) * 100) : 0;
    const avgSessionDuration = totalSessions > 0 ? Math.round(totalFocusToday / totalSessions) : 0;
    let html = '';
    html += `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 24px;">`;
    html += `<div style="background: var(--bg-primary); padding: 16px; border-radius: var(--radius-md); border: 1px solid var(--border-color); text-align: center;"><div style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); margin-bottom: 6px;">Total Focus</div><div style="font-size: 1.6rem; font-weight: 700; color: #34d399;">${formatTimeShort(totalFocusToday)}</div><div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 4px;">${focusPercentage}% of total</div></div>`;
    html += `<div style="background: var(--bg-primary); padding: 16px; border-radius: var(--radius-md); border: 1px solid var(--border-color); text-align: center;"><div style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); margin-bottom: 6px;">Total Break</div><div style="font-size: 1.6rem; font-weight: 700; color: #fbbf24;">${formatTimeShort(totalBreakToday)}</div><div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 4px;">${breakPercentage}% of total</div></div>`;
    html += `<div style="background: var(--bg-primary); padding: 16px; border-radius: var(--radius-md); border: 1px solid var(--border-color); text-align: center;"><div style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); margin-bottom: 6px;">Idle Time</div><div style="font-size: 1.6rem; font-weight: 700; color: #95a5a6;">${formatTimeShort(totalIdleToday)}</div></div>`;
    html += `<div style="background: var(--bg-primary); padding: 16px; border-radius: var(--radius-md); border: 1px solid var(--border-color); text-align: center;"><div style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); margin-bottom: 6px;">Sessions</div><div style="font-size: 1.6rem; font-weight: 700; color: var(--accent-1);">${totalSessions}</div><div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 4px;">~${formatTimeShort(avgSessionDuration)} avg</div></div>`;
    html += `<div style="background: var(--bg-primary); padding: 16px; border-radius: var(--radius-md); border: 1px solid var(--border-color); text-align: center;"><div style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); margin-bottom: 6px;">Total Time</div><div style="font-size: 1.6rem; font-weight: 700; color: var(--text-primary);">${formatTimeShort(totalTimeToday)}</div></div>`;
    html += `</div>`;
    if (todaySessions.length > 0 || (currentFocus > 0 || currentBreak > 0)) {
        html += `<h3 style="margin: 0 0 16px 0; font-size: 1.1rem; font-weight: 600; color: var(--text-primary);">📋 Session Timeline</h3>`;
        html += `<div style="display: flex; flex-direction: column; gap: 10px;">`;
        todaySessions.slice().reverse().forEach((session, index) => {
            const time = new Date(session.timestamp);
            const timeStr = time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            const efficiency = session.scheduled > 0 ? Math.round((session.focusSeconds / (session.scheduled * 60)) * 100) : 0;
            const category = session.category || 'study';
            const sessionDuration = session.focusSeconds + session.breakSeconds;
            const catColors = { study: '#7c6df0', assignment: '#f472b6', class: '#34d399', break: '#fbbf24', fitness: '#fb923c' };
            const catColor = catColors[category] || '#7c6df0';
            html += `<div style="background: var(--bg-primary); padding: 14px 16px; border-radius: var(--radius-md); border: 1px solid var(--border-color); border-left: 3px solid ${catColor}; display: flex; align-items: center; gap: 12px;">`;
            html += `<div style="min-width: 100px; font-size: 0.8rem; color: var(--text-muted); font-weight: 600;">${timeStr}</div>`;
            html += `<div style="flex: 1; min-width: 0;"><div style="font-weight: 600; color: var(--text-primary); margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(session.label)}</div>`;
            html += `<div style="display: flex; gap: 12px; font-size: 0.75rem; align-items: center; flex-wrap: wrap;">`;
            html += `<div style="display: flex; align-items: center; gap: 4px;"><span style="color: var(--text-muted);">⏱</span><span style="color: #34d399; font-weight: 600; font-variant-numeric: tabular-nums;">${formatTimeShort(session.focusSeconds)}</span></div>`;
            html += `<div style="display: flex; align-items: center; gap: 4px;"><span style="color: var(--text-muted);">☕</span><span style="color: #fbbf24; font-weight: 600; font-variant-numeric: tabular-nums;">${formatTimeShort(session.breakSeconds)}</span></div>`;
            if (session.idleSeconds > 0) html += `<div style="display: flex; align-items: center; gap: 4px;"><span style="color: var(--text-muted);">⏸</span><span style="color: #95a5a6; font-weight: 600; font-variant-numeric: tabular-nums;">${formatTimeShort(session.idleSeconds)}</span></div>`;
            html += `<div style="display: flex; align-items: center; gap: 4px;"><span style="color: var(--text-muted);">⏳</span><span style="color: var(--text-secondary); font-variant-numeric: tabular-nums;">${formatTimeShort(sessionDuration)}</span></div>`;
            if (efficiency > 0) html += `<div style="margin-left: auto; padding: 2px 8px; border-radius: 99px; font-size: 0.7rem; font-weight: 600; background: rgba(124, 109, 240, 0.15); color: var(--accent-1);">${efficiency}%</div>`;
            html += `</div></div></div>`;
        });
        if (currentFocus > 0 || currentBreak > 0) {
            const currentDuration = currentFocus + currentBreak + currentIdle;
            const currentEfficiency = currentDuration > 0 ? Math.round((currentFocus / currentDuration) * 100) : 0;
            html += `<div style="background: rgba(124, 109, 240, 0.05); padding: 14px 16px; border-radius: var(--radius-md); border: 1px solid var(--accent-1); border-left: 3px solid var(--accent-1); display: flex; align-items: center; gap: 12px;">`;
            html += `<div style="min-width: 100px; font-size: 0.8rem; color: var(--accent-1); font-weight: 600;">NOW</div>`;
            html += `<div style="flex: 1; min-width: 0;"><div style="font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">🟢 Current Session</div>`;
            html += `<div style="display: flex; gap: 12px; font-size: 0.75rem; align-items: center; flex-wrap: wrap;">`;
            html += `<div style="display: flex; align-items: center; gap: 4px;"><span style="color: var(--text-muted);">⏱</span><span style="color: #34d399; font-weight: 600; font-variant-numeric: tabular-nums;">${formatTimeShort(currentFocus)}</span></div>`;
            html += `<div style="display: flex; align-items: center; gap: 4px;"><span style="color: var(--text-muted);">☕</span><span style="color: #fbbf24; font-weight: 600; font-variant-numeric: tabular-nums;">${formatTimeShort(currentBreak)}</span></div>`;
            if (currentIdle > 0) html += `<div style="display: flex; align-items: center; gap: 4px;"><span style="color: var(--text-muted);">⏸</span><span style="color: #95a5a6; font-weight: 600; font-variant-numeric: tabular-nums;">${formatTimeShort(currentIdle)}</span></div>`;
            html += `<div style="margin-left: auto; padding: 2px 8px; border-radius: 99px; font-size: 0.7rem; font-weight: 600; background: rgba(52, 211, 153, 0.15); color: #34d399;">${currentEfficiency}% focus</div>`;
            html += `</div></div></div>`;
        }
        html += `</div>`;
    } else {
        html += `<div style="text-align: center; padding: 48px 16px; color: var(--text-muted);"><div style="font-size: 3rem; margin-bottom: 16px;">📊</div><div style="font-size: 1.1rem; font-weight: 600; margin-bottom: 8px;">No sessions yet today</div><div style="font-size: 0.9rem;">Start a focus session to see your progress here</div></div>`;
    }
    content.innerHTML = html;
    modal.style.display = 'flex';
};

function closeSessionDetailsModal() {
    const modal = document.getElementById('sessionDetailsModal');
    if (modal) modal.style.display = 'none';
}

const DEFAULT_FOCUS_GOAL_MINUTES = 240;
function getFocusGoal() {
    const saved = localStorage.getItem('dailyFocusGoal');
    if (saved) { try { return JSON.parse(saved); } catch (e) { console.warn('Could not parse focus goal:', e); } }
    return { minutes: DEFAULT_FOCUS_GOAL_MINUTES };
}
function saveFocusGoal(minutes) { localStorage.setItem('dailyFocusGoal', JSON.stringify({ minutes: parseInt(minutes) })); }
function updateFocusGoalDisplay() {
    const goal = getFocusGoal();
    const goalMinutes = goal.minutes;
    const goalHours = Math.floor(goalMinutes / 60);
    const goalMins = goalMinutes % 60;
    const completedSessions = JSON.parse(localStorage.getItem('completedSessions') || '[]');
    const today = new Date().toDateString();
    const todaySessions = completedSessions.filter(session => {
        const sessionDate = new Date(session.timestamp).toDateString();
        return sessionDate === today;
    });
    let totalFocusToday = todaySessions.reduce((sum, s) => sum + (s.focusSeconds || 0), 0);
    const savedTime = localStorage.getItem('accumulatedFocusTime');
    if (savedTime) {
        try {
            const data = JSON.parse(savedTime);
            const savedDate = new Date(data.timestamp).toDateString();
            if (savedDate === today) totalFocusToday += data.focusSeconds || 0;
        } catch (e) { console.warn('Could not parse accumulated time:', e); }
    }
    const percentage = Math.min(100, Math.round((totalFocusToday / (goalMinutes * 60)) * 100));
    const ring = document.getElementById('focusGoalRing');
    const circumference = 220;
    const offset = circumference - (percentage / 100) * circumference;
    if (ring) ring.style.strokeDashoffset = offset;
    const percentText = document.getElementById('focusGoalPercent');
    if (percentText) percentText.textContent = `${percentage}%`;
    const goalText = document.getElementById('focusGoalText');
    if (goalText) {
        const currentHours = Math.floor(totalFocusToday / 3600);
        const currentMins = Math.floor((totalFocusToday % 3600) / 60);
        goalText.textContent = `${currentHours}h ${currentMins}m / ${goalHours}h ${goalMins}m`;
    }
    const messageEl = document.getElementById('focusGoalMessage');
    if (messageEl) {
        let message = '';
        if (percentage === 0) message = '🚀 Ready to start?';
        else if (percentage < 25) message = '💪 Great start!';
        else if (percentage < 50) message = '🔥 Keep it up!';
        else if (percentage < 75) message = '⚡ Almost there!';
        else if (percentage < 100) message = '🎯 So close!';
        else message = '🏆 Goal achieved! Amazing!';
        messageEl.textContent = message;
    }
}
function editFocusGoal() {
    const currentGoal = getFocusGoal();
    const newGoal = prompt('Set your daily focus goal (in minutes):', currentGoal.minutes);
    if (newGoal && !isNaN(newGoal) && parseInt(newGoal) > 0) {
        saveFocusGoal(parseInt(newGoal));
        updateFocusGoalDisplay();
        if (typeof showNotification === 'function') showNotification('Daily focus goal updated!', 'success');
    }
}

const DEFAULT_QUICK_NOTES = [];
let quickNotes = JSON.parse(localStorage.getItem('quickNotes') || 'null') || DEFAULT_QUICK_NOTES;
function saveQuickNotes() { localStorage.setItem('quickNotes', JSON.stringify(quickNotes)); }
function renderQuickNotes() {
    const container = document.getElementById('quickNotesList');
    if (!container) return;
    if (quickNotes.length === 0) {
        container.innerHTML = '<div class="quick-notes-empty">No notes yet. Start typing above!</div>';
        return;
    }
    const recentNotes = quickNotes.slice(-3).reverse();
    container.innerHTML = recentNotes.map(note => `
        <div class="quick-note-item">
            <div class="quick-note-text">${escapeHtml(note.text)}</div>
            <div class="quick-note-time">${note.time}</div>
        </div>
    `).join('');
}
function addQuickNote(text) {
    if (!text || !text.trim()) return;
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    quickNotes.push({ text: text.trim(), time: timeStr, timestamp: now.getTime() });
    if (quickNotes.length > 50) quickNotes = quickNotes.slice(-50);
    saveQuickNotes();
    renderQuickNotes();
}
function clearQuickNotes() {
    if (confirm('Clear all notes? This cannot be undone.')) {
        quickNotes = [];
        saveQuickNotes();
        renderQuickNotes();
        const input = document.getElementById('quickNotesInput');
        if (input) input.value = '';
    }
}

function initDashboardEngine() {
    const dateDisplay = document.getElementById("dashGreetingDate");
    if (dateDisplay) {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const systemDate = new Date().toLocaleDateString('en-US', options);
        const greeting = (() => { const h = new Date().getHours(); if (h < 12) return "Good morning"; if (h < 17) return "Good afternoon"; if (h < 21) return "Good evening"; return "Good night"; })();
        dateDisplay.textContent = `${greeting}! Today is ${systemDate}.`;
    }
    renderDashTodos();
    updateDashboardLiveSession();
    renderAnalytics();
    updateSidebarProgress();
    updateDailyStats();
    renderSessionHistory();
    if (typeof initWeather === 'function') initWeather();
    updateFocusGoalDisplay();
    renderQuickNotes();
    clearInterval(window.__dashboardLiveInterval);
    window.__dashboardLiveInterval = setInterval(() => {
        if (document.getElementById('dashboard-view')?.classList.contains('active')) {
            updateDashboardLiveSession();
            renderSessionHistory();
        }
    }, 10000);
    window.addEventListener('focus', () => {
        if (document.getElementById('dashboard-view')?.classList.contains('active')) {
            updateDashboardLiveSession();
            renderSessionHistory();
        }
    });
    document.addEventListener('sessionCompleted', () => {
        renderSessionHistory();
        updateFocusGoalDisplay();
    });
    const editGoalBtn = document.getElementById('editGoalBtn');
    if (editGoalBtn) editGoalBtn.addEventListener('click', editFocusGoal);
    const quickNotesInput = document.getElementById('quickNotesInput');
    if (quickNotesInput) {
        let saveTimeout;
        quickNotesInput.addEventListener('input', (e) => {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                const text = e.target.value;
                if (text.trim()) { addQuickNote(text); e.target.value = ''; }
            }, 500);
        });
        quickNotesInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const text = e.target.value;
                if (text.trim()) { addQuickNote(text); e.target.value = ''; }
            }
        });
    }
    const clearNotesBtn = document.getElementById('clearNotesBtn');
    if (clearNotesBtn) clearNotesBtn.addEventListener('click', clearQuickNotes);
    clearInterval(window.__focusGoalInterval);
    window.__focusGoalInterval = setInterval(() => {
        if (document.getElementById('dashboard-view')?.classList.contains('active')) updateFocusGoalDisplay();
    }, 30000);
}

function calculateStreak() {
    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const completedSessions = JSON.parse(localStorage.getItem('completedSessions') || '[]');
    const sessionDates = new Set();
    completedSessions.forEach(session => {
        const sessionDate = new Date(session.timestamp);
        sessionDate.setHours(0, 0, 0, 0);
        sessionDates.add(sessionDate.getTime());
    });
    let d = new Date(today);
    for (let i = 0; i < 365; i++) {
        const hasCompleted = sessionDates.has(d.getTime());
        if (hasCompleted) {
            streak++;
        } else {
            if (d.getTime() === today.getTime()) break;
            break;
        }
        d.setDate(d.getDate() - 1);
    }
    return streak;
}

function getStreakEmoji(streak) {
    if (streak === 0) return '💤';
    if (streak < 3) return '🌱';
    if (streak < 7) return '🔥';
    if (streak < 14) return '🔥🔥';
    if (streak < 30) return '🔥🔥🔥';
    if (streak < 60) return '⚡⚡⚡';
    return '🏆🔥⚡';
}
function getStreakColor(streak) {
    if (streak === 0) return 'var(--text-muted)';
    if (streak < 3) return '#fbbf24';
    if (streak < 7) return '#fb923c';
    if (streak < 14) return '#f97316';
    if (streak < 30) return '#ef4444';
    return '#a855f7';
}
function updateStreakDisplay() {
    const streak = calculateStreak();
    const container = document.getElementById('streakDisplay');
    if (!container) return;
    const emoji = getStreakEmoji(streak);
    const color = getStreakColor(streak);
    const label = streak === 0 ? 'No streak yet' : `${streak}-day streak`;
    container.innerHTML = `
        <div class="streak-badge" style="color:${color};">
            <span class="streak-emoji">${emoji}</span>
            <span class="streak-label">${label}</span>
        </div>
    `;
    const statStreak = document.getElementById('statStreak');
    if (statStreak) statStreak.textContent = streak;
}

function updateSidebarProgress() {
    const ring = document.getElementById('sidebarProgressRing');
    const text = document.getElementById('sidebarProgressText');
    if (!ring || !text) return;
    const today = getTodayName();
    const dayEvents = events.filter(e => e.day === today);
    const total = dayEvents.length;
    const done = dayEvents.filter(e => e.completed).length;
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);
    const circumference = 125.6;
    const offset = circumference - (pct / 100) * circumference;
    ring.style.strokeDashoffset = offset;
    text.textContent = `${pct}%`;
    if (pct === 0) ring.style.stroke = 'var(--text-muted)';
    else if (pct < 30) ring.style.stroke = '#f87171';
    else if (pct < 60) ring.style.stroke = '#fbbf24';
    else if (pct < 100) ring.style.stroke = '#34d399';
    else ring.style.stroke = '#a855f7';
}

function animateCardsIn() {
    const grid = document.querySelector('.dashboard-grid');
    if (!grid) return;
    const cards = grid.querySelectorAll('.dash-card');
    cards.forEach((card, i) => {
        card.classList.remove('card-visible');
        card.style.transitionDelay = `${i * 0.08}s`;
        requestAnimationFrame(() => {
            requestAnimationFrame(() => card.classList.add('card-visible'));
        });
    });
}
function renderDashEmptyState(container, icon, title, subtitle, actionLabel, actionCallback) {
    if (!container) return;
    container.innerHTML = `
        <div class="empty-state-card">
            <div class="empty-icon">${icon}</div>
            <div class="empty-title">${title}</div>
            <div class="empty-subtitle">${subtitle}</div>
            ${actionLabel ? `<button class="empty-action-btn" data-empty-action="true">${actionLabel}</button>` : ''}
        </div>
    `;
    if (actionCallback) {
        const btn = container.querySelector('[data-empty-action]');
        if (btn) btn.addEventListener('click', actionCallback);
    }
}
function updateLastUpdated(elementId, label) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    el.textContent = `${label} ${timeStr}`;
}
function initLastUpdatedTimestamps() {
    const targets = [
        { container: 'allSessionsContainer', id: 'sessionsUpdated' },
        { container: 'hubSessionsContent', id: 'hubSessionsUpdated' },
    ];
    targets.forEach(t => {
        const container = document.getElementById(t.container);
        if (container && !document.getElementById(t.id)) {
            const span = document.createElement('span');
            span.id = t.id;
            span.className = 'last-updated';
            span.textContent = 'Updated just now';
            container.parentNode.insertBefore(span, container.nextSibling);
        }
    });
    if (!window.__lastUpdatedInterval) {
        window.__lastUpdatedInterval = setInterval(() => {
            document.querySelectorAll('.last-updated').forEach(el => {
                const now = new Date();
                const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                el.textContent = `Updated ${timeStr}`;
            });
        }, 30000);
    }
}
const DEFAULT_CARD_VISIBILITY = {
    'banner': true, 'sessions': true, 'todo': true, 'hub': true, 'widgets': true,
    'stat-tasks': true, 'stat-schedule': true, 'stat-lessons': true, 'stat-streak': true
};
const CARD_LABELS = {
    'banner': '📋 Banner', 'sessions': '⏱ Today\'s Sessions', 'todo': '☑ Master To-Do',
    'hub': '🎛️ Session Hub', 'widgets': '📦 Custom Widgets', 'stat-tasks': '✓ Tasks Done',
    'stat-schedule': '▦ Today\'s Tasks', 'stat-lessons': '▣ Lesson Folders', 'stat-streak': '🔥 Day Streak'
};
function loadCardVisibility() {
    try { const saved = localStorage.getItem('dashboardCardVisibility'); if (saved) return JSON.parse(saved); } catch (e) {}
    return { ...DEFAULT_CARD_VISIBILITY };
}
function saveCardVisibility(visibility) { localStorage.setItem('dashboardCardVisibility', JSON.stringify(visibility)); }
function applyCardVisibility() {
    const visibility = loadCardVisibility();
    Object.keys(visibility).forEach(cardId => {
        const card = document.querySelector(`.dash-card[data-card-id="${cardId}"]`);
        if (card) {
            if (visibility[cardId]) { card.style.display = ''; card.style.visibility = ''; }
            else { card.style.display = 'none'; card.style.visibility = 'hidden'; }
        }
    });
    // Renumber visible cards so grid reflows smoothly
    if (typeof renumberDashboardCards === 'function') {
        renumberDashboardCards();
    }
}
function renderVisibilityList() {
    const list = document.getElementById('cardVisibilityList');
    if (!list) return;
    const visibility = loadCardVisibility();
    list.innerHTML = Object.keys(CARD_LABELS).map(cardId => {
        const isVisible = visibility[cardId] !== false;
        return `
            <div class="vis-item">
                <span class="vis-label">${CARD_LABELS[cardId]}</span>
                <button class="vis-toggle ${isVisible ? 'active' : ''}" data-vis-card="${cardId}" aria-label="Toggle ${CARD_LABELS[cardId]}"></button>
            </div>
        `;
    }).join('');
    list.querySelectorAll('.vis-toggle').forEach(btn => {
        btn.addEventListener('click', function() {
            const cardId = this.dataset.visCard;
            const visibility = loadCardVisibility();
            visibility[cardId] = !visibility[cardId];
            saveCardVisibility(visibility);
            this.classList.toggle('active');
            applyCardVisibility();
        });
    });
}
function toggleCardVisibility() {
    const overlay = document.getElementById('cardVisibilityOverlay');
    if (!overlay) return;
    const isActive = overlay.classList.contains('active');
    if (isActive) { overlay.classList.remove('active'); overlay.style.display = 'none'; }
    else { renderVisibilityList(); overlay.classList.add('active'); overlay.style.display = 'flex'; }
}
function getSparklineData(dataKey, days = 7) {
    const data = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr = d.toDateString();
        const completedSessions = JSON.parse(localStorage.getItem('completedSessions') || '[]');
        const daySessions = completedSessions.filter(s => {
            const sDate = new Date(s.timestamp).toDateString();
            return sDate === dateStr;
        });
        let value = 0;
        if (dataKey === 'focus') value = daySessions.reduce((sum, s) => sum + (s.focusSeconds || 0), 0);
        else if (dataKey === 'sessions') value = daySessions.length;
        else if (dataKey === 'streak') value = daySessions.length > 0 ? 1 : 0;
        data.push(value);
    }
    return data;
}
function renderSparkline(svgId, data, color = '#7c6df0') {
    const svg = document.getElementById(svgId);
    if (!svg || data.length === 0) return;
    const width = 80, height = 24, padding = 2;
    const maxVal = Math.max(...data, 1);
    const points = data.map((val, i) => {
        const x = padding + (i / (data.length - 1 || 1)) * (width - padding * 2);
        const y = height - padding - (val / maxVal) * (height - padding * 2);
        return `${x},${y}`;
    }).join(' ');
    svg.innerHTML = `<polyline points="${points}" stroke="${color}" />`;
}
function initSparklines() {
    const sparklineConfigs = [
        { svgId: 'sparkline-tasks', dataKey: 'sessions', color: '#34d399', cardId: 'stat-tasks' },
        { svgId: 'sparkline-schedule', dataKey: 'focus', color: '#38bdf8', cardId: 'stat-schedule' },
        { svgId: 'sparkline-lessons', dataKey: 'sessions', color: '#fbbf24', cardId: 'stat-lessons' },
        { svgId: 'sparkline-streak', dataKey: 'streak', color: '#a855f7', cardId: 'stat-streak' },
    ];
    sparklineConfigs.forEach(config => {
        const card = document.querySelector(`.dash-card[data-card-id="${config.cardId}"]`);
        if (!card) return;
        const statInfo = card.querySelector('.stat-info');
        if (!statInfo) return;
        if (!document.getElementById(config.svgId)) {
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.id = config.svgId;
            svg.setAttribute('class', 'stat-sparkline');
            svg.setAttribute('viewBox', '0 0 80 24');
            svg.setAttribute('preserveAspectRatio', 'none');
            statInfo.appendChild(svg);
        }
        const data = getSparklineData(config.dataKey);
        renderSparkline(config.svgId, data, config.color);
    });
}
let miniCalendarDate = new Date();
function renderMiniCalendar() {
    const container = document.getElementById('dashMiniCalendar');
    if (!container) return;
    const year = miniCalendarDate.getFullYear();
    const month = miniCalendarDate.getMonth();
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    const todayStr = today.toDateString();
    const completedSessions = JSON.parse(localStorage.getItem('completedSessions') || '[]');
    const sessionDates = new Set();
    completedSessions.forEach(s => {
        const d = new Date(s.timestamp);
        if (d.getMonth() === month && d.getFullYear() === year) sessionDates.add(d.getDate());
    });
    const streakDays = new Set();
    let streak = 0;
    let d = new Date();
    d.setHours(0, 0, 0, 0);
    for (let i = 0; i < 30; i++) {
        const dayEvents = (typeof events !== 'undefined' ? events : []).filter(e => {
            const dayIndex = d.getDay();
            const dayNamesArr = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            return e.day === dayNamesArr[dayIndex];
        });
        if (dayEvents.some(e => e.completed)) { streakDays.add(d.getDate()); streak++; }
        else { if (d.toDateString() !== todayStr) break; }
        d.setDate(d.getDate() - 1);
    }
    let html = `
        <div class="mini-calendar">
            <div class="mini-calendar-header">
                <span class="mc-month">${monthNames[month]} ${year}</span>
                <div class="mc-nav">
                    <button data-mc-action="prev" title="Previous month">‹</button>
                    <button data-mc-action="next" title="Next month">›</button>
                </div>
            </div>
            <div class="mini-calendar-weekdays">${dayNames.map(n => `<span>${n}</span>`).join('')}</div>
            <div class="mini-calendar-days">
    `;
    for (let i = 0; i < firstDay; i++) html += `<div class="mc-day other-month"></div>`;
    for (let day = 1; day <= daysInMonth; day++) {
        const dateObj = new Date(year, month, day);
        const isToday = dateObj.toDateString() === todayStr;
        const hasSession = sessionDates.has(day);
        const hasStreak = streakDays.has(day);
        const classes = ['mc-day', isToday ? 'today' : '', hasSession ? 'has-session' : '', hasStreak ? 'has-streak' : ''].filter(Boolean).join(' ');
        html += `<div class="${classes}" data-mc-date="${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}">${day}</div>`;
    }
    html += `</div></div>`;
    container.innerHTML = html;
    container.querySelector('[data-mc-action="prev"]')?.addEventListener('click', () => { miniCalendarDate.setMonth(miniCalendarDate.getMonth() - 1); renderMiniCalendar(); });
    container.querySelector('[data-mc-action="next"]')?.addEventListener('click', () => { miniCalendarDate.setMonth(miniCalendarDate.getMonth() + 1); renderMiniCalendar(); });
}
function initMiniCalendar() {
    const grid = document.querySelector('.dashboard-grid');
    if (!grid) return;
    if (document.querySelector('.dash-card[data-card-id="calendar"]')) return;
    const calendarCard = document.createElement('div');
    calendarCard.className = 'dash-card';
    calendarCard.setAttribute('data-card-id', 'calendar');
    calendarCard.innerHTML = `
        <div class="card-glow-border"></div>
        <div class="card-inner">
            <div class="card-header-drag" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                <h3 style="margin:0;">📅 Calendar</h3>
                <div class="card-controls">
                    <span class="card-drag-handle" title="Drag to move">⠿</span>
                    <button class="card-resize-btn" data-action="resizeCard" data-card="calendar" title="Resize">⤡</button>
                </div>
            </div>
            <div id="dashMiniCalendar"></div>
        </div>
    `;
    const statsContainer = grid.querySelector('.dash-stats-container');
    if (statsContainer) grid.insertBefore(calendarCard, statsContainer);
    else grid.appendChild(calendarCard);
    renderMiniCalendar();
}
function toggleDashboardFocusMode() {
    const grid = document.querySelector('.dashboard-grid');
    const badge = document.getElementById('focusModeBadge');
    if (!grid) return;
    const isActive = grid.classList.contains('focus-mode');
    if (isActive) {
        grid.classList.remove('focus-mode');
        if (badge) badge.classList.remove('active');
        document.querySelectorAll('.dash-card.keep-in-focus').forEach(c => c.classList.remove('keep-in-focus'));
    } else {
        grid.classList.add('focus-mode');
        if (badge) badge.classList.add('active');
        ['banner', 'sessions', 'todo'].forEach(id => {
            const card = document.querySelector(`.dash-card[data-card-id="${id}"]`);
            if (card) card.classList.add('keep-in-focus');
        });
    }
}
function initDashboardEnhancements() {
    setTimeout(animateCardsIn, 50);
    initLastUpdatedTimestamps();
    applyCardVisibility();
    initSparklines();
    initMiniCalendar();
    const customizeBtn = document.querySelector('[data-action="toggleCardVisibility"]');
    if (customizeBtn) customizeBtn.addEventListener('click', toggleCardVisibility);
    const closeBtn = document.querySelector('[data-action="closeCardVisibility"]');
    if (closeBtn) closeBtn.addEventListener('click', toggleCardVisibility);
    const overlay = document.getElementById('cardVisibilityOverlay');
    if (overlay) overlay.addEventListener('click', (e) => { if (e.target === overlay) toggleCardVisibility(); });
    const focusModeBtn = document.querySelector('[data-action="toggleFocusMode"]');
    if (focusModeBtn) focusModeBtn.addEventListener('click', toggleDashboardFocusMode);
}
const originalInit = window.initDashboardEngine;
window.initDashboardEngine = function() {
    if (typeof originalInit === 'function') originalInit();
    initDashboardEnhancements();
};
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {});
} else {
    setTimeout(initDashboardEnhancements, 200);
}
