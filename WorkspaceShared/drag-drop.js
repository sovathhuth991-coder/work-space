// drag-drop.js — Enhanced drag & drop with time-based rescheduling

let draggedEventId = null;
let dragSourceDay = null;
let dragGhost = null;

function initDragAndDrop() {
    // Create drag ghost element for visual feedback
    dragGhost = document.createElement('div');
    dragGhost.id = 'dragGhost';
    dragGhost.style.cssText = `
        position: fixed;
        pointer-events: none;
        background: var(--accent-gradient);
        color: #fff;
        padding: 8px 12px;
        border-radius: 8px;
        font-size: 0.85rem;
        font-weight: 600;
        opacity: 0.9;
        z-index: 9999;
        box-shadow: 0 4px 16px rgba(124, 109, 240, 0.4);
        display: none;
    `;
    document.body.appendChild(dragGhost);

    // Track mouse for ghost positioning
    document.addEventListener('dragstart', (e) => {
        const item = e.target.closest('.timeline-item');
        if (!item) return;

        draggedEventId = item.dataset.eventId;
        dragSourceDay = currentOpenDay;

        // Add dragging class for styling
        item.classList.add('dragging');

        // Show ghost with task title
        const event = events.find(ev => ev.id == draggedEventId);
        if (event) {
            dragGhost.textContent = event.title;
            dragGhost.style.display = 'block';
        }

        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', draggedEventId);

        // Prevent default drag image
        const img = new Image();
        img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        e.dataTransfer.setDragImage(img, 0, 0);
    });

    document.addEventListener('drag', (e) => {
        if (dragGhost) {
            dragGhost.style.left = (e.clientX + 15) + 'px';
            dragGhost.style.top = (e.clientY + 15) + 'px';
        }
    });

    document.addEventListener('dragend', (e) => {
        const item = e.target.closest('.timeline-item');
        if (item) item.classList.remove('dragging');
        if (dragGhost) dragGhost.style.display = 'none';
        draggedEventId = null;
        dragSourceDay = null;

        // Clean up all drop targets
        document.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));
        document.querySelectorAll('.drop-indicator').forEach(el => el.remove());
    });

    // Allow drop on day cards (weekly view)
    document.addEventListener('dragover', (e) => {
        const dayBox = e.target.closest('.day');
        if (dayBox) {
            e.preventDefault();
            dayBox.classList.add('drop-target');
        }

        // Allow drop on timeline items for reordering
        const timelineItem = e.target.closest('.timeline-item');
        if (timelineItem && timelineItem.dataset.eventId != draggedEventId) {
            e.preventDefault();
            timelineItem.classList.add('drop-target');
        }

    });

    document.addEventListener('dragleave', (e) => {
        const dayBox = e.target.closest('.day');
        if (dayBox) dayBox.classList.remove('drop-target');
        const timelineItem = e.target.closest('.timeline-item');
        if (timelineItem) timelineItem.classList.remove('drop-target');
    });

    document.addEventListener('drop', (e) => {
        e.preventDefault();

        // Clean up visual indicators
        document.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));

        if (!draggedEventId) return;

        // --- Drop onto a day card (change day) ---
        const dayBox = e.target.closest('.day');
        if (dayBox) {
            const newDay = dayBox.querySelector('h3').textContent.replace('⭐️', '').trim();
            const event = events.find(ev => ev.id == draggedEventId);
            if (!event) return;

            saveStateForUndo();
            event.day = newDay;
            saveEvents();
            renderSchedule();
            showToast(`Moved to ${newDay}`, 'success');
            return;
        }


        // --- Drop onto a timeline item (reorder within same day) ---
        const timelineItem = e.target.closest('.timeline-item');
        if (timelineItem) {
            const targetId = timelineItem.dataset.eventId;
            if (targetId === draggedEventId) return;

            const day = currentOpenDay;
            if (!day) return;

            const dayEvents = events.filter(e => e.day === day).sort((a, b) => a.start.localeCompare(b.start));
            const draggedIndex = dayEvents.findIndex(e => e.id == draggedEventId);
            const targetIndex = dayEvents.findIndex(e => e.id == targetId);

            if (draggedIndex === -1 || targetIndex === -1) return;

            saveStateForUndo();
            const draggedEventObj = events.find(e => e.id == draggedEventId);
            const targetEventObj = events.find(e => e.id == targetId);

            // Remove dragged, insert before target
            const dragIndexGlobal = events.indexOf(draggedEventObj);
            const targetIndexGlobal = events.indexOf(targetEventObj);
            events.splice(dragIndexGlobal, 1);
            const newIndex = dragIndexGlobal < targetIndexGlobal ? targetIndexGlobal - 1 : targetIndexGlobal;
            events.splice(newIndex, 0, draggedEventObj);

            saveEvents();
            renderSchedule();
            openDayDiagram(day);
            showToast('Task reordered', 'info');
        }
    });
}


