// ============================================================
// helpers.js — Shared utility functions
// ============================================================

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getTimeMetrics() {
    const now = new Date();
    const dayIndex = now.getDay();
    const todayName = DAYS[dayIndex];
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    return {
        todayName,
        currentHHMM: `${hh}:${mm}`,
        currentDayIndex: dayIndex,
        now
    };
}

function timeToMinutes(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
}

function getTodayEventsSorted() {
    const { todayName, currentHHMM } = getTimeMetrics();
    return (events || [])
        .filter(e => e.day === todayName && e.end >= currentHHMM)
        .sort((a, b) => a.start.localeCompare(b.start));
}

function parseTimeToMinutes(timeStr) {
    const [h, m] = String(timeStr).split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return 0;
    return h * 60 + m;
}

function eventsOverlap(a, b) {
    if (!a || !b) return false;
    if (a.day !== b.day) return false;
    const startA = parseTimeToMinutes(a.start);
    const endA = parseTimeToMinutes(a.end);
    const startB = parseTimeToMinutes(b.start);
    const endB = parseTimeToMinutes(b.end);
    return startA < endB && startB < endA;
}

function dayHasTimeOverlaps(eventsForDay) {
    if (!Array.isArray(eventsForDay) || eventsForDay.length < 2) return false;
    const sorted = [...eventsForDay].sort((x, y) => parseTimeToMinutes(x.start) - parseTimeToMinutes(y.start));
    for (let i = 1; i < sorted.length; i++) {
        if (eventsOverlap(sorted[i - 1], sorted[i])) {
            return true;
        }
    }
    return false;
}

function formatTime(hhmm) {
    if (!hhmm) return '';
    const [h, m] = hhmm.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function getInitialTheme() {
    const saved = localStorage.getItem(STORAGE_KEYS.theme);
    if (saved && THEMES.includes(saved)) return saved;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'cyberpunk';
    }
    return DEFAULT_THEME;
}

function saveToLocalStorage(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.warn('localStorage save failed:', e);
    }
}

function loadFromLocalStorage(key, fallback = null) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : fallback;
    } catch (e) {
        console.warn('localStorage load failed:', e);
        return fallback;
    }
}

function generateId() {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function debounce(fn, delay = 300) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

window.escapeHtml = escapeHtml;
window.getTimeMetrics = getTimeMetrics;
window.timeToMinutes = timeToMinutes;
window.getTodayEventsSorted = getTodayEventsSorted;
window.formatTime = formatTime;
window.getInitialTheme = getInitialTheme;
window.saveToLocalStorage = saveToLocalStorage;
window.loadFromLocalStorage = loadFromLocalStorage;
window.generateId = generateId;
window.debounce = debounce;
window.clamp = clamp;
window.parseTimeToMinutes = parseTimeToMinutes;
window.eventsOverlap = eventsOverlap;
window.dayHasTimeOverlaps = dayHasTimeOverlaps;
