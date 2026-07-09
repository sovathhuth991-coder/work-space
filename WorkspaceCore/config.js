// ============================================================
// config.js — Application configuration and constants
// ============================================================

const APP_VERSION = '2.1.0';
const APP_NAME = 'Workspace Hub';
const STORAGE_KEYS = {
    theme: 'currentTheme',
    events: 'scheduleEvents',
    tasks: 'tasks',
    habits: 'habits',
    library: 'library',
    lessons: 'lessonTree',
    todos: 'dashTodos',
    widgets: 'widgets',
    timer: 'focusTimerState',
    accumulator: 'focusAccumulatorSeconds',
    analytics: 'focusSessions'
};

const THEMES = ['cyberpunk', 'minimal', 'ocean', 'sunset', 'forest', 'midnight', 'auto'];
const DEFAULT_THEME = 'cyberpunk';
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

window.APP_VERSION = APP_VERSION;
window.APP_NAME = APP_NAME;
window.STORAGE_KEYS = STORAGE_KEYS;
window.THEMES = THEMES;
window.DAYS = DAYS;