// Add drag handle to timeline items (called after render)
function addDragHandlesToTimeline() {
    document.querySelectorAll('.timeline-item').forEach(item => {
        if (item.querySelector('.drag-handle')) return;

        const dragHandle = document.createElement('div');
        dragHandle.className = 'drag-handle';
        dragHandle.setAttribute('draggable', 'true');
        dragHandle.innerHTML = '&#x22EE;&#x22EE;';
        dragHandle.style.cssText = `
            cursor: grab;
            color: var(--text-muted);
            font-size: 1.2rem;
            padding: 0 6px;
            user-select: none;
            opacity: 0.5;
            transition: opacity 0.2s;
            line-height: 1;
        `;
        dragHandle.title = 'Drag to reschedule';

        // Insert at the beginning of the item
        item.insertBefore(dragHandle, item.firstChild);

        // Hover effect
        item.addEventListener('mouseenter', () => {
            dragHandle.style.opacity = '1';
        });
        item.addEventListener('mouseleave', () => {
            dragHandle.style.opacity = '0.5';
        });
    });
}

// Patch renderSchedule to add drag handles
document.addEventListener('DOMContentLoaded', () => {
    const originalRenderSchedule = window.renderSchedule;
    if (typeof originalRenderSchedule === 'function') {
        window.renderSchedule = function() {
            originalRenderSchedule();
            setTimeout(addDragHandlesToTimeline, 50);
        };
    }
});


console.log('🖱️ Enhanced Drag & Drop module loaded');

// ============================================================
// SESSION HUB WIDGET DRAG & RESIZE
// ============================================================

