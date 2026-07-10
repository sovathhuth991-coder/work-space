// ============================================================
// ai-assistant.js — Detects and talks to a locally running AI
// server (Ollama, LM Studio, llama.cpp server, text-gen-webui,
// Jan, or anything else exposing an Ollama or OpenAI-compatible
// local API) and drives the sidebar AI Assistant panel.
// ============================================================

const AI_CONFIG_KEY = 'aiAssistantConfig';
const AI_HISTORY_KEY = 'aiAssistantHistory';
const AI_CHECK_INTERVAL_MS = 15000;
const AI_FETCH_TIMEOUT_MS = 2500;

// Candidate local servers, checked in order. Most local AI tools
// default to one of these ports. "kind" decides which request/response
// shape we use to chat with it.
const AI_DEFAULT_CANDIDATES = [
    { label: 'Ollama', base: 'http://localhost:11434', kind: 'ollama' },
    { label: 'LM Studio', base: 'http://localhost:1234', kind: 'openai' },
    { label: 'text-generation-webui', base: 'http://localhost:5000', kind: 'openai' },
    { label: 'llama.cpp server', base: 'http://localhost:8080', kind: 'openai' },
    { label: 'Jan', base: 'http://localhost:1337', kind: 'openai' }
];

let aiState = {
    online: false,
    checking: false,
    base: null,
    kind: null,
    model: null,
    label: null
};

function getAIConfig() {
    const cfg = loadFromLocalStorage(AI_CONFIG_KEY, {});
    return {
        customBase: cfg.customBase || null, // if set, only this endpoint is checked
        kind: cfg.kind || 'auto',           // 'auto' | 'ollama' | 'openai'
        model: cfg.model || null            // preferred model override
    };
}

function saveAIConfig(partial) {
    const current = getAIConfig();
    saveToLocalStorage(AI_CONFIG_KEY, { ...current, ...partial });
}

function getAICandidates() {
    const cfg = getAIConfig();
    if (cfg.customBase) {
        return [{ label: 'Custom', base: cfg.customBase.replace(/\/$/, ''), kind: cfg.kind === 'auto' ? 'ollama' : cfg.kind }];
    }
    return AI_DEFAULT_CANDIDATES;
}

async function fetchWithTimeout(url, options = {}, timeout = AI_FETCH_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        return response;
    } finally {
        clearTimeout(timer);
    }
}

// Try to detect a running local AI server among the candidates.
// Returns { base, kind, label, model } or null.
async function detectLocalAI() {
    const candidates = getAICandidates();
    for (const candidate of candidates) {
        try {
            if (candidate.kind === 'ollama') {
                const res = await fetchWithTimeout(`${candidate.base}/api/tags`);
                if (res.ok) {
                    const data = await res.json();
                    const models = Array.isArray(data.models) ? data.models : [];
                    const preferred = getAIConfig().model;
                    const model = (preferred && models.find(m => m.name === preferred)?.name)
                        || models[0]?.name
                        || null;
                    return { ...candidate, model };
                }
            } else {
                // OpenAI-compatible: GET /v1/models
                const res = await fetchWithTimeout(`${candidate.base}/v1/models`);
                if (res.ok) {
                    const data = await res.json();
                    const models = Array.isArray(data.data) ? data.data : [];
                    const preferred = getAIConfig().model;
                    const model = (preferred && models.find(m => m.id === preferred)?.id)
                        || models[0]?.id
                        || null;
                    return { ...candidate, model };
                }
            }
        } catch (e) {
            // Not reachable / CORS blocked / timed out — try next candidate.
        }
    }
    return null;
}

function setAIStatusUI(online, label, model) {
    const statusEl = document.getElementById('ai-status-side');
    const modelEl = document.getElementById('ai-model-name-side');
    const sendBtn = document.getElementById('ai-send-side');
    const input = document.getElementById('ai-input-side');
    if (statusEl) {
        statusEl.textContent = online ? `● online${label ? ' · ' + label : ''}` : '● offline';
        statusEl.style.color = online ? '#34d399' : '#f87171';
        statusEl.title = online
            ? 'Connected to your local AI. Click to re-check.'
            : "No local AI detected. Click to retry, or click the gear to set a custom endpoint.\nIf you're running Ollama, make sure OLLAMA_ORIGINS allows this page.";
    }
    if (modelEl) {
        modelEl.textContent = online ? (model || 'model unknown') : 'no local AI detected';
    }
    if (sendBtn) sendBtn.disabled = false; // allow click even offline, we re-check on send
    if (input) input.disabled = false;
}

