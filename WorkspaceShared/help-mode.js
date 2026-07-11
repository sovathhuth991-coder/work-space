// ============================================================
// help-mode.js — "Click to explain" contextual help.
// When Help Mode is on, clicking any part of the app shows a
// short popover explaining what it does, sourced from the same
// step data used by the guided per-section tutorials
// (window.tutorials, defined in interactive-tutorial.js) and
// falling back to pointing at the full Tutorial guide.
// ============================================================

let helpModeActive = false;
let helpPopoverEl = null;

function ensureHelpModeStyles() {
    if (document.getElementById('help-mode-styles')) return;
    const style = document.createElement('style');
    style.id = 'help-mode-styles';
    style.textContent = `
        body.help-mode-active * { cursor: help !important; }
        #helpModeBtn.active { background: linear-gradient(135deg, #34d399, #10b981); }
        .help-popover {
            position: fixed; z-index: 10050; max-width: 300px;
            background: var(--bg-surface); border: 1px solid var(--border-color-hover);
            border-radius: var(--radius-md); box-shadow: var(--shadow-elevated);
            padding: 14px 16px; backdrop-filter: blur(16px);
            animation: help-popover-in 0.18s ease-out;
        }
        @keyframes help-popover-in { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
        .help-popover-title { font-weight: 700; font-size: 13px; color: var(--text-primary); margin-bottom: 6px; display:flex; align-items:center; justify-content:space-between; gap:8px; }
        .help-popover-close { cursor:pointer; opacity:0.6; font-size:14px; line-height:1; }
        .help-popover-close:hover { opacity:1; }
        .help-popover-body { font-size: 12px; line-height: 1.5; color: var(--text-secondary); }
        .help-popover-link { display:inline-block; margin-top:8px; font-size:11px; color: var(--accent-1); cursor:pointer; text-decoration:underline; }
        .help-highlight-flash { outline: 2px solid var(--accent-1); outline-offset: 2px; border-radius: 6px; }
    `;
    document.head.appendChild(style);
}

// Find the best (most specific / closest) matching tutorial step for
// whatever element was clicked, searching across every section.
function findHelpStepForElement(el) {
    const tutorials = window.tutorials || {};
    let best = null;
    let bestDepth = Infinity;
    for (const key of Object.keys(tutorials)) {
        const section = tutorials[key];
        if (!section.steps) continue;
        for (const step of section.steps) {
            let node;
            try {
                node = el.closest(step.target);
            } catch (e) {
                continue; // invalid/unsupported selector, skip
            }
            if (!node) continue;
            // Prefer the match whose target element is deepest (most specific)
            let depth = 0;
            let cursor = el;
            while (cursor && cursor !== node) { depth++; cursor = cursor.parentElement; }
            if (cursor === node && depth < bestDepth) {
                bestDepth = depth;
                best = { section: section.title, node, ...step };
            }
        }
    }
    return best;
}

function closeHelpPopover() {
    if (helpPopoverEl) {
        helpPopoverEl.remove();
        helpPopoverEl = null;
    }
    document.querySelectorAll('.help-highlight-flash').forEach(el => el.classList.remove('help-highlight-flash'));
}

function showHelpPopover(x, y, title, bodyHtml, targetNode) {
    closeHelpPopover();
    ensureHelpModeStyles();
    if (targetNode) targetNode.classList.add('help-highlight-flash');

    const pop = document.createElement('div');
    pop.className = 'help-popover';
    pop.innerHTML = `
        <div class="help-popover-title">
            <span>${escapeHtml(title)}</span>
            <span class="help-popover-close" id="helpPopoverClose">✕</span>
        </div>
        <div class="help-popover-body">${bodyHtml}</div>
    `;
    document.body.appendChild(pop);

    // Position, clamped to viewport
    const rect = pop.getBoundingClientRect();
    let left = Math.min(x + 12, window.innerWidth - rect.width - 12);
    let top = Math.min(y + 12, window.innerHeight - rect.height - 12);
    left = Math.max(12, left);
    top = Math.max(12, top);
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';

    document.getElementById('helpPopoverClose').addEventListener('click', (e) => {
        e.stopPropagation();
        closeHelpPopover();
    });

    helpPopoverEl = pop;
}

function handleHelpModeClick(e) {
    if (!helpModeActive) return;
    // Never intercept clicks on the toggle button itself or inside an open popover.
    if (e.target.closest('#helpModeBtn') || e.target.closest('.help-popover')) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const match = findHelpStepForElement(e.target);
    if (match) {
        showHelpPopover(
            e.clientX, e.clientY,
            `${match.title}`,
            `${escapeHtml(match.content)}<div style="margin-top:6px; font-size:10px; opacity:0.6;">From: ${escapeHtml(match.section)}</div>`,
            match.node
        );
    } else {
        showHelpPopover(
            e.clientX, e.clientY,
            'Not sure yet',
            `No specific explanation for this part yet. Check the full guide for more detail.<span class="help-popover-link" id="helpOpenGuide">Open full Tutorial guide →</span>`,
            e.target
        );
        const link = document.getElementById('helpOpenGuide');
        if (link) {
            link.addEventListener('click', (evt) => {
                evt.stopPropagation();
                closeHelpPopover();
                setHelpMode(false);
                if (typeof switchView === 'function') switchView('tutorial-view');
                if (typeof openTutorialGuide === 'function') setTimeout(openTutorialGuide, 200);
            });
        }
    }
}

function setHelpMode(active) {
    helpModeActive = active;
    document.body.classList.toggle('help-mode-active', active);
    const btn = document.getElementById('helpModeBtn');
    if (btn) {
        btn.classList.toggle('active', active);
        btn.title = active
            ? 'Help mode is ON — click any part of the app to learn what it does. Click here to turn off.'
            : 'Click-to-explain: click any part of the app to learn what it does';
    }
    if (!active) closeHelpPopover();
    if (typeof showToast === 'function') {
        showToast(active ? 'Help mode on — click anything to learn what it does' : 'Help mode off', 'info', 2000);
    }
}

function toggleHelpMode() {
    setHelpMode(!helpModeActive);
}

function initHelpMode() {
    ensureHelpModeStyles();
    const btn = document.getElementById('helpModeBtn');
    if (btn) btn.addEventListener('click', toggleHelpMode);

    // Capture phase so we intercept before any nav/data-action handlers fire.
    document.addEventListener('click', handleHelpModeClick, true);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && helpModeActive) {
            if (helpPopoverEl) closeHelpPopover();
            else setHelpMode(false);
        }
    });
}

window.toggleHelpMode = toggleHelpMode;
window.setHelpMode = setHelpMode;

document.addEventListener('DOMContentLoaded', initHelpMode);
