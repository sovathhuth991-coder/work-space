# Plan: Smooth, Muted "Actions" Header Toggle

## Context
The right-side action bar toggle (`⚡ Actions` → `#headerToggleMain`, expanding `#headerToggleDropdown` with Focus Stats / Focus Mode / Theme) currently:
- **Pops instead of animating.** The dropdown is toggled via `display:none` (inline) ↔ `display:flex` (`.show` class). `display` cannot be transitioned, so the existing `transition: opacity/transform` never runs — there is no smooth "drop".
- **Is too bright.** `#headerToggleMain` is inline-styled with `background:var(--accent-gradient)`, white text, and a glow; `.header-toggle-btn.active` also uses the full gradient + glow. These inline styles also override the `.header-toggle-main` CSS class, so CSS changes alone have no effect.
- The mobile layout already repositions the dropdown to drop **downward** (stacked), so the animation must respect a different axis than desktop (sideways).

Goal (per user): smooth open/close drop animation, "less bright" look, and a cleaner overall display. Style decision: **subtle accent** — translucent accent tint, `text-secondary`, thin border, no glow.

## Affected files
1. `WorkspaceCore/layout.css` — rewrite the header-toggle block (≈ lines 1217–1308).
2. `WorkspaceCore/mobile.css` — update `#headerToggleDropdown` / `#headerToggleMain` (≈ lines 68–91) for downward drop on small screens.
3. `Workspace.html` — strip the bright inline styles from `#headerToggleMain` and the `display:none`/transform inline styles from `#headerToggleDropdown` so CSS fully owns presentation (required for the transform animation to apply).
4. `WorkspaceCore/app.js` — **no logic change required**; the existing `.show` class toggle and outside-click handler still work once `display` is no longer used.

## Implementation details

### 1. `layout.css` — `.header-toggle-main` (remove reliance on inline gradient)
```css
.header-toggle-main {
  position: relative;
  z-index: 2;
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 14px;
  border-radius: 99px;
  border: 1px solid var(--border-color);
  background: rgba(124, 109, 240, 0.12);
  color: var(--text-secondary);
  font-size: 0.75rem; font-weight: 600;
  cursor: pointer;
  box-shadow: none;
  transition: background 0.25s ease, color 0.25s ease, transform 0.2s ease, box-shadow 0.25s ease;
}
.header-toggle-main:hover {
  background: rgba(124, 109, 240, 0.20);
  color: var(--text-primary);
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(0,0,0,0.25);   /* soft dark shadow, not bright glow */
}
.header-toggle-main:active { transform: scale(0.96); }
```

### 2. `layout.css` — `#headerToggleDropdown` (animate via opacity + transform + visibility, NOT display)
Replace the `display:none` base and `display:flex !important` `.show` with:
```css
#headerToggleDropdown {
  position: absolute; top: 50%; right: 100%;
  display: flex; flex-direction: row; align-items: center;
  gap: 0; padding: 4px;
  border-radius: 99px;
  background: rgba(24, 24, 40, 0.82);
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-elevated);
  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  /* hidden state */
  opacity: 0; visibility: hidden; pointer-events: none;
  transform: translateY(-50%) translateX(8px) scale(0.96);
  transform-origin: right center;
  transition: opacity 0.28s ease,
              transform 0.28s cubic-bezier(0.34, 1.4, 0.64, 1),
              visibility 0s linear 0.28s;
  z-index: 9999;
}
#headerToggleDropdown.show {
  opacity: 1; visibility: visible; pointer-events: auto;
  transform: translateY(-50%) translateX(12px) scale(1);
  transition: opacity 0.28s ease,
              transform 0.28s cubic-bezier(0.34, 1.4, 0.64, 1),
              visibility 0s;
}
```
(The `visibility 0s ... 0.28s` delay hides it only after the fade-out completes; the `.show` variant resets that delay so it shows immediately.)

