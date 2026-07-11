// ============================================================
// ai-assistant.js — Detects and talks to a locally running AI
// server (Ollama, LM Studio, llama.cpp server, text-gen-webui,
// Jan, or anything else exposing an Ollama or OpenAI-compatible
// local API) and drives the dedicated AI Assistant view.
//
// Website sync: every message is sent with a system prompt that
// contains a live snapshot of the whole app (ai-context.js) plus
// a small set of tools (ai-tools.js) the model can call to add,
// complete, or delete things for the user. Tool calls use a
// plain fenced-JSON convention so they work with ANY chat model,
// regardless of whether that backend has native function calling.
// ============================================================

const AI_CONFIG_KEY = 'aiAssistantConfig';
const AI_HISTORY_KEY = 'aiAssistantHistory';
const AI_CHECK_INTERVAL_MS = 15000;
const AI_FETCH_TIMEOUT_MS = 2500;

const AI_DEFAULT_CANDIDATES = [
    { label: 'Ollama', base: 'http://localhost:11434', kind: 'ollama' },
    { label: 'LM Studio', base: 'http://localhost:1234', kind: 'openai' },
    { label: 'text-generation-webui', base: 'http://localhost:5000', kind: 'openai' },
    { label: 'llama.cpp server', base: 'http://localhost:8080', kind: 'openai' },
    { label: 'Jan', base: 'http://localhost:1337', kind: 'openai' }
];

let aiState = { online: false, checking: false, base: null, kind: null, model: null, label: null };

function getAIConfig() {
    const cfg = loadFromLocalStorage(AI_CONFIG_KEY, {});
    return {
        customBase: cfg.customBase || null,
        kind: cfg.kind || 'auto',
        model: cfg.model || null
    };
}

