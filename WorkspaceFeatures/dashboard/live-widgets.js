// ============================================================
// live-widgets.js — Adds three "live view" dashboard cards
// (Today's Agenda, Focus Timer, Weather) that plug into the
// SAME drag / resize / minimize / show-hide system as every
// other dash-card (see WorkspaceShared/drag-drop.js and
// WorkspaceFeatures/dashboard/dashboard.js). They mirror real
// data from the Schedule, Timer, and Weather features so they
// stay live without duplicating that logic.
// ============================================================

const LIVE_WIDGET_REFRESH_MS = 1000;

function buildLiveWidgetCard(cardId, icon, title, bodyHtml) {
    const card = document.createElement('div');
    card.className = 'dash-card live-widget-card';
    card.setAttribute('data-card-id', cardId);
    card.innerHTML = `
        <div class="card-glow-border"></div>
        <div class="card-inner">
            <div class="card-header-drag" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                <h3 style="margin:0;">${icon} ${title}</h3>
                <div class="card-controls">
                    <button class="card-nav-btn" data-nav-expand title="Expand">⛶</button>
                    <button class="card-nav-btn" data-nav-jump title="Open full page">↗</button>
                    <span class="card-drag-handle" title="Drag to move">⠿</span>
                    <button class="card-resize-btn" data-action="resizeCard" data-card="${cardId}" title="Drag to resize, click to reset">⤡</button>
                </div>
            </div>
            ${bodyHtml}
        </div>
    `;
    return card;
}

function insertLiveWidgetCard(card) {
    const grid = document.querySelector('.dashboard-grid');
    if (!grid) return false;
    if (grid.querySelector(`.dash-card[data-card-id="${card.dataset.cardId}"]`)) return false;
    const statsContainer = grid.querySelector('.dash-stats-container');
    if (statsContainer) grid.insertBefore(card, statsContainer);
    else grid.appendChild(card);
    return true;
}

function wireLiveWidgetNav(card, viewId, expandFn) {
    const jumpBtn = card.querySelector('[data-nav-jump]');
    const expandBtn = card.querySelector('[data-nav-expand]');
    if (jumpBtn) {
        jumpBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (typeof switchView === 'function') switchView(viewId);
        });
    }
    if (expandBtn) {
        expandBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            expandFn();
        });
    }
}

function ensureLiveWidgetStyles() {
    if (document.getElementById('live-widget-styles')) return;
    const style = document.createElement('style');
    style.id = 'live-widget-styles';
    style.textContent = `
        .card-nav-btn { background:transparent; border:none; color:var(--text-muted); cursor:pointer; font-size:13px; padding:2px 4px; border-radius:6px; transition:var(--transition-fast); }
        .card-nav-btn:hover { color:var(--text-primary); background:rgba(255,255,255,0.06); }
        .live-widget-footer { margin-top:12px; font-size:11px; color:var(--accent-1); cursor:pointer; opacity:0.85; }
        .live-widget-footer:hover { opacity:1; text-decoration:underline; }
        .live-widget-empty { padding:14px 4px; text-align:center; color:var(--text-muted); font-size:0.85rem; }

        .schedule-mini-item { display:flex; align-items:center; gap:10px; padding:8px 4px; border-bottom:1px solid var(--border-color); font-size:0.85rem; }
        .schedule-mini-item:last-child { border-bottom:none; }
        .schedule-mini-item.completed { opacity:0.5; text-decoration:line-through; }
        .schedule-mini-time { color:var(--text-muted); font-size:0.75rem; min-width:44px; }
        .schedule-mini-title { flex:1; color:var(--text-primary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .schedule-mini-check { background:transparent; border:1px solid var(--border-color); color:var(--text-secondary); border-radius:6px; width:22px; height:22px; cursor:pointer; flex-shrink:0; }
        .schedule-mini-check:hover { border-color:var(--accent-1); color:var(--accent-1); }

        .timer-mini-display { font-size:2.2rem; font-weight:700; text-align:center; letter-spacing:0.02em; color:var(--text-primary); margin:6px 0 14px; font-variant-numeric:tabular-nums; }
        .timer-mini-controls { display:flex; gap:8px; justify-content:center; }
        .timer-mini-btn { background:var(--bg-primary); border:1px solid var(--border-color); color:var(--text-secondary); border-radius:10px; padding:8px 16px; cursor:pointer; font-size:0.9rem; transition:var(--transition-fast); }
        .timer-mini-btn:hover { border-color:var(--border-color-hover); color:var(--text-primary); }

        .live-widget-modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.6); backdrop-filter:blur(4px); z-index:10100; display:flex; align-items:center; justify-content:center; padding:20px; }
        .live-widget-modal { width:100%; max-width:480px; max-height:80vh; overflow-y:auto; background:var(--bg-surface); border:1px solid var(--border-color-hover); border-radius:var(--radius-lg); box-shadow:var(--shadow-elevated); padding:22px; backdrop-filter:blur(20px); }
        .live-widget-modal-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; }
        .live-widget-modal-header h2 { margin:0; font-size:1.1rem; }
        .live-widget-modal-close { cursor:pointer; opacity:0.6; font-size:18px; background:none; border:none; color:var(--text-primary); }
        .live-widget-modal-close:hover { opacity:1; }
    `;
    document.head.appendChild(style);
}

