// ============================================================
// command-palette.js — Ctrl+K / Cmd+K quick navigation & actions
//
// Two sources of commands:
//   1. "Go to X" — read live off the sidebar's .nav-btn elements,
//      so it always matches whatever views actually exist.
//   2. Quick actions — a short, hand-picked list wired to real,
//      already-existing functions (tasks.js, habits.js,
//      journal-ui.js, pomodoro.js, library.js). No new business
//      logic here, just triggers for what's already there.
// ============================================================

(function () {
    const QUICK_ACTIONS = [
        {
            id: 'action-add-task',
            label: 'Add Task',
            icon: '☑',
            color: 'var(--nav-todo)',
            keywords: 'new todo create task',
            run: () => {
                if (typeof switchView === 'function') switchView('todo-view');
                setTimeout(() => document.getElementById('new-task-input')?.focus(), 150);
            }
        },
        {
            id: 'action-add-habit',
            label: 'Add Habit',
            icon: '✅',
            color: 'var(--nav-habits)',
            keywords: 'new track habit',
            run: () => {
                if (typeof switchView === 'function') switchView('habits-view');
                setTimeout(() => { if (typeof addHabit === 'function') addHabit(); }, 150);
            }
        },
        {
            id: 'action-new-journal',
            label: 'New Journal Entry',
            icon: '📔',
            color: 'var(--nav-journal)',
            keywords: 'write journal diary entry',
            run: () => {
                if (typeof switchView === 'function') switchView('journal-view');
                setTimeout(() => { if (typeof JournalUI !== 'undefined') JournalUI.openEditor(); }, 150);
            }
        },
        {
            id: 'action-start-pomodoro',
            label: 'Start Focus Timer',
            icon: '◴',
            color: 'var(--nav-timer)',
            keywords: 'pomodoro focus start timer',
            run: () => {
                if (typeof switchView === 'function') switchView('timer-view');
                setTimeout(() => document.getElementById('pomodoroStartBtn')?.click(), 150);
            }
        },
        {
            id: 'action-add-library',
            label: 'Save Link to Library',
            icon: '📚',
            color: 'var(--nav-library)',
            keywords: 'new bookmark save link library',
            run: () => {
                if (typeof switchView === 'function') switchView('library-view');
                setTimeout(() => document.getElementById('library-title')?.focus(), 150);
            }
        }
    ];

    function buildNavCommands() {
        const buttons = document.querySelectorAll('.nav-btn.hub-menu-item[data-view]');
        return Array.from(buttons).map(btn => {
            const icon = btn.querySelector('.menu-icon')?.textContent?.trim() || '→';
            const labelSpan = Array.from(btn.querySelectorAll('span')).find(
                s => !s.classList.contains('nav-glow-border') && !s.classList.contains('menu-icon')
            );
            const label = labelSpan?.textContent?.trim() || btn.dataset.view.replace('-view', '');
            const view = btn.dataset.view;
            const slug = view.replace('-view', '');
            return {
                id: `nav-${view}`,
                label: `Go to ${label}`,
                icon,
                color: `var(--nav-${slug}, var(--accent-solid))`,
                keywords: `go navigate open ${label.toLowerCase()}`,
                run: () => { if (typeof switchView === 'function') switchView(view); }
            };
        });
    }

    function getAllCommands() {
        return [...buildNavCommands(), ...QUICK_ACTIONS];
    }

    function matchCommand(cmd, query) {
        if (!query) return 0;
        const haystack = `${cmd.label} ${cmd.keywords}`.toLowerCase();
        const words = query.toLowerCase().trim().split(/\s+/);
        if (!words.every(w => haystack.includes(w))) return -1;
        return cmd.label.toLowerCase().startsWith(query.toLowerCase()) ? 2 : 1;
    }

    // ------------------------------------------------------------
    // DOM setup
    // ------------------------------------------------------------
    let overlay, input, list;
    let selectedIndex = 0;
    let currentResults = [];

    function buildPalette() {
        overlay = document.createElement('div');
        overlay.className = 'cmdk-overlay';
        overlay.innerHTML = `
            <div class="cmdk-panel">
                <div class="cmdk-input-row">
                    <span class="cmdk-icon">🔍</span>
                    <input type="text" class="cmdk-input" placeholder="Jump to a view or run a quick action…" autocomplete="off" spellcheck="false">
                </div>
                <div class="cmdk-list"></div>
                <div class="cmdk-footer">
                    <span><span class="cmdk-kbd">↑↓</span> navigate</span>
                    <span><span class="cmdk-kbd">↵</span> select</span>
                    <span><span class="cmdk-kbd">esc</span> close</span>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        input = overlay.querySelector('.cmdk-input');
        list = overlay.querySelector('.cmdk-list');

        overlay.addEventListener('mousedown', (e) => {
            if (e.target === overlay) closePalette();
        });
        input.addEventListener('input', () => render(input.value));
        input.addEventListener('keydown', handleKeydown);
    }

    function render(query) {
        const all = getAllCommands();
        currentResults = all
            .map(cmd => ({ cmd, score: matchCommand(cmd, query) }))
            .filter(r => query ? r.score >= 0 : true)
            .sort((a, b) => b.score - a.score)
            .map(r => r.cmd);

        selectedIndex = 0;

        if (currentResults.length === 0) {
            list.innerHTML = `<div class="cmdk-empty">No matches — try a different word.</div>`;
            return;
        }

        const navResults = currentResults.filter(c => c.id.startsWith('nav-'));
        const actionResults = currentResults.filter(c => c.id.startsWith('action-'));

        let html = '';
        if (actionResults.length) {
            html += `<div class="cmdk-section-label">Quick actions</div>`;
            html += actionResults.map(c => itemHtml(c)).join('');
        }
        if (navResults.length) {
            html += `<div class="cmdk-section-label">Navigate</div>`;
            html += navResults.map(c => itemHtml(c)).join('');
        }
        list.innerHTML = html;

        list.querySelectorAll('.cmdk-item').forEach(el => {
            el.addEventListener('mouseenter', () => {
                selectedIndex = currentResults.findIndex(c => c.id === el.dataset.id);
                highlightSelected();
            });
            el.addEventListener('click', () => {
                const cmd = currentResults.find(c => c.id === el.dataset.id);
                if (cmd) executeCommand(cmd);
            });
        });
        highlightSelected();
    }

    function itemHtml(cmd) {
        return `
            <div class="cmdk-item" data-id="${cmd.id}" style="--item-color:${cmd.color}">
                <span class="cmdk-item-icon">${cmd.icon}</span>
                <span class="cmdk-item-label">${cmd.label}</span>
            </div>
        `;
    }

    function highlightSelected() {
        const items = list.querySelectorAll('.cmdk-item');
        items.forEach((el, i) => {
            el.classList.toggle('selected', i === selectedIndex);
        });
        items[selectedIndex]?.scrollIntoView({ block: 'nearest' });
    }

    function handleKeydown(e) {
        if (e.key === 'Escape') {
            e.preventDefault();
            closePalette();
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (currentResults.length) {
                selectedIndex = (selectedIndex + 1) % currentResults.length;
                highlightSelected();
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (currentResults.length) {
                selectedIndex = (selectedIndex - 1 + currentResults.length) % currentResults.length;
                highlightSelected();
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const cmd = currentResults[selectedIndex];
            if (cmd) executeCommand(cmd);
        }
    }

    function executeCommand(cmd) {
        closePalette();
        // Let the close animation/DOM settle before switching views/focusing inputs
        setTimeout(() => cmd.run(), 10);
    }

    function openPalette() {
        if (!overlay) buildPalette();
        overlay.classList.add('open');
        input.value = '';
        render('');
        setTimeout(() => input.focus(), 50);
    }

    function closePalette() {
        if (overlay) overlay.classList.remove('open');
    }

    function togglePalette() {
        if (overlay && overlay.classList.contains('open')) {
            closePalette();
        } else {
            openPalette();
        }
    }

    // ------------------------------------------------------------
    // Global shortcut + discoverable trigger button
    // ------------------------------------------------------------
    document.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            togglePalette();
        }
    });

    function addTriggerButton() {
        const anchor = document.getElementById('headerToggleContainer');
        if (!anchor || !anchor.parentNode) return;
        const isMac = navigator.platform.toUpperCase().includes('MAC');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.title = 'Search & quick actions';
        btn.style.cssText = 'padding:6px 12px; border-radius:99px; border:1px solid var(--border-color); background:var(--bg-card); color:var(--text-secondary); font-size:0.75rem; cursor:pointer; display:flex; align-items:center; gap:6px; margin-right:8px; transition:var(--transition);';
        btn.innerHTML = `🔍 <span class="cmdk-trigger-hint"><span class="cmdk-kbd">${isMac ? '⌘' : 'Ctrl'}</span><span class="cmdk-kbd">K</span></span>`;
        btn.addEventListener('click', openPalette);
        anchor.parentNode.insertBefore(btn, anchor);
    }

    document.addEventListener('DOMContentLoaded', addTriggerButton);

    window.openCommandPalette = openPalette;
})();
