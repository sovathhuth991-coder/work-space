// Main entry point – initializes all modules
const DEBUG = false;

// ---- Global Error Handler ----
// window.onerror = function(message, source, lineno, colno, error) {
//     console.error('🔥 Global error:', message, error);
//     showToast('⚠️ Something went wrong. Try refreshing the page.', 'error');
//     return false;
// };

// ---- Empty State Renderer ----
function renderEmptyState(container, message, icon = '📭') {
    if (!container) return;
    container.innerHTML = `
        <div style="grid-column:1/-1; text-align:center; padding:60px 20px; color:var(--text-muted);">
            <div style="font-size:3rem; margin-bottom:16px;">${icon}</div>
            <p style="font-size:1.1rem;">${message}</p>
        </div>
    `;
}
window.renderEmptyState = renderEmptyState;

document.addEventListener('DOMContentLoaded', () => {
    if (typeof initDevTools === 'function') {
        initDevTools();
    }
    requestNotificationPermission();
    applyTheme(currentTheme);
    initDragAndDrop();
    initDashboardEngine();
    // initTimerAI() is called in focus-timer.js DOMContentLoaded - removed duplicate
    renderSchedule();
    refreshWorkspace();
    renderMyTasks();
    renderLibrary();
    renderWidgets();
    initGlobalSearch();
    renderCalendarMonth();
    checkUpcomingEvents();

    // Collapsible menu sections
    document.addEventListener('click', function(e) {
        const label = e.target.closest('.hub-menu-label');
        if (!label) return;
        const groupEl = label.nextElementSibling;
        if (!groupEl || !groupEl.classList.contains('hub-menu-group')) return;
        const isCollapsed = groupEl.classList.contains('collapsed');
        groupEl.classList.toggle('collapsed', !isCollapsed);
        label.classList.toggle('collapsed', !isCollapsed);
        try {
            const collapsedGroups = JSON.parse(localStorage.getItem('collapsedNavGroups') || '[]');
            const labelText = label.textContent.trim();
            const next = isCollapsed
                ? collapsedGroups.filter(l => l !== labelText)
                : [...new Set([...collapsedGroups, labelText])];
            localStorage.setItem('collapsedNavGroups', JSON.stringify(next));
        } catch (_) { /* ignore */ }
    });

    // Restore collapsed nav groups from last session
    try {
        const collapsedGroups = JSON.parse(localStorage.getItem('collapsedNavGroups') || '[]');
        document.querySelectorAll('.hub-menu-label').forEach(label => {
            if (collapsedGroups.includes(label.textContent.trim())) {
                label.classList.add('collapsed');
                label.nextElementSibling?.classList.add('collapsed');
            }
        });
    } catch (_) { /* ignore */ }

    // ============================================================
    // MARK INITIAL RENDER TO PREVENT RE-ANIMATION
    // ============================================================
    setTimeout(() => {
        document.querySelectorAll('.dash-card, .stat-card, .calendar-event-item').forEach(el => {
            el.classList.add('rendered');
        });
    }, 1000);

    // ============================================================
    // EVENT DELEGATION FOR NAVIGATION AND ACTION BUTTONS
    // ============================================================
    document.addEventListener('click', function(e) {
        // Handle navigation buttons
        const navBtn = e.target.closest('.nav-btn[data-view]');
        if (navBtn) {
            const viewId = navBtn.dataset.view;
            if (typeof switchView === 'function') {
                switchView(viewId);
            }
            return;
        }

        // Handle stat cards with data-view
        const statCard = e.target.closest('[data-action="switchView"][data-view]');
        if (statCard) {
            const viewId = statCard.dataset.view;
            if (typeof switchView === 'function') {
                switchView(viewId);
            }
            return;
        }

        // Handle action buttons
        const actionBtn = e.target.closest('[data-action]');
        if (!actionBtn) return;

        const action = actionBtn.dataset.action;

        // Action handler map - cleaner and more maintainable
        const actionHandlers = {
            'quickAdd': () => quickAddTask?.(),
            'startTour': () => startTour?.(),
            'showShortcuts': () => showShortcuts?.(),
            'clearAllData': () => clearAllData?.(),
            'toggleSidebarMenu': () => toggleSidebarMenu?.(),
            'toggleLibraryForm': () => {
                const f = document.getElementById('library-add-form');
                f && (f.style.display = f.style.display === 'none' ? 'block' : 'none');
            },
            'addLibraryItem': () => addLibraryItem?.(),
            'renderKnowledgeGraph': () => renderKnowledgeGraph?.(),
            'exportToIcal': () => exportToIcal?.(),
            'triggerIcalImport': () => triggerIcalImport?.(),
            'jumpToTodaySchedule': () => jumpToTodaySchedule?.(),
            'addTaskToday': () => addTaskToday?.(),
            'changeMonth': () => {
                const delta = parseInt(actionBtn.dataset.delta) || 0;
                changeMonth?.(delta);
            },
            'addHabit': () => addHabit?.(),
            'addDashTodo': () => addDashTodo?.(),
            'closeTaskModal': () => closeTaskModal?.(),
            'confirmAddTask': () => confirmAddTask?.(),
            'exportBackup': () => exportBackup?.(),
            'exportPageAsMarkdown': () => exportPageAsMarkdown?.(),
            'exportPageAsHTML': () => exportPageAsHTML?.(),
            'windowPrint': () => window.print(),
            'importBackup': () => document.getElementById('backup-import-input')?.click(),
            'triggerImportBackup': () => document.getElementById('backup-import-input')?.click(),
            'clearSearch': () => clearSearch?.(),
            'toggleFindBar': () => toggleFindBar?.(),
            'toggleSidebar': () => toggleSidebar?.(),
            'renderAnalytics': () => renderAnalytics?.(),
            'toggleLofiConsole': () => toggleLofiConsole?.(),
            'toggleRainSound': () => toggleRainSound?.(),
            'rainVolumeStep': () => stepRainVolume?.(parseFloat(actionBtn.dataset.step)),
            'toggleFocusMode': () => toggleFocusMode?.(),
            'toggleFocusStatsView': () => toggleFocusStatsView?.(),
            'openTutorialGuide': () => openTutorialGuide?.(),
            'closeTutorialGuide': () => closeTutorialGuide?.(),
            'applyTheme': () => actionBtn.closest('select') && applyTheme?.(actionBtn.closest('select').value),
            'closeSessionDetailsModal': () => closeSessionDetailsModal?.(),
            'showSessionDetailsModal': () => showSessionDetailsModal?.(),
            'resetDashboardLayout': () => resetDashboardLayout?.(),
            'smartReorderDashboard': () => window.smartReorderDashboard?.(),
            'toggleSettingsPanel': () => toggleSettingsPanel?.(),
            'closeSettingsPanel': () => toggleSettingsPanel?.(),
            'setLayoutMode': () => window.__setLayoutMode?.(actionBtn.dataset.layoutMode),
            'toggleResizeHandles': () => window.__toggleResizeHandles?.(),
            'closeFocusGoalModal': () => closeFocusGoalModal?.(),
            'saveFocusGoalModal': () => saveFocusGoalModal?.(),
            'closeGenericDetailModal': () => closeGenericDetailModal?.(),
            'toggleExportOptions': () => toggleExportOptions?.(),
            'toggleReadingForm': () => ReadingListEngine?.showAddForm(),
            'saveReadingItem': () => {
                const btn = document.getElementById('readingAddBtn');
                if (btn?.dataset.editId) {
                    ReadingListEngine?.handleUpdate();
                } else {
                    ReadingListEngine?.handleAdd();
                }
            },
            'cancelReadingEdit': () => {
                ReadingListEngine?.clearForm();
                const form = document.getElementById('readingAddForm');
                if (form) form.style.display = 'none';
                const btn = document.getElementById('readingAddBtn');
                if (btn) {
                    btn.textContent = 'Add Item';
                    delete btn.dataset.editId;
                }
            },
            'searchReadingList': () => {
                const query = document.getElementById('readingSearch')?.value || '';
                ReadingListEngine?.setSearch(query);
            },
            'filterReadingList': () => {
                const filter = actionBtn.dataset.filter;
                ReadingListEngine?.setFilter(filter);
            },
            'editReadingItem': () => {
                const id = parseInt(actionBtn.dataset.id);
                ReadingListEngine?.handleEdit(id);
            },
            'deleteReadingItem': () => {
                const id = parseInt(actionBtn.dataset.id);
                ReadingListEngine?.handleDelete(id);
            },
            'openAccountModal': () => window.openAccountModal?.(),
            'closeAccountModal': () => window.closeAccountModal?.(),
            'switchAccountTab': () => window.switchAccountTab?.(actionBtn.dataset.tab),
            'handleAccountSignIn': () => window.handleAccountSignIn?.(),
            'handleAccountSignUp': () => window.handleAccountSignUp?.(),
            'handleAccountMagicLink': () => window.handleAccountMagicLink?.(),
            'handleAccountSignOut': () => window.handleAccountSignOut?.(),
            'handleAccountSyncNow': () => window.handleAccountSyncNow?.()
        };

        const handler = actionHandlers[action];
        if (handler) handler();
    });

    // ============================================================
    // INPUT-EVENT ACTIONS (rain volume slider, lesson search box)
    // These use data-action too, but need 'input' not 'click',
    // so they can't go through the click-delegated handler above.
    // ============================================================
    document.getElementById('rainVolume')?.addEventListener('input', (e) => {
        changeRainVolume?.(parseFloat(e.target.value));
    });
    document.getElementById('lessonSearchInput')?.addEventListener('input', (e) => {
        searchLessons?.(e.target.value);
    });

    // ============================================================
    // TASK MODAL KEYBOARD SUPPORT
    // ============================================================
    document.addEventListener('keydown', (e) => {
        const modal = document.getElementById('taskAddModal');
        if (!modal || modal.style.display !== 'flex') return;

        // Enter to confirm
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (typeof confirmAddTask === 'function') {
                confirmAddTask();
            }
        }

        // Escape to close
        if (e.key === 'Escape') {
            e.preventDefault();
            if (typeof closeTaskModal === 'function') {
                closeTaskModal();
            }
        }
    });

    // Throttle auto-refresh with Page Visibility API
    let autoRefreshInterval = null;

    function startAutoRefresh() {
        if (autoRefreshInterval) return;
        autoRefreshInterval = setInterval(() => {
            renderSchedule();
            updateDashboardLiveSession();
            if (currentOpenDay) {
                const modal = document.getElementById('diagramModal');
                const active = document.activeElement;
                const editing = modal && modal.contains(active) && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT');
                if (!editing) openDayDiagram(currentOpenDay);
            }
        }, 300000);
    }

    function stopAutoRefresh() {
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
            autoRefreshInterval = null;
        }
    }

    // Pause intervals when tab is hidden to save resources
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            stopAutoRefresh();
        } else {
            startAutoRefresh();
        }
    });

    // Start the auto-refresh loop
    startAutoRefresh();

    // ============================================================
    // BURGER MENU TOGGLE
    // ============================================================
    // NOTE: The actual open/close toggle is handled by toggleSidebarMenu()
    // (see the delegated data-action="toggleSidebarMenu" handler above,
    // and toggleSidebarMenu()'s definition later in this file). Do NOT add
    // a second click listener on #burgerToggle here — it double-toggles
    // the 'open'/'active' classes on every click and cancels itself out,
    // which is why the burger menu appeared to do nothing on mobile.
    const burgerToggle = document.getElementById('burgerToggle');
    const sidebar = document.getElementById('hubSidebar');

    if (burgerToggle && sidebar) {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const sidebar = document.getElementById('hubSidebar');
                if (sidebar && sidebar.classList.contains('open')) {
                    closeSidebarMenu();
                }
            }
        });
    }

    if (DEBUG) {
        console.log('🚀 Workspace Hub initialized');
        console.log('📅 Events:', events.length);
        console.log('📁 Folders:', hubState.folders.length);
        console.log('📚 Library items:', libraryItems.length);
        console.log('✅ Tasks:', myTasks.length);
        console.log('🌓 Theme:', currentTheme);
    }

    // Initialize Reading List
    if (typeof ReadingListEngine !== 'undefined') {
        ReadingListEngine.render();
    }
});