function openLiveWidgetModal(title, bodyHtml) {
    closeLiveWidgetModal();
    const overlay = document.createElement('div');
    overlay.className = 'live-widget-modal-overlay';
    overlay.id = 'liveWidgetModalOverlay';
    overlay.innerHTML = `
        <div class="live-widget-modal">
            <div class="live-widget-modal-header">
                <h2>${title}</h2>
                <button class="live-widget-modal-close" id="liveWidgetModalClose">✕</button>
            </div>
            <div>${bodyHtml}</div>
        </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeLiveWidgetModal(); });
    document.getElementById('liveWidgetModalClose').addEventListener('click', closeLiveWidgetModal);
}

function closeLiveWidgetModal() {
    document.getElementById('liveWidgetModalOverlay')?.remove();
}

// ------------------------------------------------------------
// SCHEDULE MINI WIDGET
// ------------------------------------------------------------
function initScheduleMiniCard() {
    const card = buildLiveWidgetCard('schedule-mini', '📅', "Today's Agenda", `
        <div id="scheduleMiniList" class="schedule-mini-list"></div>
        <div class="live-widget-footer" id="scheduleMiniFooter">Open full schedule →</div>
    `);
    if (!insertLiveWidgetCard(card)) return;
    wireLiveWidgetNav(card, 'schedule-view', () => renderScheduleMiniExpanded());
    document.getElementById('scheduleMiniFooter').addEventListener('click', () => {
        if (typeof switchView === 'function') switchView('schedule-view');
    });
    renderScheduleMini();
}

function getTodayAgendaItems() {
    try {
        return typeof getTodayEventsSorted === 'function' ? getTodayEventsSorted() : [];
    } catch (e) {
        return [];
    }
}

function renderAgendaItemsHtml(items) {
    if (!items.length) {
        return `<div class="live-widget-empty">Nothing left on today's schedule 🎉</div>`;
    }
    return items.map(ev => `
        <div class="schedule-mini-item ${ev.completed ? 'completed' : ''}">
            <span class="schedule-mini-time">${escapeHtml(ev.start)}</span>
            <span class="schedule-mini-title" title="${escapeHtml(ev.title)}">${escapeHtml(ev.title)}</span>
            <button class="schedule-mini-check" title="${ev.completed ? 'Mark incomplete' : 'Mark complete'}"
                onclick="event.stopPropagation(); toggleTaskComplete('${ev.id}', '${ev.day}'); renderScheduleMini();">${ev.completed ? '↩' : '✓'}</button>
        </div>
    `).join('');
}

function renderScheduleMini() {
    const list = document.getElementById('scheduleMiniList');
    if (!list) return;
    list.innerHTML = renderAgendaItemsHtml(getTodayAgendaItems().slice(0, 5));
}

function renderScheduleMiniExpanded() {
    openLiveWidgetModal("📅 Today's Agenda", `<div>${renderAgendaItemsHtml(getTodayAgendaItems())}</div>`);
}

