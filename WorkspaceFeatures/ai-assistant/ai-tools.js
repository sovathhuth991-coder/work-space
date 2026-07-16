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
    const tasks = (typeof myTasks !== 'undefined' ? myTasks : window.myTasks) || [];
    return tasks.find(t => t.id === idOrTitle) ||
        tasks.find(t => (t.title || '').toLowerCase().includes(String(idOrTitle).toLowerCase()));
}

function aiFindHabitIndex(nameOrIndex) {
    const habitList = (typeof habits !== 'undefined' ? habits : window.habits) || [];
    if (typeof nameOrIndex === 'number' && habitList[nameOrIndex]) return nameOrIndex;
    const asNum = Number(nameOrIndex);
    if (!Number.isNaN(asNum) && habitList[asNum]) return asNum;
    return habitList.findIndex(h => (h.name || '').toLowerCase().includes(String(nameOrIndex).toLowerCase()));
}

function aiFindReadingItem(idOrTitle) {
    const items = (typeof ReadingListEngine !== 'undefined') ? ReadingListEngine.getAll() : [];
    return items.find(i => String(i.id) === String(idOrTitle)) ||
        items.find(i => (i.title || '').toLowerCase().includes(String(idOrTitle).toLowerCase()));
}

function aiFindLibraryItem(idOrTitle) {
    const items = (typeof libraryItems !== 'undefined' ? libraryItems : window.libraryItems) || [];
    return items.find(i => String(i.id) === String(idOrTitle)) ||
        items.find(i => (i.title || '').toLowerCase().includes(String(idOrTitle).toLowerCase()));
}

// ------------------------------------------------------------
// Loose day/time parsing. The model is often a small local LLM
// and won't reliably emit exact "YYYY-MM-DD" / 24-hour "HH:MM"
// formatting on its own — so instead of requiring that, these
// tools accept natural phrasing ("monday", "today", "6am",
// "6:30 PM") and this code normalizes it deterministically.
// Returns null (never throws) when input can't be understood, so
// callers can give the user/model a clear, actionable error.
// ------------------------------------------------------------
function aiMatchDayIndex(raw) {
    if (!raw) return null;
    const s = String(raw).trim().toLowerCase().replace(/^next\s+/, '');
    if (s === 'today') return new Date().getDay();
    if (s === 'tomorrow') return (new Date().getDay() + 1) % 7;
    const idx = DAYS.findIndex(d => d.toLowerCase() === s || (s.length >= 3 && d.toLowerCase().startsWith(s)));
    return idx === -1 ? null : idx;
}

// For the schedule feature, which stores events under a day NAME
// (a recurring weekly slot), not a specific calendar date.
function aiParseDayName(raw) {
    const idx = aiMatchDayIndex(raw);
    return idx === null ? null : DAYS[idx];
}

