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

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCbu_Gw3npl2Hsz-vpSGQ4Z8Xfe5B91hrY",
  authDomain: "workspace-97199.firebaseapp.com",
  databaseURL: "https://workspace-97199-default-rtdb.firebaseio.com",
  projectId: "workspace-97199",
  storageBucket: "workspace-97199.firebasestorage.app",
  messagingSenderId: "498713048370",
  appId: "1:498713048370:web:1620facbe4a93c8f63932b",
  measurementId: "G-L4T6B373RT"
};

window.APP_VERSION = APP_VERSION;
window.APP_NAME = APP_NAME;
window.STORAGE_KEYS = STORAGE_KEYS;
window.THEMES = THEMES;
window.DAYS = DAYS;
window.FIREBASE_CONFIG = FIREBASE_CONFIG;