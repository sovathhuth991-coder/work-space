// ============================================================
// USER EXPERIENCE ENHANCEMENTS (Features 16-20)
// ============================================================

// ============================================================
// FEATURE 16: GOAL TRACKING
// ============================================================

const DEFAULT_GOALS = [
    { id: 'goal_1', title: 'Complete 5 tasks daily', target: 5, unit: 'tasks', period: 'daily', createdAt: Date.now() },
    { id: 'goal_2', title: 'Study 4 hours daily', target: 240, unit: 'minutes', period: 'daily', createdAt: Date.now() },
    { id: 'goal_3', title: 'Maintain 7-day streak', target: 7, unit: 'days', period: 'weekly', createdAt: Date.now() }
];

let goals = JSON.parse(localStorage.getItem('userGoals') || 'null') || DEFAULT_GOALS;

function saveGoals() {
    localStorage.setItem('userGoals', JSON.stringify(goals));
}

function addGoal(title, target, unit, period) {
    const goal = {
        id: 'goal_' + Date.now(),
        title: title.trim(),
        target: parseInt(target),
        unit: unit,
        period: period,
        createdAt: Date.now()
    };
    goals.push(goal);
    saveGoals();
    renderGoals();
    showToast('🎯 Goal added!', 'success');
}

function deleteGoal(id) {
    if (!confirm('Delete this goal?')) return;
    goals = goals.filter(g => g.id !== id);
    saveGoals();
    renderGoals();
}

function getGoalProgress(goal) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (goal.period === 'daily') {
        const todayEvents = events.filter(e => {
            const eventDate = new Date(e.day);
            eventDate.setHours(0, 0, 0, 0);
            return eventDate.getTime() === today.getTime();
        });

        if (goal.unit === 'tasks') {
            const completed = todayEvents.filter(e => e.completed).length;
            return Math.min(100, Math.round((completed / goal.target) * 100));
        } else if (goal.unit === 'minutes') {
            const totalMinutes = todayEvents.reduce((sum, e) => {
                const [sh, sm] = e.start.split(':').map(Number);
                const [eh, em] = e.end.split(':').map(Number);
                return sum + ((eh * 60 + em) - (sh * 60 + sm));
            }, 0);
            return Math.min(100, Math.round((totalMinutes / goal.target) * 100));
        }
    } else if (goal.period === 'weekly') {
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        const weekEvents = events.filter(e => new Date(e.day) >= weekStart);

        if (goal.unit === 'days') {
            const streak = calculateStreak();
            return Math.min(100, Math.round((streak / goal.target) * 100));
        }
    }
    return 0;
}

function renderGoals() {
    const container = document.getElementById('goalsContainer');
    if (!container) return;

    if (goals.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 20px;">No goals set yet. Add your first goal below!</p>';
        return;
    }

    container.innerHTML = goals.map(goal => {
        const progress = getGoalProgress(goal);
        const progressColor = progress >= 100 ? '#34d399' : progress >= 50 ? '#fbbf24' : '#f87171';

        return `
            <div class="goal-item" style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 16px; margin-bottom: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                    <div style="flex: 1;">
                        <h4 style="margin: 0 0 4px 0; color: var(--text-primary); font-size: 0.95rem;">${escapeHtml(goal.title)}</h4>
                        <span style="font-size: 0.75rem; color: var(--text-muted);">${goal.period} • ${goal.target} ${goal.unit}</span>
                    </div>
                    <button onclick="deleteGoal('${goal.id}')" style="background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 1.2rem; padding: 0 4px;">×</button>
                </div>
                <div style="background: var(--bg-secondary); border-radius: 8px; height: 8px; overflow: hidden; margin-bottom: 6px;">
                    <div style="width: ${progress}%; height: 100%; background: ${progressColor}; transition: width 0.3s ease; border-radius: 8px;"></div>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-secondary);">
                    <span>${progress}% complete</span>
                    <span style="color: ${progress >= 100 ? '#34d399' : 'var(--text-muted)'};">${progress >= 100 ? '✓ Achieved!' : 'In progress'}</span>
                </div>
            </div>
        `;
    }).join('');
}

function showAddGoalForm() {
    const form = document.getElementById('addGoalForm');
    if (form) {
        form.style.display = form.style.display === 'none' ? 'block' : 'none';
    }
}

