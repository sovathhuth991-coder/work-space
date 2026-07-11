// ============================================================
// ai-tools.js — The "edit / remove / instruct" half of the AI
// Assistant's website sync. Defines a small set of tools the
// assistant can call, and wires each one to the app's REAL,
// already-existing functions (tasks.js, habits.js, journal.js,
// reading.js, library.js). No fictional APIs — every executor
// below calls something that already exists in this codebase.
//
// Destructive tools (delete_*) always go through a native
// confirm() dialog first, same pattern the app already uses in
// habits.js's deleteHabit().
// ============================================================

const AI_VALID_VIEWS = [
    'dashboard-view', 'ai-view', 'schedule-view', 'timer-view', 'weather-view',
    'todo-view', 'analytics-view', 'lessons-view', 'library-view', 'graph-view',
    'habits-view', 'journal-view', 'reading-view', 'tutorial-view'
];

function aiFindTask(idOrTitle) {
    const tasks = window.myTasks || [];
    return tasks.find(t => t.id === idOrTitle) ||
        tasks.find(t => (t.title || '').toLowerCase().includes(String(idOrTitle).toLowerCase()));
}

function aiFindHabitIndex(nameOrIndex) {
    const habits = window.habits || [];
    if (typeof nameOrIndex === 'number' && habits[nameOrIndex]) return nameOrIndex;
    const asNum = Number(nameOrIndex);
    if (!Number.isNaN(asNum) && habits[asNum]) return asNum;
    return habits.findIndex(h => (h.name || '').toLowerCase().includes(String(nameOrIndex).toLowerCase()));
}

function aiFindReadingItem(idOrTitle) {
    const items = (typeof ReadingListEngine !== 'undefined') ? ReadingListEngine.getAll() : [];
    return items.find(i => String(i.id) === String(idOrTitle)) ||
        items.find(i => (i.title || '').toLowerCase().includes(String(idOrTitle).toLowerCase()));
}

function aiFindLibraryItem(idOrTitle) {
    const items = window.libraryItems || [];
    return items.find(i => String(i.id) === String(idOrTitle)) ||
        items.find(i => (i.title || '').toLowerCase().includes(String(idOrTitle).toLowerCase()));
}

// ------------------------------------------------------------
// Tool schema — shown to the model in the system prompt so it
// knows what it's allowed to call and with what arguments.
// ------------------------------------------------------------
const AI_TOOL_SCHEMAS = [
    { name: 'add_task', args: '{title (required), category?, priority?("low"|"medium"|"high"), due?("YYYY-MM-DD")}', desc: 'Add a new to-do task.' },
    { name: 'complete_task', args: '{task ("id or title text")}', desc: 'Mark a task as completed (toggles if already done).' },
    { name: 'delete_task', args: '{task ("id or title text")}', desc: 'Permanently delete a task. Asks the user to confirm first.' },
    { name: 'list_tasks', args: '{}', desc: 'Return the full task list (the snapshot above only shows the first few).' },

    { name: 'add_habit', args: '{name (required)}', desc: 'Add a new habit to track.' },
    { name: 'toggle_habit_today', args: '{habit ("name or index")}', desc: "Toggle a habit's done-today status." },
    { name: 'delete_habit', args: '{habit ("name or index")}', desc: 'Permanently delete a habit. Asks the user to confirm first.' },
    { name: 'list_habits', args: '{}', desc: 'Return the full habit list.' },

    { name: 'add_journal_entry', args: '{content (required), mood?}', desc: 'Write a new journal entry.' },
    { name: 'delete_journal_entry', args: '{id (required)}', desc: 'Permanently delete a journal entry. Asks the user to confirm first.' },
    { name: 'list_journal_entries', args: '{limit?}', desc: 'Return recent journal entries (default 10).' },

    { name: 'add_reading_item', args: '{title (required), author?, url?, type?("book"|"article"|"document"|"video")}', desc: 'Add an item to the reading list.' },
    { name: 'update_reading_status', args: '{item ("id or title"), status ("to-read"|"reading"|"finished")}', desc: 'Change a reading item\'s status.' },
    { name: 'delete_reading_item', args: '{item ("id or title")}', desc: 'Permanently delete a reading list item. Asks the user to confirm first.' },
    { name: 'list_reading_items', args: '{}', desc: 'Return the full reading list.' },

    { name: 'add_library_item', args: '{title (required), url (required), category?, tags?}', desc: 'Save a new link to the library.' },
    { name: 'delete_library_item', args: '{item ("id or title")}', desc: 'Permanently delete a saved library link. Asks the user to confirm first.' },
    { name: 'list_library_items', args: '{}', desc: 'Return the full library list.' },

    { name: 'navigate_to_view', args: `{view (one of: ${AI_VALID_VIEWS.join(', ')})}`, desc: "Switch the app's visible section — use this when the user asks to be shown or taken somewhere." }
];