// ============================================================
// NAVIGATION SYSTEM
// ============================================================
window.switchView = function(targetViewId) {
    try {
        const views = document.querySelectorAll('.hub-view');
        views.forEach(view => view.classList.remove('active'));

        const targetView = document.getElementById(targetViewId);
        if (!targetView) {
            console.warn(`View "${targetViewId}" not found`);
            return;
        }

        targetView.classList.add('active');

        // ==== FIRE CUSTOM EVENT FOR SCHEDULE GRAPH ====
        const event = new CustomEvent('viewChanged', { detail: { viewId: targetViewId } });
        document.dispatchEvent(event);

        const buttons = document.querySelectorAll('.nav-btn');
        buttons.forEach(btn => btn.classList.remove('active'));

        const clickedButton = Array.from(buttons).find(btn => {
            return btn.dataset.view === targetViewId;
        });
        if (clickedButton) clickedButton.classList.add('active');

        const viewInitMap = {
            'schedule-view': [() => renderSchedule?.()],
            'todo-view': [() => renderDashTodos?.(), () => updateDashProgress?.(false)],
            'lessons-view': [() => refreshWorkspace?.()],
            'weather-view': [() => renderWeatherView?.()],
            'dashboard-view': [() => updateDashboardLiveSession?.(), () => updateDashProgress?.(false), () => updateDailyStats?.()],
            'ai-view': [() => renderContextPanel?.(), () => document.getElementById('ai-input-view')?.focus()],
            'graph-view': [() => setTimeout(() => renderKnowledgeGraph?.(), 100)],
            'analytics-view': [() => renderAnalytics?.(), () => renderFocusHistory?.(), () => renderHeatmap?.()]
        };
        (viewInitMap[targetViewId] || []).forEach(fn => fn?.());

        if (typeof updateDailyStats === 'function') {
            updateDailyStats();
        }

        try {
            localStorage.setItem('activeView', targetViewId);
        } catch (_) { /* ignore */ }

        if (window.innerWidth < 850) {
            closeSidebarMenu();
        }
    } catch (error) {
        console.error('SwitchView error:', error);
        showToast('⚠️ Something went wrong switching views. Reload the page.', 'error');
    }
};

