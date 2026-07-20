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

function renderContextMenu(items, clientX, clientY) {
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

    const menuRect = menu.getBoundingClientRect();
    const left = Math.min(clientX, window.innerWidth - menuRect.width - 8);
    const top = Math.min(clientY, window.innerHeight - menuRect.height - 8);
    menu.style.left = Math.max(8, left) + 'px';
    menu.style.top = Math.max(8, top) + 'px';

    activeContextMenu = menu;
    setTimeout(() => document.addEventListener('mousedown', onContextMenuOutsideClick, true), 0);
}

function openContextMenu(card, clientX, clientY) {
    closeContextMenu();

    const items = [];
    const expandBtn = card.querySelector('[data-nav-expand]');
    const detailAction = card.dataset.detailAction;
    if (expandBtn) {
        items.push({ label: 'View Details', onClick: () => expandBtn.click() });
    } else if (detailAction && typeof window[detailAction] === 'function') {
        items.push({ label: 'View Details', onClick: () => window[detailAction]() });
    }
    const jumpBtn = card.querySelector('[data-nav-jump]');
    const sourceView = card.dataset.sourceView;
    if (jumpBtn) {
        items.push({ label: 'Go to Source', onClick: () => jumpBtn.click() });
    } else if (sourceView) {
        items.push({ label: 'Go to Source', onClick: () => { if (typeof switchView === 'function') switchView(sourceView); } });
    }
    const canvasGroup = card.closest('.dash-card-group');
    const statGroup = card.closest('.stat-card-group');
    if (canvasGroup) {
        items.push({ label: 'Split from Group', onClick: () => { if (typeof window.__dashSplitGroup === 'function') window.__dashSplitGroup(canvasGroup); } });
    } else if (statGroup) {
        items.push({ label: 'Split from Group', onClick: () => { if (typeof window.__dashSplitStatGroup === 'function') window.__dashSplitStatGroup(statGroup); } });
    }
    renderContextMenu(items, clientX, clientY);
}