async function checkAIStatus(silent = true) {
    if (aiState.checking) return aiState.online;
    aiState.checking = true;
    const statusEl = document.getElementById('ai-status-side');
    if (statusEl && !silent) {
        statusEl.textContent = '● checking...';
        statusEl.style.color = 'var(--text-muted)';
    }
    const found = await detectLocalAI();
    aiState.checking = false;
    if (found) {
        const wasOffline = !aiState.online;
        aiState = { online: true, checking: false, base: found.base, kind: found.kind, model: found.model, label: found.label };
        setAIStatusUI(true, found.label, found.model);
        if (wasOffline && !silent) showToast(`Connected to local AI (${found.label})`, 'success');
        return true;
    } else {
        const wasOnline = aiState.online;
        aiState = { online: false, checking: false, base: null, kind: null, model: null, label: null };
        setAIStatusUI(false, null, null);
        if (wasOnline && !silent) showToast('Lost connection to local AI', 'warning');
        else if (!silent) showToast('No local AI detected on common ports', 'error');
        return false;
    }
}

function getAIHistory() {
    return loadFromLocalStorage(AI_HISTORY_KEY, []);
}

function saveAIHistory(history) {
    // Keep it small — this is a sidebar assistant, not a full transcript archive.
    saveToLocalStorage(AI_HISTORY_KEY, history.slice(-20));
}

function ensureAIStyles() {
    if (document.getElementById('ai-assistant-styles')) return;
    const style = document.createElement('style');
    style.id = 'ai-assistant-styles';
    style.textContent = `
        .ai-msg { padding:6px 8px; border-radius:8px; margin-bottom:6px; font-size:12px; line-height:1.4; white-space:pre-wrap; word-break:break-word; }
        .ai-msg-user { background:var(--bg-secondary); color:var(--text-primary); margin-left:16px; }
        .ai-msg-assistant { background:rgba(124,109,240,0.1); color:var(--text-secondary); margin-right:16px; }
        .ai-msg-thinking { opacity:0.6; font-style:italic; }
    `;
    document.head.appendChild(style);
}

function renderAIMessages() {
    ensureAIStyles();
    const container = document.getElementById('ai-messages-side');
    if (!container) return;
    const history = getAIHistory();
    if (history.length === 0) {
        container.innerHTML = '<div style="text-align:center; opacity:0.4; padding:6px 0; font-size:11px;">Ask me anything.</div>';
        return;
    }
    container.innerHTML = history.map(m =>
        `<div class="ai-msg ${m.role === 'user' ? 'ai-msg-user' : 'ai-msg-assistant'}">${escapeHtml(m.content)}</div>`
    ).join('');
    container.scrollTop = container.scrollHeight;
}

async function sendAIChat(base, kind, model, messages) {
    if (kind === 'ollama') {
        const res = await fetchWithTimeout(`${base}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, messages, stream: false })
        }, 60000);
        if (!res.ok) throw new Error(`Server responded ${res.status}`);
        const data = await res.json();
        return data.message?.content || '(empty response)';
    } else {
        const res = await fetchWithTimeout(`${base}/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, messages, stream: false })
        }, 60000);
        if (!res.ok) throw new Error(`Server responded ${res.status}`);
        const data = await res.json();
        return data.choices?.[0]?.message?.content || '(empty response)';
    }
}

