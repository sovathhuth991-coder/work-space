// ============================================================
// UNDO / REDO ENGINE
// ============================================================

const MAX_UNDO_STEPS = 50;
let undoStack = [];
let redoStack = [];

function saveStateForUndo() {
    undoStack.push(JSON.stringify(events));
    if (undoStack.length > MAX_UNDO_STEPS) undoStack.shift();
    redoStack = [];
    updateUndoRedoButtons();
}

function undo() {
    if (undoStack.length === 0) return;
    redoStack.push(JSON.stringify(events));
    events = JSON.parse(undoStack.pop());
    saveEvents();
    renderSchedule();
    updateUndoRedoButtons();
    showToast('Undo successful', 'info');
}

function redo() {
    if (redoStack.length === 0) return;
    undoStack.push(JSON.stringify(events));
    events = JSON.parse(redoStack.pop());
    saveEvents();
    renderSchedule();
    updateUndoRedoButtons();
    showToast('Redo successful', 'info');
}

function updateUndoRedoButtons() {
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    if (undoBtn) undoBtn.disabled = undoStack.length === 0;
    if (redoBtn) redoBtn.disabled = redoStack.length === 0;
}

// Expose globally
window.saveStateForUndo = saveStateForUndo;
window.undo = undo;
window.redo = redo;
window.updateUndoRedoButtons = updateUndoRedoButtons;