function openGroupContextMenu(wrapper, clientX, clientY) {
    closeContextMenu();
    const isStatGroup = wrapper.classList.contains('stat-card-group');
    renderContextMenu([
        { label: 'Split Group', onClick: () => {
            const fn = isStatGroup ? window.__dashSplitStatGroup : window.__dashSplitGroup;
            if (typeof fn === 'function') fn(wrapper);
        } }
    ], clientX, clientY);
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

    const GROUPS_KEY = 'dashboardStatGroups';
    const MERGE_ZONE = 0.25;

    let activeCard = null;
    let isDragging = false;
    let startX = 0, startY = 0;
    let dropZoneIndicator = null;
    let mergeIndicator = null;
    let pendingMergeTarget = null; // { card, side }
    let pendingReorderTargetId = null;

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

    function loadGroups() {
        try { const s = localStorage.getItem(GROUPS_KEY); return s ? JSON.parse(s) : {}; }
        catch (e) { return {}; }
    }
    function saveGroups(groups) {
        try { localStorage.setItem(GROUPS_KEY, JSON.stringify(groups)); }
        catch (e) { console.error('Error saving stat groups:', e); }
    }

    function rebuildGroupsFromStorage() {
        const groups = loadGroups();
        Object.keys(groups).forEach(groupId => {
            if (document.querySelector(`[data-group-id="${groupId}"]`)) return;
            const def = groups[groupId];
            const cardA = document.querySelector(`.dash-stats-container .dash-card[data-card-id="${def.children[0]}"]`);
            const cardB = document.querySelector(`.dash-stats-container .dash-card[data-card-id="${def.children[1]}"]`);
            if (!cardA || !cardB || cardA.closest('.stat-card-group') || cardB.closest('.stat-card-group')) return;
            const wrapper = buildStatGroupWrapper(cardA, cardB, groupId);
            setOrder(wrapper, def.order || 0);
        });
    }

    function buildStatGroupWrapper(cardA, cardB, existingGroupId) {
        const groupId = existingGroupId || ('group-stat-' + Date.now());
        const wrapper = document.createElement('div');
        wrapper.className = 'dash-card stat-card-group';
        wrapper.dataset.groupId = groupId;
        wrapper.style.gridColumn = 'span 2';

        const inner = document.createElement('div');
        inner.className = 'stat-group-inner';

        const childA = document.createElement('div');
        childA.className = 'stat-group-child';
        const divider = document.createElement('div');
        divider.className = 'stat-group-divider';
        const childB = document.createElement('div');
        childB.className = 'stat-group-child';

        [cardA, cardB].forEach(c => {
            c.style.order = '';
            c.classList.add('grouped-card');
        });

        childA.appendChild(cardA);
        childB.appendChild(cardB);
        inner.appendChild(childA);
        inner.appendChild(divider);
        inner.appendChild(childB);
        wrapper.appendChild(inner);

        container().appendChild(wrapper);
        wireStatGroupWrapper(wrapper);
        return wrapper;
    }

    function mergeStatCards(draggedCard, targetCard, side) {
        const targetOrder = getOrder(targetCard);
        const cardA = side === 'left' ? draggedCard : targetCard;
        const cardB = side === 'left' ? targetCard : draggedCard;

        const wrapper = buildStatGroupWrapper(cardA, cardB);
        setOrder(wrapper, targetOrder);
        renumber();

        const groups = loadGroups();
        groups[wrapper.dataset.groupId] = {
            children: [cardA.dataset.cardId, cardB.dataset.cardId],
            order: getOrder(wrapper)
        };
        saveGroups(groups);
        saveLayout();
        if (typeof showToast === 'function') showToast('Stats combined — right-click to split', 'success');
    }

    function splitStatGroup(wrapper) {
        const groupId = wrapper.dataset.groupId;
        const cards = Array.from(wrapper.querySelectorAll('.dash-card[data-card-id]'));
        const order = getOrder(wrapper);
        cards.forEach((card, i) => {
            card.classList.remove('grouped-card');
            container().appendChild(card);
            setOrder(card, order + i * 0.5);
        });
        wrapper.remove();

        const groups = loadGroups();
        delete groups[groupId];
        saveGroups(groups);

        renumber();
        saveLayout();
    }

    function initStatCards() {
        const box = container();
        if (!box) return;
        rebuildGroupsFromStorage();
        const cards = box.querySelectorAll('.dash-card[data-card-id]');
        if (!cards.length) return;

        loadLayout();
        getVisibleStatCards().forEach((card, index) => {
            if (!card.style.order) setOrder(card, index + 1);
        });

        cards.forEach(wireStatCard);
        Array.from(box.querySelectorAll('.stat-card-group')).forEach(wireStatGroupWrapper);

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
        if (!mergeIndicator || !document.body.contains(mergeIndicator)) {
            mergeIndicator = document.createElement('div');
            mergeIndicator.className = 'merge-zone-indicator';
            document.body.appendChild(mergeIndicator);
        }
    }

    function wireStatCard(card) {
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
    }

    function wireStatGroupWrapper(wrapper) {
        if (wrapper.dataset.statWired === '1') return;
        wrapper.dataset.statWired = '1';
        wrapper.addEventListener('contextmenu', (e) => {
            if (e.target.closest('.dash-card[data-card-id]')) return; // let the child card's own menu win
            e.preventDefault();
            openGroupContextMenu(wrapper, e.clientX, e.clientY);
        });
        wrapper.querySelectorAll('.dash-card[data-card-id]').forEach(wireStatCard);
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
        pendingMergeTarget = null;
        mergeIndicator.style.display = 'none';

        let closestCard = null, closestDist = Infinity;
        getVisibleStatCards().forEach(card => {
            if (card === activeCard || card.closest('.stat-card-group')) return; // v1: no merging into an existing group
            const rect = card.getBoundingClientRect();

            const withinVertical = cursorY > rect.top && cursorY < rect.bottom;
            if (withinVertical) {
                const zoneW = rect.width * MERGE_ZONE;
                if (cursorX >= rect.left && cursorX < rect.left + zoneW) {
                    pendingMergeTarget = { card, side: 'left' };
                } else if (cursorX <= rect.right && cursorX > rect.right - zoneW) {
                    pendingMergeTarget = { card, side: 'right' };
                }
            }

            const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
            const dist = Math.sqrt((cursorX - cx) ** 2 + (cursorY - cy) ** 2);
            if (dist < closestDist) { closestDist = dist; closestCard = card; }
        });

        if (pendingMergeTarget) {
            dropZoneIndicator.style.display = 'none';
            const rect = pendingMergeTarget.card.getBoundingClientRect();
            const barX = pendingMergeTarget.side === 'left' ? rect.left : rect.right - 4;
            mergeIndicator.style.display = 'block';
            mergeIndicator.style.left = barX + 'px';
            mergeIndicator.style.top = rect.top + 'px';
            mergeIndicator.style.height = rect.height + 'px';
            pendingReorderTargetId = null;
            return;
        }

        if (closestCard && closestDist < 250) {
            const rect = closestCard.getBoundingClientRect();
            const boxRect = box.getBoundingClientRect();
            dropZoneIndicator.style.display = 'block';
            dropZoneIndicator.style.left = (rect.left - boxRect.left) + 'px';
            dropZoneIndicator.style.top = (rect.top - boxRect.top) + 'px';
            dropZoneIndicator.style.width = rect.width + 'px';
            dropZoneIndicator.style.height = rect.height + 'px';
            pendingReorderTargetId = closestCard.dataset.cardId;
        } else {
            dropZoneIndicator.style.display = 'none';
            pendingReorderTargetId = null;
        }
    }

    function onEnd() {
        if (!isDragging || !activeCard) return;
        const card = activeCard;
        card.classList.remove('dragging');
        card.style.transition = '';
        card.style.zIndex = '';
        if (dropZoneIndicator) dropZoneIndicator.style.display = 'none';
        if (mergeIndicator) mergeIndicator.style.display = 'none';

        const transform = card.style.transform;
        const match = transform.match(/translate\(([^p]+)px,\s*([^p]+)px\)/);
        if (match) {
            const deltaX = parseFloat(match[1]), deltaY = parseFloat(match[2]);
            if (Math.abs(deltaX) > 20 || Math.abs(deltaY) > 20) {
                if (pendingMergeTarget) {
                    card.style.transform = '';
                    isDragging = false;
                    activeCard = null;
                    mergeStatCards(card, pendingMergeTarget.card, pendingMergeTarget.side);
                    pendingMergeTarget = null;
                    return;
                }
                if (pendingReorderTargetId && pendingReorderTargetId !== card.dataset.cardId) {
                    reorder(card.dataset.cardId, pendingReorderTargetId);
                }
            }
            card.style.transform = '';
        }
        pendingMergeTarget = null;
        pendingReorderTargetId = null;
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
        Array.from(document.querySelectorAll('.dash-stats-container .stat-card-group')).forEach(splitStatGroup);
        getVisibleStatCards().forEach(card => { card.style.order = ''; });
        try { localStorage.removeItem('dashboardStatLayout'); } catch (e) {}
        try { localStorage.removeItem(GROUPS_KEY); } catch (e) {}
    }

    window.__dashStatsInit = initStatCards;
    window.__dashStatsReset = resetStats;
    window.__dashStatsRenumber = renumber;
    window.__dashStatsSave = saveLayout;
    window.__dashSplitStatGroup = splitStatGroup;
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
    const GROUPS_KEY = 'dashboardCanvasGroups';
    const BREAKPOINT = 860;
    const EDGE_ZONE = 10;
    const MIN_W = 220, MIN_H = 140;
    const MERGE_ZONE = 0.25; // outer 25% of a card's width is the "drop here to combine" zone
    const CURSORS = { n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', ne: 'nesw-resize', sw: 'nesw-resize', nw: 'nwse-resize', se: 'nwse-resize' };

    let activeItem = null;   // the positioned element actually being dragged/resized (a card OR a group wrapper)
    let activeMode = null;   // 'move' | one of the CURSORS keys
    let startClientX = 0, startClientY = 0;
    let startRect = null;
    let mergeTarget = null;  // { card, side } — set while dragging over a valid merge zone
    let mergeIndicatorEl = null;

    let activeDivider = null; // a group's divider being dragged to change the split ratio
    let dividerStartX = 0, dividerStartRatio = 0.5, dividerGroupWidth = 0;

    function canvas() { return document.getElementById('dashboardCanvas'); }
    function isCanvasMode() { return window.innerWidth > BREAKPOINT; }

    // Top-level positionable items — standalone cards and group wrappers.
    // Cards living inside a group are NOT in this list (their position comes
    // from flex-basis within the group, not from the layout store).
    function getPositionedItems() {
        const el = canvas();
        if (!el) return [];
        return Array.from(el.querySelectorAll('.canvas-positioned-item'));
    }

    // Every real card, whether standalone or currently inside a group — used
    // for wiring interactions (each card keeps its own context menu etc).
    function getAllCards() {
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
            'weather':       { x: rightX, y: 0,   w: rightW, h: 220 },
            'date-countdown': { x: rightX, y: 240, w: rightW, h: 260 }
        };
        // Unknown card ids (e.g. user-added "notion-like" cards) return null so
        // layoutCards() can auto-place them instead of stacking at (0,0).
        return DEFAULTS[cardId] || null;
    }

    function loadLayout() {
        try { const s = localStorage.getItem(STORAGE_KEY); return s ? JSON.parse(s) : {}; }
        catch (e) { return {}; }
    }
    function saveLayout() {
        const layout = {};
        getPositionedItems().forEach(item => {
            const key = item.dataset.cardId || item.dataset.groupId;
            if (!key) return;
            layout[key] = {
                x: parseFloat(item.style.left) || 0,
                y: parseFloat(item.style.top) || 0,
                w: parseFloat(item.style.width) || 0,
                h: item.classList.contains('card-minimized')
                    ? parseFloat(item.dataset.restoreHeight) || 260
                    : (parseFloat(item.style.height) || 0),
                minimized: item.classList.contains('card-minimized')
            };
        });
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(layout)); }
        catch (e) { console.error('Error saving canvas layout:', e); }
    }

    function loadGroups() {
        try { const s = localStorage.getItem(GROUPS_KEY); return s ? JSON.parse(s) : {}; }
        catch (e) { return {}; }
    }
    function saveGroups(groups) {
        try { localStorage.setItem(GROUPS_KEY, JSON.stringify(groups)); }
        catch (e) { console.error('Error saving canvas groups:', e); }
    }

    function applyRect(el, rect) {
        el.style.left = rect.x + 'px';
        el.style.top = rect.y + 'px';
        el.style.width = rect.w + 'px';
        el.style.height = rect.h + 'px';
    }

    function updateCanvasHeight() {
        const el = canvas();
        if (!el || !isCanvasMode()) return;
        let maxBottom = 0;
        getPositionedItems().forEach(item => {
            if (item.style.display === 'none') return;
            const y = parseFloat(item.style.top) || 0;
            const h = item.classList.contains('card-minimized') ? 56 : (parseFloat(item.style.height) || 0);
            maxBottom = Math.max(maxBottom, y + h);
        });
        el.style.minHeight = (maxBottom + 24) + 'px';
    }

    // ---- Rebuild any saved groups on load, before laying out positions ----
    function rebuildGroupsFromStorage() {
        const groups = loadGroups();
        let changed = false;
        Object.keys(groups).forEach(groupId => {
            if (document.querySelector(`[data-group-id="${groupId}"]`)) return;
            const def = groups[groupId];
            const cardA = document.querySelector(`.dash-card[data-card-id="${def.children[0]}"]`);
            const cardB = document.querySelector(`.dash-card[data-card-id="${def.children[1]}"]`);
            if (!cardA || !cardB || cardA.closest('.dash-card-group') || cardB.closest('.dash-card-group')) return;
            buildGroupWrapper(cardA, cardB, def.ratio, groupId);
        });
        if (changed) saveGroups(groups);
    }

    function buildGroupWrapper(cardA, cardB, ratio, existingGroupId) {
        const groupId = existingGroupId || ('group-' + Date.now());
        const safeRatio = (typeof ratio === 'number' && ratio > 0 && ratio < 1) ? ratio : 0.5;
        const wrapper = document.createElement('div');
        wrapper.className = 'dash-card-group canvas-positioned-item canvas-card';
        wrapper.dataset.groupId = groupId;

        const childA = document.createElement('div');
        childA.className = 'group-child';
        childA.style.flexGrow = String(safeRatio);
        childA.style.flexShrink = '1';
        childA.style.flexBasis = '0px';

        const divider = document.createElement('div');
        divider.className = 'group-divider';
        divider.dataset.groupId = groupId;
        divider.title = 'Drag to resize the split';

        const childB = document.createElement('div');
        childB.className = 'group-child';
        childB.style.flexGrow = String(1 - safeRatio);
        childB.style.flexShrink = '1';
        childB.style.flexBasis = '0px';

        [cardA, cardB].forEach(c => {
            c.classList.remove('canvas-positioned-item');
            c.classList.remove('card-minimized');
            c.style.left = ''; c.style.top = ''; c.style.width = ''; c.style.height = '';
            c.classList.add('grouped-card');
            const minBtn = c.querySelector('.card-minimize-btn');
            if (minBtn) { minBtn.style.display = 'none'; minBtn.textContent = '−'; minBtn.title = 'Minimize'; }
            delete c.dataset.restoreHeight;
        });

        childA.appendChild(cardA);
        childB.appendChild(cardB);
        wrapper.appendChild(childA);
        wrapper.appendChild(divider);
        wrapper.appendChild(childB);

        canvas().appendChild(wrapper);
        wireDivider(divider);
        wireGroupWrapper(wrapper);

        return wrapper;
    }

    function mergeCards(draggedCard, targetCard, side) {
        const el = canvas();
        const canvasRect = el.getBoundingClientRect();
        const targetRect = targetCard.getBoundingClientRect();
        const draggedRect = draggedCard.getBoundingClientRect();

        const groupRect = {
            x: Math.min(targetRect.left, draggedRect.left) - canvasRect.left,
            y: Math.min(targetRect.top, draggedRect.top) - canvasRect.top,
            w: Math.max(targetRect.right, draggedRect.right) - Math.min(targetRect.left, draggedRect.left),
            h: Math.max(targetRect.bottom, draggedRect.bottom) - Math.min(targetRect.top, draggedRect.top)
        };

        const cardA = side === 'left' ? draggedCard : targetCard;
        const cardB = side === 'left' ? targetCard : draggedCard;

        const wrapper = buildGroupWrapper(cardA, cardB, 0.5);
        applyRect(wrapper, groupRect);

        const groups = loadGroups();
        groups[wrapper.dataset.groupId] = {
            children: [cardA.dataset.cardId, cardB.dataset.cardId],
            ratio: 0.5
        };
        saveGroups(groups);

        wireCanvasItem(wrapper);
        saveLayout();
        updateCanvasHeight();
        if (typeof window.updateCardSizeClasses === 'function') window.updateCardSizeClasses();
        if (typeof showToast === 'function') showToast('Cards combined — drag the divider to resize the split', 'success');
    }

    function splitGroup(wrapper) {
        const groupId = wrapper.dataset.groupId;
        const cards = Array.from(wrapper.querySelectorAll('.dash-card[data-card-id]'));
        const el = canvas();
        const canvasRect = el.getBoundingClientRect();
        const groupRect = wrapper.getBoundingClientRect();
        const groupX = groupRect.left - canvasRect.left;
        const groupY = groupRect.top - canvasRect.top;
        const halfW = Math.max(MIN_W, groupRect.width / 2 - 10);

        cards.forEach((card, i) => {
            card.classList.remove('grouped-card');
            card.classList.add('canvas-positioned-item');
            applyRect(card, { x: groupX + i * (halfW + 20), y: groupY, w: halfW, h: groupRect.height });
            const minBtn = card.querySelector('.card-minimize-btn');
            if (minBtn) minBtn.style.display = '';
            canvas().appendChild(card);
        });

        wrapper.remove();

        const groups = loadGroups();
        delete groups[groupId];
        saveGroups(groups);

        saveLayout();
        updateCanvasHeight();
        if (typeof window.updateCardSizeClasses === 'function') window.updateCardSizeClasses();
    }

    // ---- Merge-zone detection while dragging a card ----
    function ensureMergeIndicator() {
        if (mergeIndicatorEl && document.body.contains(mergeIndicatorEl)) return mergeIndicatorEl;
        mergeIndicatorEl = document.createElement('div');
        mergeIndicatorEl.className = 'merge-zone-indicator';
        document.body.appendChild(mergeIndicatorEl);
        return mergeIndicatorEl;
    }

    function checkMergeTarget(draggedCard, clientX, clientY) {
        mergeTarget = null;
        const indicator = ensureMergeIndicator();
        indicator.style.display = 'none';

        getPositionedItems().forEach(item => {
            if (item === draggedCard || item.dataset.groupId) return; // no merging into an existing group (v1: 2-card cap)
            const cardId = item.dataset.cardId;
            if (!cardId) return;
            const rect = item.getBoundingClientRect();
            const withinVertical = clientY > rect.top && clientY < rect.bottom;
            if (!withinVertical) return;
            const zoneW = rect.width * MERGE_ZONE;
            if (clientX >= rect.left && clientX < rect.left + zoneW) {
                mergeTarget = { card: item, side: 'left' };
            } else if (clientX <= rect.right && clientX > rect.right - zoneW) {
                mergeTarget = { card: item, side: 'right' };
            }
        });

        if (mergeTarget) {
            const rect = mergeTarget.card.getBoundingClientRect();
            const barX = mergeTarget.side === 'left' ? rect.left : rect.right - 4;
            indicator.style.display = 'block';
            indicator.style.left = barX + 'px';
            indicator.style.top = rect.top + 'px';
            indicator.style.height = rect.height + 'px';
        }
    }

    function clearMergeTarget() {
        mergeTarget = null;
        if (mergeIndicatorEl) mergeIndicatorEl.style.display = 'none';
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

    // ---- Wire a single card (whether standalone or inside a group) ----
    function wireCard(card) {
        if (card.dataset.canvasWired === '1') return;
        card.dataset.canvasWired = '1';

        card.addEventListener('mousemove', (e) => {
            if (activeItem || !isCanvasMode() || card.classList.contains('card-minimized') || card.closest('.dash-card-group')) return;
            const dir = getResizeDirection(card, e.clientX, e.clientY);
            card.style.cursor = dir ? CURSORS[dir] : '';
        });
        card.addEventListener('mouseleave', () => { if (!activeItem) card.style.cursor = ''; });

        card.addEventListener('mousedown', (e) => {
            if (!isCanvasMode() || card.classList.contains('card-minimized') || card.closest('.dash-card-group')) return;
            if (e.target.closest('button, a, input, textarea, select, .card-drag-handle')) return;
            const dir = getResizeDirection(card, e.clientX, e.clientY);
            if (!dir) return;
            startInteraction(e, card, dir);
        });
        card.addEventListener('touchstart', (e) => {
            if (!isCanvasMode() || card.classList.contains('card-minimized') || card.closest('.dash-card-group')) return;
            if (e.target.closest('button, a, input, textarea, select, .card-drag-handle')) return;
            const t = e.touches[0];
            const dir = getResizeDirection(card, t.clientX, t.clientY);
            if (!dir) return;
            startInteraction(e, card, dir);
        }, { passive: false });

        const handle = card.querySelector('.card-drag-handle');
        if (handle) {
            handle.addEventListener('mousedown', (e) => {
                const group = card.closest('.dash-card-group');
                startInteraction(e, group || card, 'move', group ? null : card);
            });
            handle.addEventListener('touchstart', (e) => {
                const group = card.closest('.dash-card-group');
                startInteraction(e, group || card, 'move', group ? null : card);
            }, { passive: false });
        }

        card.addEventListener('contextmenu', (e) => {
            if (!isCanvasMode()) return;
            e.preventDefault();
            openContextMenu(card, e.clientX, e.clientY);
        });

        ensureMinimizeButton(card);
    }

    function wireGroupWrapper(wrapper) {
        if (wrapper.dataset.canvasWired === '1') return;
        wrapper.dataset.canvasWired = '1';

        wrapper.addEventListener('mousemove', (e) => {
            if (activeItem || !isCanvasMode() || wrapper.classList.contains('card-minimized')) return;
            if (e.target.closest('.group-divider, .dash-card')) { wrapper.style.cursor = ''; return; }
            const dir = getResizeDirection(wrapper, e.clientX, e.clientY);
            wrapper.style.cursor = dir ? CURSORS[dir] : '';
        });
        wrapper.addEventListener('mouseleave', () => { if (!activeItem) wrapper.style.cursor = ''; });

        wrapper.addEventListener('mousedown', (e) => {
            if (!isCanvasMode() || wrapper.classList.contains('card-minimized')) return;
            if (e.target.closest('.group-divider, button, a, input, textarea, select, .card-drag-handle')) return;
            const dir = getResizeDirection(wrapper, e.clientX, e.clientY);
            if (!dir) return;
            startInteraction(e, wrapper, dir);
        });

        wrapper.addEventListener('contextmenu', (e) => {
            if (!isCanvasMode() || e.target.closest('.dash-card')) return; // let individual card menus take priority
            e.preventDefault();
            openGroupContextMenu(wrapper, e.clientX, e.clientY);
        });

        wrapper.querySelectorAll('.dash-card[data-card-id]').forEach(wireCard);
    }

    function wireCanvasItem(item) {
        if (item.dataset.groupId) wireGroupWrapper(item);
        else wireCard(item);
    }

    function wireDivider(divider) {
        divider.addEventListener('mousedown', (e) => {
            if (!isCanvasMode()) return;
            e.preventDefault();
            e.stopPropagation();
            const wrapper = divider.closest('.dash-card-group');
            const childA = wrapper.querySelector('.group-child');
            activeDivider = divider;
            dividerStartX = e.clientX;
            let startRatio = parseFloat(childA.style.flexGrow);
            if (isNaN(startRatio)) {
                const groups = loadGroups();
                const groupData = groups[wrapper.dataset.groupId];
                startRatio = groupData ? (groupData.ratio || 0.5) : 0.5;
            }
            dividerStartRatio = startRatio;
            dividerGroupWidth = wrapper.getBoundingClientRect().width;
            document.body.style.cursor = 'ew-resize';
            document.body.style.userSelect = 'none';
        });
    }

    function startInteraction(e, item, mode, dragSourceCard) {
        if (e.button && e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        activeItem = item;
        activeMode = mode;
        activeItem.dataset.dragSourceCardId = dragSourceCard ? dragSourceCard.dataset.cardId : '';
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        startClientX = clientX;
        startClientY = clientY;
        const el = canvas();
        const canvasRect = el.getBoundingClientRect();
        const itemRect = item.getBoundingClientRect();
        startRect = {
            x: itemRect.left - canvasRect.left,
            y: itemRect.top - canvasRect.top,
            w: itemRect.width,
            h: itemRect.height
        };
        item.classList.add(mode === 'move' ? 'dragging' : 'resizing');
        document.body.style.cursor = mode === 'move' ? 'grabbing' : CURSORS[mode];
        document.body.style.userSelect = 'none';
    }

    function onMove(e) {
        if (activeDivider) {
            const dx = e.clientX - dividerStartX;
            const newRatio = Math.min(0.8, Math.max(0.2, dividerStartRatio + dx / dividerGroupWidth));
            const wrapper = activeDivider.closest('.dash-card-group');
            const childA = wrapper.querySelector('.group-child');
            const childB = wrapper.querySelectorAll('.group-child')[1];
            childA.style.flexGrow = String(newRatio);
            childA.style.flexBasis = '0px';
            childB.style.flexGrow = String(1 - newRatio);
            childB.style.flexBasis = '0px';
            return;
        }

        if (!activeItem) return;
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

        activeItem.style.left = x + 'px';
        activeItem.style.top = y + 'px';
        activeItem.style.width = w + 'px';
        activeItem.style.height = h + 'px';

        // Only single (non-grouped) cards being MOVED can trigger a merge — not resizes, not group wrappers.
        const sourceCardId = activeItem.dataset.dragSourceCardId;
        if (activeMode === 'move' && sourceCardId && !activeItem.dataset.groupId) {
            checkMergeTarget(activeItem, clientX, clientY);
        }

        updateCanvasHeight();
    }

    function onEnd() {
        if (activeDivider) {
            const wrapper = activeDivider.closest('.dash-card-group');
            const groups = loadGroups();
            if (wrapper && groups[wrapper.dataset.groupId]) {
                const childA = wrapper.querySelector('.group-child');
                groups[wrapper.dataset.groupId].ratio = parseFloat(childA.style.flexGrow) || 0.5;
                saveGroups(groups);
            }
            activeDivider = null;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            return;
        }

        if (!activeItem) return;
        const item = activeItem;
        item.classList.remove('dragging', 'resizing');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';

        if (mergeTarget && !item.dataset.groupId) {
            const target = mergeTarget.card;
            const side = mergeTarget.side;
            clearMergeTarget();
            activeItem = null;
            activeMode = null;
            mergeCards(item, target, side);
            return;
        }

        clearMergeTarget();
        activeItem = null;
        activeMode = null;
        saveLayout();
        if (typeof window.updateCardSizeClasses === 'function') window.updateCardSizeClasses();
    }

    function layoutCards() {
        const el = canvas();
        if (!el) return;
        rebuildGroupsFromStorage();

        const canvasMode = isCanvasMode();
        const canvasWidth = el.getBoundingClientRect().width || 900;
        const layout = loadLayout();
        const gap = 20;
        const leftW = Math.max(280, Math.round((canvasWidth - gap) * 0.6));
        // Automatic-placement column for any card without a saved layout or a
        // hard-coded default (e.g. user-added "notion-like" cards). Stack them
        // below the known left-column cards (banner/schedule-mini/todo end at
        // ~880px) so they never overlap anything.
        let fallbackY = 900;
        getPositionedItems().forEach(item => {
            const key = item.dataset.cardId || item.dataset.groupId;
            item.classList.toggle('canvas-card', canvasMode);
            if (!canvasMode) {
                item.style.left = ''; item.style.top = ''; item.style.width = ''; item.style.height = '';
                return;
            }
            const saved = layout[key];
            let rect;
            if (saved) {
                rect = { x: saved.x, y: saved.y, w: saved.w, h: saved.h };
            } else {
                rect = getDefaultRect(key, canvasWidth);
                if (!rect) {
                    rect = { x: 0, y: fallbackY, w: leftW, h: 260 };
                    fallbackY += 260 + gap;
                }
            }
            applyRect(item, rect);
            if (saved && saved.minimized) {
                item.dataset.restoreHeight = rect.h + 'px';
                item.classList.add('card-minimized');
                item.style.height = '';
                const btn = item.querySelector('.card-minimize-btn');
                if (btn) { btn.textContent = '+'; btn.title = 'Restore'; }
            }
        });
        updateCanvasHeight();
    }

    function initCanvasCards() {
        const el = canvas();
        if (!el) return;
        rebuildGroupsFromStorage();
        // Register every standalone canvas card (e.g. banner, todo) as a
        // positionable item. Grouped children are skipped — they live inside a
        // .dash-card-group and are positioned by flex-basis, not the layout store.
        el.querySelectorAll('.dash-card.canvas-card[data-card-id]').forEach(card => {
            if (!card.closest('.dash-card-group')) card.classList.add('canvas-positioned-item');
        });
        getPositionedItems().forEach(wireCanvasItem);
        layoutCards();
    }

    function resetCanvas() {
        try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
        try { localStorage.removeItem(GROUPS_KEY); } catch (e) {}
        document.querySelectorAll('.dash-card-group').forEach(wrapper => {
            wrapper.querySelectorAll('.dash-card[data-card-id]').forEach(card => {
                card.classList.remove('grouped-card');
                card.classList.add('canvas-positioned-item');
                const minBtn = card.querySelector('.card-minimize-btn');
                if (minBtn) minBtn.style.display = '';
                canvas().appendChild(card);
            });
            wrapper.remove();
        });
        getAllCards().forEach(card => {
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
    window.__dashSplitGroup = splitGroup;
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