// ------------------------------------------------------------
// Executors — one function per tool name. Every executor
// returns { ok: boolean, message: string, data?: any }.
// ------------------------------------------------------------
const AI_TOOL_EXECUTORS = {
    add_task(args) {
        if (!args?.title) return { ok: false, message: 'Missing task title.' };
        const task = {
            id: `mytask_${Date.now()}`,
            title: String(args.title).trim(),
            category: args.category || 'general',
            priority: args.priority || 'medium',
            due: args.due || null,
            completed: false,
            createdAt: new Date().toISOString()
        };
        window.myTasks.push(task);
        saveMyTasks(); renderMyTasks();
        return { ok: true, message: `Added task "${task.title}".`, data: task };
    },

    complete_task(args) {
        const task = aiFindTask(args?.task);
        if (!task) return { ok: false, message: `Couldn't find a task matching "${args?.task}".` };
        toggleMyTask(task.id);
        return { ok: true, message: `Marked "${task.title}" as ${task.completed ? 'not done' : 'done'}.` };
    },

    delete_task(args) {
        const task = aiFindTask(args?.task);
        if (!task) return { ok: false, message: `Couldn't find a task matching "${args?.task}".` };
        if (!confirm(`Delete task "${task.title}"?`)) return { ok: false, message: 'Cancelled — task was not deleted.' };
        deleteMyTask(task.id);
        return { ok: true, message: `Deleted task "${task.title}".` };
    },

    list_tasks() {
        return { ok: true, message: `${(window.myTasks || []).length} tasks.`, data: window.myTasks };
    },

    add_habit(args) {
        if (!args?.name) return { ok: false, message: 'Missing habit name.' };
        window.habits.push({ name: String(args.name).trim(), history: {} });
        saveHabits(); renderHabits();
        return { ok: true, message: `Added habit "${args.name}".` };
    },

    toggle_habit_today(args) {
        const idx = aiFindHabitIndex(args?.habit);
        if (idx === -1 || idx === undefined) return { ok: false, message: `Couldn't find a habit matching "${args?.habit}".` };
        const name = window.habits[idx].name;
        toggleHabit(idx);
        return { ok: true, message: `Toggled today's status for "${name}".` };
    },

    delete_habit(args) {
        const idx = aiFindHabitIndex(args?.habit);
        if (idx === -1 || idx === undefined) return { ok: false, message: `Couldn't find a habit matching "${args?.habit}".` };
        const name = window.habits[idx].name;
        if (!confirm(`Delete habit "${name}"?`)) return { ok: false, message: 'Cancelled — habit was not deleted.' };
        window.habits.splice(idx, 1);
        saveHabits(); renderHabits();
        return { ok: true, message: `Deleted habit "${name}".` };
    },

    list_habits() {
        return { ok: true, message: `${(window.habits || []).length} habits.`, data: window.habits };
    },

    add_journal_entry(args) {
        if (!args?.content) return { ok: false, message: 'Missing journal content.' };
        const entry = JournalEngine.createEntry(args.content, args.mood || '');
        JournalUI?.render?.();
        return { ok: true, message: 'Journal entry saved.', data: entry };
    },

    delete_journal_entry(args) {
        if (!args?.id) return { ok: false, message: 'Missing entry id.' };
        if (!confirm('Delete this journal entry?')) return { ok: false, message: 'Cancelled — entry was not deleted.' };
        JournalEngine.deleteEntry(args.id);
        JournalUI?.render?.();
        return { ok: true, message: 'Journal entry deleted.' };
    },

    list_journal_entries(args) {
        const entries = JournalEngine.getEntries().slice(0, args?.limit || 10);
        return { ok: true, message: `${entries.length} entries.`, data: entries };
    },

    add_reading_item(args) {
        if (!args?.title) return { ok: false, message: 'Missing title.' };
        const item = ReadingListEngine.add({
            title: args.title, author: args.author || '', url: args.url || '', type: args.type || 'book'
        });
        ReadingListEngine.render?.();
        return { ok: true, message: `Added "${item.title}" to your reading list.`, data: item };
    },

    update_reading_status(args) {
        const item = aiFindReadingItem(args?.item);
        if (!item) return { ok: false, message: `Couldn't find a reading item matching "${args?.item}".` };
        ReadingListEngine.update(item.id, { status: args.status });
        ReadingListEngine.render?.();
        return { ok: true, message: `Marked "${item.title}" as ${args.status}.` };
    },

    delete_reading_item(args) {
        const item = aiFindReadingItem(args?.item);
        if (!item) return { ok: false, message: `Couldn't find a reading item matching "${args?.item}".` };
        if (!confirm(`Delete "${item.title}" from your reading list?`)) return { ok: false, message: 'Cancelled — item was not deleted.' };
        ReadingListEngine.delete(item.id);
        ReadingListEngine.render?.();
        return { ok: true, message: `Deleted "${item.title}" from your reading list.` };
    },

    list_reading_items() {
        const items = ReadingListEngine.getAll();
        return { ok: true, message: `${items.length} reading items.`, data: items };
    },

    add_library_item(args) {
        if (!args?.title || !args?.url) return { ok: false, message: 'Missing title or url.' };
        const item = {
            id: `lib_${Date.now()}`, title: args.title, url: args.url,
            category: args.category || 'general', tags: args.tags || '', createdAt: new Date().toISOString()
        };
        window.libraryItems.push(item);
        saveLibraryItems(); renderLibrary();
        return { ok: true, message: `Saved "${item.title}" to your library.`, data: item };
    },

    delete_library_item(args) {
        const item = aiFindLibraryItem(args?.item);
        if (!item) return { ok: false, message: `Couldn't find a library item matching "${args?.item}".` };
        if (!confirm(`Delete "${item.title}" from your library?`)) return { ok: false, message: 'Cancelled — item was not deleted.' };
        window.libraryItems = window.libraryItems.filter(i => i.id !== item.id);
        saveLibraryItems(); renderLibrary();
        return { ok: true, message: `Deleted "${item.title}" from your library.` };
    },

    list_library_items() {
        return { ok: true, message: `${(window.libraryItems || []).length} library items.`, data: window.libraryItems };
    },

    navigate_to_view(args) {
        if (!AI_VALID_VIEWS.includes(args?.view)) return { ok: false, message: `"${args?.view}" isn't a valid section.` };
        if (typeof switchView === 'function') switchView(args.view);
        return { ok: true, message: `Took you to ${args.view.replace('-view', '')}.` };
    }
};

window.AI_TOOL_SCHEMAS = AI_TOOL_SCHEMAS;
window.AI_TOOL_EXECUTORS = AI_TOOL_EXECUTORS;