function handleAddGoal() {
    const titleInput = document.getElementById('goalTitle');
    const targetInput = document.getElementById('goalTarget');
    const unitSelect = document.getElementById('goalUnit');
    const periodSelect = document.getElementById('goalPeriod');

    if (!titleInput || !targetInput || !unitSelect || !periodSelect) return;

    const title = titleInput.value.trim();
    const target = targetInput.value;
    const unit = unitSelect.value;
    const period = periodSelect.value;

    if (!title || !target) {
        showToast('Please fill in all fields', 'error');
        return;
    }

    addGoal(title, target, unit, period);

    titleInput.value = '';
    targetInput.value = '';
    form.style.display = 'none';
}

// ============================================================
// FEATURE 17: COMPARISON TOOLS
// ============================================================

function getComparisonData() {
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    // Current week
    const currentWeekStart = new Date(today);
    currentWeekStart.setDate(today.getDate() - today.getDay());
    const currentWeekEnd = new Date(currentWeekStart);
    currentWeekEnd.setDate(currentWeekStart.getDate() + 6);

    // Previous week
    const previousWeekStart = new Date(currentWeekStart);
    previousWeekStart.setDate(currentWeekStart.getDate() - 7);
    const previousWeekEnd = new Date(currentWeekStart);
    previousWeekEnd.setDate(currentWeekStart.getDate() - 1);

    // Current month
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Previous month
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    const currentWeekEvents = events.filter(e => new Date(e.day) >= currentWeekStart && new Date(e.day) <= currentWeekEnd);
    const previousWeekEvents = events.filter(e => new Date(e.day) >= previousWeekStart && new Date(e.day) <= previousWeekEnd);

    const currentMonthEvents = events.filter(e => new Date(e.day) >= currentMonthStart && new Date(e.day) <= currentMonthEnd);
    const previousMonthEvents = events.filter(e => new Date(e.day) >= previousMonthStart && new Date(e.day) <= previousMonthEnd);

    const calculateStats = (eventList) => {
        const completed = eventList.filter(e => e.completed).length;
        const total = eventList.length;
        const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

        const totalMinutes = eventList.reduce((sum, e) => {
            const [sh, sm] = e.start.split(':').map(Number);
            const [eh, em] = e.end.split(':').map(Number);
            return sum + ((eh * 60 + em) - (sh * 60 + sm));
        }, 0);

        return { total, completed, completionRate, totalMinutes };
    };

    return {
        week: {
            current: calculateStats(currentWeekEvents),
            previous: calculateStats(previousWeekEvents),
            change: {}
        },
        month: {
            current: calculateStats(currentMonthEvents),
            previous: calculateStats(previousMonthEvents),
            change: {}
        }
    };
}