function saveAIConfig(partial) {
    saveToLocalStorage(AI_CONFIG_KEY, { ...getAIConfig(), ...partial });
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
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

async function detectLocalAI() {
    for (const candidate of getAICandidates()) {
        try {
            if (candidate.kind === 'ollama') {
                const res = await fetchWithTimeout(`${candidate.base}/api/tags`);
                if (res.ok) {
                    const data = await res.json();
                    const models = Array.isArray(data.models) ? data.models : [];
                    const preferred = getAIConfig().model;
                    const model = (preferred && models.find(m => m.name === preferred)?.name) || models[0]?.name || null;
                    return { ...candidate, model };
                }
            } else {
                const res = await fetchWithTimeout(`${candidate.base}/v1/models`);
                if (res.ok) {
                    const data = await res.json();
                    const models = Array.isArray(data.data) ? data.data : [];
                    const preferred = getAIConfig().model;
                    const model = (preferred && models.find(m => m.id === preferred)?.id) || models[0]?.id || null;
                    return { ...candidate, model };
                }
            }
        } catch (e) { /* not reachable — try next candidate */ }
    }
    return null;
}

function setAIStatusUI(online, label, model) {
    const statusEl = document.getElementById('ai-status-view');
    const modelEl = document.getElementById('ai-model-name-view');
    const sendBtn = document.getElementById('ai-send-view');
    const input = document.getElementById('ai-input-view');
    if (statusEl) {
        statusEl.textContent = online ? `● online${label ? ' · ' + label : ''}` : '● offline';
        statusEl.classList.toggle('online', online);
        statusEl.classList.toggle('offline', !online);
        statusEl.title = online
            ? 'Connected to your local AI. Click to re-check.'
            : "No local AI detected. Click to retry, or click Endpoint to set a custom one.\nIf you're running Ollama, make sure OLLAMA_ORIGINS allows this page.";
    }
    if (modelEl) modelEl.textContent = online ? (model || 'model unknown') : 'no local AI detected';
    if (sendBtn) sendBtn.disabled = false;
    if (input) input.disabled = false;
}

async function checkAIStatus(silent = true) {
    if (aiState.checking) return aiState.online;
    aiState.checking = true;
    const statusEl = document.getElementById('ai-status-view');
    if (statusEl && !silent) {
        statusEl.textContent = '● checking...';
        statusEl.classList.remove('online', 'offline');
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

function getAIHistory() { return loadFromLocalStorage(AI_HISTORY_KEY, []); }
function saveAIHistory(history) { saveToLocalStorage(AI_HISTORY_KEY, history.slice(-20)); }

function areActionsAllowed() {
    const cb = document.getElementById('ai-actions-enabled');
    return cb ? cb.checked : true;
}

function renderContextPanel() {
    const el = document.getElementById('ai-context-summary');
    if (!el || typeof getSiteSnapshot !== 'function') return;
    const s = getSiteSnapshot();
    el.innerHTML = `
        <div class="ai-context-row"><span>✅ Tasks</span><span>${s.tasks.pending} pending / ${s.tasks.total}</span></div>
        <div class="ai-context-row"><span>🔥 Habits</span><span>${s.habits.doneToday}/${s.habits.total} done today</span></div>
        <div class="ai-context-row"><span>📔 Journal</span><span>${s.journal.total} entries</span></div>
        <div class="ai-context-row"><span>📚 Reading</span><span>${s.reading.total} items</span></div>
        <div class="ai-context-row"><span>🔗 Library</span><span>${s.library.total} links</span></div>
        <div class="ai-context-row"><span>▦ Today</span><span>${s.scheduleToday.items.length} events</span></div>
    `;
}

function renderAIMessages() {
    const container = document.getElementById('ai-messages-view');
    if (!container) return;
    const history = getAIHistory();
    if (history.length === 0) {
        container.innerHTML = '<div class="ai-empty-state">Ask me anything about your Workspace — tasks, habits, journal, reading list, and more.</div>';
        return;
    }
    container.innerHTML = history.map(m => {
        if (m.role === 'action') {
            return `<div class="ai-msg ai-msg-action ${m.ok ? 'ok' : 'fail'}">${m.ok ? '✅' : '⚠️'} ${escapeHtml(m.content)}</div>`;
        }
        return `<div class="ai-msg ${m.role === 'user' ? 'ai-msg-user' : 'ai-msg-assistant'}">${escapeHtml(m.content)}</div>`;
    }).join('');
    container.scrollTop = container.scrollHeight;
}

function buildSystemPrompt() {
    const snapshot = (typeof getSiteContextPromptBlock === 'function') ? getSiteContextPromptBlock() : '(no site data available)';
    const toolLines = (window.AI_TOOL_SCHEMAS || [])
        .map(t => `- ${t.name}${t.args} — ${t.desc}`).join('\n');

    return `You are the built-in AI Assistant inside "Workspace Hub", a personal productivity app. You can see the user's real, current data below, and you can act on it using tools.

${snapshot}

TOOLS
${areActionsAllowed() ? `You may call ONE tool per reply when the user asks you to add, complete, delete, update, or navigate somewhere. To call a tool, reply with ONLY this and nothing else:
\`\`\`tool_call
{"name": "<tool_name>", "arguments": { ... }}
\`\`\`
Available tools:
${toolLines}

If the user is just asking a question, answer normally in plain text using the snapshot above — do not call a tool.` : 'Tool actions are currently disabled by the user. Answer questions using the snapshot above, but do not attempt to call any tool.'}`;
}

function parseToolCall(text) {
    const match = text.match(/```tool_call\s*([\s\S]*?)```/);
    if (!match) return null;
    try {
        const parsed = JSON.parse(match[1].trim());
        if (parsed && typeof parsed.name === 'string') return parsed;
    } catch (e) { /* model produced malformed JSON — ignore, treat as plain text */ }
    return null;
}

async function sendAIChat(base, kind, model, messages) {
    if (kind === 'ollama') {
        const res = await fetchWithTimeout(`${base}/api/chat`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, messages, stream: false })
        }, 60000);
        if (!res.ok) throw new Error(`Server responded ${res.status}`);
        const data = await res.json();
        return data.message?.content || '(empty response)';
    } else {
        const res = await fetchWithTimeout(`${base}/v1/chat/completions`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, messages, stream: false })
        }, 60000);
        if (!res.ok) throw new Error(`Server responded ${res.status}`);
        const data = await res.json();
        return data.choices?.[0]?.message?.content || '(empty response)';
    }
}

async function sendAIMessageView() {
    const input = document.getElementById('ai-input-view');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    if (!aiState.online) {
        const ok = await checkAIStatus(false);
        if (!ok) {
            showToast('No local AI detected. Start Ollama/LM Studio, or set a custom endpoint via Endpoint.', 'error');
            return;
        }
    }

    input.value = '';
    input.disabled = true;
    const sendBtn = document.getElementById('ai-send-view');
    if (sendBtn) sendBtn.disabled = true;

    const history = getAIHistory();
    history.push({ role: 'user', content: text });
    saveAIHistory(history);
    renderAIMessages();

    const container = document.getElementById('ai-messages-view');
    const thinkingEl = document.createElement('div');
    thinkingEl.className = 'ai-msg ai-msg-assistant ai-msg-thinking';
    thinkingEl.textContent = 'Thinking…';
    if (container) { container.appendChild(thinkingEl); container.scrollTop = container.scrollHeight; }

    try {
        const modelToUse = aiState.model || getAIConfig().model;
        const systemMsg = { role: 'system', content: buildSystemPrompt() };
        const wireMessages = [systemMsg, ...history.slice(-10).map(m => ({ role: m.role === 'action' ? 'assistant' : m.role, content: m.content }))];

        const reply = await sendAIChat(aiState.base, aiState.kind, modelToUse, wireMessages);
        thinkingEl.remove();

        const toolCall = areActionsAllowed() ? parseToolCall(reply) : null;

        if (toolCall) {
            const executor = window.AI_TOOL_EXECUTORS?.[toolCall.name];
            let result;
            if (!executor) {
                result = { ok: false, message: `Unknown tool "${toolCall.name}".` };
            } else {
                try {
                    result = executor(toolCall.arguments || {});
                } catch (err) {
                    console.error('[AI Assistant] tool execution failed:', err);
                    result = { ok: false, message: `Something went wrong running "${toolCall.name}".` };
                }
            }
            const updated = getAIHistory();
            updated.push({ role: 'action', content: result.message, ok: result.ok });
            saveAIHistory(updated);
            renderAIMessages();
            renderContextPanel();
        } else {
            const updated = getAIHistory();
            updated.push({ role: 'assistant', content: reply });
            saveAIHistory(updated);
            renderAIMessages();
        }
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
    if (input === null) return;
    const trimmed = input.trim();
    if (!trimmed) {
        saveAIConfig({ customBase: null, kind: 'auto' });
        showToast('Switched back to auto-detecting local AI servers', 'info');
    } else {
        const kind = confirm('Click OK if this is an Ollama server, or Cancel if it\'s an OpenAI-compatible server (LM Studio, llama.cpp, text-generation-webui, etc).')
            ? 'ollama' : 'openai';
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
    renderAIMessages();
    renderContextPanel();

    const sendBtn = document.getElementById('ai-send-view');
    const input = document.getElementById('ai-input-view');
    const statusEl = document.getElementById('ai-status-view');
    const settingsBtn = document.getElementById('ai-settings-btn-view');
    const clearBtn = document.getElementById('ai-clear-btn-view');

    if (sendBtn) sendBtn.addEventListener('click', sendAIMessageView);
    if (input) {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAIMessageView(); }
        });
    }
    if (statusEl) { statusEl.style.cursor = 'pointer'; statusEl.addEventListener('click', () => checkAIStatus(false)); }
    if (settingsBtn) settingsBtn.addEventListener('click', configureAIEndpoint);
    if (clearBtn) clearBtn.addEventListener('click', clearAIChat);

    checkAIStatus(true);
    setInterval(() => checkAIStatus(true), AI_CHECK_INTERVAL_MS);
}

window.checkAIStatus = checkAIStatus;
window.sendAIMessageView = sendAIMessageView;
window.configureAIEndpoint = configureAIEndpoint;
window.clearAIChat = clearAIChat;
window.renderContextPanel = renderContextPanel;

document.addEventListener('DOMContentLoaded', initAIAssistant);