async function sendAIMessageSide() {
    const input = document.getElementById('ai-input-side');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    if (!aiState.online) {
        const ok = await checkAIStatus(false);
        if (!ok) {
            showToast('No local AI detected. Start Ollama/LM Studio, or set a custom endpoint via the gear icon.', 'error');
            return;
        }
    }

    input.value = '';
    input.disabled = true;
    const sendBtn = document.getElementById('ai-send-side');
    if (sendBtn) sendBtn.disabled = true;

    const history = getAIHistory();
    history.push({ role: 'user', content: text });
    saveAIHistory(history);
    renderAIMessages();

    const container = document.getElementById('ai-messages-side');
    const thinkingEl = document.createElement('div');
    thinkingEl.className = 'ai-msg ai-msg-assistant ai-msg-thinking';
    thinkingEl.textContent = 'Thinking…';
    if (container) {
        container.appendChild(thinkingEl);
        container.scrollTop = container.scrollHeight;
    }

    try {
        const modelToUse = aiState.model || getAIConfig().model;
        const reply = await sendAIChat(
            aiState.base,
            aiState.kind,
            modelToUse,
            history.map(m => ({ role: m.role, content: m.content }))
        );
        const updated = getAIHistory();
        updated.push({ role: 'assistant', content: reply });
        saveAIHistory(updated);
        renderAIMessages();
    } catch (e) {
        console.warn('[AI Assistant] chat failed:', e);
        thinkingEl.remove();
        showToast('Local AI did not respond. It may have gone offline.', 'error');
        checkAIStatus(true);
    } finally {
        if (input) input.disabled = false;
        if (sendBtn) sendBtn.disabled = false;
        input?.focus();
    }
}

function configureAIEndpoint() {
    const current = getAIConfig();
    const input = prompt(
        'Enter your local AI server URL (e.g. http://localhost:11434 for Ollama, http://localhost:1234 for LM Studio).\nLeave blank to auto-detect common local servers instead.',
        current.customBase || ''
    );
    if (input === null) return; // cancelled
    const trimmed = input.trim();
    if (!trimmed) {
        saveAIConfig({ customBase: null, kind: 'auto' });
        showToast('Switched back to auto-detecting local AI servers', 'info');
    } else {
        const kind = confirm('Click OK if this is an Ollama server, or Cancel if it\'s an OpenAI-compatible server (LM Studio, llama.cpp, text-generation-webui, etc).')
            ? 'ollama'
            : 'openai';
        saveAIConfig({ customBase: trimmed, kind });
        showToast('Custom AI endpoint saved', 'success');
    }
    checkAIStatus(false);
}

function clearAIChat() {
    saveToLocalStorage(AI_HISTORY_KEY, []);
    renderAIMessages();
}

function initAIAssistant() {
    ensureAIStyles();
    renderAIMessages();

    const sendBtn = document.getElementById('ai-send-side');
    const input = document.getElementById('ai-input-side');
    const statusEl = document.getElementById('ai-status-side');

    if (sendBtn) sendBtn.addEventListener('click', sendAIMessageSide);
    if (input) {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendAIMessageSide();
            }
        });
    }
    if (statusEl) {
        statusEl.style.cursor = 'pointer';
        statusEl.addEventListener('click', () => checkAIStatus(false));
    }

    // Small gear + clear controls next to the AI Assistant label, added
    // without touching the static HTML markup.
    const header = statusEl?.parentElement;
    if (header && !document.getElementById('ai-settings-btn')) {
        const gear = document.createElement('span');
        gear.id = 'ai-settings-btn';
        gear.textContent = '⚙';
        gear.title = 'Configure local AI endpoint';
        gear.style.cssText = 'cursor:pointer; font-size:11px; margin-left:6px; opacity:0.6;';
        gear.addEventListener('click', configureAIEndpoint);
        gear.addEventListener('mouseenter', () => gear.style.opacity = '1');
        gear.addEventListener('mouseleave', () => gear.style.opacity = '0.6');
        statusEl.insertAdjacentElement('afterend', gear);
    }

    checkAIStatus(true);
    setInterval(() => checkAIStatus(true), AI_CHECK_INTERVAL_MS);
}

window.checkAIStatus = checkAIStatus;
window.sendAIMessageSide = sendAIMessageSide;
window.configureAIEndpoint = configureAIEndpoint;
window.clearAIChat = clearAIChat;

document.addEventListener('DOMContentLoaded', initAIAssistant);