function renderComparisonTools() {
    const container = document.getElementById('comparisonContainer');
    if (!container) return;

    const data = getComparisonData();

    // Calculate changes
    data.week.change.tasks = data.week.current.total - data.week.previous.total;
    data.week.change.completion = data.week.current.completionRate - data.week.previous.completionRate;
    data.week.change.minutes = data.week.current.totalMinutes - data.week.previous.totalMinutes;

    data.month.change.tasks = data.month.current.total - data.month.previous.total;
    data.month.change.completion = data.month.current.completionRate - data.month.previous.completionRate;
    data.month.change.minutes = data.month.current.totalMinutes - data.month.previous.totalMinutes;

    const renderComparisonCard = (title, current, previous, change, icon) => {
        const changeSymbol = change > 0 ? '↑' : change < 0 ? '↓' : '→';
        const changeColor = change > 0 ? '#34d399' : change < 0 ? '#f87171' : 'var(--text-muted)';
        const changeText = change === 0 ? 'No change' : `${Math.abs(change)}%`;

        return `
            <div class="dash-card" style="grid-column: span 1;">
                <div class="card-inner">
                    <div class="card-header">
                        <h3>${icon} ${title}</h3>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px;">
                        <div style="background: var(--bg-secondary); padding: 12px; border-radius: 8px;">
                            <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 4px;">Current</div>
                            <div style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary);">${current}</div>
                        </div>
                        <div style="background: var(--bg-secondary); padding: 12px; border-radius: 8px;">
                            <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 4px;">Previous</div>
                            <div style="font-size: 1.5rem; font-weight: 700; color: var(--text-secondary);">${previous}</div>
                        </div>
                    </div>
                    <div style="margin-top: 12px; padding: 8px 12px; background: var(--bg-secondary); border-radius: 8px; text-align: center;">
                        <span style="font-size: 0.85rem; color: ${changeColor}; font-weight: 600;">
                            ${changeSymbol} ${changeText}
                        </span>
                    </div>
                </div>
            </div>
        `;
    };

    container.innerHTML = `
        <div style="grid-column: 1 / -1; margin-bottom: 20px;">
            <h3 style="margin: 0 0 8px 0; color: var(--text-primary);">📊 Performance Comparison</h3>
            <p style="margin: 0; color: var(--text-secondary); font-size: 0.9rem;">Compare your productivity across time periods</p>
        </div>

        ${renderComparisonCard('This Week', `${data.week.current.total} tasks`, `${data.week.previous.total} tasks`, Math.abs(data.week.change.tasks), '📅')}
        ${renderComparisonCard('Completion Rate', `${data.week.current.completionRate}%`, `${data.week.previous.completionRate}%`, Math.abs(data.week.change.completion), '✅')}
        ${renderComparisonCard('Study Time', `${Math.round(data.week.current.totalMinutes / 60)}h`, `${Math.round(data.week.previous.totalMinutes / 60)}h`, Math.abs(data.week.change.minutes), '⏱️')}

        <div style="grid-column: 1 / -1; margin-top: 20px; margin-bottom: 20px;">
            <h3 style="margin: 0 0 8px 0; color: var(--text-primary);">📈 Monthly Overview</h3>
        </div>

        ${renderComparisonCard('This Month', `${data.month.current.total} tasks`, `${data.month.previous.total} tasks`, Math.abs(data.month.change.tasks), '📆')}
        ${renderComparisonCard('Completion Rate', `${data.month.current.completionRate}%`, `${data.month.previous.completionRate}%`, Math.abs(data.month.change.completion), '🎯')}
        ${renderComparisonCard('Study Time', `${Math.round(data.month.current.totalMinutes / 60)}h`, `${Math.round(data.month.previous.totalMinutes / 60)}h`, Math.abs(data.month.change.minutes), '📚')}
    `;
}

// ============================================================
// FEATURE 18: ENHANCED KEYBOARD SHORTCUTS
// ============================================================

function initEnhancedKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        const active = document.activeElement;
        const isTyping = active && (
            active.tagName === 'INPUT' ||
            active.tagName === 'TEXTAREA' ||
            active.isContentEditable === true ||
            active.tagName === 'SELECT'
        );

        // Ctrl+G or Cmd+G = Toggle Goal Tracker
        if ((e.metaKey || e.ctrlKey) && e.key === 'g' && !e.shiftKey) {
            if (isTyping) return;
            e.preventDefault();
            const goalsView = document.getElementById('goals-view');
            if (goalsView) {
                switchView('goals-view');
            } else {
                showToast('Goal tracker not available', 'error');
            }
        }

        // Ctrl+Shift+F or Cmd+Shift+F = Toggle Focus Mode
        if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'F') {
            if (isTyping) return;
            e.preventDefault();
            if (typeof toggleFocusMode === 'function') {
                toggleFocusMode();
            }
        }

        // Ctrl+Shift+N or Cmd+Shift+N = Quick Add Task
        if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'N') {
            if (isTyping) return;
            e.preventDefault();
            if (typeof quickAddTask === 'function') {
                quickAddTask();
            }
        }

        // Ctrl+Shift+R or Cmd+Shift+R = Refresh Analytics
        if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'R') {
            if (isTyping) return;
            e.preventDefault();
            if (typeof renderAnalytics === 'function') {
                renderAnalytics();
                showToast('Analytics refreshed', 'info');
            }
        }

        // Ctrl+Shift+C or Cmd+Shift+C = Toggle Comparison View
        if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'C') {
            if (isTyping) return;
            e.preventDefault();
            const comparisonView = document.getElementById('comparison-view');
            if (comparisonView) {
                switchView('comparison-view');
            } else {
                showToast('Comparison tools not available', 'error');
            }
        }

        // Ctrl+Shift+T or Cmd+Shift+T = Toggle Theme
        if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'T') {
            if (isTyping) return;
            e.preventDefault();
            toggleDarkLightMode();
        }
    });
}

// ============================================================
// FEATURE 20: DARK/LIGHT THEME TOGGLE
// ============================================================