// ============================================================
// INITIALIZE ACTIVE VIEW ON LOAD
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
    if (typeof handleUrlParams === 'function') {
        handleUrlParams();
    }
    const savedView = localStorage.getItem('activeView') || 'dashboard-view';


    const viewExists = document.getElementById(savedView) !== null;
    const initialView = viewExists ? savedView : 'dashboard-view';

    if (typeof updateDailyStats === 'function') updateDailyStats();
    window.switchView(initialView);
});

// ============================================================
// KEYBOARD SHORTCUTS
// ============================================================
document.addEventListener('keydown', (e) => {
    // ─── Helper: check if user is typing in a text field ───
    const active = document.activeElement;
    const isTyping = active && (
        active.tagName === 'INPUT' ||
        active.tagName === 'TEXTAREA' ||
        active.isContentEditable === true ||
        active.tagName === 'SELECT'
    );

    // Skip shortcuts when typing (except Escape)
    if (isTyping && e.key !== 'Escape') return;

    // ─── View switching with Cmd+1..8 (unchanged) ───
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey) {
        switch (e.key) {
            case '1': e.preventDefault(); switchView('dashboard-view'); break;
            case '2': e.preventDefault(); switchView('schedule-view'); break;
            case '3': e.preventDefault(); switchView('timer-view'); break;
            case '4': e.preventDefault(); switchView('todo-view'); break;
            case '5': e.preventDefault(); switchView('lessons-view'); break;
            case '6': e.preventDefault(); switchView('analytics-view'); break;
            case '7': e.preventDefault(); switchView('library-view'); break;
            case '8': e.preventDefault(); switchView('graph-view'); break;
        }
    }

    // ─── Undo (Cmd+Z) and Redo (Cmd+Shift+Z) ───
    if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        if (typeof undo === 'function') {
            e.preventDefault();
            undo();
        }
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) {
        if (typeof redo === 'function') {
            e.preventDefault();
            redo();
        }
    }

    // ─── Ctrl+N (or Cmd+N) = New Task ───
    if ((e.metaKey || e.ctrlKey) && e.key === 'n' && !e.shiftKey) {
        e.preventDefault();
        switchView('schedule-view');
        setTimeout(() => openDayDiagram(getTodayName()), 150);
    }

    // ─── Ctrl+F (or Cmd+F) = Focus Timer ───
    if ((e.metaKey || e.ctrlKey) && e.key === 'f' && !e.shiftKey) {
        e.preventDefault();
        switchView('timer-view');
    }

    // ─── Ctrl+S (or Cmd+S) = Focus Global Search ───
    if ((e.metaKey || e.ctrlKey) && e.key === 's' && !e.shiftKey) {
        e.preventDefault();
        const searchInput = document.getElementById('globalSearchInput');
        if (searchInput) {
            searchInput.focus();
            searchInput.select();
        }
    }

    // ─── Ctrl+J (or Cmd+J) = Journal View ───
    if ((e.metaKey || e.ctrlKey) && e.key === 'j' && !e.shiftKey) {
        e.preventDefault();
        switchView('journal-view');
    }

    // ─── Ctrl+? (or Cmd+?) = Show Shortcuts ───
    if ((e.metaKey || e.ctrlKey) && e.key === '?' && !e.shiftKey) {
        e.preventDefault();
        showShortcuts?.();
    }

    // ─── Escape to close modals / search (always works) ───
    if (e.key === 'Escape') {
        const modal = document.getElementById('diagramModal');
        if (modal && modal.style.display === 'flex') {
            closeDayDiagram();
        }
        const dropdown = document.getElementById('globalSearchDropdown');
        if (dropdown) dropdown.style.display = 'none';
    }
});

