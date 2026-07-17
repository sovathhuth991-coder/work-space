// ============================================================
// firebase-sync.js — TinyBase ↔ Firebase Realtime Database sync
// ============================================================
// Requires Firebase SDK loaded before this script.
// Add these to index.html <head>:
//   <script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js"></script>
//   <script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-database-compat.js"></script>

(function () {
  if (!window.TinyBaseStore || !window.FIREBASE_CONFIG || !firebase || !firebase.database) {
    const missing = [];
    if (!window.TinyBaseStore) missing.push('TinyBaseStore');
    if (!window.FIREBASE_CONFIG) missing.push('FIREBASE_CONFIG');
    if (!firebase) missing.push('firebase');
    if (!firebase || !firebase.database) missing.push('firebase.database');
    console.warn('Firebase sync: missing dependencies:', missing.join(', '));
    return;
  }

  const SYNCED_KEYS = new Set([
    'scheduleEvents', 'myTasks', 'habits', 'libraryItems', 'taskTemplates',
    'dashTodos', 'customWidgets', 'completedSessions', 'sessionHistory',
    'accumulatedFocusTime', 'dailyFocusGoal', 'quickNotes', 'weatherCity',
    'weatherData', 'activeCountdownDate', 'focusHistory', 'pomodoroStats',
    'customTimers', 'workspace_journal', 'workspace_reading_list',
    'aiAssistantConfig', 'aiAssistantHistory', 'userGoals', 'dev_custom_css',
    'dev_color_overrides', 'dashboardCardVisibility', 'sessionHubLayout',
    'dashboardStatLayout', 'dashboardCanvasLayout', 'hubState',
    'collapsedFolders', 'sidebarCollapsed', 'focusStatsVisible',
    'tourCompleted', 'tourSkipped', 'currentTheme', 'activeView',
    'collapsedNavGroups',
  ]);

  const TABLE_PREFIX = 'tables';
  const VALUE_PREFIX = 'values';

  let app = null;
  let db = null;
  let syncEnabled = false;
  let ignoreNextFirebaseEvent = false;

  function initFirebase() {
    try {
      app = firebase.initializeApp(window.FIREBASE_CONFIG);
      db = firebase.database();
      syncEnabled = true;
      console.log('firebase-sync: initialized');
    } catch (e) {
      console.warn('firebase-sync: init failed', e);
    }
  }

  function pathFor(key) {
    return SYNCED_KEYS.has(key) ? `${TABLE_PREFIX}/${key}` : null;
  }

  function valuePathFor(key) {
    return SYNCED_KEYS.has(key) ? `${VALUE_PREFIX}/${key}` : null;
  }

  function isArrayData(data) {
    if (!Array.isArray(data)) return false;
    if (data.length === 0) return true;
    return typeof data[0] === 'object' && data[0] !== null;
  }

  function arrayToObject(arr) {
    const obj = {};
    arr.forEach((item, idx) => {
      const id = item && item.id ? item.id : `idx_${idx}`;
      obj[id] = item;
    });
    return obj;
  }

  function objectToArray(obj) {
    if (!obj || typeof obj !== 'object') return [];
    return Object.values(obj);
  }

  function sendTableToFirebase(key, rows) {
    if (!syncEnabled || !db) return;
    const p = pathFor(key);
    if (!p) return;
    ignoreNextFirebaseEvent = true;
    const obj = arrayToObject(rows);
    db.ref(p).set(obj).catch(e => console.warn('firebase-sync: write failed', key, e));
  }

  function sendValueToFirebase(key, value) {
    if (!syncEnabled || !db) return;
    const p = valuePathFor(key);
    if (!p) return;
    ignoreNextFirebaseEvent = true;
    db.ref(p).set(value).catch(e => console.warn('firebase-sync: write failed', key, e));
  }

  function removeTableFromFirebase(key) {
    if (!syncEnabled || !db) return;
    const p = pathFor(key);
    if (!p) return;
    ignoreNextFirebaseEvent = true;
    db.ref(p).remove().catch(e => console.warn('firebase-sync: remove failed', key, e));
  }

  function removeValueFromFirebase(key) {
    if (!syncEnabled || !db) return;
    const p = valuePathFor(key);
    if (!p) return;
    ignoreNextFirebaseEvent = true;
    db.ref(p).remove().catch(e => console.warn('firebase-sync: remove failed', key, e));
  }

  function applyFirebaseTableToStore(key, raw) {
    const rows = objectToArray(raw);
    const store = window.TinyBaseStore;
    if (!store) return;
    const existing = store.getTable(key);
    if (JSON.stringify(existing) !== JSON.stringify(rows)) {
      store.setTable(key, rows);
    }
  }

  function applyFirebaseValueToStore(key, value) {
    const store = window.TinyBaseStore;
    if (!store) return;
    const existing = store.getValue(key);
    if (JSON.stringify(existing) !== JSON.stringify(value)) {
      store.setValue(key, value);
    }
  }

  function attachFirebaseListeners() {
    if (!db) return;

    SYNCED_KEYS.forEach(key => {
      const tableP = pathFor(key);
      const valueP = valuePathFor(key);

      if (tableP) {
        db.ref(tableP).on('value', (snap) => {
          if (ignoreNextFirebaseEvent) {
            ignoreNextFirebaseEvent = false;
            return;
          }
          applyFirebaseTableToStore(key, snap.val());
        });
      }

      if (valueP) {
        db.ref(valueP).on('value', (snap) => {
          if (ignoreNextFirebaseEvent) {
            ignoreNextFirebaseEvent = false;
            return;
          }
          applyFirebaseValueToStore(key, snap.val());
        });
      }
    });
  }

  function attachStoreListeners() {
    const store = window.TinyBaseStore;
    if (!store) return;

    SYNCED_KEYS.forEach(key => {
      store.on(key, () => {
        const table = store.getTable(key);
        if (table && table.length) {
          sendTableToFirebase(key, table);
        } else {
          const value = store.getValue(key);
          if (value !== undefined) {
            sendValueToFirebase(key, value);
          } else {
            removeTableFromFirebase(key);
            removeValueFromFirebase(key);
          }
        }
      });
    });
  }

  function migrateFirebaseToStore() {
    if (!db) return;
    const store = window.TinyBaseStore;
    if (!store) return;

    SYNCED_KEYS.forEach(key => {
      const tableP = pathFor(key);
      const valueP = valuePathFor(key);

      if (tableP) {
        db.ref(tableP).once('value').then((snap) => {
          if (snap.exists()) {
            const rows = objectToArray(snap.val());
            const existing = store.getTable(key);
            if (!existing || !existing.length) {
              store.setTable(key, rows);
            }
          }
        }).catch(() => {});
      }

      if (valueP) {
        db.ref(valueP).once('value').then((snap) => {
          if (snap.exists()) {
            const val = snap.val();
            const existing = store.getValue(key);
            if (existing === undefined) {
              store.setValue(key, val);
            }
          }
        }).catch(() => {});
      }
    });
  }

  async function waitForTinyBaseStore(timeout = 5000) {
    const start = Date.now();
    while (!window.TinyBaseStore && Date.now() - start < timeout) {
      await new Promise(r => setTimeout(r, 50));
    }
    return !!window.TinyBaseStore;
  }

  async function init() {
    const hasStore = await waitForTinyBaseStore();
    if (!hasStore || !window.FIREBASE_CONFIG || !firebase || !firebase.database) {
    const missing = [];
    if (!window.TinyBaseStore) missing.push('TinyBaseStore');
    if (!window.FIREBASE_CONFIG) missing.push('FIREBASE_CONFIG');
    if (!firebase) missing.push('firebase');
    if (!firebase || !firebase.database) missing.push('firebase.database');
    console.warn('Firebase sync: missing dependencies:', missing.join(', '));
      return;
    }
    initFirebase();
    if (!syncEnabled) return;
    attachStoreListeners();
    migrateFirebaseToStore().then(() => {
      attachFirebaseListeners();
    }).catch(() => {});
    window.FirebaseSync = {
      isEnabled: () => syncEnabled,
      migrate: migrateFirebaseToStore
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
