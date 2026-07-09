let analyticsCache = null;
let analyticsCacheKey = '';

function getAnalytics() {
    const cacheKey = events.length + '-' + events.map(e => e.id + e.completed + e.category).join('-');
    if (analyticsCache && analyticsCacheKey === cacheKey) {
        return analyticsCache;
    }

    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const weekEvents = events.filter(e => new Date(e.day) >= weekStart);
    const monthEvents = events.filter(e => new Date(e.day) >= monthStart);
    const categoryBreakdown = {};
    events.forEach(e => { const cat = e.category || 'study'; categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + 1; });
    const totalStudyTime = events.filter(e => !e.completed).reduce((total, e) => {
        const [sh, sm] = e.start.split(':').map(Number);
        const [eh, em] = e.end.split(':').map(Number);
        return total + ((eh * 60 + em) - (sh * 60 + sm));
    }, 0);
    const productiveHours = {};
    events.forEach(e => { const hour = parseInt(e.start.split(':')[0]); productiveHours[hour] = (productiveHours[hour] || 0) + 1; });
    const result = {
        totalEvents: events.length,
        completedEvents: events.filter(e => e.completed).length,
        weekEvents: weekEvents.length,
        monthEvents: monthEvents.length,
        categoryBreakdown,
        totalStudyTime,
        completionRate: events.length ? (events.filter(e => e.completed).length / events.length * 100) : 0,
        productiveHours,
        averageEventsPerDay: events.length / 7
    };

    analyticsCache = result;
    analyticsCacheKey = cacheKey;
    return result;
}

function getOptimalStudyTimes() {
    const prod = {};
    events.forEach(e => {
        if (e.completed) return;
        const hour = parseInt(e.start.split(':')[0]);
        const [sh, sm] = e.start.split(':').map(Number);
        const [eh, em] = e.end.split(':').map(Number);
        const dur = (eh * 60 + em) - (sh * 60 + sm);
        if (!prod[hour]) prod[hour] = { count: 0, totalDuration: 0 };
        prod[hour].count++;
        prod[hour].totalDuration += dur;
    });
    return Object.entries(prod).sort((a, b) => b[1].totalDuration - a[1].totalDuration).slice(0, 3).map(([h]) => `${h}:00 - ${parseInt(h) + 1}:00`);
}

function detectSchedulingConflicts() {
    const conflicts = [];
    for (let i = 0; i < events.length; i++) {
        for (let j = i + 1; j < events.length; j++) {
            if (events[i].day === events[j].day && eventsOverlap(events[i], events[j])) {
                conflicts.push({
                    event1: events[i],
                    event2: events[j],
                    suggestion: `Consider moving "${events[j].title}" to avoid overlap with "${events[i].title}"`
                });
            }
        }
    }
    return conflicts;
}

function selectEventColor(element) {
    document.querySelectorAll('.color-option').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
}

// ============================================================
// RENDER ANALYTICS DASHBOARD
// ============================================================

function renderAnalytics() {
    const data = getAnalytics();

    // ---- Stats Grid ----
    const statsGrid = document.getElementById('analyticsStatsGrid');
    if (statsGrid) {
        statsGrid.innerHTML = `
            <div class="analytics-stat-card">
                <div class="analytics-stat-number accent">${data.totalEvents}</div>
                <div class="analytics-stat-label">Total Tasks</div>
            </div>
            <div class="analytics-stat-card">
                <div class="analytics-stat-number green">${data.completedEvents}</div>
                <div class="analytics-stat-label">Completed</div>
            </div>
            <div class="analytics-stat-card">
                <div class="analytics-stat-number gold">${Math.round(data.completionRate)}%</div>
                <div class="analytics-stat-label">Completion Rate</div>
            </div>
            <div class="analytics-stat-card">
                <div class="analytics-stat-number accent">${data.totalStudyTime > 60 ? Math.round(data.totalStudyTime / 60) + 'h' : data.totalStudyTime + 'm'}</div>
                <div class="analytics-stat-label">Study Time</div>
            </div>
        `;
    }

    // ---- Category Breakdown ----
    const catContainer = document.getElementById('categoryBreakdownContainer');
    if (catContainer) {
        const categories = data.categoryBreakdown;
        const total = Object.values(categories).reduce((a, b) => a + b, 0) || 1;
        if (Object.keys(categories).length === 0) {
            catContainer.innerHTML = '<p style="color: var(--text-muted);">No categories yet. Add some tasks!</p>';
        } else {
            catContainer.innerHTML = Object.entries(categories).map(([cat, count]) => `
                <div class="category-bar-item">
                    <span class="category-bar-label">${escapeHtml(cat)}</span>
                    <div class="category-bar-track">
                        <div class="category-bar-fill ${escapeHtml(cat)}" style="width: ${(count / total) * 100}%;"></div>
                    </div>
                    <span style="font-size:0.8rem;color:var(--text-muted);min-width:30px;">${count}</span>
                </div>
            `).join('');
        }
    }

    // ---- Optimal Study Times ----
    const optimalContainer = document.getElementById('optimalTimesContainer');
    if (optimalContainer) {
        const times = getOptimalStudyTimes();
        if (times.length === 0) {
            optimalContainer.innerHTML = '<p style="color: var(--text-muted);">Not enough data yet. Keep studying!</p>';
        } else {
            optimalContainer.innerHTML = times.map(time => `
                <span class="optimal-time-item">⏰ ${time}</span>
            `).join('');
        }
    }

    // ---- Scheduling Conflicts ----
    const conflictsContainer = document.getElementById('conflictsContainer');
    if (conflictsContainer) {
        const conflicts = detectSchedulingConflicts();
        if (conflicts.length === 0) {
            conflictsContainer.innerHTML = '<p style="color: #34d399; font-weight: 600;">✅ No conflicts detected! Your schedule is clean.</p>';
        } else {
            conflictsContainer.innerHTML = conflicts.map(c => `
                <div class="conflict-item">
                    <strong>${escapeHtml(c.event1.title)}</strong> overlaps with <strong>${escapeHtml(c.event2.title)}</strong>
                    <div class="conflict-suggestion">💡 ${escapeHtml(c.suggestion)}</div>
                </div>
            `).join('');
        }
    }
}

