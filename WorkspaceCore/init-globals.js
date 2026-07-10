// Temporary initializer for missing globals (prevents ReferenceError in dev)
(function(){
    function safeParse(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return fallback;
            const parsed = JSON.parse(raw);
            return parsed == null ? fallback : parsed;
        } catch (_) {
            return fallback;
        }
    }

    // Generate a unique week identifier (year + week number)
    function getWeekId(date) {
        const year = date.getFullYear();
        const firstDayOfYear = new Date(year, 0, 1);
        const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
        const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
        return `${year}-W${weekNumber}`;
    }

    let scheduleEvents = safeParse('scheduleEvents', []);
    const legacySchedule = safeParse('scheduleData', []);

    if ((!scheduleEvents || !scheduleEvents.length) && Array.isArray(legacySchedule) && legacySchedule.length) {
        scheduleEvents = legacySchedule.map((item, idx) => {
            const date = item.date ? new Date(item.date) : null;
            const dayName = item.day || (date instanceof Date && !isNaN(date) ? date.toLocaleDateString('en-US', { weekday: 'long' }) : '');
            const title = item.title || item.name || `Task ${idx + 1}`;
            const start = item.start || item.time || '09:00';
            const end = item.end || item.durationEnd || '10:00';
            return {
                id: item.id || `evt_${Date.now()}_${idx}`,
                title,
                day: dayName,
                start,
                end,
                category: item.category || item.cat || 'study',
                completed: item.completed || false,
                reminderEnabled: item.reminderEnabled || false,
                reminderMinutes: item.reminderMinutes || 15,
                linkedPageId: item.linkedPageId || item.linkedLesson || null,
                weekId: getWeekId(new Date())  // Add weekId to migrated events
            };
        }).filter(ev => ev.day && DAYS.includes(ev.day));
        console.log('init-globals: migrated legacy scheduleData to scheduleEvents', scheduleEvents.length, 'items');
    }

    // Add weekId to existing events that don't have it
    const currentWeekId = getWeekId(new Date());
    scheduleEvents = scheduleEvents.map(event => {
        if (!event.weekId) {
            return { ...event, weekId: currentWeekId };
        }
        return event;
    });

    window.events = window.events || scheduleEvents;
    window.libraryItems = window.libraryItems || safeParse('libraryItems', []);
    window.habits = window.habits || safeParse('habits', []);
    window.myTasks = window.myTasks || safeParse('myTasks', []);
    window.taskTemplates = window.taskTemplates || safeParse('taskTemplates', []);
    window.dashTodos = window.dashTodos || safeParse('dashTodos', []) || [];

    window.getTodayName = window.getTodayName || function() {
        return new Date().toLocaleDateString('en-US', { weekday: 'long' });
    };

    // Get current session snapshot based on actual time
    window.getSessionSnapshot = window.getSessionSnapshot || function() {
        const todayEvents = (window.events || []).filter(e => {
            try { return e.day === window.getTodayName(); } catch(_) { return false; }
        }).sort((a,b)=> (a.start||'').localeCompare(b.start||''));

        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        let current = null;
        let next = null;

        for (let i = 0; i < todayEvents.length; i++) {
            const event = todayEvents[i];
            const start = event.start || '00:00';
            const end = event.end || '23:59';

            if (currentTime >= start && currentTime < end) {
                current = event;
                next = todayEvents[i + 1] || null;
                break;
            } else if (currentTime < start && !next) {
                next = event;
            }
        }

        return {
            current,
            next,
            todayEvents
        };
    };

    console.log('init-globals: ensured events and related arrays exist', {
        eventsLength: (window.events||[]).length,
        libraryItemsLength: (window.libraryItems||[]).length,
        dashTodosLength: (window.dashTodos||[]).length
    });
})();
