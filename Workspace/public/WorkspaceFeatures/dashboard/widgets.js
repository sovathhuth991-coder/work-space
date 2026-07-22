// ============================================================
// WIDGETS — split into standalone per-type dashboard cards.
// Each of Notes / Quote / Links / Stats is still multi-instance
// (you can add several blocks of the same type), but each type
// now lives in its own dash-card instead of a shared "Custom
// Widgets" container with an add-block dropdown.
//
// "This Week's Task Progress" (previously the "chart" widget
// type) and "Study Beats" (previously the "local-audio" widget
// type) have been removed from this array-based system entirely:
// Task Progress is now its own standalone always-on card (see
// renderTaskProgressCard below), and Study Beats lives solely in
// the separate Ambient Mix Station widget — having both was a
// duplicate rain-sound player.
// ============================================================

let customWidgets = JSON.parse(localStorage.getItem('customWidgets') || '[]');

function saveCustomWidgets() {
    localStorage.setItem('customWidgets', JSON.stringify(customWidgets));
}

// Renders the inner HTML for a single block. Only notes/quote/links/stats
// are reachable from the UI now; timer/schedule/weather are kept as-is
// in case they get wired up later, but nothing currently creates them.
function renderWidgetBlock(widget) {
    let content = '';
    switch (widget.type) {
        case 'notes':
            content = `<textarea placeholder="Write your notes..." onchange="updateWidgetContent('${widget.id}', this.value)">${escapeHtml(widget.content || '')}</textarea>`;
            break;
        case 'links':
            content = `
                <div class="widget-links">${(widget.links || []).map((l, i) => `
                    <div class="widget-link-item">
                        <a href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer">🔗 ${escapeHtml(l.name)}</a>
                        <button class="widget-row-delete" onclick="removeWidgetListItem('${widget.id}','links',${i})" title="Remove">✕</button>
                    </div>`).join('') || '<p class="widget-empty-hint">No links yet — add one below</p>'}
                </div>
                <div class="widget-add-row">
                    <input type="text" id="linkName-${widget.id}" placeholder="Label" />
                    <input type="text" id="linkUrl-${widget.id}" placeholder="https://..." />
                    <button onclick="addWidgetLink('${widget.id}')" title="Add link">+</button>
                </div>
            `;
            break;
        case 'stats':
            content = `
                <div class="widget-stats">${(widget.stats || []).map((s, i) => `
                    <div class="widget-stat-item">
                        <span class="widget-stat-label">${escapeHtml(s.label)}</span>
                        <span class="widget-stat-value">${escapeHtml(s.value)}</span>
                        <button class="widget-row-delete" onclick="removeWidgetListItem('${widget.id}','stats',${i})" title="Remove">✕</button>
                    </div>`).join('') || '<p class="widget-empty-hint">No stats yet — add one below</p>'}
                </div>
                <div class="widget-add-row">
                    <input type="text" id="statLabel-${widget.id}" placeholder="Label" />
                    <input type="text" id="statValue-${widget.id}" placeholder="Value" />
                    <button onclick="addWidgetStat('${widget.id}')" title="Add stat">+</button>
                </div>
            `;
            break;
        case 'timer': {
            const m = Math.floor(widget.remainingSeconds / 60),
                s = widget.remainingSeconds % 60;
            content = `<div class="widget-timer"><div class="widget-timer-display" id="timer-${widget.id}">${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}</div><div class="widget-timer-controls"><button class="widget-timer-btn" onclick="toggleWidgetTimer('${widget.id}')">${widget.timerRunning ? 'Pause' : 'Start'}</button><button class="widget-timer-btn" onclick="resetWidgetTimer('${widget.id}')">Reset</button></div></div>`;
            break;
        }
        case 'schedule': {
            const todayTasks = events.filter(e => e.day === getTodayName()).sort((a, b) => a.start.localeCompare(b.start));
            content = `
                <div class="widget-schedule">
                    ${todayTasks.length === 0 ? '<p style="color:var(--text-muted);font-style:italic;">No tasks today</p>' :
                    todayTasks.slice(0, 5).map(t => `
                        <div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid var(--border-color);">
                            <span>${escapeHtml(t.title)}</span>
                            <span style="color:var(--accent-1);font-size:0.8rem;">${t.start}</span>
                        </div>
                    `).join('')}
                    ${todayTasks.length > 5 ? `<div style="color:var(--text-muted);font-size:0.7rem;margin-top:4px;">+ ${todayTasks.length - 5} more</div>` : ''}
                </div>
            `;
            break;
        }
        case 'quote':
            content = `
                <div class="widget-quote-block">
                    <span class="widget-quote-mark" aria-hidden="true">&ldquo;</span>
                    <textarea class="widget-quote-input" placeholder="Write a quote..." onchange="updateWidgetField('${widget.id}', 'quoteText', this.value)">${escapeHtml(widget.quoteText || '')}</textarea>
                    <input type="text" class="widget-quote-author-input" placeholder="— Author" value="${escapeHtml(widget.quoteAuthor || '')}" onchange="updateWidgetField('${widget.id}', 'quoteAuthor', this.value)" />
                </div>
            `;
            break;
        case 'weather':
            content = `<div class="widget-weather"><div class="widget-weather-icon">${escapeHtml(widget.icon || '🌤️')}</div><div class="widget-weather-temp">${escapeHtml(widget.temp || 28)}°C</div><div class="widget-weather-desc">${escapeHtml(widget.condition || 'Sunny')} · ${escapeHtml(widget.location || 'Unknown')}</div></div>`;
            break;
        default:
            content = `<p>Unknown widget type</p>`;
    }
    return `<div class="widget-card widget-${widget.type}" data-widget-id="${widget.id}"><div class="widget-header"><span class="widget-drag-handle" draggable="true" title="Drag to reorder">⠿</span><div class="widget-title">${escapeHtml(widget.title)}</div><div class="widget-actions"><button class="widget-btn delete" onclick="deleteWidget('${widget.id}')">✕</button></div></div><div class="widget-content">${content}</div></div>`;
}