### 3. `layout.css` — `.header-toggle-btn` / `.active` (muted)
```css
.header-toggle-btn {
  position: relative; display: inline-flex; align-items: center; gap: 6px;
  background: transparent !important; border: none !important;
  color: var(--text-secondary) !important; cursor: pointer !important;
  white-space: nowrap !important; font-weight: 500 !important;
  padding: 6px 12px !important; font-size: 0.72rem !important;
  border-radius: 99px;
  transition: background 0.2s ease, color 0.2s ease, transform 0.2s ease !important;
}
.header-toggle-btn:hover { color: var(--text-primary) !important; background: rgba(255,255,255,0.05) !important; }
.header-toggle-btn:active { transform: scale(0.95); }
.header-toggle-btn.active {
  background: rgba(124, 109, 240, 0.18) !important;
  color: var(--text-primary) !important;
  box-shadow: none !important;
}
.header-toggle-btn.active:hover { background: rgba(124, 109, 240, 0.26) !important; }
```
Keep the existing `::after` separator rules (soften opacity is optional; leave as-is).

### 4. `mobile.css` — downward drop on small screens
The media query already sets `top: calc(100% + 8px)`, `flex-direction: column`, `border-radius: var(--radius-md)`. Add transform overrides so it drops **down** instead of sideways:
```css
@media (max-width: 850px) {
  #headerToggleDropdown {
    transform: translateY(-8px) scale(0.96);
    transform-origin: top right;
  }
  #headerToggleDropdown.show { transform: translateY(0) scale(1); }
}
```
(These `#id` rules have equal specificity to the desktop ones and come later, so they win inside the query.)

### 5. `Workspace.html` — remove inline styles that block the animation
- `#headerToggleMain`: delete the inline `style="...background:var(--accent-gradient); border:none; color:#fff; ... box-shadow:0 2px 8px rgba(124, 109, 240, 0.3);..."`. Leave `class="header-toggle-main"` (CSS now owns look). Keep it readable by leaving the element with no conflicting inline style.
- `#headerToggleDropdown`: delete the inline `style="..."` entirely. **Critical:** the inline `display:none` and `transform: translateY(-50%) translateX(8px)` currently override the CSS animation transform — removing them lets the CSS transitions run. Keep `id="headerToggleDropdown"` and inner markup.
- Leave `#toggleArrow` inline style as-is (`transition: transform 0.3s ease` + rotate handled by `app.js`).

### 6. Optional polish (recommended)
Add a `prefers-reduced-motion` guard in `layout.css` to disable the scale/translate (keep a simple fade) for accessibility:
```css
@media (prefers-reduced-motion: reduce) {
  #headerToggleDropdown, #headerToggleDropdown.show { transition: opacity 0.2s ease; transform: none; }
}
```

## Risks / gotchas
- **Inline `transform` on `#headerToggleDropdown` is the silent blocker** — if not removed, the CSS keyframe/transition transform is overridden and there will still be no animation. Must remove it.
- `#headerToggleDropdown` has **no `class` attribute** (only `id`); all CSS targets the id, so that's fine.
- The dropdown is now always `display:flex` + `visibility:hidden` (was `display:none`). It is `position:absolute`, so it does not affect layout; `pointer-events:none` when hidden prevents accidental clicks. The existing outside-click handler still closes it correctly.
- Keep the small colored emoji spans inside the toggle buttons (e.g. green ⏱, orange ☕) — they are tiny accents and read fine against the muted background; softening them is out of scope.

## Validation
1. Load `Workspace.html` (via `launch_dashboard.bat` or any static server).
2. Click `⚡ Actions`: dropdown should **smoothly fade + drop/scale in** (no instant pop); arrow `▶` rotates to `▼`.
3. Click it again or click elsewhere: dropdown **smoothly fades/scales out**.
4. Confirm the main button is now a **subtle translucent accent pill** (no bright gradient, no glow).
5. Toggle Focus Mode / Theme inside the dropdown — still functional; active state is a muted accent fill, not a bright gradient.
6. Resize window below ~850px: dropdown drops **downward** with the same smooth animation.
7. (Optional) Enable OS "reduce motion" and confirm it falls back to a plain fade.