function toggleDarkLightMode() {
    const currentTheme = localStorage.getItem('currentTheme') || 'cyberpunk';
    const darkThemes = ['cyberpunk', 'ocean', 'sunset', 'forest', 'midnight'];
    const lightThemes = ['minimal'];

    const isDark = darkThemes.includes(currentTheme);
    const newTheme = isDark ? 'minimal' : 'cyberpunk';

    applyTheme(newTheme);
    showToast(`Switched to ${isDark ? 'Light' : 'Dark'} mode`, 'info');
}

function initThemeToggle() {
    // Add theme toggle button to header if it doesn't exist
    const header = document.querySelector('.hub-content > div[style*="sticky"]');
    if (header && !document.getElementById('themeToggleBtn')) {
        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'themeToggleBtn';
        toggleBtn.className = 'focus-toggle-btn';
        toggleBtn.setAttribute('data-action', 'toggleTheme');
        toggleBtn.style.cssText = 'margin-left:8px; padding:6px 14px; border-radius:99px; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:var(--text-secondary); font-size:0.8rem; cursor:pointer; transition:var(--transition);';
        toggleBtn.textContent = '🌓';
        toggleBtn.title = 'Toggle Dark/Light Mode';

        toggleBtn.addEventListener('click', toggleDarkLightMode);
        header.appendChild(toggleBtn);
    }
}

// ============================================================
// FEATURE 19: ENHANCED SEARCH & FILTER
// ============================================================