// ============================================================
// 🌐 GLOBAL UNIFIED SEARCH ENGINE
// ============================================================

/**
 * Initializes the global search bar that searches across:
 * - Lessons (pages and block content via hubState)
 * - Schedule events
 * - Library items
 */
function initGlobalSearch() {
    const input = document.getElementById('globalSearchInput');
    const dropdown = document.getElementById('globalSearchDropdown');
    const resultsLabel = document.getElementById('globalSearchResults');
    if (!input) return;

    input.addEventListener('input', debounce((e) => {
        const query = e.target.value.trim().toLowerCase();
        if (!query) {
            dropdown.style.display = 'none';
            resultsLabel.textContent = '';
            return;
        }

        const matches = [];

        // Search Lessons (pages and blocks)
        if (typeof hubState !== 'undefined' && hubState.pages) {
            Object.values(hubState.pages).forEach(page => {
                if (page.title && page.title.toLowerCase().includes(query)) {
                    matches.push({ type: '📄 Lesson', name: page.title, link: 'Open in Lessons' });
                }
                if (page.blocks && Array.isArray(page.blocks)) {
                    page.blocks.forEach(block => {
                        if (block.content && block.content.toLowerCase().includes(query)) {
                            matches.push({
                                type: '📝 Block',
                                name: `"${block.content.slice(0, 40)}..."`,
                                page: page.title
                            });
                        }
                    });
                }
            });
        }

        // Search Schedule Events
        if (typeof events !== 'undefined') {
            events.forEach(ev => {
                if (ev.title && ev.title.toLowerCase().includes(query)) {
                    matches.push({ type: '📅 Task', name: `${ev.title} (${ev.day} ${ev.start})` });
                }
            });
        }

        // Search Library
        if (typeof libraryItems !== 'undefined') {
            libraryItems.forEach(item => {
                if (item.title && item.title.toLowerCase().includes(query)) {
                    matches.push({ type: '📚 Library', name: item.title, url: item.url });
                } else if (item.tags && item.tags.toLowerCase().includes(query)) {
                    matches.push({ type: '📚 Library', name: item.title, url: item.url });
                }
            });
        }

        // Render results
        if (matches.length === 0) {
            dropdown.innerHTML = '<div style="padding:12px;color:var(--text-muted);">No results found</div>';
            dropdown.style.display = 'block';
            resultsLabel.textContent = '0 results';
            return;
        }

        resultsLabel.textContent = `${matches.length} result${matches.length > 1 ? 's' : ''}`;
        dropdown.innerHTML = '';
        matches.forEach(m => {
            const row = document.createElement('div');
            row.style.padding = '8px 12px';
            row.style.borderBottom = '1px solid var(--border-color)';
            row.style.cursor = 'pointer';
            // Hover styling is handled by the #globalSearchDropdown>div:hover CSS rule

            const typeSpan = document.createElement('span');
            typeSpan.style.fontWeight = '600';
            typeSpan.style.color = 'var(--accent-1)';
            typeSpan.textContent = m.type;
            row.appendChild(typeSpan);

            const nameSpan = document.createElement('span');
            nameSpan.style.color = 'var(--text-secondary)';
            nameSpan.textContent = ` ${m.name}`;
            row.appendChild(nameSpan);

            if (m.page) {
                const pageSpan = document.createElement('span');
                pageSpan.style.color = 'var(--text-muted)';
                pageSpan.style.fontSize = '0.75rem';
                pageSpan.textContent = ` in ${m.page}`;
                row.appendChild(pageSpan);
            }

            row.addEventListener('click', () => handleGlobalSearchClick(m));
            dropdown.appendChild(row);
        });
        dropdown.style.display = 'block';
    }, 300));

    // Close dropdown on outside click
    document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target) && e.target !== input) {
            dropdown.style.display = 'none';
        }
    });
}