const WIDGET_GRID_IDS = {
    notes: 'dashNotesGrid',
    quote: 'dashQuoteGrid',
    links: 'dashLinksGrid',
    stats: 'dashStatsGrid'
};

const WIDGET_COUNT_IDS = {
    notes: 'notesCount',
    quote: 'quoteCount',
    links: 'linksCount',
    stats: 'statsCount'
};

const WIDGET_EMPTY_CONFIG = {
    notes: { icon: '📝', message: 'No notes yet — click to add one' },
    quote: { icon: '💬', message: 'No quotes yet — click to add one' },
    links: { icon: '🔗', message: 'No link blocks yet — click to add one' },
    stats: { icon: '📊', message: 'No stat blocks yet — click to add one' }
};

function renderWidgetsByType(type) {
    const gridId = WIDGET_GRID_IDS[type];
    const grid = gridId && document.getElementById(gridId);
    if (!grid) return;
    const items = customWidgets.filter(w => w.type === type);

    const countEl = document.getElementById(WIDGET_COUNT_IDS[type]);
    if (countEl) countEl.textContent = items.length ? String(items.length) : '';

    if (!items.length) {
        const cfg = WIDGET_EMPTY_CONFIG[type] || { icon: '📦', message: 'Nothing here yet.' };
        grid.innerHTML = `<div class="widget-card-empty" onclick="addWidget('${type}')" role="button" tabindex="0"><span class="widget-card-empty-icon">${cfg.icon}</span>${cfg.message}</div>`;
        return;
    }
    grid.innerHTML = items.map(renderWidgetBlock).join('');
    initWidgetDragReorder(gridId);
}

function renderWidgets() {
    Object.keys(WIDGET_GRID_IDS).forEach(renderWidgetsByType);
    renderTaskProgressCard();
}

