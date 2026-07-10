// ============================================================
// 📚 READING LIST ENGINE
// ============================================================

const ReadingListEngine = {
    STORAGE_KEY: 'workspace_reading_list',

    // Default empty state
    defaultItems: [],

    // Current filter state
    currentFilter: 'all', // all, to-read, reading, finished
    searchQuery: '',

    // ============================================================
    // CRUD OPERATIONS
    // ============================================================

    getAll() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : this.defaultItems;
        } catch (e) {
            console.error('Error reading list:', e);
            return this.defaultItems;
        }
    },

    save(items) {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(items));
        } catch (e) {
            console.error('Error saving reading list:', e);
            showToast('⚠️ Failed to save reading list', 'error');
        }
    },

    add(item) {
        const items = this.getAll();
        const newItem = {
            id: Date.now(),
            title: item.title || 'Untitled',
            author: item.author || '',
            url: item.url || '',
            type: item.type || 'book', // book, article, document, video
            status: item.status || 'to-read', // to-read, reading, finished
            notes: item.notes || '',
            dateAdded: new Date().toISOString().split('T')[0],
            dateFinished: null
        };
        items.push(newItem);
        this.save(items);
        return newItem;
    },

    update(id, updates) {
        const items = this.getAll();
        const index = items.findIndex(item => item.id === id);
        if (index === -1) return null;

        // If marking as finished, set dateFinished
        if (updates.status === 'finished' && items[index].status !== 'finished') {
            updates.dateFinished = new Date().toISOString().split('T')[0];
        }

        items[index] = { ...items[index], ...updates };
        this.save(items);
        return items[index];
    },

    delete(id) {
        const items = this.getAll().filter(item => item.id !== id);
        this.save(items);
    },

    // ============================================================
    // FILTERING & SEARCH
    // ============================================================

    getFiltered() {
        let items = this.getAll();

        // Apply status filter
        if (this.currentFilter !== 'all') {
            items = items.filter(item => item.status === this.currentFilter);
        }

        // Apply search query
        if (this.searchQuery) {
            const query = this.searchQuery.toLowerCase();
            items = items.filter(item =>
                item.title.toLowerCase().includes(query) ||
                item.author.toLowerCase().includes(query) ||
                item.notes.toLowerCase().includes(query)
            );
        }

        // Sort by date added (newest first)
        items.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));

        return items;
    },

    getStats() {
        const items = this.getAll();
        return {
            total: items.length,
            toRead: items.filter(i => i.status === 'to-read').length,
            reading: items.filter(i => i.status === 'reading').length,
            finished: items.filter(i => i.status === 'finished').length
        };
    },

    // ============================================================
    // RENDER FUNCTIONS
    // ============================================================

    renderStats() {
        const container = document.getElementById('readingStatsBar');
        if (!container) return;

        const stats = this.getStats();
        container.innerHTML = `
            <div class="reading-stats-bar">
                <div class="reading-stat">
                    <span class="reading-stat-value">${stats.total}</span>
                    <span class="reading-stat-label">Total</span>
                </div>
                <div class="reading-stat">
                    <span class="reading-stat-value">${stats.toRead}</span>
                    <span class="reading-stat-label">To Read</span>
                </div>
                <div class="reading-stat">
                    <span class="reading-stat-value">${stats.reading}</span>
                    <span class="reading-stat-label">Reading</span>
                </div>
                <div class="reading-stat">
                    <span class="reading-stat-value">${stats.finished}</span>
                    <span class="reading-stat-label">Finished</span>
                </div>
            </div>
        `;
    },

    renderItems() {
        const container = document.getElementById('readingItemsGrid');
        if (!container) return;

        const items = this.getFiltered();

        if (items.length === 0) {
            renderEmptyState(container, 'No reading items yet. Add your first book or article!', '📚');
            return;
        }

        container.innerHTML = items.map(item => this.renderItemCard(item)).join('');
    },

    renderItemCard(item) {
        const typeIcons = {
            'book': '📖',
            'article': '📄',
            'document': '📝',
            'video': '🎥'
        };

        const statusColors = {
            'to-read': '#95a5a6',
            'reading': '#3498db',
            'finished': '#2ecc71'
        };

        const statusLabels = {
            'to-read': 'To Read',
            'reading': 'Reading',
            'finished': 'Finished'
        };

        const icon = typeIcons[item.type] || '📄';
        const statusColor = statusColors[item.status] || '#95a5a6';
        const statusLabel = statusLabels[item.status] || 'Unknown';

        return `
            <div class="reading-item-card" data-id="${item.id}">
                <div class="reading-item-header">
                    <div class="reading-item-icon">${icon}</div>
                    <div class="reading-item-type">${item.type}</div>
                </div>
                <div class="reading-item-content">
                    <h3 class="reading-item-title">${this.escapeHtml(item.title)}</h3>
                    ${item.author ? `<p class="reading-item-author">by ${this.escapeHtml(item.author)}</p>` : ''}
                    ${item.notes ? `<p class="reading-item-notes">${this.escapeHtml(item.notes)}</p>` : ''}
                    ${item.url ? `<a href="${this.escapeHtml(item.url)}" target="_blank" rel="noopener" class="reading-item-link">🔗 Link</a>` : ''}
                </div>
                <div class="reading-item-footer">
                    <span class="reading-status-badge" style="background:${statusColor}20; color:${statusColor}; border:1px solid ${statusColor}40;">
                        ${statusLabel}
                    </span>
                    <div class="reading-item-actions">
                        <button class="reading-action-btn" data-action="editReadingItem" data-id="${item.id}" title="Edit">✏️</button>
                        <button class="reading-action-btn" data-action="deleteReadingItem" data-id="${item.id}" title="Delete">🗑️</button>
                    </div>
                </div>
                <div class="reading-item-date">Added: ${item.dateAdded}</div>
            </div>
        `;
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    render() {
        this.renderStats();
        this.renderItems();
    },

    // ============================================================
    // FORM HANDLERS
    // ============================================================

    showAddForm() {
        const form = document.getElementById('readingAddForm');
        if (form) {
            form.style.display = form.style.display === 'none' ? 'block' : 'none';
            if (form.style.display === 'block') {
                this.clearForm();
            }
        }
    },

    clearForm() {
        document.getElementById('readingTitle') && (document.getElementById('readingTitle').value = '');
        document.getElementById('readingAuthor') && (document.getElementById('readingAuthor').value = '');
        document.getElementById('readingUrl') && (document.getElementById('readingUrl').value = '');
        document.getElementById('readingType') && (document.getElementById('readingType').value = 'book');
        document.getElementById('readingStatus') && (document.getElementById('readingStatus').value = 'to-read');
        document.getElementById('readingNotes') && (document.getElementById('readingNotes').value = '');
    },

    getFormData() {
        return {
            title: document.getElementById('readingTitle')?.value || '',
            author: document.getElementById('readingAuthor')?.value || '',
            url: document.getElementById('readingUrl')?.value || '',
            type: document.getElementById('readingType')?.value || 'book',
            status: document.getElementById('readingStatus')?.value || 'to-read',
            notes: document.getElementById('readingNotes')?.value || ''
        };
    },

    handleAdd() {
        const data = this.getFormData();
        if (!data.title.trim()) {
            showToast('⚠️ Please enter a title', 'error');
            return;
        }

        this.add(data);
        this.clearForm();
        this.render();
        showToast('✅ Reading item added!', 'success');
    },

    handleEdit(id) {
        const items = this.getAll();
        const item = items.find(i => i.id === id);
        if (!item) return;

        // Populate form
        document.getElementById('readingTitle') && (document.getElementById('readingTitle').value = item.title);
        document.getElementById('readingAuthor') && (document.getElementById('readingAuthor').value = item.author);
        document.getElementById('readingUrl') && (document.getElementById('readingUrl').value = item.url);
        document.getElementById('readingType') && (document.getElementById('readingType').value = item.type);
        document.getElementById('readingStatus') && (document.getElementById('readingStatus').value = item.status);
        document.getElementById('readingNotes') && (document.getElementById('readingNotes').value = item.notes);

        // Show form
        const form = document.getElementById('readingAddForm');
        if (form) form.style.display = 'block';

        // Change add button to update button temporarily
        const addBtn = document.getElementById('readingAddBtn');
        if (addBtn) {
            addBtn.textContent = 'Update Item';
            addBtn.dataset.editId = id;
        }

        // Scroll to form
        form?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },

    handleUpdate() {
        const editId = document.getElementById('readingAddBtn')?.dataset.editId;
        if (!editId) return;

        const data = this.getFormData();
        if (!data.title.trim()) {
            showToast('⚠️ Please enter a title', 'error');
            return;
        }

        this.update(parseInt(editId), data);

        // Reset button
        const addBtn = document.getElementById('readingAddBtn');
        if (addBtn) {
            addBtn.textContent = 'Add Item';
            delete addBtn.dataset.editId;
        }

        this.clearForm();
        this.render();
        showToast('✅ Reading item updated!', 'success');
    },

    handleDelete(id) {
        if (!confirm('Delete this reading item?')) return;
        this.delete(id);
        this.render();
        showToast('🗑️ Reading item deleted', 'info');
    },

    // ============================================================
    // FILTER & SEARCH
    // ============================================================

    setFilter(filter) {
        this.currentFilter = filter;

        // Update filter button states
        document.querySelectorAll('.reading-filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });

        this.renderItems();
    },

    setSearch(query) {
        this.searchQuery = query;
        this.renderItems();
    }
};

// Make it globally accessible
window.ReadingListEngine = ReadingListEngine;