/**
 * Handles clicking on a search result item.
 * Navigates to the appropriate view based on result type.
 * @param {Object} item - The search result item
 */
function handleGlobalSearchClick(item) {
    const dropdown = document.getElementById('globalSearchDropdown');
    const input = document.getElementById('globalSearchInput');
    dropdown.style.display = 'none';
    input.value = '';

    if (item.type.includes('Lesson') || item.type.includes('Block')) {
        switchView('lessons-view');
    } else if (item.type.includes('Task')) {
        switchView('schedule-view');
        setTimeout(() => openDayDiagram(getTodayName()), 100);
    } else if (item.type.includes('Library') && item.url && item.url.startsWith('http')) {
        window.open(item.url, '_blank');
    } else if (item.type.includes('Library')) {
        showToast('Invalid URL', 'error');
    }
    showToast(`Found: ${item.name}`, 'info');
}

// Expose globally
window.initGlobalSearch = initGlobalSearch;
window.handleGlobalSearchClick = handleGlobalSearchClick;

// ============================================================
// 🎵 AUDIO & LoFi WIDGET CONTROLS
// ============================================================

let rainAudio = document.getElementById('rainAudioEngine');
let rainPlaying = false;

function toggleLofiConsole() {
    const widget = document.getElementById('lofiWidget');
    const btn = document.getElementById('lofiToggleBtn');
    if (!widget) return;
    widget.classList.toggle('minimized');
    if (btn) {
        btn.textContent = widget.classList.contains('minimized') ? '🎛️' : '−';
    }
}

function toggleRainSound() {
    rainAudio ||= document.getElementById('rainAudioEngine');
    if (!rainAudio) return;
    const btn = document.getElementById('rainPlayBtn');
    if (rainPlaying) {
        rainAudio.pause();
        rainPlaying = false;
        btn && (btn.textContent = '▶');
    } else {
        rainAudio.play().catch(() => {});
        rainPlaying = true;
        btn && (btn.textContent = '⏸');
    }
}

function stepRainVolume(step) {
    rainAudio ||= document.getElementById('rainAudioEngine');
    if (!rainAudio) return;
    const next = Math.max(0, Math.min(1, Math.round((rainAudio.volume + step * 0.1) * 10) / 10));
    rainAudio.volume = next;
    const slider = document.getElementById('rainVolume');
    if (slider) slider.value = next;
}

function changeRainVolume(value) {
    rainAudio ||= document.getElementById('rainAudioEngine');
    rainAudio && (rainAudio.volume = parseFloat(value));
}

function showShortcuts() {
const existing = document.getElementById('shortcutsModal');
if (existing) { existing.remove(); return; }

const modal = document.createElement('div');
modal.id = 'shortcutsModal';
modal.style.cssText = `
    position:fixed; top:0; left:0; width:100%; height:100%;
    background:rgba(0,0,0,0.6); backdrop-filter:blur(8px);
    z-index:10000; display:flex; align-items:center; justify-content:center;
    animation:fadeIn 0.2s ease;
`;
modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

const box = document.createElement('div');
box.style.cssText = `
    background:var(--bg-card); border:1px solid var(--border-color);
    border-radius:16px; padding:32px; max-width:500px; width:90%;
    max-height:80vh; overflow-y:auto;
    box-shadow:var(--shadow-elevated);
`;
box.innerHTML = `
    <h2 style="margin:0 0 16px;display:flex;justify-content:space-between;align-items:center;">
    ⌨️ Keyboard Shortcuts
    <button class="matrix-btn" onclick="document.getElementById('shortcutsModal').remove()">✕</button>
    </h2>
    <ul style="list-style:none;padding:0;display:flex;flex-direction:column;gap:8px;">
        <li><kbd>⌘1</kbd> – Dashboard</li>
        <li><kbd>⌘2</kbd> – Schedule</li>
        <li><kbd>⌘3</kbd> – Timer</li>
        <li><kbd>⌘4</kbd> – Master To‑Do</li>
        <li><kbd>⌘5</kbd> – Lessons</li>
        <li><kbd>⌘6</kbd> – Analytics</li>
        <li><kbd>⌘7</kbd> – Library</li>
        <li><kbd>⌘8</kbd> – Knowledge Graph</li>
        <li><kbd>⌘Z</kbd> – Undo</li>
        <li><kbd>⌘⇧Z</kbd> – Redo</li>
        <li><kbd>⌘N</kbd> – New Task (today)</li>
        <li><kbd>⌘F</kbd> – Focus Timer</li>
        <li><kbd>⌘S</kbd> – Focus Search</li>
        <li><kbd>⌘?</kbd> – Show Shortcuts</li>
        <li><kbd>Esc</kbd> – Close modals / search</li>
    </ul>
    <p style="font-size:0.8rem;color:var(--text-muted);margin-top:12px;">On Windows/Linux, use <kbd>Ctrl</kbd> instead of ⌘</p>
`;
modal.appendChild(box);
document.body.appendChild(modal);
}


// ============================================================
// FOCUS MODE – Class‑based (clean, CSS-driven)
// ============================================================

let focusModeActive = false;