// ============================================================
// THIS WEEK'S TASK PROGRESS — standalone card, was the "chart"
// widget type. Computed directly from `events` rather than being
// a stored/addable block. Color-codes the number/bar so progress
// is readable at a glance, not just as a raw percentage.
// ============================================================
function renderTaskProgressCard() {
    const target = document.getElementById('dashTaskProgress');
    if (!target) return;
    const total = events.length || 1;
    const completed = events.filter(e => e.completed).length;
    const pct = Math.round((completed / total) * 100);
    const tone = pct >= 70 ? '#34d399' : pct >= 35 ? '#f59e0b' : '#f43f5e';
    target.innerHTML = `
        <div class="task-progress-value" style="color:${tone};">${pct}<span style="font-size:1rem;font-weight:600;">% complete</span></div>
        <div class="task-progress-track">
            <div class="task-progress-fill" style="width:${pct}%; background:linear-gradient(90deg, var(--accent-1), ${tone});"></div>
        </div>
        <div class="task-progress-footer">
            <span>✓ ${completed} done</span>
            <span>${total - completed} left</span>
        </div>
    `;
}

function addWidget(type) {
    const widget = { id: `widget_${Date.now()}`, type };
    switch (type) {
        case 'notes':
            widget.title = '📝 Notes';
            widget.content = '';
            break;
        case 'quote':
            widget.title = '💬 Quote';
            widget.quoteText = '';
            widget.quoteAuthor = '';
            break;
        case 'links':
            widget.title = '🔗 Links';
            widget.links = [];
            break;
        case 'stats':
            widget.title = '📊 Stats';
            widget.stats = [];
            break;
        default:
            return;
    }
    customWidgets.push(widget);
    saveCustomWidgets();
    renderWidgetsByType(type);

    // Focus the new block's primary field so you can start typing
    // right away instead of having to click into it.
    const grid = document.getElementById(WIDGET_GRID_IDS[type]);
    const newCard = grid && grid.querySelector(`[data-widget-id="${widget.id}"]`);
    const firstField = newCard && newCard.querySelector('textarea, input');
    if (firstField) firstField.focus();
}

// ============================================================
// EDITABLE BLOCK CONTENT (quote text/author, links, stats)
// ============================================================
function updateWidgetField(id, field, value) {
    const w = customWidgets.find(w => w.id === id);
    if (w) {
        w[field] = value;
        saveCustomWidgets();
    }
}

function addWidgetLink(id) {
    const nameInput = document.getElementById(`linkName-${id}`);
    const urlInput = document.getElementById(`linkUrl-${id}`);
    if (!nameInput || !urlInput) return;
    const name = nameInput.value.trim();
    let url = urlInput.value.trim();
    if (!name || !url) return;
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    const w = customWidgets.find(w => w.id === id);
    if (!w) return;
    w.links = w.links || [];
    w.links.push({ name, url });
    saveCustomWidgets();
    renderWidgetsByType('links');
}

function addWidgetStat(id) {
    const labelInput = document.getElementById(`statLabel-${id}`);
    const valueInput = document.getElementById(`statValue-${id}`);
    if (!labelInput || !valueInput) return;
    const label = labelInput.value.trim();
    const value = valueInput.value.trim();
    if (!label || !value) return;
    const w = customWidgets.find(w => w.id === id);
    if (!w) return;
    w.stats = w.stats || [];
    w.stats.push({ label, value });
    saveCustomWidgets();
    renderWidgetsByType('stats');
}

function removeWidgetListItem(id, field, index) {
    const w = customWidgets.find(w => w.id === id);
    if (!w || !Array.isArray(w[field])) return;
    w[field].splice(index, 1);
    saveCustomWidgets();
    renderWidgetsByType(w.type);
}

