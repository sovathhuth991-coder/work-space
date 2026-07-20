// ============================================================
// UNDO / REDO ENGINE
// ============================================================
// Generalized to cover any feature, not just schedule events. A feature
// registers itself once with registerUndoStore(key, { get, set }):
//   - get()      returns its current state (anything JSON-serializable)
//   - set(value) writes that state back AND does whatever persistence /
//     re-render the feature needs (this engine only manages the stack)
//
// Before a destructive change, the feature calls saveStateForUndo(key) to
// snapshot its *current* (pre-change) state. undo()/redo() replay snapshots
// in the order they actually happened — one shared history across every
// registered feature — and restore only the store each snapshot belongs to.
//
// saveStateForUndo() with no key defaults to 'schedule', so the existing
// call sites in schedule-planner.js and drag-drop.js didn't need to change.

const MAX_UNDO_STEPS = 50;
let undoStack = []; // { key, snapshot }
let redoStack = [];
const undoStores = {};

function registerUndoStore(key, { get, set }) {
    undoStores[key] = { get, set };
}

function saveStateForUndo(key = 'schedule') {
    const store = undoStores[key];
    if (!store) { console.warn(`[undo] saveStateForUndo: unknown store "${key}"`); return; }
    undoStack.push({ key, snapshot: JSON.stringify(store.get()) });
    if (undoStack.length > MAX_UNDO_STEPS) undoStack.shift();
    redoStack = [];
    updateUndoRedoButtons();
}

function undo() {
    if (undoStack.length === 0) return;
    const { key, snapshot } = undoStack.pop();
    const store = undoStores[key];
    if (!store) return;
    redoStack.push({ key, snapshot: JSON.stringify(store.get()) });
    store.set(JSON.parse(snapshot));
    updateUndoRedoButtons();
    showToast('Undo successful', 'info');
}

function redo() {
    if (redoStack.length === 0) return;
    const { key, snapshot } = redoStack.pop();
    const store = undoStores[key];
    if (!store) return;
    undoStack.push({ key, snapshot: JSON.stringify(store.get()) });
    store.set(JSON.parse(snapshot));
    updateUndoRedoButtons();
    showToast('Redo successful', 'info');
}

function updateUndoRedoButtons() {
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    if (undoBtn) undoBtn.disabled = undoStack.length === 0;
    if (redoBtn) redoBtn.disabled = redoStack.length === 0;
}

// The schedule store — this preserves the exact original behavior for the
// default (no-arg) saveStateForUndo() / undo() / redo() call sites.
registerUndoStore('schedule', {
    get: () => events,
    set: (value) => {
        events = value;
        saveEvents();
        renderSchedule();
    }
});

// Expose globally
window.registerUndoStore = registerUndoStore;
window.saveStateForUndo = saveStateForUndo;
window.undo = undo;
window.redo = redo;
window.updateUndoRedoButtons = updateUndoRedoButtons;