// ------------------------------------------------------------
// FOCUS TIMER MINI WIDGET
// ------------------------------------------------------------
function initTimerMiniCard() {
    const card = buildLiveWidgetCard('timer-mini', '⏱', 'Focus Timer', `
        <div class="timer-mini-display" id="timerMiniDisplay">--:--</div>
        <div class="timer-mini-controls">
            <button id="timerMiniStart" class="timer-mini-btn" title="Start">▶ Start</button>
            <button id="timerMiniPause" class="timer-mini-btn" title="Pause">⏸ Pause</button>
            <button id="timerMiniReset" class="timer-mini-btn" title="Reset">⟲</button>
        </div>
    `);
    if (!insertLiveWidgetCard(card)) return;
    wireLiveWidgetNav(card, 'timer-view', () => {
        renderTimerMini();
        openLiveWidgetModal('⏱ Focus Timer', `<div style="text-align:center;"><div class="timer-mini-display">${document.getElementById('timerMiniDisplay')?.textContent || '--:--'}</div><p style="color:var(--text-muted);font-size:0.85rem;">Open the full Timer page for presets, Pomodoro cycles, and session history.</p></div>`);
    });

    document.getElementById('timerMiniStart').addEventListener('click', (e) => {
        e.stopPropagation();
        proxyTimerClick('start');
    });
    document.getElementById('timerMiniPause').addEventListener('click', (e) => {
        e.stopPropagation();
        proxyTimerClick('pause');
    });
    document.getElementById('timerMiniReset').addEventListener('click', (e) => {
        e.stopPropagation();
        proxyTimerClick('reset');
    });

    renderTimerMini();
}

// The real Start/Pause/Reset buttons live on the (possibly hidden)
// Timer view. Clicking a hidden button still fires its real handler,
// so we simply forward the click to whichever mode is selected.
function isPomodoroModeActive() {
    return !!document.getElementById('pomodoroShell')?.classList.contains('active');
}

function proxyTimerClick(action) {
    const ids = isPomodoroModeActive()
        ? { start: 'pomodoroStartBtn', pause: 'pomodoroPauseBtn', reset: 'pomodoroResetBtn' }
        : { start: 'startBtn', pause: 'pauseBtn', reset: 'resetBtn' };
    const el = document.getElementById(ids[action]);
    if (el && !el.disabled) {
        el.click();
        setTimeout(renderTimerMini, 50);
        return true;
    }
    return false;
}

function renderTimerMini() {
    const displayEl = document.getElementById('timerMiniDisplay');
    if (!displayEl) return;
    const source = document.getElementById(isPomodoroModeActive() ? 'pomodoroDisplay' : 'countdownDisplay');
    displayEl.textContent = source ? source.textContent : '--:--';
}

// ------------------------------------------------------------
// WEATHER MINI WIDGET (reuses weather.js's own renderer)
// ------------------------------------------------------------
function initWeatherMiniCard() {
    const card = buildLiveWidgetCard('weather', '🌤', 'Weather', `
        <div id="weatherWidgetContainer" class="dash-widget-placeholder"></div>
    `);
    if (!insertLiveWidgetCard(card)) return;
    wireLiveWidgetNav(card, 'weather-view', () => {
        openLiveWidgetModal('🌤 Weather', document.getElementById('weatherWidgetContainer')?.innerHTML || 'Loading weather…');
    });
    if (typeof renderWeatherWidget === 'function') renderWeatherWidget();
}

// ------------------------------------------------------------
// INIT + LIVE REFRESH
// ------------------------------------------------------------
function initLiveWidgets() {
    ensureLiveWidgetStyles();
    initScheduleMiniCard();
    initTimerMiniCard();
    initWeatherMiniCard();

    // Fold the new cards into the existing show/hide "Customize" panel
    // and drag/resize/minimize system, if it's present.
    if (typeof DEFAULT_CARD_VISIBILITY === 'object') {
        ['schedule-mini', 'timer-mini', 'weather'].forEach(id => {
            if (!(id in DEFAULT_CARD_VISIBILITY)) DEFAULT_CARD_VISIBILITY[id] = true;
        });
    }
    if (typeof CARD_LABELS === 'object') {
        CARD_LABELS['schedule-mini'] = "📅 Today's Agenda";
        CARD_LABELS['timer-mini'] = '⏱ Focus Timer';
        CARD_LABELS['weather'] = '🌤 Weather';
    }
    if (typeof applyCardVisibility === 'function') applyCardVisibility();
    if (typeof initDashboardCards === 'function') initDashboardCards();
    // initDashboardCards() already tails with updateCardSizeClasses(), but recompute
    // explicitly in case the cards were just inserted (idempotent).
    if (typeof window.updateCardSizeClasses === 'function') window.updateCardSizeClasses();

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeLiveWidgetModal();
    });

    setInterval(() => {
        renderScheduleMini();
        renderTimerMini();
        if (typeof renderWeatherWidget === 'function') renderWeatherWidget();
    }, LIVE_WIDGET_REFRESH_MS);
}

document.addEventListener('DOMContentLoaded', initLiveWidgets);
