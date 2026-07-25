// ============================================================
// auto-sync.js — Drop-in auto-sync for Workspace Hub
// ============================================================
// Add this file to your project and include it in index.html
// AFTER sync.js and AFTER all feature scripts.
//
// This wraps your existing save functions so they auto-push
// to Supabase 2 seconds after local changes.
// ============================================================

(function() {
  'use strict';

  if (!window.supabaseClient) {
    console.warn('[auto-sync] Supabase not available — auto-sync disabled');
    return;
  }

  console.log('[auto-sync] Initializing...');

  // ─── Config ───
  const DEBOUNCE_MS = 2000; // 2 seconds after last save
  const TABLES = {
    'myTasks':      { table: 'tasks',           pushFn: 'pushMyTasks' },
    'habits':       { table: 'habits',          pushFn: null },
    'scheduleEvents': { table: 'schedule_events', pushFn: null },
    'libraryItems':   { table: 'library_items',   pushFn: null },
    'journalEntries': { table: 'journal_entries', pushFn: null },
    'readingItems':   { table: 'reading_items',   pushFn: null },
    'dashTodos':      { table: 'dash_todos',      pushFn: null },
    'focusSessions':  { table: 'focus_sessions',  pushFn: null },
  };

  const pending = new Map(); // localStorageKey -> timeoutId

  // ─── Generic push function ───
  async function pushTable(tableName, localKey) {
    const user = await (window.getCurrentUser ? window.getCurrentUser() : Promise.resolve(null));
    if (!user) return;

    const raw = localStorage.getItem(localKey);
    if (!raw) return;

    let items;
    try { items = JSON.parse(raw); }
    catch { return; }

    const isArray = Array.isArray(items);
    const now = new Date().toISOString();

    try {
      if (localKey === 'dashboardCardVisibility') {
        // Singleton
        await window.supabaseClient.from(tableName).upsert({
          user_id: user.id,
          data: items,
          updated_at: now
        }, { onConflict: 'user_id' });
      } else if (isArray) {
        if (!items.length) return;
        const rows = items.map(item => ({
          id: String(item.id || `item_${Date.now()}_${Math.random().toString(36).slice(2,5)}`),
          user_id: user.id,
          data: item,
          updated_at: now
        }));
        await window.supabaseClient.from(tableName).upsert(rows, { onConflict: 'id,user_id' });
      }
      console.log(`[auto-sync] Pushed ${tableName}:`, isArray ? items.length + ' items' : 'singleton');
    } catch (err) {
      console.error(`[auto-sync] Push failed for ${tableName}:`, err.message);
    }
  }

  // ─── Debounced auto-push ───
  function schedulePush(localKey, config) {
    if (pending.has(localKey)) {
      clearTimeout(pending.get(localKey));
    }
    const timeoutId = setTimeout(() => {
      pending.delete(localKey);
      // Use existing push function if available
      if (config.pushFn && typeof window[config.pushFn] === 'function') {
        window[config.pushFn]();
      } else {
        pushTable(config.table, localKey);
      }
    }, DEBOUNCE_MS);
    pending.set(localKey, timeoutId);
  }

  // ─── Hook localStorage.setItem ───
  const originalSetItem = localStorage.setItem;
  localStorage.setItem = function(key, value) {
    originalSetItem.apply(this, arguments);
    if (TABLES[key]) {
      schedulePush(key, TABLES[key]);
    }
  };

  // ─── Auto-pull on sign-in ───
  if (window.supabaseClient.auth) {
    window.supabaseClient.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        console.log('[auto-sync] Signed in — pulling remote data...');
        // Pull all tables
        if (typeof window.pullMyTasks === 'function') {
          await window.pullMyTasks();
        }
        // You can add more pull calls here as you migrate features
      }
    });
  }

  // ─── Background pull every 15 seconds ───
  setInterval(async () => {
    const user = await (window.getCurrentUser ? window.getCurrentUser() : Promise.resolve(null));
    if (!user) return;
    if (typeof window.pullMyTasks === 'function') {
      window.pullMyTasks();
    }
  }, 15000);

  // ─── Pull when tab becomes visible ───
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && window.getCurrentUser) {
      window.getCurrentUser().then(user => {
        if (user && typeof window.pullMyTasks === 'function') {
          window.pullMyTasks();
        }
      });
    }
  });

  console.log('[auto-sync] Ready! Changes will auto-sync 2s after save.');
})();