(function() {
    'use strict';

    const STORAGE_KEY = 'sessionHubLayout';
    let activeWidget = null;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;
    let isDragging = false;
    let isResizing = false;
    let resizeDirection = null;

    function initSessionHub() {
        const grid = document.getElementById('sessionHubGrid');
        if (!grid) return;

        // Load saved layout
        loadLayout();

        // Add drag listeners to all widgets
        grid.querySelectorAll('.hub-widget').forEach(widget => {
            const handle = widget.querySelector('.hub-drag-handle');
            if (handle) {
                handle.addEventListener('mousedown', (e) => startDrag(e, widget));
                handle.addEventListener('touchstart', (e) => startDrag(e, widget), { passive: false });
            }

            const resizeBtn = widget.querySelector('.hub-resize-btn');
            if (resizeBtn) {
                resizeBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    toggleWidgetSize(widget);
                });
            }
        });

        // Global move and end listeners
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onEnd);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('touchend', onEnd);

        // Reset button
        const resetBtn = document.querySelector('[data-action="resetSessionHub"]');
        if (resetBtn) {
            resetBtn.addEventListener('click', resetLayout);
        }
    }

    function startDrag(e, widget) {
        if (e.button && e.button !== 0) return; // Only left click
        e.preventDefault();

        activeWidget = widget;
        isDragging = true;
        widget.classList.add('dragging');

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        startX = clientX;
        startY = clientY;

        const rect = widget.getBoundingClientRect();
        startLeft = rect.left;
        startTop = rect.top;
    }

    function onMove(e) {
        if (!isDragging || !activeWidget) return;
        e.preventDefault();

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        const deltaX = clientX - startX;
        const deltaY = clientY - startY;

        // Use transform for smooth 60fps movement
        activeWidget.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(1.02)`;
        activeWidget.style.transition = 'none'; // Disable transition during drag
    }

    function onEnd() {
        if (!isDragging || !activeWidget) return;

        const widget = activeWidget;
        widget.classList.remove('dragging');
        widget.style.transition = ''; // Re-enable transition

        // Get final position
        const transform = widget.style.transform;
        const match = transform.match(/translate\(([^p]+)px,\s*([^p]+)px\)/);
        if (match) {
            const deltaX = parseFloat(match[1]);
            const deltaY = parseFloat(match[2]);

            // Only save if moved more than 10px
            if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
                // Determine new grid area based on position
                const grid = document.getElementById('sessionHubGrid');
                if (grid) {
                    const gridRect = grid.getBoundingClientRect();
                    const widgetRect = widget.getBoundingClientRect();

                    const relativeX = widgetRect.left + deltaX - gridRect.left;
                    const relativeY = widgetRect.top + deltaY - gridRect.top;

                    const colWidth = gridRect.width / 3;
                    const newCol = Math.floor(relativeX / colWidth) + 1;

                    // Update grid-area
                    const widgetName = widget.dataset.widget;
                    updateWidgetPosition(widgetName, newCol);
                }
            }

            // Reset transform
            widget.style.transform = '';
        }

        isDragging = false;
        activeWidget = null;
    }

    function toggleWidgetSize(widget) {
        const widgetName = widget.dataset.widget;
        if (!widgetName) return;

        // Toggle between normal and large size
        const isLarge = widget.classList.toggle('widget-large');

        // Save to layout
        saveLayout();

        // Show feedback
        showToast(isLarge ? '📐 Widget enlarged' : '📐 Widget normal size', 'info');
    }

    function updateWidgetPosition(widgetName, newCol) {
        const grid = document.getElementById('sessionHubGrid');
        if (!grid) return;

        const widget = grid.querySelector(`[data-widget="${widgetName}"]`);
        if (!widget) return;

        // Get current row
        const currentArea = widget.style.gridArea || widgetName;
        const row = currentArea.split(' ')[1] || '1';

        // Update grid area
        const newArea = `${widgetName} ${row} / span 1 / span 1`;
        widget.style.gridArea = newArea;

        // Save layout
        saveLayout();

        showToast('📦 Widget moved', 'info');
    }

    function saveLayout() {
        const grid = document.getElementById('sessionHubGrid');
        if (!grid) return;

        const layout = {};
        grid.querySelectorAll('.hub-widget').forEach(widget => {
            const name = widget.dataset.widget;
            if (name) {
                layout[name] = {
                    gridArea: widget.style.gridArea || name,
                    isLarge: widget.classList.contains('widget-large')
                };
            }
        });

        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
        } catch (e) {
            console.error('Error saving layout:', e);
        }
    }

    function loadLayout() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (!saved) return;

            const layout = JSON.parse(saved);
            const grid = document.getElementById('sessionHubGrid');
            if (!grid) return;

            Object.keys(layout).forEach(widgetName => {
                const widget = grid.querySelector(`[data-widget="${widgetName}"]`);
                if (widget && layout[widgetName]) {
                    widget.style.gridArea = layout[widgetName].gridArea;
                    if (layout[widgetName].isLarge) {
                        widget.classList.add('widget-large');
                    }
                }
            });
        } catch (e) {
            console.error('Error loading layout:', e);
        }
    }

    function resetLayout() {
        const grid = document.getElementById('sessionHubGrid');
        if (!grid) return;

        // Reset all widgets to default positions
        grid.querySelectorAll('.hub-widget').forEach(widget => {
            const name = widget.dataset.widget;
            widget.style.gridArea = name;
            widget.classList.remove('widget-large');
        });

        // Clear saved layout
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (e) {
            console.error('Error clearing layout:', e);
        }

        showToast('🔄 Layout reset to default', 'info');
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSessionHub);
    } else {
        initSessionHub();
    }

    // Expose globally
    window.initSessionHub = initSessionHub;
    window.resetSessionHub = resetLayout;

})();

// ============================================================
// DASHBOARD CARDS — minimize + right-click context menu
// (shared by both the stat-tile reorder system below and the
// freeform canvas system below that)
// ============================================================

function ensureMinimizeButton(card) {
    const controls = card.querySelector('.card-controls');
    if (!controls || controls.querySelector('.card-minimize-btn')) return;
    const btn = document.createElement('button');
    btn.className = 'card-minimize-btn';
    btn.title = 'Minimize';
    btn.textContent = '−';
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleCardMinimize(card);
    });
    const dragHandle = controls.querySelector('.card-drag-handle');
    if (dragHandle) controls.insertBefore(btn, dragHandle);
    else controls.appendChild(btn);
}

function toggleCardMinimize(card) {
    const minimizing = !card.classList.contains('card-minimized');
    if (card.classList.contains('canvas-card')) {
        if (minimizing) {
            // Remember the current height so un-minimizing can restore it —
            // a freeform card has no natural "content height" to spring back to.
            card.dataset.restoreHeight = card.style.height || (card.getBoundingClientRect().height + 'px');
            card.style.height = '';
        } else {
            card.style.height = card.dataset.restoreHeight || '260px';
        }
    }
    card.classList.toggle('card-minimized', minimizing);
    const btn = card.querySelector('.card-minimize-btn');
    if (btn) { btn.textContent = minimizing ? '+' : '−'; btn.title = minimizing ? 'Restore' : 'Minimize'; }
    if (typeof window.updateCardSizeClasses === 'function') window.updateCardSizeClasses();
    if (typeof window.__dashCanvasSave === 'function') window.__dashCanvasSave();
    if (typeof window.__dashStatsSave === 'function') window.__dashStatsSave();
}

// ---- Right-click context menu: "View Details" + "Go to Source" ----
// Reuses whatever nav the card already defines:
//   - a [data-nav-expand] / [data-nav-jump] button (live-widget cards), or
//   - a data-source-view="xxx" attribute → switchView(xxx) (static cards).
let activeContextMenu = null;

function closeContextMenu() {
    if (activeContextMenu) { activeContextMenu.remove(); activeContextMenu = null; }
    document.removeEventListener('mousedown', onContextMenuOutsideClick, true);
}

function onContextMenuOutsideClick(e) {
    if (activeContextMenu && !activeContextMenu.contains(e.target)) closeContextMenu();
}

function openContextMenu(card, clientX, clientY) {
    closeContextMenu();

    const items = [];
    const expandBtn = card.querySelector('[data-nav-expand]');
    if (expandBtn) {
        items.push({ label: '🔍 View Details', onClick: () => expandBtn.click() });
    }
    const jumpBtn = card.querySelector('[data-nav-jump]');
    const sourceView = card.dataset.sourceView;
    if (jumpBtn) {
        items.push({ label: '↗ Go to Source', onClick: () => jumpBtn.click() });
    } else if (sourceView) {
        items.push({ label: '↗ Go to Source', onClick: () => { if (typeof switchView === 'function') switchView(sourceView); } });
    }
    if (!items.length) return;

    const menu = document.createElement('div');
    menu.className = 'card-context-menu';
    items.forEach(item => {
        const btn = document.createElement('button');
        btn.textContent = item.label;
        btn.addEventListener('click', () => { closeContextMenu(); item.onClick(); });
        menu.appendChild(btn);
    });
    document.body.appendChild(menu);

    // Keep it on-screen
    const menuRect = menu.getBoundingClientRect();
    const left = Math.min(clientX, window.innerWidth - menuRect.width - 8);
    const top = Math.min(clientY, window.innerHeight - menuRect.height - 8);
    menu.style.left = Math.max(8, left) + 'px';
    menu.style.top = Math.max(8, top) + 'px';

    activeContextMenu = menu;
    setTimeout(() => document.addEventListener('mousedown', onContextMenuOutsideClick, true), 0);
}

document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeContextMenu(); });

// ============================================================
// STAT TILES — reorder-by-drag, scoped to .dash-stats-container
// so it no longer fights with cards living elsewhere on the page
// (that cross-container order collision was the source of the
// "glitches after moving" bug).
// ============================================================

(function() {
    'use strict';

    let activeCard = null;
    let isDragging = false;
    let startX = 0, startY = 0;
    let dropZoneIndicator = null;

    function container() { return document.querySelector('.dash-stats-container'); }

    function getVisibleStatCards() {
        const box = container();
        if (!box) return [];
        return Array.from(box.querySelectorAll('.dash-card[data-card-id]')).filter(c => c.style.display !== 'none');
    }

    function getOrder(card) { return parseInt(card.style.order || '0', 10); }
    function setOrder(card, order) { card.style.order = order; }

    function renumber() {
        const visible = getVisibleStatCards();
        visible.sort((a, b) => getOrder(a) - getOrder(b));
        visible.forEach((card, index) => setOrder(card, index + 1));
    }

    function initStatCards() {
        const box = container();
        if (!box) return;
        const cards = box.querySelectorAll('.dash-card[data-card-id]');
        if (!cards.length) return;

        loadLayout();
        getVisibleStatCards().forEach((card, index) => {
            if (!card.style.order) setOrder(card, index + 1);
        });

        cards.forEach(card => {
            if (card.dataset.statWired === '1') return;
            card.dataset.statWired = '1';
            const handle = card.querySelector('.card-drag-handle');
            if (handle) {
                handle.addEventListener('mousedown', (e) => startDrag(e, card));
                handle.addEventListener('touchstart', (e) => startDrag(e, card), { passive: false });
            }
            ensureMinimizeButton(card);
            card.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                openContextMenu(card, e.clientX, e.clientY);
            });
        });

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onEnd);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('touchend', onEnd);

        if (!dropZoneIndicator || !document.body.contains(dropZoneIndicator)) {
            dropZoneIndicator = document.createElement('div');
            dropZoneIndicator.className = 'drop-zone-indicator';
            dropZoneIndicator.style.cssText = `
                position: absolute;
                border: 2px dashed var(--accent-1);
                border-radius: var(--radius-lg);
                background: rgba(124, 109, 240, 0.08);
                pointer-events: none;
                z-index: 50;
                display: none;
                transition: all 0.2s ease;
            `;
            box.appendChild(dropZoneIndicator);
        }
    }

    function startDrag(e, card) {
        if (e.button && e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        activeCard = card;
        isDragging = true;
        card.classList.add('dragging');
        startX = e.touches ? e.touches[0].clientX : e.clientX;
        startY = e.touches ? e.touches[0].clientY : e.clientY;
    }

    function onMove(e) {
        if (!isDragging || !activeCard) return;
        e.preventDefault();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const deltaX = clientX - startX;
        const deltaY = clientY - startY;
        activeCard.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(1.03)`;
        activeCard.style.transition = 'none';
        activeCard.style.zIndex = '1000';
        showDropZone(clientX, clientY);
    }

    function showDropZone(cursorX, cursorY) {
        const box = container();
        if (!box || !dropZoneIndicator) return;
        let closestCard = null, closestDist = Infinity;
        getVisibleStatCards().forEach(card => {
            if (card === activeCard) return;
            const rect = card.getBoundingClientRect();
            const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
            const dist = Math.sqrt((cursorX - cx) ** 2 + (cursorY - cy) ** 2);
            if (dist < closestDist) { closestDist = dist; closestCard = card; }
        });
        if (closestCard && closestDist < 250) {
            const rect = closestCard.getBoundingClientRect();
            const boxRect = box.getBoundingClientRect();
            dropZoneIndicator.style.display = 'block';
            dropZoneIndicator.style.left = (rect.left - boxRect.left) + 'px';
            dropZoneIndicator.style.top = (rect.top - boxRect.top) + 'px';
            dropZoneIndicator.style.width = rect.width + 'px';
            dropZoneIndicator.style.height = rect.height + 'px';
            dropZoneIndicator.dataset.targetId = closestCard.dataset.cardId;
        } else {
            dropZoneIndicator.style.display = 'none';
        }
    }

    function onEnd() {
        if (!isDragging || !activeCard) return;
        const card = activeCard;
        card.classList.remove('dragging');
        card.style.transition = '';
        card.style.zIndex = '';
        if (dropZoneIndicator) dropZoneIndicator.style.display = 'none';

        const transform = card.style.transform;
        const match = transform.match(/translate\(([^p]+)px,\s*([^p]+)px\)/);
        if (match) {
            const deltaX = parseFloat(match[1]), deltaY = parseFloat(match[2]);
            if (Math.abs(deltaX) > 20 || Math.abs(deltaY) > 20) {
                const targetId = dropZoneIndicator?.dataset?.targetId;
                if (targetId && targetId !== card.dataset.cardId) reorder(card.dataset.cardId, targetId);
            }
            card.style.transform = '';
        }
        isDragging = false;
        activeCard = null;
    }

    function reorder(sourceId, targetId) {
        const sourceCard = document.querySelector(`.dash-stats-container .dash-card[data-card-id="${sourceId}"]`);
        const targetCard = document.querySelector(`.dash-stats-container .dash-card[data-card-id="${targetId}"]`);
        if (!sourceCard || !targetCard) return;

        const sourceOrder = getOrder(sourceCard);
        const targetOrder = getOrder(targetCard);

        getVisibleStatCards().forEach(card => {
            const order = getOrder(card);
            const cardId = card.dataset.cardId;
            if (cardId === sourceId) return;
            if (targetOrder < sourceOrder) {
                if (order > targetOrder && order < sourceOrder) setOrder(card, order + 1);
            } else {
                if (order >= sourceOrder && order < targetOrder) setOrder(card, order - 1);
            }
        });
        setOrder(sourceCard, targetOrder);
        renumber();
        saveLayout();
    }

    function saveLayout() {
        const layout = {};
        getVisibleStatCards().forEach(card => {
            layout[card.dataset.cardId] = { order: card.style.order || '0' };
        });
        try { localStorage.setItem('dashboardStatLayout', JSON.stringify(layout)); }
        catch (e) { console.error('Error saving stat layout:', e); }
    }

    function loadLayout() {
        try {
            const saved = localStorage.getItem('dashboardStatLayout');
            if (!saved) return;
            const layout = JSON.parse(saved);
            Object.keys(layout).forEach(cardId => {
                const card = document.querySelector(`.dash-stats-container .dash-card[data-card-id="${cardId}"]`);
                if (card && layout[cardId] && layout[cardId].order) card.style.order = layout[cardId].order;
            });
        } catch (e) { console.error('Error loading stat layout:', e); }
    }

    function resetStats() {
        getVisibleStatCards().forEach(card => { card.style.order = ''; });
        try { localStorage.removeItem('dashboardStatLayout'); } catch (e) {}
    }

    window.__dashStatsInit = initStatCards;
    window.__dashStatsReset = resetStats;
    window.__dashStatsRenumber = renumber;
    window.__dashStatsSave = saveLayout;
})();

