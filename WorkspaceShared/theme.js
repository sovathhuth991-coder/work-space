// theme.js — sets CSS custom properties + auto theme
const THEME_MAP = {

    cyberpunk: {
        '--bg-primary': '#0a0a12',
        '--bg-secondary': '#12121e',
        '--bg-surface': 'rgba(18, 18, 30, 0.85)',
        '--bg-card': 'rgba(24, 24, 40, 0.7)',
        '--border-color': 'rgba(255, 255, 255, 0.06)',
        '--text-primary': '#f1f1f7',
        '--text-secondary': '#b0b0c8',
        '--text-muted': '#6b6b85',
        '--accent-1': '#7c6df0',
        '--accent-2': '#5b8def',
        '--accent-gradient': 'linear-gradient(135deg, #7c6df0, #5b8def)',
        '--shadow-soft': '0 8px 32px rgba(0, 0, 0, 0.4)',
        '--shadow-glow': '0 0 40px rgba(124, 109, 240, 0.15)',
        '--radius-lg': '16px',
        '--radius-md': '12px',
        '--radius-sm': '8px',
        '--transition': '0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        '--sidebar-width': '280px'
    },
    minimal: {
        '--bg-primary': '#ffffff',
        '--bg-secondary': '#f8fafc',
        '--bg-surface': 'rgba(248, 250, 252, 0.95)',
        '--bg-card': 'rgba(255, 255, 255, 0.9)',
        '--border-color': 'rgba(0, 0, 0, 0.08)',
        '--text-primary': '#1e293b',
        '--text-secondary': '#64748b',
        '--text-muted': '#94a3b8',
        '--accent-1': '#3b82f6',
        '--accent-2': '#8b5cf6',
        '--accent-gradient': 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
        '--shadow-soft': '0 8px 32px rgba(0, 0, 0, 0.08)',
        '--shadow-glow': '0 0 40px rgba(59, 130, 246, 0.1)',
        '--radius-lg': '16px',
        '--radius-md': '12px',
        '--radius-sm': '8px',
        '--transition': '0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        '--sidebar-width': '280px'
    },
    ocean: {
        '--bg-primary': '#0c1929',
        '--bg-secondary': '#1e293b',
        '--bg-surface': 'rgba(30, 41, 59, 0.85)',
        '--bg-card': 'rgba(30, 41, 59, 0.7)',
        '--border-color': 'rgba(255, 255, 255, 0.06)',
        '--text-primary': '#e2e8f0',
        '--text-secondary': '#94a3b8',
        '--text-muted': '#64748b',
        '--accent-1': '#0ea5e9',
        '--accent-2': '#06b6d4',
        '--accent-gradient': 'linear-gradient(135deg, #0ea5e9, #06b6d4)',
        '--shadow-soft': '0 8px 32px rgba(0, 0, 0, 0.4)',
        '--shadow-glow': '0 0 40px rgba(14, 165, 233, 0.15)',
        '--radius-lg': '16px',
        '--radius-md': '12px',
        '--radius-sm': '8px',
        '--transition': '0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        '--sidebar-width': '280px'
    },
    sunset: {
        '--bg-primary': '#1a1a2e',
        '--bg-secondary': '#16213e',
        '--bg-surface': 'rgba(22, 33, 62, 0.85)',
        '--bg-card': 'rgba(22, 33, 62, 0.7)',
        '--border-color': 'rgba(255, 255, 255, 0.06)',
        '--text-primary': '#f8fafc',
        '--text-secondary': '#cbd5e1',
        '--text-muted': '#64748b',
        '--accent-1': '#f97316',
        '--accent-2': '#ec4899',
        '--accent-gradient': 'linear-gradient(135deg, #f97316, #ec4899)',
        '--shadow-soft': '0 8px 32px rgba(0, 0, 0, 0.4)',
        '--shadow-glow': '0 0 40px rgba(249, 115, 22, 0.15)',
        '--radius-lg': '16px',
        '--radius-md': '12px',
        '--radius-sm': '8px',
        '--transition': '0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        '--sidebar-width': '280px'
    },
    forest: {
        '--bg-primary': '#0a1810',
        '--bg-secondary': '#1a2e23',
        '--bg-surface': 'rgba(26, 46, 35, 0.85)',
        '--bg-card': 'rgba(26, 46, 35, 0.7)',
        '--border-color': 'rgba(255, 255, 255, 0.06)',
        '--text-primary': '#e2e8f0',
        '--text-secondary': '#a1b5a8',
        '--text-muted': '#6b7b72',
        '--accent-1': '#22c55e',
        '--accent-2': '#14b8a6',
        '--accent-gradient': 'linear-gradient(135deg, #22c55e, #14b8a6)',
        '--shadow-soft': '0 8px 32px rgba(0, 0, 0, 0.4)',
        '--shadow-glow': '0 0 40px rgba(34, 197, 94, 0.15)',
        '--radius-lg': '16px',
        '--radius-md': '12px',
        '--radius-sm': '8px',
        '--transition': '0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        '--sidebar-width': '280px'
    },
    midnight: {
        '--bg-primary': '#0f0f1e',
        '--bg-secondary': '#1a1a2e',
        '--bg-surface': 'rgba(26, 26, 46, 0.85)',
        '--bg-card': 'rgba(26, 26, 46, 0.7)',
        '--border-color': 'rgba(255, 255, 255, 0.06)',
        '--text-primary': '#f8fafc',
        '--text-secondary': '#c4b5fd',
        '--text-muted': '#7c6d9e',
        '--accent-1': '#818cf8',
        '--accent-2': '#c084fc',
        '--accent-gradient': 'linear-gradient(135deg, #818cf8, #c084fc)',
        '--shadow-soft': '0 8px 32px rgba(0, 0, 0, 0.4)',
        '--shadow-glow': '0 0 40px rgba(129, 140, 248, 0.15)',
        '--radius-lg': '16px',
        '--radius-md': '12px',
        '--radius-sm': '8px',
        '--transition': '0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        '--sidebar-width': '280px'
    }
};

