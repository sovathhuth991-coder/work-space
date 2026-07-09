// ============================================================
// DEV TOOLS — Live Style & Code Editor
// ============================================================

let devToolsOpen = false;
let activeDevTab = 'theme';
let customCSS = '';
let devColorOverrides = {};

const CSS_VARS = [
    { name: '--accent-1', default: '#7c6df0', label: 'Primary Accent' },
    { name: '--accent-2', default: '#5b8def', label: 'Secondary Accent' },
    { name: '--bg-card', default: 'rgba(24,24,40,0.7)', label: 'Card BG' },
    { name: '--bg-secondary', default: '#12121e', label: 'Sidebar BG' },
    { name: '--text-primary', default: '#f1f1f7', label: 'Main Text' },
    { name: '--text-secondary', default: '#b0b0c8', label: 'Secondary Text' },
    { name: '--radius-lg', default: '16px', label: 'Large Radius' },
    { name: '--radius-md', default: '12px', label: 'Medium Radius' },
];

function initDevTools() {
    try {
        customCSS = localStorage.getItem('dev_custom_css') || '';
        devColorOverrides = JSON.parse(localStorage.getItem('dev_color_overrides') || '{}');
    } catch (e) {
        console.warn('Failed to load dev tools state:', e);
        customCSS = '';
        devColorOverrides = {};
    }

    const footer = document.querySelector('.hub-version');
    if (footer) {
        const btn = document.createElement('button');
        btn.className = 'dev-tools-toggle-btn';
        btn.innerHTML = '🛠️';
        btn.title = 'Open Dev Tools (Live Edit)';
        btn.onclick = () => toggleDevTools();
        footer.parentNode.insertBefore(btn, footer);
        const spacer = document.createElement('span');
        spacer.style.margin = '0 6px';
        spacer.textContent = '|';
        footer.parentNode.insertBefore(spacer, footer);
    }

    buildDevPanel();

    if (customCSS) {
        applyCustomCSS(customCSS, false);
    }
    Object.keys(devColorOverrides).forEach(key => {
        if (devColorOverrides[key]) {
            document.documentElement.style.setProperty(key, devColorOverrides[key]);
        }
    });
}

function buildDevPanel() {
    const existing = document.getElementById('devToolsPanel');
    if (existing) existing.remove();

    const panel = document.createElement('div');
    panel.id = 'devToolsPanel';
    panel.className = 'dev-tools-panel';

    const header = document.createElement('div');
    header.className = 'dev-tools-header';
    header.innerHTML = `
        <span class="dev-tools-drag-handle" id="devDragHandle">⠿</span>
        <h3>🛠️ Dev Tools</h3>
        <button class="dev-tools-close" onclick="toggleDevTools()">✕</button>
    `;
    panel.appendChild(header);

    const tabs = document.createElement('div');
    tabs.className = 'dev-tools-tabs';
    const tabNames = [
        { id: 'theme', label: '🎨 Theme' },
        { id: 'css', label: '✏️ CSS' },
        { id: 'html', label: '📄 HTML' }
    ];
    tabNames.forEach(t => {
        const btn = document.createElement('button');
        btn.className = `dev-tools-tab${t.id === activeDevTab ? ' active' : ''}`;
        btn.dataset.tab = t.id;
        btn.textContent = t.label;
        btn.onclick = () => switchDevTab(t.id);
        tabs.appendChild(btn);
    });
    panel.appendChild(tabs);

    const body = document.createElement('div');
    body.className = 'dev-tools-body';

    // Theme tab
    const themeTab = document.createElement('div');
    themeTab.className = `tab-content${activeDevTab === 'theme' ? ' active' : ''}`;
    themeTab.dataset.tab = 'theme';

    CSS_VARS.forEach(v => {
        const row = document.createElement('div');
        row.className = 'color-var-row';

        const label = document.createElement('label');
        label.textContent = v.label;

        const input = document.createElement('input');
        input.type = 'color';
        input.value = devColorOverrides[v.name] || v.default;
        input.title = v.name;
        input.oninput = (e) => {
            const val = e.target.value;
            document.documentElement.style.setProperty(v.name, val);
            devColorOverrides[v.name] = val;
            localStorage.setItem('dev_color_overrides', JSON.stringify(devColorOverrides));
        };

        const reset = document.createElement('button');
        reset.className = 'reset-btn';
        reset.textContent = '↺';
        reset.title = 'Reset to default';
        reset.onclick = () => {
            document.documentElement.style.setProperty(v.name, v.default);
            input.value = v.default;
            delete devColorOverrides[v.name];
            localStorage.setItem('dev_color_overrides', JSON.stringify(devColorOverrides));
        };

        row.appendChild(label);
        row.appendChild(input);
        row.appendChild(reset);
        themeTab.appendChild(row);
    });

    const note = document.createElement('p');
    note.style.cssText = 'font-size:0.7rem;color:var(--text-muted);margin-top:8px;';
    note.textContent = '💡 Changes apply instantly. Copy your colors to variables.css when done.';
    themeTab.appendChild(note);
    body.appendChild(themeTab);

    // CSS tab
    const cssTab = document.createElement('div');
    cssTab.className = `tab-content${activeDevTab === 'css' ? ' active' : ''}`;
    cssTab.dataset.tab = 'css';

    const textarea = document.createElement('textarea');
    textarea.className = 'dev-css-textarea';
    textarea.id = 'devCssInput';
    textarea.value = customCSS;
    textarea.placeholder = '/* Write custom CSS here... */\n\n.dash-card {\n  border-radius: 20px;\n  padding: 32px;\n}';

    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:10px;align-items:center;flex-wrap:wrap;';

    const applyBtn = document.createElement('button');
    applyBtn.className = 'dev-apply-btn';
    applyBtn.textContent = '⚡ Apply CSS';
    applyBtn.onclick = () => {
        const val = document.getElementById('devCssInput').value;
        customCSS = val;
        localStorage.setItem('dev_custom_css', val);
        applyCustomCSS(val, true);
        document.getElementById('devInjectStatus').textContent = '✅ CSS injected!';
        setTimeout(() => {
            document.getElementById('devInjectStatus').textContent = '';
        }, 2000);
    };

    const status = document.createElement('span');
    status.id = 'devInjectStatus';
    status.className = 'dev-inject-status';

    actions.appendChild(applyBtn);
    actions.appendChild(status);

    cssTab.appendChild(textarea);
    cssTab.appendChild(actions);
    body.appendChild(cssTab);

    // HTML tab
    const htmlTab = document.createElement('div');
    htmlTab.className = `tab-content${activeDevTab === 'html' ? ' active' : ''}`;
    htmlTab.dataset.tab = 'html';

    const htmlDisplay = document.createElement('pre');
    htmlDisplay.className = 'dev-html-display';
    htmlDisplay.id = 'devHtmlDisplay';
    htmlDisplay.textContent = 'Loading...';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'dev-copy-btn';
    copyBtn.textContent = '📋 Copy to clipboard';
    copyBtn.onclick = () => {
        const text = document.getElementById('devHtmlDisplay').textContent;
        navigator.clipboard?.writeText(text).then(() => {
            copyBtn.textContent = '✅ Copied!';
            setTimeout(() => copyBtn.textContent = '📋 Copy to clipboard', 1500);
        }).catch(() => {
            const range = document.createRange();
            range.selectNode(document.getElementById('devHtmlDisplay'));
            window.getSelection().removeAllRanges();
            window.getSelection().addRange(range);
            document.execCommand('copy');
            copyBtn.textContent = '✅ Copied!';
            setTimeout(() => copyBtn.textContent = '📋 Copy to clipboard', 1500);
        });
    };

    htmlTab.appendChild(htmlDisplay);
    htmlTab.appendChild(copyBtn);
    body.appendChild(htmlTab);

    panel.appendChild(body);
    document.body.appendChild(panel);

    refreshHtmlDisplay();
    makeDraggable(panel, document.getElementById('devDragHandle'));

    if (devToolsOpen) {
        panel.classList.add('open');
    }
}

