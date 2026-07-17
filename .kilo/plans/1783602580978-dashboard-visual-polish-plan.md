# Dashboard UI Enhancement Plan — Visual Polish & Micro-Interactions

## Objective
Enhance the existing workspace dashboard UI with premium micro-interactions and visual polish. All changes must be limited to:
- `WorkspaceFeatures/dashboard/dashboard.css`
- `WorkspaceFeatures/dashboard/dashboard.js`
- `WorkspaceFeatures/dashboard/widgets.css`
- `WorkspaceFeatures/dashboard/widgets.js`

## Confirmed Decisions
1. **Toast animations:** Removed from this plan. Out of scope for dashboard-only changes.
2. **3D tilt:** Applied to `.dash-card` via JS. Disabled during drag and on touch devices. Initialized after entrance animation completes.
3. **Ripple:** Implemented as child `<span class="ripple-wave">` appended by JS. No `::after` usage on buttons.
4. **Spring scope:** `springAnimate()` replaces only dynamic JS-driven animations (progress fills, counters, entrance). CSS hover/active transitions remain unchanged.

## Implementation Tasks

### 1. Spring Animation Tokens + Ripple (CSS + JS)
**Files:** `dashboard.css`, `dashboard.js`
- Add CSS custom properties:
  ```css
  --spring-bounce: 0.34 1.56 0.64 1;
  --spring-smooth: 0.25 0.1 0.25 1;
  --spring-snappy: 0.4 0 0.2 1;
  ```
- Replace hardcoded cubic-bezier values in `.dash-card`, `.card-inner`, `.stat-card` with these tokens.
- Add `.ripple-wave` CSS (child span, not `::after`):
  ```css
  .ripple-wave {
    position: absolute;
    border-radius: inherit;
    background: rgba(255,255,255,0.25);
    transform: scale(0);
    animation: ripple-expand 0.6s ease-out forwards;
    pointer-events: none;
  }
  @keyframes ripple-expand {
    to { transform: scale(2.5); opacity: 0; }
  }
  ```
- Add JS `createRipple(event, element)` that appends `<span class="ripple-wave">`, positions it at click coordinates, animates, then removes.
- Apply ripple to: `.dash-add-todo-btn`, `.matrix-btn`, `.hub-reset-btn`, `.vis-close-btn`, `.dashboard-customize-btn`, stat cards, session items.
- Add JS `springAnimate(element, property, from, to, config)` for dynamic animations.

### 2. Button Micro-Interactions (CSS)
**Files:** `dashboard.css`
- `.matrix-btn`, `.dash-add-todo-btn`:
  - Hover: `translateY(-2px)` + increased glow shadow
  - Active: `translateY(0) scale(0.97)` + shadow shrink
  - Focus-visible: `outline: 2px solid var(--accent-1)` + `outline-offset: 2px`
  - Disabled: reduced opacity + `cursor: not-allowed`
- Add `.btn-press` class for temporary active-state via JS.

### 3. 3D Card Tilt (JS + CSS)
**Files:** `dashboard.css`, `dashboard.js`
- CSS: `.dash-card { transform-style: preserve-3d; }`
- JS `initCardTilt()`:
  - Listen `mousemove` on `.dash-card`, calculate cursor position relative to card center.
  - Apply `rotateX` and `rotateY` clamped to ±4deg.
  - Reset on `mouseleave`.
  - Exclude stat cards, focus-mode cards, dragging cards.
  - Disable on touch devices: `if (!window.matchMedia('(hover: hover)').matches) return;`
  - Initialize after `animateCardsIn` completes.
  - Use `requestAnimationFrame` for smooth updates.

### 4. Enhanced Entrance Animations (CSS + JS)
**Files:** `dashboard.css`, `dashboard.js`
- Add animation variants:
  - `.dash-banner` — `slideDownFade`
  - `.stat-card` — `scaleUpFade`
  - `.session-hub-card` — `slideFromRight`
  - `.dash-card[data-card-id="widgets"]` — `fadeBlurIn`