function toggleFocusMode() {
    focusModeActive = !focusModeActive;
    const toggleBtn = document.getElementById('toggleFocusMode');

    // ─── Toggle the class on the body ───
    document.body.classList.toggle('focus-mode', focusModeActive);

    // ─── Update button text and active state ───
    if (toggleBtn) {
        toggleBtn.textContent = focusModeActive ? '🔓 Exit' : '🧘 Focus';
        toggleBtn.classList.toggle('active', focusModeActive);
    }

    // ─── Show/hide views (CSS handles the rest) ───
    const allViews = document.querySelectorAll('.hub-view');
    if (focusModeActive) {
        // Hide all views except timer
        allViews.forEach(view => {
            if (view.id !== 'timer-view') {
                view.style.display = 'none';
            }
        });
        const timerView = document.getElementById('timer-view');
        if (timerView) {
            timerView.style.display = 'block';
            timerView.classList.add('active');
            // Switch to timer view
            if (typeof switchView === 'function') {
                switchView('timer-view');
            }
        }
        showToast('🧘 Focus Mode on – distractions hidden', 'info');
    } else {
        // Restore all views
        allViews.forEach(view => {
            view.style.display = '';
            view.classList.remove('active');
        });
        // Re‑activate the previous view
        const activeView = localStorage.getItem('activeView') || 'dashboard-view';
        if (typeof switchView === 'function') {
            switchView(activeView);
        }
        showToast('Focus Mode off', 'info');
    }
}

// ============================================================
// FOCUS STATS VIEW – collapse/expand the header's live
// focus/break/idle time readout (⏱ / ☕ / ⏸ next to Focus toggle)
// ============================================================

let focusStatsVisible = localStorage.getItem('focusStatsVisible') !== 'false'; // default: shown

function toggleFocusStatsView() {
    focusStatsVisible = !focusStatsVisible;
    localStorage.setItem('focusStatsVisible', focusStatsVisible);
    applyFocusStatsVisibility();
}

function applyFocusStatsVisibility() {
    const btn = document.getElementById('toggleFocusStats');
    if (!btn) return;
    btn.classList.toggle('active', focusStatsVisible);
    // Keep the first icon (⏱) always visible so the button still reads as
    // "this is the stats toggle" even when collapsed; hide the rest.
    const spans = btn.querySelectorAll('span');
    spans.forEach((span, i) => {
        if (i === 0) return;
        span.style.display = focusStatsVisible ? '' : 'none';
    });
}

// Apply saved preference once the header exists
document.addEventListener('DOMContentLoaded', applyFocusStatsVisibility);

window.toggleFocusMode = toggleFocusMode;

// ============================================================
// HEADER TOGGLE BUTTONS – Sideways Dropdown Toggle
// ============================================================

function initHeaderToggles() {
    const mainToggleBtn = document.getElementById('headerToggleMain');
    const toggleDropdown = document.getElementById('headerToggleDropdown');
    const toggleArrow = document.getElementById('toggleArrow');
    const toggleStatsBtn = document.getElementById('toggleFocusStats');
    const toggleFocusBtn = document.getElementById('toggleFocusMode');
    const toggleThemeBtn = document.getElementById('toggleTheme');

    // Toggle dropdown visibility
    if (mainToggleBtn && toggleDropdown) {
        mainToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isShowing = toggleDropdown.classList.contains('show');

            if (isShowing) {
                toggleDropdown.classList.remove('show');
                if (toggleArrow) {
                    toggleArrow.style.transform = 'rotate(0deg)';
                }
            } else {
                toggleDropdown.classList.add('show');
                if (toggleArrow) {
                    toggleArrow.style.transform = 'rotate(90deg)';
                }
            }
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!mainToggleBtn.contains(e.target) && !toggleDropdown.contains(e.target)) {
                toggleDropdown.classList.remove('show');
                if (toggleArrow) {
                    toggleArrow.style.transform = 'rotate(0deg)';
                }
            }
        });
    }

    // Focus Stats button - stats are always visible in the button
    // No toggle needed since the time displays are embedded in the button
    if (toggleStatsBtn) {
        toggleStatsBtn.addEventListener('click', () => {
            // Visual feedback only - stats are always shown
            toggleStatsBtn.classList.toggle('active');
            setTimeout(() => toggleStatsBtn.classList.remove('active'), 300);
        });
    }

    // Focus Mode toggle
    if (toggleFocusBtn) {
        toggleFocusBtn.addEventListener('click', () => {
            if (typeof toggleFocusMode === 'function') {
                toggleFocusMode();
            }
        });
    }

    // Theme toggle (cycle through themes)
    if (toggleThemeBtn) {
        toggleThemeBtn.addEventListener('click', () => {
            const themes = window.THEME_NAMES || ['cyberpunk', 'minimal', 'ocean', 'sunset', 'forest', 'midnight'];
            const currentThemeIndex = themes.indexOf(currentTheme);
            const nextThemeIndex = (currentThemeIndex + 1) % themes.length;
            const nextTheme = themes[nextThemeIndex];

            if (typeof applyTheme === 'function') {
                applyTheme(nextTheme);
                toggleThemeBtn.classList.add('active');
                setTimeout(() => toggleThemeBtn.classList.remove('active'), 300);

                // Update theme button icon based on theme
                const themeIcons = {
                    'cyberpunk': '🌆',
                    'minimal': '☀️',
                    'ocean': '🌊',
                    'sunset': '🌅',
                    'forest': '🌲',
                    'midnight': '🌙'
                };
                toggleThemeBtn.textContent = themeIcons[nextTheme] || '🌓';
            }
        });
    }
}

window.initHeaderToggles = initHeaderToggles;