// For to-do tasks, which store a specific due DATE (YYYY-MM-DD).
// "Monday"/"today"/"tomorrow" resolve to the next real occurrence
// of that weekday — today counts as itself, not next week.
function aiResolveDueDate(raw) {
    if (!raw) return null;
    const s = String(raw).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const idx = aiMatchDayIndex(s);
    if (idx === null) return null;
    const today = new Date();
    const diff = (idx - today.getDay() + 7) % 7;
    const target = new Date(today);
    target.setDate(target.getDate() + diff);
    const y = target.getFullYear(), m = String(target.getMonth() + 1).padStart(2, '0'), d = String(target.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// Accepts "6am", "6:30pm", "6:30 PM", "18:30", "noon", "midnight" —
// with or without a colon, space, or leading zero — and normalizes
// to strict 24-hour "HH:MM" (what the schedule feature stores).
function aiParseTimeString(raw) {
    if (!raw) return null;
    const s = String(raw).trim().toLowerCase();
    if (s === 'noon') return '12:00';
    if (s === 'midnight') return '00:00';

    let m = s.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
    if (m) return `${m[1].padStart(2, '0')}:${m[2]}`;

    m = s.match(/^(\d{1,2})(?::([0-5]\d))?\s*(am|pm)$/);
    if (m) {
        let hour = parseInt(m[1], 10);
        if (hour < 1 || hour > 12) return null;
        const minute = m[2] || '00';
        hour = (m[3] === 'am') ? (hour === 12 ? 0 : hour) : (hour === 12 ? 12 : hour + 12);
        return `${String(hour).padStart(2, '0')}:${minute}`;
    }
    return null;
}

// "06:00" -> "6:00 AM", for confirmation messages.
function aiFormatTimeLabel(t) {
    if (typeof convert24To12Hour !== 'function') return t;
    const { hour, minute, ampm } = convert24To12Hour(t);
    return `${parseInt(hour, 10)}:${minute} ${ampm}`;
}

// ------------------------------------------------------------
// Tool schema — shown to the model in the system prompt so it
// knows what it's allowed to call and with what arguments.
// ------------------------------------------------------------
const AI_TOOL_SCHEMAS = [
    { name: 'add_task', args: '{title (required), category?, priority?("low"|"medium"|"high"), due?(e.g. "2026-07-20", "Monday", "today", "tomorrow")}', desc: 'Add a new to-do task.' },
    { name: 'complete_task', args: '{task ("id or title text")}', desc: 'Mark a task as completed (toggles if already done).' },
    { name: 'delete_task', args: '{task ("id or title text")}', desc: 'Permanently delete a task. Asks the user to confirm first.' },
    { name: 'list_tasks', args: '{}', desc: 'Return the full task list (the snapshot above only shows the first few).' },

    { name: 'add_schedule_event', args: '{title (required), day (required, e.g. "Monday", "today", "tomorrow"), start (required, e.g. "6am", "6:30 PM", "18:00"), end (required, same format as start), category?}', desc: 'Add a timed event to the weekly schedule. Day and time can be written naturally, not just exact formats.' },

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
        let due = null;
        if (args.due) {
            due = aiResolveDueDate(args.due);
            if (!due) return { ok: false, message: `Couldn't understand the due date "${args.due}". Try "YYYY-MM-DD", a weekday name, "today", or "tomorrow".` };
        }
        const task = {
            id: `mytask_${Date.now()}`,
            title: String(args.title).trim(),
            category: args.category || 'general',
            priority: args.priority || 'medium',
            due,
            completed: false,
            createdAt: new Date().toISOString()
        };
        myTasks.push(task);
        saveMyTasks(); renderMyTasks();
        return { ok: true, message: `Added task "${task.title}"${due ? ` (due ${due})` : ''}.`, data: task };
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
        return { ok: true, message: `${(myTasks || []).length} tasks.`, data: myTasks };
    },

    add_schedule_event(args) {
        if (!args?.title) return { ok: false, message: 'Missing event title.' };

        const day = aiParseDayName(args?.day);
        if (!day) return { ok: false, message: `Couldn't understand the day "${args?.day}". Try a weekday name like "Monday", or "today"/"tomorrow".` };

        const start = aiParseTimeString(args?.start);
        if (!start) return { ok: false, message: `Couldn't understand the start time "${args?.start}". Try something like "6am" or "18:00".` };

        const end = aiParseTimeString(args?.end);
        if (!end) return { ok: false, message: `Couldn't understand the end time "${args?.end}". Try something like "12pm" or "23:00".` };

        const issues = (typeof validateTaskTimes === 'function') ? validateTaskTimes(start, end, day) : [];
        const blocking = issues.find(i => i.type === 'error');
        if (blocking) return { ok: false, message: blocking.message };

        const event = {
            id: Date.now(),
            title: String(args.title).trim(),
            category: args.category || 'study',
            start, end, day,
            completed: false,
            notes: '',
            link: '',
            color: 'default',
            reminderEnabled: false,
            reminderMinutes: 15,
            reminderShown: false,
            linkedPageId: undefined,
            recurrence: null,
            weekId: (typeof getWeekId === 'function') ? getWeekId(new Date()) : undefined
        };
        window.events = window.events || [];
        window.events.push(event);
        if (typeof saveEvents === 'function') saveEvents();
        if (typeof renderSchedule === 'function') renderSchedule();

        const warning = issues.find(i => i.type === 'warning');
        return {
            ok: true,
            message: `Added "${event.title}" to ${day}, ${aiFormatTimeLabel(start)}–${aiFormatTimeLabel(end)}.${warning ? ` (heads up: ${warning.message})` : ''}`,
            data: event
        };
    },

    add_habit(args) {
        if (!args?.name) return { ok: false, message: 'Missing habit name.' };
        habits.push({ name: String(args.name).trim(), history: {} });
        saveHabits(); renderHabits();
        return { ok: true, message: `Added habit "${args.name}".` };
    },

    toggle_habit_today(args) {
        const idx = aiFindHabitIndex(args?.habit);
        if (idx === -1 || idx === undefined) return { ok: false, message: `Couldn't find a habit matching "${args?.habit}".` };
        const name = habits[idx].name;
        toggleHabit(idx);
        return { ok: true, message: `Toggled today's status for "${name}".` };
    },

    delete_habit(args) {
        const idx = aiFindHabitIndex(args?.habit);
        if (idx === -1 || idx === undefined) return { ok: false, message: `Couldn't find a habit matching "${args?.habit}".` };
        const name = habits[idx].name;
        if (!confirm(`Delete habit "${name}"?`)) return { ok: false, message: 'Cancelled — habit was not deleted.' };
        habits.splice(idx, 1);
        saveHabits(); renderHabits();
        return { ok: true, message: `Deleted habit "${name}".` };
    },

    list_habits() {
        return { ok: true, message: `${(habits || []).length} habits.`, data: habits };
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
        libraryItems.push(item);
        saveLibraryItems(); renderLibrary();
        return { ok: true, message: `Saved "${item.title}" to your library.`, data: item };
    },

    delete_library_item(args) {
        const item = aiFindLibraryItem(args?.item);
        if (!item) return { ok: false, message: `Couldn't find a library item matching "${args?.item}".` };
        if (!confirm(`Delete "${item.title}" from your library?`)) return { ok: false, message: 'Cancelled — item was not deleted.' };
        libraryItems = libraryItems.filter(i => i.id !== item.id);
        saveLibraryItems(); renderLibrary();
        return { ok: true, message: `Deleted "${item.title}" from your library.` };
    },

    list_library_items() {
        return { ok: true, message: `${(libraryItems || []).length} library items.`, data: libraryItems };
    },

    navigate_to_view(args) {
        if (!AI_VALID_VIEWS.includes(args?.view)) return { ok: false, message: `"${args?.view}" isn't a valid section.` };
        if (typeof switchView === 'function') switchView(args.view);
        return { ok: true, message: `Took you to ${args.view.replace('-view', '')}.` };
    }
};

window.AI_TOOL_SCHEMAS = AI_TOOL_SCHEMAS;
window.AI_TOOL_EXECUTORS = AI_TOOL_EXECUTORS;