- Update `animateCardsIn()` to apply variant classes based on `data-card-id` with staggered delays.

### 5. List Item Micro-Animations (CSS + JS)
**Files:** `dashboard.css`, `dashboard.js`
- Todo items (`.strike-item`):
  - Check: add `.todo-checked` class → scale bounce + color flash
  - Delete: add `.todo-deleting` → fade out + slide right, then remove after transition
  - Add: add `.todo-entering` → slide in from left with fade
- Session items (`.session-item`, `.session-history-item`):
  - Hover: slide right 4px + border-left glow
  - Click: brief `.item-press` → `scale(0.98)`
- Update `renderDashTodos`, `renderSessionHistory`, `renderAllSessions`, `updateHubSessionsWidget` to apply enter/exit classes.

### 6. Animated Empty States (CSS + JS)
**Files:** `dashboard.css`, `dashboard.js`
- Create CSS animated icons:
  - `.empty-icon-chart` — 3 bars scaling sequentially
  - `.empty-icon-pencil` — floating/rotating
  - `.empty-icon-target` — rotating rings
- Update empty-state HTML in:
  - `renderDashTodos` → chart icon
  - `renderSessionHistory` → chart icon
  - `updateHubSessionsWidget` → chart icon
  - `renderWidgets` → chart icon
- Pause animations on `visibilitychange` when tab hidden.

### 7. Progress Bar Glow & Shimmer (CSS)
**Files:** `dashboard.css`, `widgets.css`
- `.progress-bar-fill`:
  - Always: `box-shadow: 0 0 12px var(--accent-glow)`
  - Shimmer: speed to 1.5s, add alternating opacity
  - Hover: `box-shadow: 0 0 24px var(--accent-glow)` + slight width pulse
- `.widget-chart-fill`: add `box-shadow: 0 0 8px var(--accent-glow)`
- Focus goal ring: add `filter: drop-shadow(0 0 8px var(--accent-glow))`

### 8. Custom Tooltip System (CSS + JS)
**Files:** `dashboard.css`, `dashboard.js`
- Add `.custom-tooltip` CSS:
  - Background: `var(--bg-card)` + border + backdrop blur
  - Arrow via `::after`
  - Entrance: `fadeInUp` animation
- Add JS `showTooltip(text, targetElement)` / `hideTooltip()`.
- Migrate dashboard `title` attributes to custom tooltips:
  - Drag handles (`Drag to move`)
  - Resize buttons (`Resize`)
  - Customize button (`Show/Hide dashboard cards`)
  - Add Task button
  - Calendar nav buttons
- Keep `title` as fallback for accessibility.

## Implementation Order
1. Spring tokens + ripple
2. Button micro-interactions
3. 3D card tilt
4. Enhanced entrance animations
5. List item micro-animations
6. Animated empty states
7. Progress bar enhancements
8. Custom tooltips

## Risks & Mitigations
- **Performance:** Use `will-change: transform` on animated elements. Use `transform` and `opacity` only. Add `requestAnimationFrame` for tilt.
- **Theme compatibility:** All colors via CSS variables. Test in all 6 themes.
- **Mobile:** Disable 3D tilt on touch devices. Reduce animation complexity via media queries.
- **Accessibility:** Add `@media (prefers-reduced-motion: reduce)` to disable non-essential animations.

## Validation
1. Open dashboard in Chrome/Edge/Firefox.
2. Verify animations smooth at 60fps (DevTools Performance).
3. Toggle through all 6 themes, confirm colors adapt.
4. Test on mobile viewport (375px) and desktop (1440px).
5. Verify focus mode, drag-drop, and resize still work.
6. Check localStorage-dependent features (todos, sessions, widgets) still persist.

## Out of Scope
- Toast animations (global, out of dashboard scope)
- New dashboard cards or features
- Changes to non-dashboard files
- Analytics/backend changes
