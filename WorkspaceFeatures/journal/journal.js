/* ============================================================
   JOURNAL ENGINE
   ============================================================ */

const JournalEngine = {
    STORAGE_KEY: 'workspace_journal',

    // Get all journal entries
    getEntries() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('Failed to load journal entries:', e);
            return [];
        }
    },

    // Save all entries
    saveEntries(entries) {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(entries));
            return true;
        } catch (e) {
            console.error('Failed to save journal entries:', e);
            return false;
        }
    },

    // Create new entry
    createEntry(content, mood = '') {
        const entries = this.getEntries();
        const entry = {
            id: Date.now().toString(),
            content: content.trim(),
            mood: mood,
            date: new Date().toISOString(),
            createdAt: Date.now()
        };
        entries.unshift(entry);
        this.saveEntries(entries);
        return entry;
    },

    // Update existing entry
    updateEntry(id, updates) {
        const entries = this.getEntries();
        const index = entries.findIndex(e => e.id === id);
        if (index !== -1) {
            entries[index] = { ...entries[index], ...updates };
            this.saveEntries(entries);
            return entries[index];
        }
        return null;
    },

    // Delete entry
    deleteEntry(id) {
        const entries = this.getEntries();
        const filtered = entries.filter(e => e.id !== id);
        this.saveEntries(filtered);
        return filtered;
    },

    // Get entry by ID
    getEntry(id) {
        const entries = this.getEntries();
        return entries.find(e => e.id === id);
    },

    // Get entries for a specific date
    getEntriesByDate(dateStr) {
        const entries = this.getEntries();
        return entries.filter(e => {
            const entryDate = new Date(e.date).toDateString();
            return entryDate === new Date(dateStr).toDateString();
        });
    },

    // Get today's entries
    getTodayEntries() {
        return this.getEntriesByDate(new Date());
    },

    // Get statistics
    getStats() {
        const entries = this.getEntries();
        const today = this.getTodayEntries();
        const thisWeek = entries.filter(e => {
            const entryDate = new Date(e.date);
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            return entryDate >= weekAgo;
        });

        return {
            total: entries.length,
            today: today.length,
            thisWeek: thisWeek.length,
            currentStreak: this.calculateStreak()
        };
    },

    // Calculate consecutive days streak
    calculateStreak() {
        const entries = this.getEntries();
        if (entries.length === 0) return 0;

        // Get unique date strings (YYYY-MM-DD format) using local time to avoid timezone issues
        const dates = [...new Set(entries.map(e => {
            const date = new Date(e.date);
            // Use local date components to avoid timezone complications
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }))].sort((a, b) => b.localeCompare(a));

        let streak = 0;
        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const yesterdayDate = new Date(Date.now() - 86400000);
        const yesterday = `${yesterdayDate.getFullYear()}-${String(yesterdayDate.getMonth() + 1).padStart(2, '0')}-${String(yesterdayDate.getDate()).padStart(2, '0')}`;

        if (dates[0] === today || dates[0] === yesterday) {
            streak = 1;
            for (let i = 1; i < dates.length; i++) {
                const current = new Date(dates[i - 1]);
                const prev = new Date(dates[i]);
                const diffDays = Math.round((current - prev) / 86400000);

                if (diffDays === 1) {
                    streak++;
                } else {
                    break;
                }
            }
        }

        return streak;
    },

    // Search entries
    searchEntries(query) {
        const entries = this.getEntries();
        const lowerQuery = query.toLowerCase();
        return entries.filter(e =>
            e.content.toLowerCase().includes(lowerQuery)
        );
    }
};
