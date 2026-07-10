/* ============================================================
   JOURNAL UI
   ============================================================ */

const JournalUI = {
    currentEditingId: null,

    init() {
        this.setupEventListeners();
        this.render();
    },

    setupEventListeners() {
        // Quick add button
        const quickAddBtn = document.getElementById('journalQuickAddBtn');
        if (quickAddBtn) {
            quickAddBtn.addEventListener('click', () => this.openEditor());
        }

        // Empty state button (event delegation)
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-action="openJournalEditor"]')) {
                this.openEditor();
            }
        });

        // Modal cancel button
        const cancelBtn = document.getElementById('journalEditorCancel');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.closeEditor());
        }

        // Modal save button
        const saveBtn = document.getElementById('journalEditorSave');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveEntry());
        }

        // Close modal on backdrop click
        const modal = document.getElementById('journalEditorModal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.closeEditor();
            });
        }

        // Mood selector
        const moodOptions = document.querySelectorAll('.journal-mood-option');
        moodOptions.forEach(option => {
            option.addEventListener('click', () => {
                moodOptions.forEach(o => o.classList.remove('selected'));
                option.classList.add('selected');
            });
        });

        // Escape key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeEditor();
        });
    },

    render() {
        const container = document.getElementById('journalEntriesList');
        if (!container) return;

        const entries = JournalEngine.getEntries();
        const stats = JournalEngine.getStats();

        // Render stats bar
        this.renderStatsBar(stats);

        // Render entries or empty state
        if (entries.length === 0) {
            container.innerHTML = this.getEmptyStateHTML();
        } else {
            container.innerHTML = entries.map(entry => this.createEntryHTML(entry)).join('');
            this.attachEntryEventListeners();
        }
    },

    renderStatsBar(stats) {
        const statsBar = document.getElementById('journalStatsBar');
        if (!statsBar) return;

        statsBar.innerHTML = `
            <div class="journal-stat">
                <span>Total Entries:</span>
                <span class="journal-stat-value">${stats.total}</span>
            </div>
            <div class="journal-stat">
                <span>Today:</span>
                <span class="journal-stat-value">${stats.today}</span>
            </div>
            <div class="journal-stat">
                <span>This Week:</span>
                <span class="journal-stat-value">${stats.thisWeek}</span>
            </div>
            <div class="journal-stat">
                <span>Streak:</span>
                <span class="journal-stat-value">${stats.currentStreak} days</span>
            </div>
        `;
    },

    createEntryHTML(entry) {
        const date = new Date(entry.date);
        const dateStr = date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        const timeStr = date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });

        return `
            <div class="journal-entry" data-id="${entry.id}">
                <div class="journal-entry-header">
                    <div class="journal-entry-date">${dateStr} at ${timeStr}</div>
                    <div class="journal-entry-actions">
                        <button class="journal-btn edit" data-action="edit" data-id="${entry.id}">Edit</button>
                        <button class="journal-btn delete" data-action="delete" data-id="${entry.id}">Delete</button>
                    </div>
                </div>
                <div class="journal-entry-content">${this.escapeHtml(entry.content)}</div>
                ${entry.mood ? `<div class="journal-entry-mood">${entry.mood}</div>` : ''}
            </div>
        `;
    },

    attachEntryEventListeners() {
        // Edit buttons
        document.querySelectorAll('.journal-btn.edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                this.openEditor(id);
            });
        });

        // Delete buttons
        document.querySelectorAll('.journal-btn.delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                if (confirm('Delete this journal entry?')) {
                    JournalEngine.deleteEntry(id);
                    this.render();
                }
            });
        });

        // Click entry to view in modal
        document.querySelectorAll('.journal-entry').forEach(entry => {
            entry.addEventListener('click', () => {
                const id = entry.dataset.id;
                const journalEntry = JournalEngine.getEntry(id);
                if (journalEntry) {
                    this.openViewModal(journalEntry);
                }
            });
        });
    },

    openEditor(entryId = null) {
        const modal = document.getElementById('journalEditorModal');
        const title = document.getElementById('journalEditorTitle');
        const textarea = document.getElementById('journalEditorTextarea');
        const moodOptions = document.querySelectorAll('.journal-mood-option');

        if (!modal || !textarea) return;

        // Reset mood selection
        moodOptions.forEach(o => o.classList.remove('selected'));

        if (entryId) {
            const entry = JournalEngine.getEntry(entryId);
            if (entry) {
                this.currentEditingId = entryId;
                title.textContent = 'Edit Journal Entry';
                textarea.value = entry.content;
                if (entry.mood) {
                    const moodOption = document.querySelector(`.journal-mood-option[data-mood="${entry.mood}"]`);
                    if (moodOption) moodOption.classList.add('selected');
                }
            }
        } else {
            this.currentEditingId = null;
            title.textContent = 'New Journal Entry';
            textarea.value = '';
        }

        modal.classList.add('active');
        textarea.focus();
    },

    closeEditor() {
        const modal = document.getElementById('journalEditorModal');
        if (modal) {
            modal.classList.remove('active');
        }
        this.currentEditingId = null;
    },

    saveEntry() {
        const textarea = document.getElementById('journalEditorTextarea');
        const selectedMood = document.querySelector('.journal-mood-option.selected');
        const errorMsg = document.getElementById('journalEditorError');

        if (!textarea) return;

        const content = textarea.value.trim();
        if (!content) {
            // Show inline error message instead of alert
            if (errorMsg) {
                errorMsg.textContent = 'Please write something in your journal entry.';
                errorMsg.style.display = 'block';
                textarea.style.borderColor = '#ef4444';
                textarea.focus();

                // Hide error after 3 seconds
                setTimeout(() => {
                    errorMsg.style.display = 'none';
                    textarea.style.borderColor = '';
                }, 3000);
            } else {
                // Fallback to alert if error element doesn't exist
                alert('Please write something in your journal entry.');
            }
            return;
        }

        const mood = selectedMood ? selectedMood.dataset.mood : '';

        if (this.currentEditingId) {
            JournalEngine.updateEntry(this.currentEditingId, { content, mood });
        } else {
            JournalEngine.createEntry(content, mood);
        }

        this.closeEditor();
        this.render();
    },

    getEmptyStateHTML() {
        return `
            <div class="journal-empty-state">
                <div class="journal-empty-state-icon">📔</div>
                <div class="journal-empty-state-title">No journal entries yet</div>
                <div class="journal-empty-state-desc">Start documenting your thoughts and reflections.</div>
                <button class="matrix-btn" data-action="openJournalEditor">Write Your First Entry</button>
            </div>
        `;
    },

    openViewModal(entry) {
        // Remove existing view modal if present
        const existingModal = document.getElementById('journalViewModal');
        if (existingModal) {
            existingModal.remove();
        }

        const date = new Date(entry.date);
        const dateStr = date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        const timeStr = date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });

        const modal = document.createElement('div');
        modal.id = 'journalViewModal';
        modal.className = 'journal-view-modal';
        modal.innerHTML = `
            <div class="journal-view-modal-content">
                <div class="journal-view-modal-header">
                    <div>
                        <h3>Journal Entry</h3>
                        <p class="journal-view-date">${dateStr} at ${timeStr}</p>
                    </div>
                    <button class="journal-view-close" data-action="closeJournalViewModal">✕</button>
                </div>
                <div class="journal-view-modal-body">
                    ${this.escapeHtml(entry.content).replace(/\n/g, '<br>')}
                </div>
                ${entry.mood ? `<div class="journal-view-modal-footer">${entry.mood}</div>` : ''}
            </div>
        `;

        document.body.appendChild(modal);

        // Add event listener to close button
        const closeBtn = modal.querySelector('[data-action="closeJournalViewModal"]');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeViewModal());
        }

        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.closeViewModal();
        });

        // Close on Escape key
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeViewModal();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    },

    closeViewModal() {
        const modal = document.getElementById('journalViewModal');
        if (modal) {
            modal.remove();
        }
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML.replace(/\n/g, '<br>');
    }
};