// Initialize header toggles when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHeaderToggles);
} else {
    initHeaderToggles();
}

    // Initialize Session Hub drag & resize
    if (typeof initSessionHub === 'function') {
        initSessionHub();
    }

    // Initialize Dashboard Cards drag & resize
    if (typeof initDashboardCards === 'function') {
        initDashboardCards();
    }

    let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const btn = document.getElementById('pwaInstallBtn');
    if (btn) btn.style.display = 'block';
});
function installApp() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((result) => {
            if (result.outcome === 'accepted') {
                showToast('App installed! 🎉', 'success');
            }
            deferredPrompt = null;
            const btn = document.getElementById('pwaInstallBtn');
            if (btn) btn.style.display = 'none';
        });
    }
}

// Also add the button to Lessons view header
// Inside #lessons-view .view-header (you can add it manually or we'll do it via JS)
// For simplicity, just paste this after the timer button logic.

// ============================================================
// QUICK ADD TASK
// ============================================================

function quickAddTask() {
    switchView('schedule-view');
    setTimeout(() => {
        openDayDiagram(getTodayName());
    }, 150);
}

// ============================================================
// CLEAR ALL DATA
// ============================================================
async function clearAllData(clearCache = false) {
    if (!confirm('⚠️ This will permanently delete ALL your data (events, lessons, tasks, widgets, todos, templates, etc.).\nAre you sure?')) return;
    if (!confirm('Really? There is no undo.')) return;

    localStorage.clear();

    if (clearCache && 'caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
    }

    showToast(clearCache ? 'All data and cache cleared. Reloading...' : 'All data cleared. Reloading...', 'warning');
    setTimeout(() => window.location.reload(), 500);
}

// Backward compatibility
window.clearAllDataAndCache = () => clearAllData(true);

// Full mobile-sidebar cleanup, shared by the Escape key, switchView(), and the
// resize handler below — previously each of these did its own partial reset,
// and switchView() in particular only removed the sidebar's 'open' class
// without hiding the backdrop, resetting the burger icon, or restoring body
// scroll. That meant tapping any nav link on mobile left the dimmed backdrop
// covering the screen (still intercepting taps) and body scroll locked, so
// the app looked broken immediately after the first use of the menu.
function closeSidebarMenu() {
    const sidebar = document.getElementById('hubSidebar');
    const burger = document.getElementById('burgerToggle');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (sidebar) sidebar.classList.remove('open');
    if (burger) {
        burger.classList.remove('active');
        burger.setAttribute('aria-expanded', 'false');
    }
    if (backdrop) backdrop.style.display = 'none';
    document.body.style.overflow = '';
}
window.closeSidebarMenu = closeSidebarMenu;

// ============================================================
// SIDEBAR TOGGLE – with backdrop overlay
// ============================================================
function toggleSidebarMenu() {
    const shell = document.querySelector('.hub-shell');
    const sidebar = document.getElementById('hubSidebar');
    const burger = document.getElementById('burgerToggle');
    const backdrop = document.getElementById('sidebarBackdrop');

    if (!shell || !sidebar || !burger) return;

    const isMobile = window.innerWidth <= 850;

    if (isMobile) {
        // Mobile: toggle 'open' class on sidebar (transform)
        const isOpen = sidebar.classList.toggle('open');
        burger.classList.toggle('active');
        burger.setAttribute('aria-expanded', isOpen);

        // Toggle backdrop
        if (backdrop) {
            backdrop.style.display = isOpen ? 'block' : 'none';
        }

        // Prevent body scroll when sidebar is open
        document.body.style.overflow = isOpen ? 'hidden' : '';
    } else {
        // Desktop: toggle 'sidebar-collapsed' on the shell
        const isCollapsed = shell.classList.toggle('sidebar-collapsed');
        burger.classList.toggle('active');
        burger.setAttribute('aria-expanded', !isCollapsed);

        // No backdrop on desktop
        if (backdrop) {
            backdrop.style.display = 'none';
        }

        // Collapsing the sidebar resizes the canvas via a grid-template-
        // columns transition, not a viewport change, so window 'resize'
        // never fires. Re-run the canvas/flow layout once the transition
        // ends so cards can rescale into the new width.
        shell.addEventListener('transitionend', function onShellResize(ev) {
            if (ev.propertyName !== 'grid-template-columns') return;
            shell.removeEventListener('transitionend', onShellResize);
            if (typeof window.__dashCanvasInit === 'function') window.__dashCanvasInit();
            if (typeof window.__refreshFlowLayout === 'function') window.__refreshFlowLayout();
        });
    }
}

// Handle window resize – close sidebar if resizing to desktop
window.addEventListener('resize', function() {
    if (window.innerWidth > 850) {
        closeSidebarMenu();
    }
});

function toggleSettingsPanel() {
    const overlay = document.getElementById('settingsOverlay');
    if (!overlay) return;
    const isActive = overlay.classList.contains('active');
    if (isActive) { overlay.classList.remove('active'); overlay.style.display = 'none'; }
    else { overlay.classList.add('active'); overlay.style.display = 'flex'; }
}
window.toggleSettingsPanel = toggleSettingsPanel;

document.addEventListener('DOMContentLoaded', () => {
    const settingsOverlay = document.getElementById('settingsOverlay');
    if (settingsOverlay) {
        settingsOverlay.addEventListener('click', (e) => {
            if (e.target === settingsOverlay) toggleSettingsPanel();
        });
    }
});


// MINIMALUIACTIVE
let minimalUiActive = false;

function toggleMinimalUI() {
    minimalUiActive = !minimalUiActive;
    document.body.classList.toggle('minimal-ui', minimalUiActive);
    const btn = document.getElementById('minimalUiToggle');
    if (btn) {
        btn.textContent = minimalUiActive ? '🧘 Exit Minimal UI' : '🧘 Minimal UI';
        btn.classList.toggle('minimal-active', minimalUiActive);
    }
    showToast(minimalUiActive ? '🧘 Minimal UI on' : '🧘 Minimal UI off', 'info');
}
window.toggleMinimalUI = toggleMinimalUI;

