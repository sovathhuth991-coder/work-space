// ============================================================
// icons.js — shared icon library
//
// Every icon here is built from plain geometric primitives
// (circle, line, rect, path made of straight/arc segments) —
// no pictorial/colorful emoji. Stroke = currentColor, so each
// icon inherits whatever text color it's dropped into.
//
// Usage:
//   whIcon('home')                 -> default 16px inline icon
//   whIcon('home', 'wh-icon-lg')   -> add an extra class
//
// Add new icons by adding a new key to WH_ICONS — keep the
// same viewBox/stroke conventions so new ones match visually.
// ============================================================

const WH_ICONS = {
    // ---- Sidebar / navigation ----
    home: '<path d="M4 11.5 12 4l8 7.5"/><path d="M6 10.5V20a1 1 0 0 0 1 1h3v-6h4v6h3a1 1 0 0 0 1-1v-9.5"/>',
    chip: '<rect x="7" y="7" width="10" height="10" rx="1.5"/><path d="M9 7V3M15 7V3M9 21v-4M15 21v-4M7 9H3M7 15H3M21 9h-4M21 15h-4"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    clock: '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/>',
    cloud: '<path d="M6.5 19a4.5 4.5 0 0 1-.5-8.97A5.5 5.5 0 0 1 16.9 8.5 4 4 0 0 1 17.5 19h-11z"/>',
    checkSquare: '<rect x="3" y="3" width="18" height="18" rx="3"/><polyline points="7 12 10.5 15.5 17 8.5"/>',
    barChart: '<rect x="4" y="10" width="4" height="10" rx="0.5"/><rect x="10" y="4" width="4" height="16" rx="0.5"/><rect x="16" y="13" width="4" height="7" rx="0.5"/>',
    layers: '<path d="M12 3 2 9l10 6 10-6-10-6z"/><path d="M2 15l10 6 10-6"/>',
    bookshelf: '<path d="M4 4v16"/><rect x="4" y="4" width="4" height="16"/><rect x="10" y="6" width="4" height="14"/><rect x="16" y="3" width="4" height="17"/>',
    network: '<circle cx="5" cy="6" r="1.6"/><circle cx="19" cy="6" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="5" cy="18" r="1.6"/><circle cx="19" cy="18" r="1.6"/><path d="M6.4 6.9l4.6 4.3M17.6 6.9l-4.6 4.3M6.4 17.1l4.6-4.3M17.6 17.1l-4.6-4.3M5 7.6v8.8M19 7.6v8.8"/>',
    checkCircle: '<circle cx="12" cy="12" r="9"/><polyline points="8 12 11 15 16 9"/>',
    notebook: '<rect x="4" y="3" width="16" height="18" rx="2"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="16" x2="13" y2="16"/>',
    bookmark: '<path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"/>',
    openBook: '<path d="M2 6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H2z"/><path d="M22 6a2 2 0 0 0-2-2h-6a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h8z"/>',

    // ---- General-purpose (reused across cards/buttons/modals) ----
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
    activity: '<polyline points="2 12 7 12 10 20 14 4 17 12 22 12"/>',
    chevronRight: '<polyline points="9 6 15 12 9 18"/>',
    cup: '<path d="M4 9h12a3 3 0 0 1 0 6h-1"/><path d="M4 9v6a3 3 0 0 0 3 3h5a3 3 0 0 0 3-3V9"/><path d="M8 2c0 1-1 1.5-1 2.5S8 6 8 7"/><path d="M12 2c0 1-1 1.5-1 2.5S12 6 12 7"/>',
    hourglass: '<path d="M6 2h12M6 22h12M7 2c0 5 3.5 6.5 5 8-1.5 1.5-5 3-5 8h10c0-5-3.5-6.5-5-8 1.5-1.5 5-3 5-8"/>',
    sparkle: '<path d="M12 2v6M12 16v6M2 12h6M16 12h6M5 5l4 4M15 15l4 4M19 5l-4 4M9 15l-4 4"/>',
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    document: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>'
};

// Returns an inline <svg> string for the given icon name — falls back to an
// empty string if the name isn't defined, so a typo never throws.
function whIcon(name, extraClass) {
    const inner = WH_ICONS[name];
    if (!inner) return '';
    const cls = extraClass ? `wh-icon ${extraClass}` : 'wh-icon';
    return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}

window.WH_ICONS = WH_ICONS;
window.whIcon = whIcon;