function toggleDevTools() {
    devToolsOpen = !devToolsOpen;
    const panel = document.getElementById('devToolsPanel');
    if (panel) {
        panel.classList.toggle('open', devToolsOpen);
        if (devToolsOpen) refreshHtmlDisplay();
    } else {
        buildDevPanel();
        devToolsOpen = true;
        document.getElementById('devToolsPanel').classList.add('open');
    }
}

function switchDevTab(tabId) {
    activeDevTab = tabId;
    document.querySelectorAll('.dev-tools-tab').forEach(el => {
        el.classList.toggle('active', el.dataset.tab === tabId);
    });
    document.querySelectorAll('.tab-content').forEach(el => {
        el.classList.toggle('active', el.dataset.tab === tabId);
    });
    if (tabId === 'html') refreshHtmlDisplay();
}

function applyCustomCSS(css, showToastMsg = false) {
    const old = document.getElementById('devInjectedStyle');
    if (old) old.remove();

    if (!css.trim()) return;

    const style = document.createElement('style');
    style.id = 'devInjectedStyle';
    style.textContent = css;
    document.head.appendChild(style);

    if (showToastMsg) {
        const toast = document.createElement('div');
        toast.className = 'toast-notification toast-success';
        toast.textContent = '✅ Custom CSS applied';
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('toast-hide');
            setTimeout(() => toast.remove(), 300);
        }, 1500);
    }
}

function refreshHtmlDisplay() {
    const display = document.getElementById('devHtmlDisplay');
    if (!display) return;

    const activeView = document.querySelector('.hub-view.active');
    if (activeView) {
        let html = activeView.outerHTML;
        display.textContent = html;
    } else {
        display.textContent = '<!-- No active view -->';
    }
}

function makeDraggable(element, handle) {
    let isDragging = false;
    let offsetX = 0, offsetY = 0;

    handle.addEventListener('mousedown', (e) => {
        if (e.target.closest('button')) return;
        isDragging = true;
        const rect = element.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
        element.style.position = 'fixed';
        element.style.transition = 'none';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        let x = e.clientX - offsetX;
        let y = e.clientY - offsetY;
        const maxX = window.innerWidth - element.offsetWidth;
        const maxY = window.innerHeight - element.offsetHeight;
        x = Math.max(0, Math.min(x, maxX));
        y = Math.max(0, Math.min(y, maxY));
        element.style.left = x + 'px';
        element.style.top = y + 'px';
        element.style.right = 'auto';
        element.style.bottom = 'auto';
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            element.style.transition = '';
        }
    });
}

// ─── PATCH switchView WITHOUT DUPLICATING originalSwitchView ───
document.addEventListener('DOMContentLoaded', () => {
    if (typeof window.originalSwitchView === 'undefined') {
        window.originalSwitchView = window.switchView;
    }
    if (typeof window.originalSwitchView === 'function') {
        window.switchView = function(viewId) {
            window.originalSwitchView(viewId);
            if (devToolsOpen) {
                setTimeout(refreshHtmlDisplay, 100);
            }
        };
    }
});

window.toggleDevTools = toggleDevTools;
window.switchDevTab = switchDevTab;
window.applyCustomCSS = applyCustomCSS;
window.refreshHtmlDisplay = refreshHtmlDisplay;
window.initDevTools = initDevTools;

console.log('🛠️ Dev Tools module loaded — click 🛠️ in the sidebar to open.');