window.toggleSidebarMenu = toggleSidebarMenu;

window.quickAddTask = quickAddTask;

window.showShortcuts = showShortcuts;

// Expose globally
window.toggleLofiConsole = toggleLofiConsole;
window.toggleRainSound = toggleRainSound;
window.stepRainVolume = stepRainVolume;
window.changeRainVolume = changeRainVolume;


// Initialize Journal
if (typeof JournalEngine !== 'undefined' && typeof JournalUI !== 'undefined') {
    JournalUI.init();
}

// ============================================================
// TUTORIAL CARDS GENERATOR
// ============================================================
const tutorialData = [
    { icon: '📊', title: 'Dashboard', tutorial: 'dashboard', desc: 'Your command center. Learn about the banner, active session, master to-do, and stats cards.' },
    { icon: '📅', title: 'Schedule', tutorial: 'schedule', desc: 'Master your weekly planning. Learn about day cards, task creation, timeline, and day navigation.' },
    { icon: '⏱️', title: 'Focus Timer', tutorial: 'timer', desc: 'Boost productivity with timed sessions. Explore session tracker, presets, and custom timers.' },
    { icon: '☑️', title: 'To-Do', tutorial: 'todo', desc: 'Master your task management. Learn to add tasks, track progress, and view momentum stats.' },
    { icon: '📚', title: 'Lessons', tutorial: 'lessons', desc: 'Create and organize learning content. Explore the explorer panel, rich text editor, and slash commands.' },
    { icon: '📖', title: 'Library', tutorial: 'library', desc: 'Store and organize resources. Learn to add links, videos, documents, and code snippets.' },
    { icon: '✅', title: 'Habits', tutorial: 'habits', desc: 'Build consistency with daily tracking. Create habits, track streaks, and monitor completion rates.' },
    { icon: '📈', title: 'Analytics', tutorial: 'analytics', desc: 'Insights into your productivity. Explore session history, category breakdown, and peak performance.' },
    { icon: '📔', title: 'Journal', tutorial: 'journal', desc: 'Capture daily reflections. Learn the quick-add button, your stats, and browsing past entries.' },
    { icon: '📕', title: 'Reading List', tutorial: 'reading', desc: 'Track books and articles. Learn to search, filter, add items, and update reading status.' },
    { icon: '🌤️', title: 'Weather', tutorial: 'weather', desc: 'Check the forecast. Learn to change location and read current conditions and the multi-day forecast.' },
    { icon: '🤖', title: 'AI Assistant', tutorial: 'ai', desc: 'Your workspace, in chat form. Connect a local AI, learn action permissions, and see what it can do.' },
    { icon: '🕸️', title: 'Knowledge Graph', tutorial: 'graph', desc: 'Visualize how your lessons and links connect to each other.' }
];

function renderTutorialCards() {
    const grid = document.getElementById('tutorialCardsGrid');
    if (!grid) return;

    grid.innerHTML = tutorialData.map(t => `
        <div class="tutorial-card" data-tutorial="${t.tutorial}"
             style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 24px; cursor: pointer; transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); position: relative; overflow: hidden;">
            <div class="card-glow-border"></div>
            <div style="font-size: 2.5rem; margin-bottom: 12px;">${t.icon}</div>
            <h3 style="margin: 0 0 8px 0; font-size: 1.1rem; font-weight: 600; color: var(--text-primary);">${t.title}</h3>
            <p style="margin: 0 0 16px 0; font-size: 0.85rem; color: var(--text-secondary); line-height: 1.5;">${t.desc}</p>
            <div style="display: flex; align-items: center; gap: 8px; color: var(--accent-1); font-size: 0.85rem; font-weight: 600;">
                <span>Start Tutorial</span>
                <span style="transition: transform 0.3s;">→</span>
            </div>
        </div>
    `).join('');
}

// ============================================================
// TUTORIAL CARD CLICK HANDLER
// ============================================================
const tutorialToViewMap = {
    'dashboard': 'dashboard-view',
    'schedule': 'schedule-view',
    'timer': 'timer-view',
    'todo': 'todo-view',
    'lessons': 'lessons-view',
    'library': 'library-view',
    'habits': 'habits-view',
    'analytics': 'analytics-view',
    'journal': 'journal-view',
    'reading': 'reading-view',
    'weather': 'weather-view',
    'ai': 'ai-view',
    'graph': 'graph-view'
};

document.addEventListener('click', function(e) {
    const card = e.target.closest('.tutorial-card');
    if (!card) return;

    const tutorial = card.dataset.tutorial;
    const viewId = tutorialToViewMap[tutorial];
    if (!viewId) return;

    // Switch to the corresponding view
    if (typeof switchView === 'function') {
        switchView(viewId);
    }

    // Show contextual toast
    const title = card.querySelector('h3')?.textContent || tutorial;
    showToast(`📖 Starting tutorial for ${title}...`, 'info');

    // Start the specific tutorial for the feature that was clicked —
    // this used to call startTour(), a completely different, generic,
    // fixed-content walkthrough from tour.js that ignored which card was
    // clicked entirely. That's why every card produced identical content.
    if (typeof startTutorial === 'function') {
        setTimeout(() => startTutorial(tutorial), 300);
    }
});

// Render tutorial cards when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderTutorialCards);
} else {
    renderTutorialCards();
}