function renderFocusHistory() {
    const container = document.getElementById('focusHistoryContainer');
    if (!container) return;
    const history = JSON.parse(localStorage.getItem('focusHistory') || '[]');
    if (!history.length) {
        container.innerHTML = '<p style="color:var(--text-muted);">No sessions logged yet. Complete a focus timer session to start tracking.</p>';
        return;
    }
    const recent = history.slice(-10).reverse(); // last 10
    container.innerHTML = recent.map(s => `
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border-color);">
            <span>${s.modeLabel}</span>
            <span>${Math.round(s.duration/60)} min</span>
            <span style="color:var(--text-muted);font-size:0.8rem;">${new Date(s.timestamp).toLocaleString()}</span>
        </div>
    `).join('');
}

// ---- Auto-refresh analytics when switching to the view ----
// Add this to your switchView function in app.js:
// if (targetViewId === 'analytics-view') renderAnalytics();

// ---- Also call it on initial load ----
document.addEventListener('DOMContentLoaded', () => {
    // ... existing code ...
    renderAnalytics();
    renderHeatmap();
});

// HEAT MAP

function renderHeatmap() {
    const container = document.getElementById('heatmapContainer');
    if (!container) return;
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay(); // 0=Sun

    // Build a map of completed tasks per day
    const completionMap = {};
    events.forEach(ev => {
        if (!ev.completed) return;
        const date = new Date(ev.day + ' ' + ev.start);
        const day = date.getDate();
        if (date.getMonth() === month && date.getFullYear() === year) {
            completionMap[day] = (completionMap[day] || 0) + 1;
        }
    });

    const maxCount = Math.max(1, ...Object.values(completionMap));

    let html = '<div style="display:grid; grid-template-columns:repeat(7,1fr); gap:4px; max-width:500px; margin:0 auto;">';
    // Day headers
    ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(d => {
        html += `<div style="text-align:center;font-size:0.6rem;color:var(--text-muted);">${d}</div>`;
    });
    // Empty days before first
    for (let i = 0; i < firstDay; i++) {
        html += `<div></div>`;
    }
    // Days
    for (let d = 1; d <= daysInMonth; d++) {
        const count = completionMap[d] || 0;
        const intensity = count > 0 ? Math.min(100, (count / maxCount) * 100) : 0;
        const color = count === 0 ? 'rgba(255,255,255,0.04)' :
                    intensity < 30 ? 'rgba(124,109,240,0.3)' :
                    intensity < 60 ? 'rgba(124,109,240,0.6)' :
                    intensity < 90 ? 'rgba(124,109,240,0.85)' :
                    '#7c6df0';
        const title = count === 0 ? `${d} – No tasks` : `${d} – ${count} task${count>1?'s':''}`;
        html += `<div style="aspect-ratio:1; border-radius:4px; background:${color}; transition:var(--transition); cursor:default;" title="${title}"></div>`;
    }
    html += '</div>';

    // Add a small legend
    html += `<div style="display:flex; justify-content:center; gap:8px; margin-top:12px; font-size:0.65rem; color:var(--text-muted);">
        <span>Less</span>
        <span style="display:inline-block; width:14px; height:14px; border-radius:3px; background:rgba(124,109,240,0.2);"></span>
        <span style="display:inline-block; width:14px; height:14px; border-radius:3px; background:rgba(124,109,240,0.5);"></span>
        <span style="display:inline-block; width:14px; height:14px; border-radius:3px; background:rgba(124,109,240,0.8);"></span>
        <span style="display:inline-block; width:14px; height:14px; border-radius:3px; background:#7c6df0;"></span>
        <span>More</span>
    </div>`;

    container.innerHTML = html;
}
