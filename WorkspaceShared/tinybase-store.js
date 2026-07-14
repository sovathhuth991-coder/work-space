// ============================================================
// tinybase-store.js — TinyBase MergeableStore + PartyKit sync
// ============================================================

(function () {
  if (!window.TinyBase || !window.TinyBase.createMergeableStore) {
    console.warn('TinyBase not loaded — sync features disabled');
    return;
  }

  const {
    createMergeableStore,
    createLocalStoragePersister,
  } = window.TinyBase;

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

  function isSyncedKey(key) {
    return SYNCED_KEYS.has(key);
  }

  function installLocalStorageProxy() {
    let proxyDepth = 0;
    const origGetItem = localStorage.getItem.bind(localStorage);
    const origSetItem = localStorage.setItem.bind(localStorage);
    const origRemoveItem = localStorage.removeItem.bind(localStorage);
    const origClear = localStorage.clear.bind(localStorage);

    localStorage.getItem = function(key) {
      if (isSyncedKey(key)) {
        try {
          const table = store.getTable(key);
          if (table && table.length) {
            return JSON.stringify(table.map(row => {
              const { _id, ...rest } = row;
              return rest;
            }));
          }
          const value = store.getValue(key);
          if (value !== undefined) {
            return typeof value === 'string' ? value : JSON.stringify(value);
          }
        } catch (_) { /* fall through */ }
      }
      return origGetItem(key);
    };

    localStorage.setItem = function(key, value) {
      if (isSyncedKey(key) && proxyDepth === 0) {
        proxyDepth++;
        try {
          const data = JSON.parse(value);
          if (Array.isArray(data)) {
            store.setTable(key, data.map((item, idx) => ({ ...item, _id: item.id || `ls_${key}_${idx}` })));
          } else if (typeof data === 'object' && data !== null) {
            store.setValue(key, data);
          } else {
            store.setValue(key, data);
          }
        } catch (_) {
          store.setValue(key, value);
        } finally {
          proxyDepth--;
        }
        return;
      }
      origSetItem(key, value);
    };

    localStorage.removeItem = function(key) {
      if (isSyncedKey(key) && proxyDepth === 0) {
        proxyDepth++;
        try {
          try { store.delTable(key); } catch (_) { store.delValue(key); }
        } finally {
          proxyDepth--;
        }
        return;
      }
      origRemoveItem(key);
    };

    localStorage.clear = function() {
      origClear();
      try {
        SYNCED_KEYS.forEach(key => {
          try { store.delTable(key); } catch (_) { store.delValue(key); }
        });
      } catch (_) {}
    };
  }

  const PARTYKIT_ENABLED = typeof window.TinyBasePersisterPartyKitClient !== 'undefined';

  const store = createMergeableStore();
  const listeners = {};
  let partyKitPersister = null;
  let localStoragePersister = null;

  function notify(tableOrValueId) {
    const cbs = listeners[tableOrValueId];
    if (cbs) cbs.forEach(cb => cb());
    const allCbs = listeners['*'];
    if (allCbs) allCbs.forEach(cb => cb(tableOrValueId));
  }

  function on(tableOrValueId, cb) {
    if (!listeners[tableOrValueId]) listeners[tableOrValueId] = [];
    listeners[tableOrValueId].push(cb);
    return () => {
      listeners[tableOrValueId] = listeners[tableOrValueId].filter(fn => fn !== cb);
    };
  }

  function getTable(tableId) {
    try { return store.getTable(tableId); } catch (_) { return []; }
  }

  function getRow(tableId, rowId) {
    try { return store.getRow(tableId, rowId); } catch (_) { return null; }
  }

  function getValue(valueId) {
    try { return store.getValue(valueId); } catch (_) { return undefined; }
  }

  function setValue(valueId, value) {
    store.setValue(valueId, value);
    notify(valueId);
  }

  function addRow(tableId, row) {
    const id = store.addRow(tableId, row);
    notify(tableId);
    return id;
  }

  function setRow(tableId, rowId, row) {
    store.setRow(tableId, rowId, row);
    notify(tableId);
  }

  function delRow(tableId, rowId) {
    store.delRow(tableId, rowId);
    notify(tableId);
  }

  function setTable(tableId, rows) {
    store.setTable(tableId, rows);
    notify(tableId);
  }

  function delTable(tableId) {
    store.delTable(tableId);
    notify(tableId);
  }

  function getTableIds() {
    try { return store.getTableIds(); } catch (_) { return []; }
  }

  function getTablesJson() {
    try { return store.getTablesJson(); } catch (_) { return []; }
  }

  function getValuesJson() {
    try { return store.getValuesJson(); } catch (_) { return {}; }
  }

  function migrateLocalStorageToStore() {
    const LS_KEYS = {
      scheduleEvents: 'scheduleEvents',
      myTasks: 'myTasks',
      habits: 'habits',
      libraryItems: 'libraryItems',
      taskTemplates: 'taskTemplates',
      dashTodos: 'dashTodos',
      customWidgets: 'customWidgets',
      completedSessions: 'completedSessions',
      sessionHistory: 'sessionHistory',
      accumulatedFocusTime: 'accumulatedFocusTime',
      dailyFocusGoal: 'dailyFocusGoal',
      quickNotes: 'quickNotes',
      weatherCity: 'weatherCity',
      weatherData: 'weatherData',
      activeCountdownDate: 'activeCountdownDate',
      focusHistory: 'focusHistory',
      pomodoroStats: 'pomodoroStats',
      customTimers: 'customTimers',
      workspace_journal: 'workspace_journal',
      workspace_reading_list: 'workspace_reading_list',
      aiAssistantConfig: 'aiAssistantConfig',
      aiAssistantHistory: 'aiAssistantHistory',
      userGoals: 'userGoals',
      dev_custom_css: 'dev_custom_css',
      dev_color_overrides: 'dev_color_overrides',
      dashboardCardVisibility: 'dashboardCardVisibility',
      sessionHubLayout: 'sessionHubLayout',
      dashboardStatLayout: 'dashboardStatLayout',
      dashboardCanvasLayout: 'dashboardCanvasLayout',
      hubState: 'hubState',
      collapsedFolders: 'collapsedFolders',
      sidebarCollapsed: 'sidebarCollapsed',
      focusStatsVisible: 'focusStatsVisible',
      tourCompleted: 'tourCompleted',
      tourSkipped: 'tourSkipped',
      currentTheme: 'currentTheme',
      activeView: 'activeView',
      collapsedNavGroups: 'collapsedNavGroups',
    };

    const migrated = [];
    Object.entries(LS_KEYS).forEach(([tableId, lsKey]) => {
      try {
        const raw = localStorage.getItem(lsKey);
        if (!raw) return;
        const data = JSON.parse(raw);
        if (Array.isArray(data)) {
          store.setTable(tableId, data.map((item, idx) => ({ ...item, _id: item.id || `ls_${lsKey}_${idx}` })));
        } else if (typeof data === 'object' && data !== null) {
          store.setValue(tableId, data);
        }
        migrated.push(lsKey);
      } catch (_) { /* skip */ }
    });

    if (migrated.length) {
      console.log(`tinybase-store: migrated ${migrated.length} localStorage keys to store`, migrated);
    }
  }

  async function init() {
    migrateLocalStorageToStore();
    installLocalStorageProxy();

    localStoragePersister = createLocalStoragePersister(store, 'workspaceHubStore');
    try {
      await localStoragePersister.startAutoLoad();
    } catch (e) {
      console.warn('tinybase-store: localStorage persister load failed', e);
    }

    if (PARTYKIT_ENABLED && window.PARTYKIT_URL && window.PARTYKIT_ROOM) {
      try {
        const { createPartyKitPersister } = window.TinyBasePersisterPartyKitClient;
        const partySocket = new window.PartySocket({
          host: window.PARTYKIT_URL.replace(/^https?:\/\//, '').replace(/\/$/, ''),
          room: window.PARTYKIT_ROOM,
        });
        partyKitPersister = createPartyKitPersister(store, partySocket);
        await partyKitPersister.startAutoLoad();
        await partyKitPersister.startAutoSave();
        console.log('tinybase-store: PartyKit sync enabled');
      } catch (e) {
        console.warn('tinybase-store: PartyKit sync failed', e);
      }
    }

    window.TinyBaseStore = {
      store,
      getTable,
      getRow,
      getValue,
      setValue,
      addRow,
      setRow,
      delRow,
      setTable,
      delTable,
      getTableIds,
      getTablesJson,
      getValuesJson,
      on,
      migrateLocalStorageToStore,
      isPartyKitEnabled: () => !!partyKitPersister,
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