// ─── AUTO THEME ──────────────────────────────────────────────────
// Map system preference to our theme names
const SYSTEM_THEME_MAP = {
    dark: 'cyberpunk',
    light: 'minimal'
};

function getSystemTheme() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? 'dark' : 'light';
}

function getStoredTheme() {
    return localStorage.getItem('currentTheme') || null;
}

function getInitialTheme() {
    const stored = getStoredTheme();
    if (stored && THEME_MAP[stored]) return stored;
    // If no stored theme, use system preference
    const system = getSystemTheme();
    return SYSTEM_THEME_MAP[system] || 'cyberpunk';
}

let currentTheme = getInitialTheme();

function applyTheme(themeName) {
    const theme = THEME_MAP[themeName];
    if (!theme) return;
    currentTheme = themeName;
    localStorage.setItem('currentTheme', themeName);
    const root = document.documentElement;
    Object.entries(theme).forEach(([key, value]) => {
        root.style.setProperty(key, value);
    });
    updateThemeSelector();
}

// Listen for system theme changes
const darkModeMedia = window.matchMedia('(prefers-color-scheme: dark)');
darkModeMedia.addEventListener('change', (e) => {
    // Only auto-switch if the user hasn't manually selected a theme
    if (!localStorage.getItem('currentTheme')) {
        const newTheme = e.matches ? 'cyberpunk' : 'minimal';
        applyTheme(newTheme);
        showToast('🌗 Theme auto‑switched to ' + newTheme, 'info');
    }
});

function updateThemeSelector() {
    document.querySelectorAll('#schedule-theme-selector, #lessons-theme-selector, #globalThemeSelector')
        .forEach(el => { if (el) el.value = currentTheme; });
}

// ─── EXPOSE ─────────────────────────────────────────────────────
window.currentTheme = currentTheme;
window.applyTheme = applyTheme;
