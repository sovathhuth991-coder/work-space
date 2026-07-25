// ============================================================
// mobile-nav.js — Hamburger menu + swipe gestures
// ============================================================
// Add this AFTER your other scripts in index.html.
// Creates a ☰ button on mobile and swipe-to-open sidebar.
// ============================================================

(function() {
  'use strict';

  const SIDEBAR_ID = 'hubSidebar';
  const sidebar = document.getElementById(SIDEBAR_ID);
  if (!sidebar) {
    console.warn('[mobile-nav] Sidebar not found — mobile nav disabled');
    return;
  }

  // ─── Create overlay ───
  let overlay = document.getElementById('mobile-sidebar-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'mobile-sidebar-overlay';
    overlay.style.cssText = `
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.5);
      backdrop-filter: blur(3px);
      z-index: 90;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s;
    `;
    overlay.addEventListener('click', closeSidebar);
    document.body.appendChild(overlay);
  }

  // ─── Create hamburger button ───
  let hamburger = document.getElementById('mobile-menu-toggle');
  if (!hamburger) {
    hamburger = document.createElement('button');
    hamburger.id = 'mobile-menu-toggle';
    hamburger.innerHTML = '☰';
    hamburger.setAttribute('aria-label', 'Open menu');
    hamburger.style.cssText = `
      display: none;
      position: fixed;
      top: 12px;
      left: 12px;
      z-index: 100;
      width: 44px;
      height: 44px;
      align-items: center;
      justify-content: center;
      border: none;
      border-radius: 8px;
      background: var(--bg-secondary, #1a1a2e);
      color: var(--text-primary, #e0e0ff);
      font-size: 1.25rem;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    `;
    hamburger.addEventListener('click', toggleSidebar);
    document.body.appendChild(hamburger);
  }

  // ─── Toggle functions ───
  function openSidebar() {
    sidebar.classList.add('open');
    overlay.style.opacity = '1';
    overlay.style.pointerEvents = 'all';
    document.body.style.overflow = 'hidden';
  }

  function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.style.opacity = '0';
    overlay.style.pointerEvents = 'none';
    document.body.style.overflow = '';
  }

  function toggleSidebar() {
    if (sidebar.classList.contains('open')) closeSidebar();
    else openSidebar();
  }

  // ─── Close sidebar when clicking a nav button ───
  sidebar.querySelectorAll('.nav-btn, .hub-menu-item').forEach(btn => {
    btn.addEventListener('click', () => {
      if (window.innerWidth <= 768) closeSidebar();
    });
  });

  // ─── Swipe gestures ───
  let touchStartX = 0;
  let touchEndX = 0;
  const minSwipe = 60;

  document.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    const dist = touchEndX - touchStartX;

    // Swipe right from left edge → open
    if (dist > minSwipe && touchStartX < 30 && window.innerWidth <= 768) {
      openSidebar();
    }
    // Swipe left → close
    else if (dist < -minSwipe && sidebar.classList.contains('open')) {
      closeSidebar();
    }
  }, { passive: true });

  // ─── Show/hide hamburger on resize ───
  function checkMobile() {
    if (window.innerWidth <= 768) {
      hamburger.style.display = 'flex';
    } else {
      hamburger.style.display = 'none';
      closeSidebar();
    }
  }

  window.addEventListener('resize', checkMobile);
  checkMobile(); // Initial check

  console.log('[mobile-nav] Hamburger menu + swipe gestures ready');
})();
