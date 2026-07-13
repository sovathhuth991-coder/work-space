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

    // Update optional eyebrow if it exists
    const dashEyebrow = document.getElementById('dashTodoEyebrow');
    if (dashEyebrow) {
        const openCount = dashTodos.filter(t => !t.done).length;
        dashEyebrow.textContent = `TASKS · ${openCount} OPEN`;
    }
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
    if (fill) fill.style.width = `${pct}%`;
    if (pctLabel) pctLabel.textContent = `${pct}%`;
    if (stat) stat.textContent = label;
    if (typeof updateStreakDisplay === 'function') {
        clearTimeout(window.__streakTimeout);
        window.__streakTimeout = setTimeout(updateStreakDisplay, 50);
    }
}

function updateDashboardLiveSession() {
    const { current, next, todayEvents } = getSessionSnapshot();
    updateHubSessionsWidget(current, next, todayEvents);
    updateQuickJumpLinks();
    if (typeof updateFocusTimerTaskLink === 'function') updateFocusTimerTaskLink();
    updateDashboardStats();
    updateDashProgress(false);
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
    const todayEvents = (events || []).filter(e => e.day === getTimeMetrics().todayName);
    if (folderStat && typeof hubState !== 'undefined') folderStat.textContent = String(hubState.folders.length);
    if (todayStat) todayStat.textContent = String(todayEvents.length);
}

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
    if (typeof initWeather === 'function') initWeather();
    updateFocusGoalDisplay();
    renderQuickNotes();
    clearInterval(window.__dashboardLiveInterval);
    window.__dashboardLiveInterval = setInterval(() => {
        if (document.getElementById('dashboard-view')?.classList.contains('active')) {
            updateDashboardLiveSession();
        }
    }, 10000);
    window.addEventListener('focus', () => {
        if (document.getElementById('dashboard-view')?.classList.contains('active')) {
            updateDashboardLiveSession();
        }
    });
    document.addEventListener('sessionCompleted', () => {
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
    // Update inline badge for the new dashboard layout
    const streakLabelEl = container.querySelector('.streak-label');
    const streakEmojiEl = container.querySelector('.streak-emoji');
    if (streakLabelEl) {
        streakLabelEl.textContent = streak;
    }
    if (streakEmojiEl) {
        streakEmojiEl.textContent = emoji;
    }
    // Also update stat card
    const statStreak = document.getElementById('statStreak');
    if (statStreak) statStreak.textContent = streak;
    // Style the badge
    container.style.color = color;
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
    document.addEventListener('DOMContentLoaded', () => {
        initDashboardEnhancements();
    });
} else {
    setTimeout(initDashboardEnhancements, 200);
}