// ============================================================
// DRAG-TO-REORDER BLOCKS
// Native HTML5 drag-and-drop. The drag handle (not the whole card)
// is the draggable element, so dragging inside a textarea/input to
// select text never gets hijacked as a card drag. Only mouse/
// trackpad input fires these events — touch reordering isn't wired
// up yet, same limitation as plain HTML5 DnD generally has.
//
// Reordering is scoped within a single grid (i.e. within a single
// type) — dragging a Notes block only reorders it among other
// Notes blocks, since each type now has its own grid/card.
// ============================================================
function initWidgetDragReorder(gridId) {
    const grid = document.getElementById(gridId);
    if (!grid) return;
    let dragSrcId = null;

    grid.querySelectorAll('.widget-card').forEach(card => {
        const handle = card.querySelector('.widget-drag-handle');
        if (handle) {
            handle.addEventListener('dragstart', (e) => {
                dragSrcId = card.dataset.widgetId;
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setDragImage(card, 20, 20);
                card.classList.add('widget-dragging');
            });
            handle.addEventListener('dragend', () => {
                card.classList.remove('widget-dragging');
                grid.querySelectorAll('.widget-card').forEach(c => c.classList.remove('widget-drag-over'));
            });
        }

        card.addEventListener('dragover', (e) => {
            if (!dragSrcId || card.dataset.widgetId === dragSrcId) return;
            e.preventDefault();
            card.classList.add('widget-drag-over');
        });
        card.addEventListener('dragleave', () => {
            card.classList.remove('widget-drag-over');
        });
        card.addEventListener('drop', (e) => {
            e.preventDefault();
            card.classList.remove('widget-drag-over');
            const targetId = card.dataset.widgetId;
            if (!dragSrcId || dragSrcId === targetId) return;
            const fromIndex = customWidgets.findIndex(w => w.id === dragSrcId);
            const toIndex = customWidgets.findIndex(w => w.id === targetId);
            if (fromIndex === -1 || toIndex === -1) return;
            const movedType = customWidgets[fromIndex].type;
            const [moved] = customWidgets.splice(fromIndex, 1);
            customWidgets.splice(toIndex, 0, moved);
            dragSrcId = null;
            saveCustomWidgets();
            renderWidgetsByType(movedType);
        });
    });
}

// ============================================================
// OTHER WIDGET FUNCTIONS
// ============================================================
function updateWidgetContent(id, newContent) {
    const w = customWidgets.find(w => w.id === id);
    if (w && w.type === 'notes') {
        w.content = newContent;
        saveCustomWidgets();
    }
}

function toggleWidgetTimer(id) {
    const w = customWidgets.find(w => w.id === id);
    if (!w || w.type !== 'timer') return;
    w.timerRunning = !w.timerRunning;
    if (w.timerRunning) {
        w.timerInterval = setInterval(() => {
            if (w.remainingSeconds > 0) {
                w.remainingSeconds--;
                updateTimerDisplay(w);
            } else {
                clearInterval(w.timerInterval);
                w.timerRunning = false;
                w.remainingSeconds = w.minutes * 60;
                showToast('Timer finished!', 'success');
                renderWidgetsByType('timer');
            }
        }, 1000);
    } else {
        clearInterval(w.timerInterval);
    }
    saveCustomWidgets();
    renderWidgetsByType('timer');
}

function resetWidgetTimer(id) {
    const w = customWidgets.find(w => w.id === id);
    if (!w || w.type !== 'timer') return;
    if (w.timerInterval) clearInterval(w.timerInterval);
    w.timerRunning = false;
    w.remainingSeconds = w.minutes * 60;
    saveCustomWidgets();
    renderWidgetsByType('timer');
}

function updateTimerDisplay(w) {
    if (!w) return;
    const display = document.getElementById(`timer-${w.id}`);
    if (!display) return;
    const m = Math.floor(w.remainingSeconds / 60),
        s = w.remainingSeconds % 60;
    display.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function deleteWidget(id) {
    const widget = customWidgets.find(w => w.id === id);
    if (!widget) return;
    const hasContent = widget.content || widget.quoteText || (widget.links && widget.links.length) || (widget.stats && widget.stats.length);
    if (hasContent && !confirm('Delete this block? This can\'t be undone.')) return;
    if (widget.type === 'timer' && widget.timerInterval) {
        clearInterval(widget.timerInterval);
    }
    customWidgets = customWidgets.filter(w => w.id !== id);
    saveCustomWidgets();
    renderWidgetsByType(widget.type);
}

// ============================================================
// MIGRATION — one-time cleanup of the two widget types that no
// longer exist in this system: "local-audio" (the duplicate
// Study Beats player — the real one now lives only in the
// Ambient Mix Station widget) and "chart" (This Week's Task
// Progress, now its own standalone card computed live instead of
// a stored block). No new default blocks are auto-seeded anymore
// — Notes/Quote/Links/Stats start empty until the user adds one.
// ============================================================
(function migrateLegacyWidgetTypes() {
    const before = customWidgets.length;
    customWidgets = customWidgets.filter(w => w.type !== 'local-audio' && w.type !== 'chart');
    if (customWidgets.length !== before) {
        saveCustomWidgets();
    }
    renderWidgets();
})();
