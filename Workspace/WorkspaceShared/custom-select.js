// ============================================================
// custom-select.js — replaces native <select> dropdowns app-wide.
//
// Native <option> lists ignore your CSS almost everywhere (that's
// the white unreadable panel you were seeing) — the browser draws
// them with its own OS-level styling, not the page's. The fix is
// to hide the native <select> and build the dropdown ourselves.
//
// Every enhanced select keeps its original <select> in the DOM,
// hidden but fully in sync (value + a real 'change' event on every
// pick) — so nothing elsewhere in the app that reads .value or
// listens for 'change' needs to change at all.
//
// Special-cased for nicer previews:
//   #category, #library-category, #library-category-filter
//     -> colored dot per option, matching --cat-* variables
//   #globalThemeSelector
//     -> gradient swatch per option, matching each theme's real
//        --accent-gradient
// Everything else gets the plain (still fully animated/themed) version.
// ============================================================

(function() {
    'use strict';

    const CATEGORY_COLORS = {
        study: 'var(--cat-study)',
        work: 'var(--cat-work)',
        personal: 'var(--cat-personal)',
        fitness: 'var(--cat-fitness)',
        social: 'var(--cat-social)',
        other: 'var(--cat-other)'
    };

    const THEME_GRADIENTS = {
        cyberpunk: 'linear-gradient(135deg, #7c6df0, #5b8def)',
        minimal: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
        ocean: 'linear-gradient(135deg, #0ea5e9, #06b6d4)',
        sunset: 'linear-gradient(135deg, #f97316, #ec4899)',
        forest: 'linear-gradient(135deg, #22c55e, #14b8a6)',
        midnight: 'linear-gradient(135deg, #818cf8, #c084fc)',
        auto: 'linear-gradient(135deg, #64748b 50%, #f8fafc 50%)'
    };

    let openPanel = null; // the currently-open .wh-select-panel, if any

    function closeOpenPanel() {
        if (!openPanel) return;
        const wrap = openPanel.closest('.wh-select-wrap');
        wrap.classList.remove('wh-select-open');
        openPanel = null;
    }

    function swatchFor(select, option) {
        if (select.id === 'globalThemeSelector' && THEME_GRADIENTS[option.value]) {
            return `<span class="wh-select-swatch wh-select-swatch-gradient" style="background:${THEME_GRADIENTS[option.value]}"></span>`;
        }
        if ((select.id === 'category' || select.id === 'library-category' || select.id === 'library-category-filter')
            && CATEGORY_COLORS[option.value]) {
            return `<span class="wh-select-swatch" style="background:${CATEGORY_COLORS[option.value]}"></span>`;
        }
        return '';
    }

    // Strips a leading emoji + space from option text, since the swatch
    // (for the selects that get one) already carries that meaning visually
    // — keeping both would be redundant. Selects with no swatch keep their
    // original text untouched, emoji and all.
    function labelFor(select, option) {
        const hasSwatch = swatchFor(select, option) !== '';
        if (!hasSwatch) return option.textContent;
        return option.textContent.replace(/^\p{Emoji_Presentation}\s*/u, '').trim();
    }

    function enhanceSelect(select) {
        if (select.dataset.whEnhanced) return;
        select.dataset.whEnhanced = '1';

        const wrap = document.createElement('div');
        wrap.className = 'wh-select-wrap';
        const originalStyle = select.getAttribute('style');
        if (originalStyle) wrap.setAttribute('style', originalStyle);
        select.parentNode.insertBefore(wrap, select);
        wrap.appendChild(select);
        select.classList.add('wh-select-native');

        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'wh-select-trigger';
        wrap.appendChild(trigger);

        const panel = document.createElement('div');
        panel.className = 'wh-select-panel';
        wrap.appendChild(panel);

        function renderTrigger() {
            const selected = select.options[select.selectedIndex];
            const swatch = selected ? swatchFor(select, selected) : '';
            const label = selected ? labelFor(select, selected) : '';
            trigger.innerHTML = `${swatch}<span class="wh-select-trigger-label">${label}</span>` +
                '<svg class="wh-icon wh-select-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';
        }

        function renderPanel() {
            panel.innerHTML = '';
            Array.from(select.options).forEach((option, i) => {
                const row = document.createElement('button');
                row.type = 'button';
                row.className = 'wh-select-option' + (option.selected ? ' selected' : '');
                row.style.setProperty('--wh-option-index', i);
                row.innerHTML = `${swatchFor(select, option)}<span>${labelFor(select, option)}</span>`;
                row.addEventListener('click', () => {
                    select.value = option.value;
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                    renderTrigger();
                    renderPanel();
                    closeOpenPanel();
                });
                panel.appendChild(row);
            });
        }

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = wrap.classList.contains('wh-select-open');
            closeOpenPanel();
            if (!isOpen) {
                wrap.classList.add('wh-select-open');
                openPanel = panel;
            }
        });

        // A dynamic select (e.g. lesson-page links, or options rebuilt after
        // a schedule/recurrence change) needs the trigger/panel refreshed —
        // watching the native select covers that without every caller
        // needing to know a custom dropdown even exists on top of it.
        const mo = new MutationObserver(() => { renderTrigger(); renderPanel(); });
        mo.observe(select, { childList: true, subtree: true, attributes: true, attributeFilter: ['value'] });
        select.addEventListener('change', () => { if (select.value !== undefined) renderTrigger(); });

        renderTrigger();
        renderPanel();
    }

    function enhanceAll(root) {
        (root || document).querySelectorAll('select:not([data-wh-enhanced])').forEach(enhanceSelect);
    }

    document.addEventListener('click', closeOpenPanel);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeOpenPanel(); });

    // Cover selects that get injected later (modals, dynamically-built
    // forms) without every file that builds one needing to call anything.
    const bodyObserver = new MutationObserver((mutations) => {
        for (const m of mutations) {
            for (const node of m.addedNodes) {
                if (node.nodeType !== 1) continue;
                if (node.matches && node.matches('select')) enhanceSelect(node);
                if (node.querySelectorAll) enhanceAll(node);
            }
        }
    });

    function start() {
        enhanceAll(document);
        bodyObserver.observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }

    window.WHEnhanceSelects = enhanceAll;
})();