function initEnhancedSearch() {
    const searchInput = document.getElementById('globalSearchInput');
    if (!searchInput) return;

    // Add filter dropdown
    const existingDropdown = document.getElementById('searchFilters');
    if (existingDropdown) return;

    const filterContainer = document.createElement('div');
    filterContainer.id = 'searchFilters';
    filterContainer.style.cssText = 'display: flex; gap: 8px; align-items: center;';

    const filters = [
        { id: 'filterAll', label: 'All', value: 'all', active: true },
        { id: 'filterLessons', label: 'Lessons', value: 'lessons' },
        { id: 'filterTasks', label: 'Tasks', value: 'tasks' },
        { id: 'filterLibrary', label: 'Library', value: 'library' }
    ];

    filterContainer.innerHTML = filters.map(f => `
        <button class="filter-btn ${f.active ? 'active' : ''}" data-filter="${f.value}"
                style="padding: 4px 12px; border-radius: 6px; border: 1px solid var(--border-color);
                       background: ${f.active ? 'var(--accent-gradient)' : 'var(--bg-secondary)'};
                       color: ${f.active ? '#fff' : 'var(--text-secondary)'};
                       font-size: 0.75rem; cursor: pointer; transition: var(--transition);">
            ${f.label}
        </button>
    `).join('');

    searchInput.parentNode.insertBefore(filterContainer, searchInput.nextSibling);

    // Add filter click handlers
    filterContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('.filter-btn');
        if (!btn) return;

        const filter = btn.dataset.filter;

        // Update active state
        filterContainer.querySelectorAll('.filter-btn').forEach(b => {
            b.classList.remove('active');
            b.style.background = 'var(--bg-secondary)';
            b.style.color = 'var(--text-secondary)';
        });
        btn.classList.add('active');
        btn.style.background = 'var(--accent-gradient)';
        btn.style.color = '#fff';

        // Store current filter
        searchInput.dataset.currentFilter = filter;

        // Trigger search with filter
        if (searchInput.value.trim()) {
            searchInput.dispatchEvent(new Event('input'));
        }
    });

    // Initialize filter
    searchInput.dataset.currentFilter = 'all';
}

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    // Override global search to support filters
    const originalInitGlobalSearch = window.initGlobalSearch;
    window.initGlobalSearch = function() {
        if (originalInitGlobalSearch) {
            originalInitGlobalSearch();
        }
        initEnhancedSearch();
    };

    // Initialize enhanced keyboard shortcuts
    initEnhancedKeyboardShortcuts();

    // Initialize theme toggle
    initThemeToggle();

    // Initialize enhanced search
    initEnhancedSearch();

    // Add Goals view to navigation if not exists
    const navMenu = document.querySelector('.hub-menu');
    if (navMenu && !document.getElementById('goals-nav-btn')) {
        const toolsLabel = navMenu.querySelector('.hub-menu-label:nth-child(2)');
        if (toolsLabel) {
            const goalsBtn = document.createElement('button');
            goalsBtn.id = 'goals-nav-btn';
            goalsBtn.className = 'nav-btn hub-menu-item';
            goalsBtn.setAttribute('data-view', 'goals-view');
            goalsBtn.innerHTML = `
                <span class="nav-glow-border"></span>
                <span class="menu-icon">🎯</span>
                <span>Goals</span>
            `;
            toolsLabel.after(goalsBtn);
        }
    }

    // Add Goals view section if not exists
    if (!document.getElementById('goals-view')) {
        const mainContent = document.querySelector('.hub-content');
        if (mainContent) {
            const goalsView = document.createElement('section');
            goalsView.id = 'goals-view';
            goalsView.className = 'hub-view';
            goalsView.innerHTML = `
                <div class="view-header">
                    <div>
                        <p class="view-kicker">Track Your Progress</p>
                        <h1>Goal Tracker</h1>
                    </div>
                    <button class="matrix-btn" onclick="showAddGoalForm()">+ Add Goal</button>
                </div>

                <div id="addGoalForm" style="display:none; background: var(--bg-card); border: 1px solid var(--border-color);
                     border-radius: var(--radius-md); padding: 20px; margin-bottom: 24px;">
                    <h3 style="margin: 0 0 16px 0; color: var(--text-primary);">Create New Goal</h3>
                    <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                        <input type="text" id="goalTitle" placeholder="Goal title..."
                               style="padding: 10px 14px; border-radius: 8px; border: 1px solid var(--border-color);
                                      background: var(--bg-secondary); color: var(--text-primary);">
                        <input type="number" id="goalTarget" placeholder="Target" min="1"
                               style="padding: 10px 14px; border-radius: 8px; border: 1px solid var(--border-color);
                                      background: var(--bg-secondary); color: var(--text-primary);">
                        <select id="goalUnit"
                                style="padding: 10px 14px; border-radius: 8px; border: 1px solid var(--border-color);
                                       background: var(--bg-secondary); color: var(--text-primary);">
                            <option value="tasks">Tasks</option>
                            <option value="minutes">Minutes</option>
                            <option value="days">Days</option>
                        </select>
                        <select id="goalPeriod"
                                style="padding: 10px 14px; border-radius: 8px; border: 1px solid var(--border-color);
                                       background: var(--bg-secondary); color: var(--text-primary);">
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                        </select>
                    </div>
                    <div style="display: flex; gap: 8px; justify-content: flex-end;">
                        <button class="matrix-btn secondary" onclick="showAddGoalForm()">Cancel</button>
                        <button class="matrix-btn" onclick="handleAddGoal()">Save Goal</button>
                    </div>
                </div>

                <div id="goalsContainer"></div>
            `;

            // Insert before the first view
            const firstView = mainContent.querySelector('.hub-view');
            if (firstView) {
                mainContent.insertBefore(goalsView, firstView);
            } else {
                mainContent.appendChild(goalsView);
            }
        }
    }

    // Add Comparison view section if not exists
    if (!document.getElementById('comparison-view')) {
        const mainContent = document.querySelector('.hub-content');
        if (mainContent) {
            const comparisonView = document.createElement('section');
            comparisonView.id = 'comparison-view';
            comparisonView.className = 'hub-view';
            comparisonView.innerHTML = `
                <div class="view-header">
                    <div>
                        <p class="view-kicker">Analyze Trends</p>
                        <h1>Comparison Tools</h1>
                    </div>
                    <button class="matrix-btn" onclick="renderComparisonTools()">🔄 Refresh</button>
                </div>
                <div class="dash-card" style="grid-column: 1 / -1;">
                    <div class="card-inner">
                        <div id="comparisonContainer"></div>
                    </div>
                </div>
            `;

            const firstView = mainContent.querySelector('.hub-view');
            if (firstView) {
                mainContent.insertBefore(comparisonView, firstView);
            } else {
                mainContent.appendChild(comparisonView);
            }
        }
    }

    // Render goals on load
    setTimeout(renderGoals, 100);

    // Update switchView to handle new views
    const originalSwitchView = window.switchView;
    window.switchView = function(targetViewId) {
        if (targetViewId === 'goals-view') {
            renderGoals();
        } else if (targetViewId === 'comparison-view') {
            renderComparisonTools();
        }

        if (originalSwitchView) {
            originalSwitchView(targetViewId);
        }
    };
});

// Expose functions globally
window.addGoal = addGoal;
window.deleteGoal = deleteGoal;
window.showAddGoalForm = showAddGoalForm;
window.handleAddGoal = handleAddGoal;
window.renderGoals = renderGoals;
window.renderComparisonTools = renderComparisonTools;
window.toggleDarkLightMode = toggleDarkLightMode;
