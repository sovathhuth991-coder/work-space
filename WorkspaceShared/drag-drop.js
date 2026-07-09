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
// DASHBOARD CARDS DRAG & RESIZE (All cards)
// ============================================================

(function() {
    'use strict';

    const STORAGE_KEY = 'dashboardCardLayout';
    let activeCard = null;
    let startX = 0;
    let startY = 0;
    let isDragging = false;
    let dropZoneIndicator = null;
    let cardOrderMap = {}; // cardId -> order number

    function getVisibleCards() {
        return Array.from(document.querySelectorAll('.dash-card[data-card-id]')).filter(c => c.style.display !== 'none');
    }

    function getCardOrder(card) {
        return parseInt(card.style.order || '0', 10);
    }

    function setCardOrder(card, order) {
        card.style.order = order;
        cardOrderMap[card.dataset.cardId] = order;
    }

    function renumberAllCards() {
        const visible = getVisibleCards();
        visible.sort((a, b) => getCardOrder(a) - getCardOrder(b));
        visible.forEach((card, index) => {
            setCardOrder(card, index + 1);
        });
    }

    function initDashboardCards() {
        const cards = document.querySelectorAll('.dash-card[data-card-id]');
        if (cards.length === 0) return;

        // Load saved layout
        loadLayout();

        // Ensure every visible card has an order
        const visible = getVisibleCards();
        visible.forEach((card, index) => {
            if (!card.style.order) {
                setCardOrder(card, index + 1);
            }
        });

        // Add drag listeners to all cards
        cards.forEach(card => {
            const handle = card.querySelector('.card-drag-handle');
            if (handle) {
                handle.addEventListener('mousedown', (e) => startDrag(e, card));
                handle.addEventListener('touchstart', (e) => startDrag(e, card), { passive: false });
            }

            const resizeBtn = card.querySelector('.card-resize-btn');
            if (resizeBtn) {
                resizeBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    toggleCardSize(card);
                });
            }
        });

        // Global move and end listeners
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onEnd);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('touchend', onEnd);

        // Reset button
        const resetBtn = document.querySelector('[data-action="resetDashboardLayout"]');
        if (resetBtn) {
            resetBtn.addEventListener('click', resetLayout);
        }

        // Create drop zone indicator
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
        const grid = document.querySelector('.dashboard-grid');
        if (grid) {
            grid.appendChild(dropZoneIndicator);
        }
    }

    function startDrag(e, card) {
        if (e.button && e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();

        activeCard = card;
        isDragging = true;
        card.classList.add('dragging');

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        startX = clientX;
        startY = clientY;
    }

    function onMove(e) {
        if (!isDragging || !activeCard) return;
        e.preventDefault();

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        const deltaX = clientX - startX;
        const deltaY = clientY - startY;

        activeCard.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(1.02)`;
        activeCard.style.transition = 'none';
        activeCard.style.zIndex = '1000';

        showDropZone(clientX, clientY);
    }

    function showDropZone(cursorX, cursorY) {
        const grid = document.querySelector('.dashboard-grid');
        if (!grid || !dropZoneIndicator) return;

        const visible = getVisibleCards();
        let closestCard = null;
        let closestDist = Infinity;

        visible.forEach(card => {
            if (card === activeCard) return;
            const rect = card.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            const dist = Math.sqrt((cursorX - cx) ** 2 + (cursorY - cy) ** 2);
            if (dist < closestDist) {
                closestDist = dist;
                closestCard = card;
            }
        });

        if (closestCard && closestDist < 250) {
            const rect = closestCard.getBoundingClientRect();
            const gridRect = grid.getBoundingClientRect();
            dropZoneIndicator.style.display = 'block';
            dropZoneIndicator.style.left = (rect.left - gridRect.left) + 'px';
            dropZoneIndicator.style.top = (rect.top - gridRect.top) + 'px';
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

        if (dropZoneIndicator) {
            dropZoneIndicator.style.display = 'none';
        }

        const transform = card.style.transform;
        const match = transform.match(/translate\(([^p]+)px,\s*([^p]+)px\)/);
        if (match) {
            const deltaX = parseFloat(match[1]);
            const deltaY = parseFloat(match[2]);

            if (Math.abs(deltaX) > 30 || Math.abs(deltaY) > 30) {
                const targetId = dropZoneIndicator?.dataset?.targetId;
                if (targetId && targetId !== card.dataset.cardId) {
                    reorderCards(card.dataset.cardId, targetId);
                }
            }

            card.style.transform = '';
        }

        isDragging = false;
        activeCard = null;
    }

    function reorderCards(sourceId, targetId) {
        const sourceCard = document.querySelector(`.dash-card[data-card-id="${sourceId}"]`);
        const targetCard = document.querySelector(`.dash-card[data-card-id="${targetId}"]`);
        if (!sourceCard || !targetCard) return;

        const sourceOrder = getCardOrder(sourceCard);
        const targetOrder = getCardOrder(targetCard);

        // Shift other cards to make room
        const visible = getVisibleCards();
        visible.forEach(card => {
            const order = getCardOrder(card);
            const cardId = card.dataset.cardId;
            if (cardId === sourceId) return;

            if (targetOrder < sourceOrder) {
                // Moving up: shift cards between target+1 and source down by 1
                if (order > targetOrder && order < sourceOrder) {
                    setCardOrder(card, order + 1);
                }
            } else {
                // Moving down: shift cards between source and target-1 up by 1
                if (order >= sourceOrder && order < targetOrder) {
                    setCardOrder(card, order - 1);
                }
            }
        });

        // Place source at target position
        setCardOrder(sourceCard, targetOrder);

        // Renumber everything to be sequential
        renumberAllCards();

        // Save
        saveLayout();
        showToast(`📦 ${sourceId} moved`, 'info');
    }

    function toggleCardSize(card) {
        const cardId = card.dataset.cardId;
        if (!cardId) return;

        if (cardId === 'banner' || cardId === 'widgets' || cardId === 'hub') {
            showToast('This card cannot be resized', 'info');
            return;
        }

        const isLarge = card.classList.toggle('card-large');
        saveLayout();
        showToast(isLarge ? '📐 Card enlarged' : '📐 Card normal size', 'info');
    }

    function saveLayout() {
        const layout = {};
        document.querySelectorAll('.dash-card[data-card-id]').forEach(card => {
            const cardId = card.dataset.cardId;
            if (!cardId) return;
            layout[cardId] = {
                order: card.style.order || '0',
                isLarge: card.classList.contains('card-large'),
                hidden: card.style.display === 'none'
            };
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
            Object.keys(layout).forEach(cardId => {
                const card = document.querySelector(`.dash-card[data-card-id="${cardId}"]`);
                if (!card || !layout[cardId]) return;

                if (layout[cardId].order) {
                    card.style.order = layout[cardId].order;
                }
                if (layout[cardId].isLarge) {
                    card.classList.add('card-large');
                }
                if (layout[cardId].hidden) {
                    card.style.display = 'none';
                }
            });
        } catch (e) {
            console.error('Error loading layout:', e);
        }
    }

    function resetLayout() {
        document.querySelectorAll('.dash-card[data-card-id]').forEach(card => {
            card.style.order = '';
            card.style.gridArea = '';
            card.style.gridColumn = '';
            card.style.position = '';
            card.style.left = '';
            card.style.top = '';
            card.style.width = '';
            card.style.transform = '';
            card.style.display = '';
            card.classList.remove('card-large');
            delete card.dataset.customPosition;
        });

        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (e) {
            console.error('Error clearing layout:', e);
        }

        showToast('🔄 Layout reset to default', 'info');
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initDashboardCards);
    } else {
        initDashboardCards();
    }

    // Expose globally
    window.initDashboardCards = initDashboardCards;
    window.resetDashboardLayout = resetLayout;
    window.renumberDashboardCards = renumberAllCards;

})();