// ============================================================
// FREEFORM CANVAS — Today's Focus, Master To-Do, Today's Agenda,
// Focus Timer, Weather, Calendar. Fully free positioning (drag
// anywhere) and resizing (drag any edge/corner) instead of the
// old nearest-card-snap reorder system, which doesn't have a
// coherent meaning once cards live in a fixed multi-column
// layout. Position/size are stored per-card in localStorage.
// ============================================================

(function() {
    'use strict';

    const STORAGE_KEY = 'dashboardCanvasLayout';
    const BREAKPOINT = 860;
    const EDGE_ZONE = 10;
    const MIN_W = 220, MIN_H = 140;
    const CURSORS = { n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', ne: 'nesw-resize', sw: 'nesw-resize', nw: 'nwse-resize', se: 'nwse-resize' };

    let activeCard = null;
    let activeMode = null; // 'move' | one of the CURSORS keys (resize direction)
    let startClientX = 0, startClientY = 0;
    let startRect = null;

    function canvas() { return document.getElementById('dashboardCanvas'); }
    function isCanvasMode() { return window.innerWidth > BREAKPOINT; }

    function getCanvasCards() {
        const el = canvas();
        if (!el) return [];
        return Array.from(el.querySelectorAll('.dash-card[data-card-id]'));
    }

    function getDefaultRect(cardId, canvasWidth) {
        const gap = 20;
        const leftW = Math.max(280, Math.round((canvasWidth - gap) * 0.6));
        const rightW = Math.max(240, canvasWidth - gap - leftW);
        const rightX = leftW + gap;
        const DEFAULTS = {
            'banner':        { x: 0,      y: 0,   w: leftW,  h: 300 },
            'schedule-mini': { x: 0,      y: 320, w: leftW,  h: 320 },
            'todo':          { x: 0,      y: 660, w: leftW,  h: 220 },
            'timer-mini':    { x: rightX, y: 0,   w: rightW, h: 260 },
            'weather':       { x: rightX, y: 280, w: rightW, h: 220 },
            'calendar':      { x: rightX, y: 520, w: rightW, h: 380 }
        };
        return DEFAULTS[cardId] || { x: 0, y: 0, w: leftW, h: 260 };
    }

    function loadLayout() {
        try { const s = localStorage.getItem(STORAGE_KEY); return s ? JSON.parse(s) : {}; }
        catch (e) { return {}; }
    }
    function saveLayout() {
        const layout = {};
        getCanvasCards().forEach(card => {
            layout[card.dataset.cardId] = {
                x: parseFloat(card.style.left) || 0,
                y: parseFloat(card.style.top) || 0,
                w: parseFloat(card.style.width) || 0,
                h: card.classList.contains('card-minimized')
                    ? parseFloat(card.dataset.restoreHeight) || 260
                    : (parseFloat(card.style.height) || 0),
                minimized: card.classList.contains('card-minimized')
            };
        });
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(layout)); }
        catch (e) { console.error('Error saving canvas layout:', e); }
    }

    function applyRect(card, rect) {
        card.style.left = rect.x + 'px';
        card.style.top = rect.y + 'px';
        card.style.width = rect.w + 'px';
        card.style.height = rect.h + 'px';
    }

    function updateCanvasHeight() {
        const el = canvas();
        if (!el || !isCanvasMode()) return;
        let maxBottom = 0;
        getCanvasCards().forEach(card => {
            if (card.style.display === 'none') return;
            const y = parseFloat(card.style.top) || 0;
            const h = card.classList.contains('card-minimized') ? 56 : (parseFloat(card.style.height) || 0);
            maxBottom = Math.max(maxBottom, y + h);
        });
        el.style.minHeight = (maxBottom + 24) + 'px';
    }

    function layoutCards() {
        const el = canvas();
        if (!el) return;
        const canvasMode = isCanvasMode();
        const canvasWidth = el.getBoundingClientRect().width || 900;
        const layout = loadLayout();

        getCanvasCards().forEach(card => {
            const cardId = card.dataset.cardId;
            card.classList.toggle('canvas-card', canvasMode);
            if (!canvasMode) {
                card.style.left = ''; card.style.top = ''; card.style.width = ''; card.style.height = '';
                return;
            }
            const saved = layout[cardId];
            const rect = saved
                ? { x: saved.x, y: saved.y, w: saved.w, h: saved.h }
                : getDefaultRect(cardId, canvasWidth);
            applyRect(card, rect);
            if (saved && saved.minimized) {
                card.dataset.restoreHeight = rect.h + 'px';
                card.classList.add('card-minimized');
                card.style.height = '';
                const btn = card.querySelector('.card-minimize-btn');
                if (btn) { btn.textContent = '+'; btn.title = 'Restore'; }
            }
        });
        updateCanvasHeight();
    }

    function getResizeDirection(card, clientX, clientY) {
        const rect = card.getBoundingClientRect();
        const nearLeft = clientX - rect.left < EDGE_ZONE;
        const nearRight = rect.right - clientX < EDGE_ZONE;
        const nearTop = clientY - rect.top < EDGE_ZONE;
        const nearBottom = rect.bottom - clientY < EDGE_ZONE;
        if (nearTop && nearLeft) return 'nw';
        if (nearTop && nearRight) return 'ne';
        if (nearBottom && nearLeft) return 'sw';
        if (nearBottom && nearRight) return 'se';
        if (nearTop) return 'n';
        if (nearBottom) return 's';
        if (nearLeft) return 'w';
        if (nearRight) return 'e';
        return null;
    }

    function wireCanvasCard(card) {
        if (card.dataset.canvasWired === '1') return;
        card.dataset.canvasWired = '1';

        card.addEventListener('mousemove', (e) => {
            if (activeCard || !isCanvasMode() || card.classList.contains('card-minimized')) return;
            const dir = getResizeDirection(card, e.clientX, e.clientY);
            card.style.cursor = dir ? CURSORS[dir] : '';
        });
        card.addEventListener('mouseleave', () => { if (!activeCard) card.style.cursor = ''; });

        card.addEventListener('mousedown', (e) => {
            if (!isCanvasMode() || card.classList.contains('card-minimized')) return;
            if (e.target.closest('button, a, input, textarea, select, .card-drag-handle')) return;
            const dir = getResizeDirection(card, e.clientX, e.clientY);
            if (!dir) return;
            startInteraction(e, card, dir);
        });
        card.addEventListener('touchstart', (e) => {
            if (!isCanvasMode() || card.classList.contains('card-minimized')) return;
            if (e.target.closest('button, a, input, textarea, select, .card-drag-handle')) return;
            const t = e.touches[0];
            const dir = getResizeDirection(card, t.clientX, t.clientY);
            if (!dir) return;
            startInteraction(e, card, dir);
        }, { passive: false });

        const handle = card.querySelector('.card-drag-handle');
        if (handle) {
            handle.addEventListener('mousedown', (e) => startInteraction(e, card, 'move'));
            handle.addEventListener('touchstart', (e) => startInteraction(e, card, 'move'), { passive: false });
        }

        card.addEventListener('contextmenu', (e) => {
            if (!isCanvasMode()) return;
            e.preventDefault();
            openContextMenu(card, e.clientX, e.clientY);
        });

        ensureMinimizeButton(card);
    }

    function startInteraction(e, card, mode) {
        if (e.button && e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        activeCard = card;
        activeMode = mode;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        startClientX = clientX;
        startClientY = clientY;
        const el = canvas();
        const canvasRect = el.getBoundingClientRect();
        const cardRect = card.getBoundingClientRect();
        startRect = {
            x: cardRect.left - canvasRect.left,
            y: cardRect.top - canvasRect.top,
            w: cardRect.width,
            h: cardRect.height
        };
        card.classList.add(mode === 'move' ? 'dragging' : 'resizing');
        document.body.style.cursor = mode === 'move' ? 'grabbing' : CURSORS[mode];
        document.body.style.userSelect = 'none';
    }

    function onMove(e) {
        if (!activeCard) return;
        e.preventDefault();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const dx = clientX - startClientX;
        const dy = clientY - startClientY;
        const el = canvas();
        const canvasWidth = el.getBoundingClientRect().width || 900;

        let { x, y, w, h } = startRect;

        if (activeMode === 'move') {
            x = startRect.x + dx;
            y = startRect.y + dy;
        } else {
            if (activeMode.includes('e')) w = Math.max(MIN_W, startRect.w + dx);
            if (activeMode.includes('s')) h = Math.max(MIN_H, startRect.h + dy);
            if (activeMode.includes('w')) {
                w = Math.max(MIN_W, startRect.w - dx);
                x = startRect.x + (startRect.w - w);
            }
            if (activeMode.includes('n')) {
                h = Math.max(MIN_H, startRect.h - dy);
                y = startRect.y + (startRect.h - h);
            }
        }

        x = Math.max(0, Math.min(x, canvasWidth - 40));
        y = Math.max(0, y);

        activeCard.style.left = x + 'px';
        activeCard.style.top = y + 'px';
        activeCard.style.width = w + 'px';
        activeCard.style.height = h + 'px';

        updateCanvasHeight();
    }

    function onEnd() {
        if (!activeCard) return;
        activeCard.classList.remove('dragging', 'resizing');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        activeCard = null;
        activeMode = null;
        saveLayout();
        if (typeof window.updateCardSizeClasses === 'function') window.updateCardSizeClasses();
    }

    function initCanvasCards() {
        const el = canvas();
        if (!el) return;
        getCanvasCards().forEach(wireCanvasCard);
        layoutCards();
    }

    function resetCanvas() {
        try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
        getCanvasCards().forEach(card => {
            card.classList.remove('card-minimized');
            const btn = card.querySelector('.card-minimize-btn');
            if (btn) { btn.textContent = '−'; btn.title = 'Minimize'; }
            delete card.dataset.restoreHeight;
        });
        layoutCards();
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);

    let resizeTimer = null;
    window.addEventListener('resize', () => {
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(layoutCards, 150);
    });

    window.__dashCanvasInit = initCanvasCards;
    window.__dashCanvasReset = resetCanvas;
    window.__dashCanvasSave = saveLayout;
    window.__dashCanvasUpdateHeight = updateCanvasHeight;
})();

