// ============================================================
// ai-context.js — Builds a live, read-only snapshot of the
// entire Workspace app (tasks, habits, journal, reading list,
// library, schedule, dashboard) so the AI Assistant always has
// current, real data to talk about — not just whatever the user
// typed in the chat box.
//
// This file only READS state. Nothing here mutates data.
// Actions (add/edit/delete) live in ai-tools.js.
// ============================================================

// Keep the prompt small enough for weaker local models — cap how
// much of each list we inline, and trim long text fields.
const AI_CONTEXT_LIMITS = {
    tasks: 12,
    habits: 15,
    journalEntries: 5,
    readingItems: 10,
    libraryItems: 10,
    scheduleEvents: 10
};

function aiTrim(text, max = 140) {
    if (!text) return '';
    const clean = String(text).replace(/\s+/g, ' ').trim();
    return clean.length > max ? clean.slice(0, max - 1) + '…' : clean;
}

function getSiteSnapshot() {
    const tasks = Array.isArray(window.myTasks) ? window.myTasks : [];
    const habits = Array.isArray(window.habits) ? window.habits : [];
    const libraryItems = Array.isArray(window.libraryItems) ? window.libraryItems : [];
    const events = Array.isArray(window.events) ? window.events : [];

    const journalEntries = (typeof JournalEngine !== 'undefined') ? JournalEngine.getEntries() : [];
    const readingItems = (typeof ReadingListEngine !== 'undefined') ? ReadingListEngine.getAll() : [];

    const todayName = (typeof getTodayName === 'function') ? getTodayName() : new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const todayEvents = events.filter(e => e.day === todayName);

    const todayStr = new Date().toDateString();

    return {
        generatedAt: new Date().toISOString(),
        activeView: (typeof localStorage !== 'undefined' && localStorage.getItem('activeView')) || 'dashboard-view',
        tasks: {
            total: tasks.length,
            completed: tasks.filter(t => t.completed).length,
            pending: tasks.filter(t => !t.completed).length,
            items: tasks.slice(0, AI_CONTEXT_LIMITS.tasks).map(t => ({
                id: t.id, title: t.title, category: t.category, priority: t.priority,
                due: t.due || null, completed: !!t.completed
            }))
        },
        habits: {
            total: habits.length,
            doneToday: habits.filter(h => h.history && h.history[todayStr]).length,
            items: habits.slice(0, AI_CONTEXT_LIMITS.habits).map((h, i) => ({
                index: i, name: h.name, doneToday: !!(h.history && h.history[todayStr])
            }))
        },
        journal: {
            total: journalEntries.length,
            recent: journalEntries.slice(0, AI_CONTEXT_LIMITS.journalEntries).map(e => ({
                id: e.id, date: e.date, mood: e.mood || null, snippet: aiTrim(e.content, 160)
            }))
        },
        reading: {
            total: readingItems.length,
            toRead: readingItems.filter(i => i.status === 'to-read').length,
            reading: readingItems.filter(i => i.status === 'reading').length,
            finished: readingItems.filter(i => i.status === 'finished').length,
            items: readingItems.slice(0, AI_CONTEXT_LIMITS.readingItems).map(i => ({
                id: i.id, title: i.title, author: i.author, type: i.type, status: i.status
            }))
        },
        library: {
            total: libraryItems.length,
            items: libraryItems.slice(0, AI_CONTEXT_LIMITS.libraryItems).map(i => ({
                id: i.id, title: i.title, url: i.url, category: i.category
            }))
        },
        scheduleToday: {
            day: todayName,
            items: todayEvents.slice(0, AI_CONTEXT_LIMITS.scheduleEvents).map(e => ({
                id: e.id, title: e.title, start: e.start, end: e.end, completed: !!e.completed
            }))
        }
    };
}

// Compact, human-readable version for the model's system prompt.
function getSiteContextPromptBlock() {
    const s = getSiteSnapshot();

    const taskLines = s.tasks.items.map(t =>
        `  - [${t.completed ? 'x' : ' '}] "${t.title}" (id:${t.id}${t.priority ? `, priority:${t.priority}` : ''}${t.due ? `, due:${t.due}` : ''})`
    ).join('\n') || '  (none)';

    const habitLines = s.habits.items.map(h =>
        `  - "${h.name}" (index:${h.index}) — ${h.doneToday ? 'done today' : 'not done today'}`
    ).join('\n') || '  (none)';

    const journalLines = s.journal.recent.map(j =>
        `  - ${j.date?.slice(0, 10) || ''}${j.mood ? ' ' + j.mood : ''}: "${j.snippet}" (id:${j.id})`
    ).join('\n') || '  (none)';

    const readingLines = s.reading.items.map(r =>
        `  - "${r.title}"${r.author ? ' by ' + r.author : ''} — ${r.status} (id:${r.id})`
    ).join('\n') || '  (none)';

    const libraryLines = s.library.items.map(l =>
        `  - "${l.title}" (${l.url}) (id:${l.id})`
    ).join('\n') || '  (none)';

    const scheduleLines = s.scheduleToday.items.map(e =>
        `  - ${e.start}–${e.end} "${e.title}"${e.completed ? ' (done)' : ''} (id:${e.id})`
    ).join('\n') || '  (nothing scheduled)';

    return `LIVE WORKSPACE SNAPSHOT (as of ${new Date(s.generatedAt).toLocaleTimeString()}):
Currently viewing: ${s.activeView}

TASKS (${s.tasks.pending} pending / ${s.tasks.total} total):
${taskLines}

HABITS (${s.habits.doneToday}/${s.habits.total} done today):
${habitLines}

RECENT JOURNAL ENTRIES (${s.journal.total} total):
${journalLines}

READING LIST (${s.reading.toRead} to-read, ${s.reading.reading} in progress, ${s.reading.finished} finished):
${readingLines}

SAVED LIBRARY LINKS (${s.library.total} total):
${libraryLines}

TODAY'S SCHEDULE (${s.scheduleToday.day}):
${scheduleLines}`;
}

window.getSiteSnapshot = getSiteSnapshot;
window.getSiteContextPromptBlock = getSiteContextPromptBlock;