// ============================================================
// PUBLIC GLUE — keeps the same function names the rest of the
// app already calls (live-widgets.js, dashboard.js, app.js),
// just fanning out to both subsystems above.
// ============================================================

function initDashboardCards() {
    if (typeof window.__dashStatsInit === 'function') window.__dashStatsInit();
    if (typeof window.__dashCanvasInit === 'function') window.__dashCanvasInit();
    const widgetsCard = document.querySelector('.dash-card[data-card-id="widgets"]');
    if (widgetsCard) ensureMinimizeButton(widgetsCard);
    updateCardSizeClasses();
}

function updateCardSizeClasses() {
    const cards = document.querySelectorAll('.dashboard-grid .dash-card[data-card-id]');
    cards.forEach(card => {
        if (card.style.display === 'none') return;
        if (card.classList.contains('card-minimized')) return;
        const rect = card.getBoundingClientRect();
        const w = rect.width;
        const h = rect.height;
        const wClass = w < 300 ? 'xs' : w < 440 ? 'sm' : w < 640 ? 'md' : 'lg';
        const hClass = h < 240 ? 'short' : h < 460 ? 'normal' : 'tall';
        card.dataset.w = wClass;
        card.dataset.h = hClass;
    });
    if (typeof window.__dashCanvasUpdateHeight === 'function') window.__dashCanvasUpdateHeight();
}

function resetDashboardLayout() {
    if (typeof window.__dashStatsReset === 'function') window.__dashStatsReset();
    if (typeof window.__dashCanvasReset === 'function') window.__dashCanvasReset();
    document.querySelectorAll('.dash-card[data-card-id]').forEach(card => {
        card.style.display = '';
    });
    showToast('🔄 Layout reset to default', 'info');
    updateCardSizeClasses();
}

function renumberAllCards() {
    if (typeof window.__dashStatsRenumber === 'function') window.__dashStatsRenumber();
    if (typeof window.__dashCanvasUpdateHeight === 'function') window.__dashCanvasUpdateHeight();
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDashboardCards);
} else {
    initDashboardCards();
}

// Expose globally
window.initDashboardCards = initDashboardCards;
window.resetDashboardLayout = resetDashboardLayout;
window.renumberDashboardCards = renumberAllCards;
window.updateCardSizeClasses = updateCardSizeClasses;
window.openCardContextMenu = openContextMenu;
