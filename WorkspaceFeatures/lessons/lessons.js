// ============================================================
// NOTION-STYLE LESSON ENGINE – FIXED
// ============================================================

console.log('📚 lessons.js loaded');

// ----- Default Data -----
const DEFAULT_HUB_STATE = {
    folders: {},
    pages: {},
    activePageId: null,
    rootFolderIds: []
};

// ----- State Loading -----
function loadHubState() {
    try {
        const stored = localStorage.getItem("hubState");
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed.folders)) return migrateFromOldFormat(parsed);
            if (parsed.rootFolderIds) return parsed;
            if (parsed.folders && typeof parsed.folders === 'object') {
                parsed.rootFolderIds = Object.keys(parsed.folders);
                return parsed;
            }
        }
    } catch (_) {}
    return JSON.parse(JSON.stringify(DEFAULT_HUB_STATE));
}

function migrateFromOldFormat(oldState) {
    const newState = {
        folders: {},
        pages: oldState.pages || {},
        activePageId: oldState.activePageId || null,
        rootFolderIds: []
    };
    oldState.folders.forEach(folder => {
        const children = [];
        if (folder.pageIds) {
            folder.pageIds.forEach(pid => children.push('page_' + pid));
        }
        newState.folders[folder.id] = {
            id: folder.id,
            title: folder.title,
            icon: '📁',
            children: children
        };
        newState.rootFolderIds.push(folder.id);
    });
    return newState;
}

let hubState = loadHubState();
console.log('hubState initial:', hubState);
console.log('hubState.rootFolderIds:', Array.isArray(hubState.rootFolderIds) ? hubState.rootFolderIds : 'MISSING');
let collapsedFolders = JSON.parse(localStorage.getItem("collapsedFolders") || "{}");
let currentSearchQuery = '';

// ============================================================
// BACKUP / RESTORE FUNCTIONS (was missing)
// ============================================================
function exportBackup() {
    const data = {
        hubState,
        events: typeof events !== 'undefined' ? events : [],
        myTasks: typeof myTasks !== 'undefined' ? myTasks : [],
        libraryItems: typeof libraryItems !== 'undefined' ? libraryItems : [],
        habits: typeof habits !== 'undefined' ? habits : [],
        dashTodos: typeof dashTodos !== 'undefined' ? dashTodos : [],
        taskTemplates: typeof taskTemplates !== 'undefined' ? taskTemplates : [],
        version: '2.1'
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workspace_backup_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('✅ Backup exported!', 'success');
}

function importBackup(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.hubState) {
                showToast('Invalid backup file.', 'error');
                return;
            }
            // Restore all state
            hubState = data.hubState;
            if (data.events) events = data.events;
            if (data.myTasks) myTasks = data.myTasks;
            if (data.libraryItems) libraryItems = data.libraryItems;
            if (data.habits) habits = data.habits;
            if (data.dashTodos) dashTodos = data.dashTodos;
            if (data.taskTemplates) taskTemplates = data.taskTemplates;

            // Save everything
            saveHubState();
            if (typeof saveEvents === 'function') saveEvents();
            if (typeof saveMyTasks === 'function') saveMyTasks();
            if (typeof saveLibraryItems === 'function') saveLibraryItems();
            if (typeof saveHabits === 'function') saveHabits();
            if (typeof saveDashTodos === 'function') saveDashTodos();
            if (typeof saveTaskTemplates === 'function') saveTaskTemplates();

            refreshWorkspace();
            showToast('✅ Backup restored successfully!', 'success');
        } catch (err) {
            showToast('Failed to parse backup: ' + err.message, 'error');
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

// ============================================================
// SAVE / REFRESH
// ============================================================
let saveTimeout = null;

function showSaveIndicator() {
    const indicator = document.getElementById('saveIndicator');
    if (indicator) {
        indicator.style.display = 'inline-block';
        indicator.style.opacity = '1';
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            indicator.style.opacity = '0';
            setTimeout(() => { indicator.style.display = 'none'; }, 300);
        }, 1500);
    }
}

function saveHubState() {
    localStorage.setItem("hubState", JSON.stringify(hubState));
    if (typeof updateDashboardStats === 'function') updateDashboardStats();
    showSaveIndicator();
}

function saveCollapsedFolders() {
    localStorage.setItem("collapsedFolders", JSON.stringify(collapsedFolders));
}

function refreshWorkspace() {
    console.log('🔄 Refreshing workspace...');
    saveHubState();
    renderTreeSidebar();
    renderCurriculumLedger();
}

// ============================================================
// SEARCH (uses escapeHtml)
// ============================================================
function searchLessons(query) {
    currentSearchQuery = query.trim().toLowerCase();

    const resultsContainer = document.getElementById("lessonSearchResults");
    const treeContainer = document.getElementById("dynamic-lesson-tree");

    if (!resultsContainer || !treeContainer) return;

    const trimmedQuery = query.trim().toLowerCase();

    if (!trimmedQuery) {
        currentSearchQuery = '';
        resultsContainer.style.display = 'none';
        resultsContainer.innerHTML = '';
        treeContainer.style.display = '';
        renderCurriculumLedger();
        return;
    }

    const matches = [];
    Object.entries(hubState.pages).forEach(([pageId, page]) => {
        let pageMatch = false;
        let matchedBlocks = [];

        if (page.title.toLowerCase().includes(trimmedQuery)) {
            pageMatch = true;
        }

        page.blocks.forEach((block, idx) => {
            if (block.content && block.content.toLowerCase().includes(trimmedQuery)) {
                matchedBlocks.push({ index: idx, content: block.content });
                pageMatch = true;
            }
        });

        if (pageMatch) {
            let folderTitle = '';
            for (const fid of hubState.rootFolderIds) {
                const folder = hubState.folders[fid];
                if (folder && folder.children.includes('page_' + pageId)) {
                    folderTitle = folder.title;
                    break;
                }
            }
            matches.push({
                pageId,
                title: page.title,
                folderTitle,
                matchedBlocks: matchedBlocks.slice(0, 3)
            });
        }
    });

    treeContainer.style.display = 'none';
    resultsContainer.style.display = 'block';

    if (matches.length === 0) {
        resultsContainer.innerHTML = '<div style="padding: 12px; color: var(--text-muted); text-align: center;">No results found</div>';
        return;
    }

    resultsContainer.innerHTML = matches.map(match => `
        <div class="search-result-item" style="padding: 10px 12px; cursor: pointer; border-bottom: 1px solid var(--border-color); transition: background 0.15s;"
             onmouseover="this.style.background='var(--bg-hover)'"
             onmouseout="this.style.background='transparent'"
             onclick="openSearchResult('${match.pageId}')">
            <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">
                📄 ${highlightMatch(escapeHtml(match.title), trimmedQuery)}
            </div>
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 4px;">
                📁 ${escapeHtml(match.folderTitle)}
            </div>
            ${match.matchedBlocks.length > 0 ? `
                <div style="font-size: 0.8rem; color: var(--text-secondary); padding-left: 8px; border-left: 2px solid var(--accent-color);">
                    ${match.matchedBlocks.map(block => `
                        <div style="margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                            ${highlightMatch(escapeHtml(block.content), trimmedQuery)}
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        </div>
    `).join('');
}

function highlightMatch(text, query) {
    if (!query) return text;
    const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
    return text.replace(regex, '<mark style="background: rgba(168, 85, 247, 0.3); color: inherit; padding: 0 2px; border-radius: 2px;">$1</mark>');
}

function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function openSearchResult(pageId) {
    const resultsContainer = document.getElementById("lessonSearchResults");
    const searchInput = document.getElementById("lessonSearchInput");

    if (resultsContainer) {
        resultsContainer.style.display = 'none';
        resultsContainer.innerHTML = '';
    }
    if (searchInput) {
        searchInput.value = '';
    }

    const treeContainer = document.getElementById("dynamic-lesson-tree");
    if (treeContainer) {
        treeContainer.style.display = '';
    }

    hubState.activePageId = pageId;
    refreshWorkspace();

    const sidebar = document.getElementById('app-sidebar');
    if (sidebar) sidebar.classList.remove('mobile-open', 'open');

    setTimeout(() => highlightSearchResultsInLedger(), 100);
}

// ============================================================
// TREE RENDER (escapeHtml)
// ============================================================
let draggedPageId = null;
let draggedSourceFolderId = null;

function renderTreeSidebar() {
    const container = document.getElementById("dynamic-lesson-tree");
    if (!container) return;
    container.innerHTML = "";

    if (hubState.rootFolderIds.length === 0) {
        container.innerHTML = `<div style="color:#64748b;padding:10px;text-align:center;">No folders yet.<br>Right‑click to create one.</div>`;
        container.oncontextmenu = (e) => {
            e.preventDefault();
            e.stopPropagation();
            showLessonContextMenu(e, { type: 'root' });
        };
        return;
    }

    function renderFolder(folderId, depth = 0) {
        const folder = hubState.folders[folderId];
        if (!folder) return null;

        const collapsed = collapsedFolders[folderId] || false;
        const folderNode = document.createElement("div");
        folderNode.className = `lesson-folder ${!collapsed ? 'expanded' : ''}`;
        folderNode.style.marginLeft = (depth * 12) + 'px';

        const trigger = document.createElement("div");
        trigger.className = "folder-trigger";
        trigger.innerHTML = `
            <span class="folder-arrow" style="display:inline-block;transition:transform 0.2s; ${!collapsed ? 'transform:rotate(90deg);' : ''}">▶</span>
            <span class="folder-icon">${folder.icon || '📁'}</span>
            <span class="folder-title" style="font-weight:600;">${escapeHtml(folder.title)}</span>
        `;
        trigger.dataset.folderId = folderId;

        trigger.onclick = (e) => {
            e.stopPropagation();
            collapsedFolders[folderId] = !collapsedFolders[folderId];
            saveCollapsedFolders();
            refreshWorkspace();
        };
        trigger.oncontextmenu = (e) => {
            e.preventDefault();
            e.stopPropagation();
            showLessonContextMenu(e, { type: 'folder', folderId: folderId });
        };

        trigger.addEventListener('dragover', function(e) {
            e.preventDefault();
            this.style.background = 'rgba(124,109,240,0.15)';
        });
        trigger.addEventListener('dragleave', function(e) {
            this.style.background = '';
        });
        trigger.addEventListener('drop', function(e) {
            e.preventDefault();
            this.style.background = '';
            const targetFolderId = this.dataset.folderId;
            if (!targetFolderId || !draggedPageId || draggedSourceFolderId === targetFolderId) return;
            const sourceFolder = hubState.folders[draggedSourceFolderId];
            const targetFolder = hubState.folders[targetFolderId];
            if (!sourceFolder || !targetFolder) return;
            const pageKey = 'page_' + draggedPageId;
            sourceFolder.children = sourceFolder.children.filter(id => id !== pageKey);
            if (!targetFolder.children.includes(pageKey)) {
                targetFolder.children.push(pageKey);
            }
            saveHubState();
            refreshWorkspace();
            showToast(`📄 Page moved to "${escapeHtml(targetFolder.title)}"`, 'success');
        });

        const content = document.createElement("div");
        content.className = "folder-content";
        content.style.display = !collapsed ? "flex" : "none";

        if (folder.children.length === 0) {
            const empty = document.createElement("div");
            empty.style.cssText = "padding:4px 12px;color:#475569;font-size:0.8rem;font-style:italic;";
            empty.textContent = "Empty";
            content.appendChild(empty);
        } else {
            folder.children.forEach(childId => {
                if (childId.startsWith('page_')) {
                    const pageId = childId.replace('page_', '');
                    const page = hubState.pages[pageId];
                    if (!page) return;
                    const leaf = document.createElement("div");
                    leaf.className = `lesson-leaf-node ${hubState.activePageId === pageId ? 'active' : ''}`;
                    leaf.dataset.pageId = pageId;
                    leaf.innerHTML = `<span class="leaf-icon">📄</span><span class="leaf-title">${escapeHtml(page.title)}</span>`;
                    leaf.onclick = () => {
                        hubState.activePageId = pageId;
                        refreshWorkspace();
                        const sidebar = document.getElementById('app-sidebar');
                        if (sidebar) sidebar.classList.remove('mobile-open', 'open');
                    };
                    leaf.oncontextmenu = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        showLessonContextMenu(e, { type: 'page', pageId: pageId, folderId: folderId });
                    };

                    leaf.draggable = true;
                    leaf.addEventListener('dragstart', function(e) {
                        draggedPageId = this.dataset.pageId;
                        draggedSourceFolderId = folderId;
                        e.dataTransfer.setData('text/plain', draggedPageId);
                        this.style.opacity = '0.4';
                    });
                    leaf.addEventListener('dragend', function(e) {
                        this.style.opacity = '1';
                        setTimeout(() => {
                            draggedPageId = null;
                            draggedSourceFolderId = null;
                        }, 100);
                    });

                    content.appendChild(leaf);
                } else {
                    const subFolderNode = renderFolder(childId, depth + 1);
                    if (subFolderNode) content.appendChild(subFolderNode);
                }
            });
        }

        folderNode.appendChild(trigger);
        folderNode.appendChild(content);
        return folderNode;
    }

    hubState.rootFolderIds.forEach(fid => {
        const node = renderFolder(fid);
        if (node) container.appendChild(node);
    });

    container.oncontextmenu = (e) => {
        const target = e.target;
        if (target === container || target.closest('.folder-content') || target.closest('.lesson-folder') === null) {
            e.preventDefault();
            e.stopPropagation();
            showLessonContextMenu(e, { type: 'root' });
        }
    };
}

// ============================================================
// CONTEXT MENU
// ============================================================
async function showLessonContextMenu(e, context) {
    const menu = document.getElementById('lessonContextMenu');
    if (!menu) return;

    let items = [];

    if (context.type === 'root') {
        items.push({ label: '📁 New Folder', action: 'createFolder' });
    } else if (context.type === 'folder') {
        const folder = hubState.folders[context.folderId];
        if (!folder) return;
        items.push({ label: '📁 New Subfolder', action: 'createSubfolder', folderId: context.folderId });
        items.push({ label: '📄 New Page', action: 'createPage', folderId: context.folderId });
        items.push({ label: '✏️ Rename', action: 'renameFolder', folderId: context.folderId, currentName: folder.title });
        items.push({ label: '🎨 Change Icon', action: 'changeIcon', folderId: context.folderId, currentIcon: folder.icon });
        items.push({ label: '🗑️ Delete', action: 'deleteFolder', folderId: context.folderId, currentName: folder.title });
    } else if (context.type === 'page') {
        const page = hubState.pages[context.pageId];
        const pageTitle = page ? page.title : '';
        items.push({ label: '✏️ Rename Page', action: 'renamePage', pageId: context.pageId, currentName: pageTitle });
        items.push({ label: '🗑️ Delete Page', action: 'deletePage', pageId: context.pageId, folderId: context.folderId });
        items.push({ label: '📂 Move to...', action: 'movePage', pageId: context.pageId, folderId: context.folderId });
    }

    if (items.length === 0) {
        menu.style.display = 'none';
        return;
    }

    let html = '';
    items.forEach((item, index) => {
        if (index > 0 && (item.action === 'createSubfolder' || item.action === 'createPage')) {
            html += `<div class="menu-divider"></div>`;
        }
        html += `<div class="menu-item" data-action="${item.action}" data-folderid="${item.folderId || ''}" data-pageid="${item.pageId || ''}" data-currentname="${escapeHtml(item.currentName || '')}" data-currenticon="${escapeHtml(item.currentIcon || '')}">${escapeHtml(item.label)}</div>`;
    });
    menu.innerHTML = html;

    menu.style.left = e.clientX + 'px';
    menu.style.top = e.clientY + 'px';
    menu.style.display = 'block';

    menu.querySelectorAll('.menu-item').forEach(el => {
        el.addEventListener('click', async function() {
            const action = this.dataset.action;
            const folderId = this.dataset.folderid;
            const pageId = this.dataset.pageid;
            const currentName = this.dataset.currentname || '';
            const currentIcon = this.dataset.currenticon || '';

            switch(action) {
                case 'createFolder': {
                    const result = await showCustomModal({
                        title: 'Create Folder',
                        description: 'Enter a name for the new folder:',
                        placeholder: 'Folder name...',
                        confirmText: 'Create'
                    });
                    if (result && result.value) {
                        const name = result.value;
                        const id = `folder_${Date.now()}`;
                        hubState.folders[id] = { id, title: name.trim(), icon: '📁', children: [] };
                        hubState.rootFolderIds.push(id);
                        refreshWorkspace();
                        showToast(`✅ Folder "${escapeHtml(name.trim())}" created!`, 'success');
                    }
                    break;
                }
                case 'createSubfolder': {
                    const result = await showCustomModal({
                        title: 'Create Subfolder',
                        description: 'Enter a name for the new subfolder:',
                        placeholder: 'Subfolder name...',
                        confirmText: 'Create'
                    });
                    if (result && result.value) {
                        const name = result.value;
                        const parent = hubState.folders[folderId];
                        if (!parent) { showToast('Folder not found.', 'error'); return; }
                        const id = `folder_${Date.now()}`;
                        hubState.folders[id] = { id, title: name.trim(), icon: '📁', children: [] };
                        parent.children.push(id);
                        refreshWorkspace();
                        showToast(`✅ Subfolder "${escapeHtml(name.trim())}" created!`, 'success');
                    }
                    break;
                }
                case 'createPage': {
                    const result = await showCustomModal({
                        title: 'Create Page',
                        description: 'Enter a title for the new page:',
                        placeholder: 'Page title...',
                        confirmText: 'Create'
                    });
                    if (result && result.value) {
                        const parent = hubState.folders[folderId];
                        if (!parent) { showToast('Folder not found.', 'error'); return; }
                        const id = `page_${Date.now()}`;
                        const pageId = id.replace('page_', '');
                        hubState.pages[pageId] = { title: result.value.trim(), blocks: [] };
                        parent.children.push(id);
                        hubState.activePageId = pageId;
                        refreshWorkspace();
                        showToast(`✅ Page "${escapeHtml(result.value.trim())}" created!`, 'success');
                    }
                    break;
                }
                case 'renameFolder': {
                    const result = await showCustomModal({
                        title: 'Rename Folder',
                        description: 'Enter a new name:',
                        placeholder: 'New folder name...',
                        defaultValue: currentName,
                        confirmText: 'Rename'
                    });
                    if (result && result.value) {
                        const folder = hubState.folders[folderId];
                        if (folder) {
                            folder.title = result.value.trim();
                            saveHubState();
                            refreshWorkspace();
                            showToast(`✅ Folder renamed to "${escapeHtml(result.value.trim())}"`, 'success');
                        }
                    }
                    break;
                }
                case 'changeIcon': {
                    const result = await showCustomModal({
                        title: 'Change Folder Icon',
                        description: 'Enter an emoji (e.g., 📚, 🧠, 🎯) or paste one:',
                        placeholder: '📁',
                        defaultValue: currentIcon || '📁',
                        confirmText: 'Set Icon'
                    });
                    if (result && result.value) {
                        const folder = hubState.folders[folderId];
                        if (folder) {
                            folder.icon = result.value.trim() || '📁';
                            saveHubState();
                            refreshWorkspace();
                            showToast('✅ Icon updated', 'success');
                        }
                    }
                    break;
                }
                case 'deleteFolder': {
                    const confirmed = await showCustomConfirm(`Delete folder "${currentName}" and all its contents?`);
                    if (confirmed) {
                        function deleteFolderRecursive(fid) {
                            const folder = hubState.folders[fid];
                            if (!folder) return;
                            folder.children.forEach(childId => {
                                if (childId.startsWith('page_')) {
                                    const pid = childId.replace('page_', '');
                                    delete hubState.pages[pid];
                                } else {
                                    deleteFolderRecursive(childId);
                                }
                            });
                            delete hubState.folders[fid];
                        }
                        deleteFolderRecursive(folderId);
                        let parentFound = false;
                        for (const fid of hubState.rootFolderIds) {
                            if (fid === folderId) {
                                hubState.rootFolderIds = hubState.rootFolderIds.filter(f => f !== folderId);
                                parentFound = true;
                                break;
                            }
                        }
                        if (!parentFound) {
                            for (const fid in hubState.folders) {
                                const folder = hubState.folders[fid];
                                if (folder && folder.children.includes(folderId)) {
                                    folder.children = folder.children.filter(c => c !== folderId);
                                    parentFound = true;
                                    break;
                                }
                            }
                        }
                        if (hubState.activePageId && hubState.activePageId.startsWith('page_')) {
                            hubState.activePageId = null;
                        }
                        saveHubState();
                        refreshWorkspace();
                        showToast(`🗑️ Folder "${currentName}" deleted.`, 'info');
                    }
                    break;
                }
                case 'renamePage': {
                    const result = await showCustomModal({
                        title: 'Rename Page',
                        description: 'Enter a new name:',
                        placeholder: 'New page name...',
                        defaultValue: currentName,
                        confirmText: 'Rename'
                    });
                    if (result && result.value) {
                        const page = hubState.pages[pageId];
                        if (page) {
                            page.title = result.value.trim();
                            saveHubState();
                            refreshWorkspace();
                            showToast(`✅ Page renamed to "${escapeHtml(result.value.trim())}"`, 'success');
                        }
                    }
                    break;
                }
                case 'deletePage': {
                    const confirmed = await showCustomConfirm(`Delete page "${currentName}"?`);
                    if (confirmed) {
                        const folder = hubState.folders[folderId];
                        if (folder) {
                            folder.children = folder.children.filter(c => c !== 'page_' + pageId);
                            delete hubState.pages[pageId];
                            if (hubState.activePageId === pageId) hubState.activePageId = null;
                            saveHubState();
                            refreshWorkspace();
                            showToast(`🗑️ Page "${currentName}" deleted.`, 'info');
                        }
                    }
                    break;
                }
                case 'movePage': {
                    const allFolders = Object.values(hubState.folders).filter(f => f.id !== folderId);
                    if (allFolders.length === 0) {
                        showToast('No other folders to move to.', 'info');
                        break;
                    }
                    const folderOptions = allFolders.map(f => ({ value: f.id, label: f.title }));
                    const result = await showCustomModal({
                        title: 'Move Page',
                        description: 'Select a destination folder:',
                        placeholder: '',
                        confirmText: 'Move',
                        selectOptions: folderOptions
                    });
                    if (result && result.value) {
                        const targetFolderId = result.selected;
                        const targetFolder = hubState.folders[targetFolderId];
                        if (!targetFolder) { showToast('Folder not found.', 'error'); return; }
                        const sourceFolder = hubState.folders[folderId];
                        if (sourceFolder) {
                            sourceFolder.children = sourceFolder.children.filter(c => c !== 'page_' + pageId);
                        }
                        const pageKey = 'page_' + pageId;
                        if (!targetFolder.children.includes(pageKey)) {
                            targetFolder.children.push(pageKey);
                        }
                        saveHubState();
                        refreshWorkspace();
                        showToast(`📄 Page moved to "${escapeHtml(targetFolder.title)}"`, 'success');
                    }
                    break;
                }
            }

            menu.style.display = 'none';
        });
    });

    const closeMenu = (e) => {
        if (!menu.contains(e.target)) {
            menu.style.display = 'none';
            document.removeEventListener('click', closeMenu);
        }
    };
    setTimeout(() => {
        document.addEventListener('click', closeMenu);
    }, 10);
}

// ============================================================
// BLOCK CONTEXT MENU, SLASH COMMANDS, etc. (with escapeHtml)
// ============================================================
function showBlockContextMenu(e, blockIndex, pageId, isFromHandle = false) {
    e.preventDefault();
    const menu = document.getElementById('lessonContextMenu');
    if (!menu) return;

    const items = [
        { label: 'Turn into', action: 'turnInto' },
        { label: 'Color', action: 'color' },
        { label: 'Duplicate', action: 'duplicate' },
        { label: 'Delete', action: 'delete' },
        { label: 'Copy link to block', action: 'copyLink' }
    ];

    let html = '';
    items.forEach(item => {
        html += `<div class="menu-item" data-action="${item.action}">${escapeHtml(item.label)}</div>`;
    });
    menu.innerHTML = html;
    menu.style.left = e.clientX + 'px';
    menu.style.top = e.clientY + 'px';
    menu.style.display = 'block';
    menu.dataset.blockIndex = blockIndex;
    menu.dataset.pageId = pageId;

    menu.querySelectorAll('.menu-item').forEach(el => {
        el.addEventListener('click', function(e2) {
            e2.stopPropagation();
            const action = this.dataset.action;
            const index = parseInt(menu.dataset.blockIndex);
            const pid = menu.dataset.pageId;
            handleBlockContextAction(action, index, pid, this);
            menu.style.display = 'none';
        });
    });

    const closeMenu = (ev) => {
        if (!menu.contains(ev.target)) {
            menu.style.display = 'none';
            document.removeEventListener('click', closeMenu);
        }
    };
    setTimeout(() => {
        document.addEventListener('click', closeMenu);
    }, 10);
}

async function handleBlockContextAction(action, blockIndex, pageId, targetEl) {
    const page = hubState.pages[pageId];
    if (!page) return;
    const block = page.blocks[blockIndex];
    if (!block) return;

    switch (action) {
        case 'duplicate': {
            const newBlock = JSON.parse(JSON.stringify(block));
            page.blocks.splice(blockIndex + 1, 0, newBlock);
            saveHubState();
            renderCurriculumLedger();
            showToast('Block duplicated', 'info');
            break;
        }
        case 'delete': {
            const confirmed = await showCustomConfirm(`Delete this block?`);
            if (confirmed) {
                page.blocks.splice(blockIndex, 1);
                saveHubState();
                renderCurriculumLedger();
                showToast('Block deleted', 'info');
            }
            break;
        }
        case 'copyLink': {
            const url = new URL(window.location.href);
            url.searchParams.set('page', pageId);
            url.searchParams.set('block', blockIndex);
            const link = url.toString();
            navigator.clipboard?.writeText(link).then(() => {
                showToast('Link copied to clipboard!', 'success');
            }).catch(() => {
                const input = document.createElement('input');
                input.value = link;
                document.body.appendChild(input);
                input.select();
                document.execCommand('copy');
                document.body.removeChild(input);
                showToast('Link copied!', 'success');
            });
            break;
        }
        case 'turnInto': {
            const types = ['bullet', 'h1', 'h2', 'h3', 'quote', 'code', 'callout', 'toggle', 'divider'];
            const options = types.map(t => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }));
            const result = await showCustomModal({
                title: 'Turn into',
                description: 'Select block type:',
                placeholder: '',
                confirmText: 'Apply',
                selectOptions: options
            });
            if (result && result.value) {
                if (result.selected === 'code') {
                    const content = block.content || '';
                    const detected = detectLanguage(content);
                    const lang = await showLanguagePicker(detected);
                    if (lang) {
                        block.type = 'code';
                        block.language = lang;
                        block.content = content;
                        saveHubState();
                        renderCurriculumLedger();
                        showToast(`Code block (${lang})`, 'info');
                    }
                } else {
                    block.type = result.selected;
                    if (block.type !== 'code') delete block.language;
                    if (block.type === 'toggle') block.expanded = true;
                    saveHubState();
                    renderCurriculumLedger();
                    showToast(`Block type changed to ${result.selected}`, 'info');
                }
            }
            break;
        }
        case 'color': {
            const result = await showColorPicker();
            if (result) {
                if (result.isBg) {
                    block.bgColor = result.color;
                    delete block.textColor;
                } else {
                    block.textColor = result.color;
                    delete block.bgColor;
                }
                saveHubState();
                renderCurriculumLedger();
                showToast('Color applied', 'info');
            }
            break;
        }
        default:
            break;
    }
}

// ============================================================
// SLASH COMMANDS
// ============================================================
let slashIndex = -1;
let slashItems = [];

function handleSlashCommand(e, lineDiv) {
    const text = lineDiv.innerText;
    if (text === '/') {
        const dropdown = document.getElementById('slashCommandDropdown');
        const rect = lineDiv.getBoundingClientRect();
        dropdown.style.left = rect.left + 'px';
        dropdown.style.top = (rect.bottom + 4) + 'px';
        dropdown.style.display = 'block';
        slashIndex = -1;
        slashItems = dropdown.querySelectorAll('.slash-item');
        highlightSlashItem(0);
        dropdown.dataset.targetIndex = lineDiv.dataset.index;
        dropdown.dataset.pageId = hubState.activePageId;
        return;
    } else {
        closeSlashDropdown();
    }
}

function closeSlashDropdown() {
    const dropdown = document.getElementById('slashCommandDropdown');
    dropdown.style.display = 'none';
    slashIndex = -1;
}

function highlightSlashItem(index) {
    const items = slashItems;
    items.forEach((el, i) => {
        el.style.background = i === index ? 'rgba(124,109,240,0.15)' : '';
    });
}

document.addEventListener('keydown', async function(e) {
    const dropdown = document.getElementById('slashCommandDropdown');
    if (dropdown.style.display === 'block') {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            slashIndex = (slashIndex + 1) % slashItems.length;
            highlightSlashItem(slashIndex);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            slashIndex = (slashIndex - 1 + slashItems.length) % slashItems.length;
            highlightSlashItem(slashIndex);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const selected = slashItems[slashIndex];
            if (selected) {
                const type = selected.dataset.type;
                const pageId = dropdown.dataset.pageId;
                const index = parseInt(dropdown.dataset.targetIndex);
                const page = hubState.pages[pageId];
                if (page && !isNaN(index)) {
                    page.blocks[index].type = type;
                    page.blocks[index].content = '';
                    page.blocks[index].time = '';
                    if (type === 'toggle') page.blocks[index].expanded = true;
                    if (type === 'code') {
                        const lang = await showLanguagePicker(null);
                        if (lang) {
                            page.blocks[index].language = lang;
                            saveHubState();
                            renderCurriculumLedger();
                        }
                    }
                    saveHubState();
                    renderCurriculumLedger();
                    closeSlashDropdown();
                    showToast(`Block type set to ${type}`, 'info');
                }
            }
        } else if (e.key === 'Escape') {
            closeSlashDropdown();
        }
    }
});

document.addEventListener('click', function(e) {
    const dropdown = document.getElementById('slashCommandDropdown');
    if (dropdown.style.display === 'block' && !dropdown.contains(e.target)) {
        closeSlashDropdown();
    }
});

// ============================================================
// FIND / REPLACE
// ============================================================
function toggleFindBar() {
    const bar = document.querySelector('.find-bar');
    if (bar) {
        const isHidden = bar.style.display === 'none' || bar.style.display === '';
        bar.style.display = isHidden ? 'flex' : 'none';
        if (isHidden) {
            document.getElementById('findInput').focus();
        }
    }
}

function performFind() {
    const input = document.getElementById('findInput');
    const query = input.value.trim();
    if (!query) {
        clearHighlights();
        document.getElementById('findCount').textContent = '0/0';
        return;
    }
    findMatches = [];
    const contentEditable = document.querySelectorAll('.editable-line');
    window.getSelection().removeAllRanges();
    const found = window.find(query);
    if (found) {
        let count = 0;
        const text = document.querySelector('#live-ledger-output').innerText;
        const regex = new RegExp(escapeRegex(query), 'gi');
        const matches = text.match(regex);
        count = matches ? matches.length : 0;
        findMatches = [{ start: 0, end: 0 }];
        findCurrentIndex = 1;
        document.getElementById('findCount').textContent = `${1}/${count}`;
        window.find(query);
        const sel = window.getSelection();
        if (sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            range.startContainer.parentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    } else {
        document.getElementById('findCount').textContent = '0/0';
    }
}

function findNext() {
    const query = document.getElementById('findInput').value.trim();
    if (!query) return;
    window.find(query, false, false, true);
    const sel = window.getSelection();
    if (sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        range.startContainer.parentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function findPrev() {
    const query = document.getElementById('findInput').value.trim();
    if (!query) return;
    window.find(query, false, true, true);
    const sel = window.getSelection();
    if (sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        range.startContainer.parentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function clearHighlights() {
    window.getSelection().removeAllRanges();
    document.getElementById('findCount').textContent = '0/0';
    document.getElementById('findInput').value = '';
}

document.addEventListener('DOMContentLoaded', function() {
    const findInput = document.getElementById('findInput');
    if (findInput) {
        findInput.addEventListener('input', performFind);
        findInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                findNext();
            }
        });
    }
    const prevBtn = document.getElementById('findPrev');
    const nextBtn = document.getElementById('findNext');
    const closeBtn = document.getElementById('findClose');
    if (prevBtn) prevBtn.addEventListener('click', findPrev);
    if (nextBtn) nextBtn.addEventListener('click', findNext);
    if (closeBtn) closeBtn.addEventListener('click', function() {
        const bar = document.querySelector('.find-bar');
        if (bar) bar.style.display = 'none';
        clearHighlights();
    });
});

// ============================================================
// PAGE TEMPLATES
// ============================================================
const TEMPLATES = {
    'Lecture Notes': [
        { type: 'h1', content: 'Lecture Notes' },
        { type: 'bullet', content: 'Introduction' },
        { type: 'bullet', content: 'Key concepts' },
        { type: 'bullet', content: 'Summary' },
        { type: 'quote', content: 'Important quote from lecture' }
    ],
    'Code Snippet Collection': [
        { type: 'h1', content: 'Code Snippets' },
        { type: 'code', content: 'function hello() { console.log("Hello"); }', language: 'JavaScript' },
        { type: 'code', content: 'print("Hello")', language: 'Python' },
        { type: 'bullet', content: 'More snippets...' }
    ],
    'To-Do List': [
        { type: 'h1', content: 'To-Do List' },
        { type: 'bullet', content: 'Task 1' },
        { type: 'bullet', content: 'Task 2' },
        { type: 'bullet', content: 'Task 3' }
    ]
};

function applyTemplate(templateName) {
    const page = hubState.pages[hubState.activePageId];
    if (!page) return;
    const blocks = TEMPLATES[templateName];
    if (!blocks) return;
    page.blocks = blocks.map(b => {
        const block = { ...b };
        if (block.type === 'code') {
            block.language = block.language || 'Text';
        }
        if (block.type === 'toggle') block.expanded = true;
        return block;
    });
    saveHubState();
    renderCurriculumLedger();
    showToast(`✅ Template "${templateName}" applied`, 'success');
}

// ============================================================
// RENDER CURRICULUM LEDGER (with escapeHtml)
// ============================================================
function renderCurriculumLedger() {
    const output = document.getElementById("live-ledger-output");
    const headline = document.getElementById("active-page-headline");
    if (!output) return;
    output.innerHTML = "";

    const page = hubState.pages[hubState.activePageId];
    if (!page) {
        if (headline) headline.textContent = "Select a page from the tree view to open a workspace";
        output.innerHTML = `<div style="color:#475569;padding:16px;text-align:center;font-style:italic;">👈 Click a page in the Lesson Menu to start editing.</div>`;
        return;
    }
    if (headline) headline.textContent = escapeHtml(page.title);

    if (!page.blocks.length) {
        const grid = document.createElement('div');
        grid.className = 'empty-state-grid';
        grid.innerHTML = `
            <div class="empty-state-title">Start writing</div>
            <div class="empty-state-subtitle">Click a block type below or press <kbd>/</kbd> to open commands</div>
            <div class="empty-state-options" style="margin-bottom:16px;">
                <div class="empty-option" data-type="h1">Heading 1</div>
                <div class="empty-option" data-type="h2">Heading 2</div>
                <div class="empty-option" data-type="h3">Heading 3</div>
                <div class="empty-option" data-type="bullet">Bullet list</div>
                <div class="empty-option" data-type="quote">Quote</div>
                <div class="empty-option" data-type="code">Code</div>
                <div class="empty-option" data-type="callout">Callout</div>
                <div class="empty-option" data-type="toggle">Toggle</div>
                <div class="empty-option" data-type="divider">Divider</div>
                <div class="empty-option" data-type="embed">Embed</div>
            </div>
            <div style="border-top:1px solid var(--border-color); padding-top:16px; margin-top:8px;">
                <div class="empty-state-subtitle" style="margin-bottom:12px;">📋 Templates</div>
                <div style="display:flex; flex-wrap:wrap; gap:10px; justify-content:center;">
                    ${Object.keys(TEMPLATES).map(name => `
                        <div class="empty-option" onclick="applyTemplate('${name}')" style="background:rgba(124,109,240,0.08); border-color:rgba(124,109,240,0.3);">${escapeHtml(name)}</div>
                    `).join('')}
                </div>
            </div>
        `;
        grid.querySelectorAll('.empty-option[data-type]').forEach(el => {
            el.addEventListener('click', function() {
                const type = this.dataset.type;
                const newBlock = { time: '', content: '', type: type };
                if (type === 'toggle') newBlock.expanded = true;
                if (type === 'code') {
                    showLanguagePicker(null).then(lang => {
                        if (lang) {
                            newBlock.language = lang;
                            page.blocks.push(newBlock);
                            saveHubState();
                            renderCurriculumLedger();
                            showToast(`Code block (${lang}) created`, 'info');
                        }
                    });
                } else {
                    page.blocks.push(newBlock);
                    saveHubState();
                    renderCurriculumLedger();
                    showToast('Block created', 'info');
                }
            });
        });
        output.appendChild(grid);
        return;
    }

    page.blocks.forEach((block, idx) => {
        const row = document.createElement("div");
        row.className = "notion-row-node";
        row.dataset.index = idx;
        row.draggable = true;

        if (block.type) {
            row.dataset.type = block.type;
        }
        if (block.textColor) {
            row.style.color = block.textColor;
        }
        if (block.bgColor) {
            row.style.backgroundColor = block.bgColor;
        }

        const iconMap = {
            'h1': '#',
            'h2': '##',
            'h3': '###',
            'bullet': '•',
            'quote': '“',
            'code': '{ }',
            'callout': '💡',
            'toggle': '▸',
            'divider': '—',
            'embed': '🔗'
        };
        const iconSpan = document.createElement('span');
        iconSpan.className = 'block-icon';
        iconSpan.textContent = iconMap[block.type] || '•';
        iconSpan.style.cssText = 'flex-shrink:0; width:24px; font-size:0.85rem; color:var(--text-muted); opacity:0.5; margin-top:2px; text-align:center;';
        row.appendChild(iconSpan);

        const handle = document.createElement('div');
        handle.className = 'block-drag-handle';
        handle.innerHTML = '⠿';
        handle.title = 'Drag or click for menu';
        handle.addEventListener('mousedown', function(e) {
            e.stopPropagation();
            showBlockContextMenu(e, idx, hubState.activePageId, true);
        });
        handle.draggable = false;
        row.appendChild(handle);

        row.addEventListener('contextmenu', (e) => {
            showBlockContextMenu(e, idx, hubState.activePageId);
        });

        row.addEventListener('dragstart', handleBlockDragStart);
        row.addEventListener('dragover', handleBlockDragOver);
        row.addEventListener('dragleave', handleBlockDragLeave);
        row.addEventListener('drop', handleBlockDrop);
        row.addEventListener('dragend', handleBlockDragEnd);

        if (block.type === 'toggle') {
            const toggleContainer = document.createElement('div');
            toggleContainer.className = 'toggle-container';

            const toggleHeader = document.createElement('div');
            toggleHeader.className = 'toggle-header';
            const arrow = document.createElement('span');
            arrow.className = 'toggle-arrow';
            arrow.textContent = block.expanded !== false ? '▾' : '▸';
            arrow.style.marginRight = '6px';
            arrow.style.cursor = 'pointer';
            arrow.addEventListener('click', function(e) {
                e.stopPropagation();
                block.expanded = !block.expanded;
                saveHubState();
                renderCurriculumLedger();
            });

            const toggleContentEditable = document.createElement('div');
            toggleContentEditable.className = 'editable-line toggle-content';
            toggleContentEditable.contentEditable = 'plaintext-only';
            toggleContentEditable.spellcheck = false;
            toggleContentEditable.dataset.index = idx;
            toggleContentEditable.dataset.time = block.time || '';
            toggleContentEditable.dataset.content = block.content || '';
            toggleContentEditable.textContent = block.content || 'Toggle...';

            toggleContentEditable.addEventListener('input', function(e) {
                const raw = this.innerText.trim();
                const index = Number(this.dataset.index);
                const page = hubState.pages[hubState.activePageId];
                if (!page) return;
                if (page.blocks[index]) {
                    page.blocks[index].content = raw;
                    this.dataset.content = raw;
                    saveHubState();
                }
            });

            toggleContentEditable.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    const index = Number(this.dataset.index);
                    const page = hubState.pages[hubState.activePageId];
                    if (page) {
                        page.blocks.splice(index + 1, 0, { time: '', content: '', type: 'bullet' });
                        saveHubState();
                        renderCurriculumLedger();
                    }
                }
            });

            toggleHeader.appendChild(arrow);
            toggleHeader.appendChild(toggleContentEditable);
            toggleContainer.appendChild(toggleHeader);

            row.appendChild(toggleContainer);
            output.appendChild(row);
            return;
        }

        if (block.type === 'divider') {
            const hr = document.createElement('hr');
            hr.className = 'block-divider';
            row.appendChild(hr);
            output.appendChild(row);
            return;
        }

        if (block.type === 'code' && block.language) {
            const langDisplay = document.createElement('div');
            langDisplay.className = 'code-lang-label';
            langDisplay.textContent = escapeHtml(block.language);

            const pre = document.createElement('pre');
            pre.className = 'code-block';
            const code = document.createElement('code');
            code.className = `language-${block.language.toLowerCase()}`;
            code.textContent = block.content || '';

            pre.appendChild(code);
            const codeContainer = document.createElement('div');
            codeContainer.className = 'code-container';
            codeContainer.appendChild(langDisplay);
            codeContainer.appendChild(pre);
            row.appendChild(codeContainer);
            output.appendChild(row);

            setTimeout(() => {
                if (window.Prism) {
                    Prism.highlightElement(code);
                }
            }, 20);
            return;
        }

        if (block.type === 'embed' && block.embed) {
            let embedHtml = '';
            const url = block.embed;
            if (url.includes('youtube.com/watch') || url.includes('youtu.be/')) {
                let videoId = url.split('v=')[1];
                if (!videoId) {
                    const parts = url.split('/');
                    videoId = parts[parts.length - 1].split('?')[0];
                }
                if (videoId) {
                    embedHtml = `<div class="embed-container"><iframe src="https://www.youtube.com/embed/${videoId}" allowfullscreen></iframe></div>`;
                }
            } else if (url.includes('vimeo.com')) {
                const videoId = url.split('/').pop().split('?')[0];
                embedHtml = `<div class="embed-container"><iframe src="https://player.vimeo.com/video/${videoId}" allowfullscreen></iframe></div>`;
            } else {
                embedHtml = `<div class="embed-container"><iframe src="${escapeHtml(url)}" allowfullscreen></iframe></div>`;
            }
            row.innerHTML = embedHtml;
            output.appendChild(row);
            return;
        }

        const lineDiv = document.createElement('div');
        lineDiv.className = 'editable-line';
        lineDiv.contentEditable = 'plaintext-only';
        lineDiv.spellcheck = false;
        lineDiv.dataset.index = idx;
        lineDiv.dataset.time = block.time || '';
        lineDiv.dataset.content = block.content || '';

        let displayContent = escapeHtml(block.content || '');
        if (currentSearchQuery) {
            displayContent = highlightMatch(displayContent, currentSearchQuery);
        }
        // Wiki links
        displayContent = displayContent.replace(/\[\[(.*?)\]\]/g, (match, pageTitle) => {
            let targetPageId = null;
            for (const pid in hubState.pages) {
                const p = hubState.pages[pid];
                if (p && p.title.toLowerCase() === pageTitle.trim().toLowerCase()) {
                    targetPageId = pid;
                    break;
                }
            }
            if (targetPageId) {
                return `<a href="#" class="wiki-link" data-page-id="${targetPageId}" onclick="openWikiLink(event, '${targetPageId}')" style="color: #38bdf8; text-decoration: underline; cursor: pointer;">${escapeHtml(pageTitle)}</a>`;
            } else {
                return `<span class="wiki-link-broken" style="color: #ef4444; font-style: italic;">${escapeHtml(pageTitle)}</span>`;
            }
        });

        lineDiv.innerHTML = displayContent;

        lineDiv.addEventListener('input', function(e) {
            const raw = this.innerText.trim();
            const index = Number(this.dataset.index);
            const page = hubState.pages[hubState.activePageId];
            if (!page) return;
            if (page.blocks[index]) {
                page.blocks[index].content = raw;
                this.dataset.content = raw;
                saveHubState();
            }
        });

        lineDiv.addEventListener('input', function(e) {
            const text = this.innerText;
            if (text === '/') {
                handleSlashCommand(e, this);
            }
        });

        lineDiv.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const index = Number(this.dataset.index);
                const page = hubState.pages[hubState.activePageId];
                if (page) {
                    // Add new block to data
                    page.blocks.splice(index + 1, 0, { time: '', content: '', type: 'bullet' });
                    saveHubState();
                    // Optimized: Only re-render once after adding block
                    renderCurriculumLedger();
                    // Focus the new block
                    setTimeout(() => {
                        const newBlock = document.querySelector(`.notion-row-node[data-index="${index + 1}"] .editable-line`);
                        if (newBlock) newBlock.focus();
                    }, 50);
                }
            }
            if (e.key === 'Backspace' && this.innerText.trim() === '') {
                e.preventDefault();
                const index = Number(this.dataset.index);
                const page = hubState.pages[hubState.activePageId];
                if (page && page.blocks.length > 1) {
                    // Remove block from data
                    page.blocks.splice(index, 1);
                    saveHubState();
                    // Optimized: Only re-render once after deleting block
                    renderCurriculumLedger();
                    // Focus previous block
                    setTimeout(() => {
                        const prevIndex = Math.max(0, index - 1);
                        const prevBlock = document.querySelector(`.notion-row-node[data-index="${prevIndex}"] .editable-line`);
                        if (prevBlock) {
                            prevBlock.focus();
                            // Move cursor to end
                            const range = document.createRange();
                            const sel = window.getSelection();
                            range.selectNodeContents(prevBlock);
                            range.collapse(false);
                            sel.removeAllRanges();
                            sel.addRange(range);
                        }
                    }, 50);
                }
            }
        });

        lineDiv.addEventListener('blur', function() {
            setTimeout(() => {
                renderCurriculumLedger();
            }, 100);
        });

        row.appendChild(lineDiv);
        output.appendChild(row);
    });

    setTimeout(() => {
        if (window.Prism) {
            document.querySelectorAll('.code-block code').forEach(el => {
                try {
                    Prism.highlightElement(el);
                } catch (_) {}
            });
        }
    }, 50);
}

function highlightSearchResultsInLedger() {
    if (!currentSearchQuery) return;
    renderCurriculumLedger();
}

// ============================================================
// MARKDOWN EXPORT
// ============================================================
function exportPageAsMarkdown() {
    const page = hubState.pages[hubState.activePageId];
    if (!page) {
        showToast('⚠️ Select a page first.', 'warning');
        return;
    }
    let md = `# ${page.title}\n\n`;
    page.blocks.forEach(b => {
        if (b.type === 'code' && b.language) {
            md += '```' + b.language.toLowerCase() + '\n' + (b.content || '') + '\n```\n\n';
        } else if (b.type === 'toggle') {
            md += `▸ ${b.content || ''}\n\n`;
        } else if (b.type === 'divider') {
            md += '---\n\n';
        } else {
            if (b.time) md += `**${b.time}**  \n`;
            md += `${b.content || ''}\n\n`;
        }
    });
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${page.title.replace(/\s+/g, '_')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('✅ Markdown exported!', 'success');
}

// ============================================================
// HTML EXPORT
// ============================================================
function exportPageAsHTML() {
    const page = hubState.pages[hubState.activePageId];
    if (!page) {
        showToast('⚠️ Select a page first.', 'warning');
        return;
    }

    // Build block content
    let blocksHtml = '';
    page.blocks.forEach(b => {
        const content = escapeHtml(b.content || '');
        switch (b.type) {
            case 'h1':
                blocksHtml += `<h1>${content}</h1>`;
                break;
            case 'h2':
                blocksHtml += `<h2>${content}</h2>`;
                break;
            case 'h3':
                blocksHtml += `<h3>${content}</h3>`;
                break;
            case 'bullet':
                blocksHtml += `<li>${content}</li>`;
                break;
            case 'quote':
                blocksHtml += `<blockquote>${content}</blockquote>`;
                break;
            case 'code':
                const lang = b.language || 'text';
                blocksHtml += `<pre><code class="language-${lang}">${content}</code></pre>`;
                break;
            case 'callout':
                blocksHtml += `<div class="callout">💡 ${content}</div>`;
                break;
            case 'toggle':
                blocksHtml += `<details><summary>${content}</summary></details>`;
                break;
            case 'divider':
                blocksHtml += `<hr>`;
                break;
            default:
                blocksHtml += `<p>${content}</p>`;
        }
    });

    // Build the full HTML document
    const title = escapeHtml(page.title);
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} – Workspace Hub</title>
    <style>
        /* ── Reset & Base ── */
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f8fafc;
            color: #1e293b;
            padding: 40px 20px;
            max-width: 800px;
            margin: 0 auto;
            line-height: 1.7;
        }
        .page-title {
            font-size: 2.2rem;
            font-weight: 700;
            margin-bottom: 28px;
            padding-bottom: 12px;
            border-bottom: 2px solid #e2e8f0;
            color: #0f172a;
        }
        h1 { font-size: 1.8rem; margin: 24px 0 12px; color: #0f172a; }
        h2 { font-size: 1.4rem; margin: 20px 0 10px; color: #1e293b; }
        h3 { font-size: 1.2rem; margin: 16px 0 8px; color: #334155; }
        p { margin: 8px 0; }
        ul { padding-left: 24px; margin: 8px 0; }
        li { margin: 4px 0; }
        blockquote {
            border-left: 4px solid #7c6df0;
            padding-left: 16px;
            margin: 12px 0;
            color: #475569;
            font-style: italic;
        }
        pre {
            background: #1e293b;
            color: #e2e8f0;
            padding: 16px;
            border-radius: 8px;
            overflow-x: auto;
            font-family: 'SF Mono', 'Fira Code', monospace;
            font-size: 0.9rem;
            margin: 12px 0;
        }
        code { font-family: 'SF Mono', 'Fira Code', monospace; }
        hr { border: none; border-top: 1px solid #e2e8f0; margin: 24px 0; }
        .callout {
            background: #f1f5f9;
            padding: 12px 16px;
            border-radius: 8px;
            border-left: 4px solid #7c6df0;
            margin: 12px 0;
        }
        details {
            background: #f8fafc;
            padding: 10px 14px;
            border-radius: 6px;
            border: 1px solid #e2e8f0;
            margin: 8px 0;
        }
        summary { font-weight: 600; cursor: pointer; }
        .footer {
            margin-top: 40px;
            padding-top: 16px;
            border-top: 1px solid #e2e8f0;
            font-size: 0.75rem;
            color: #94a3b8;
            text-align: center;
        }
        @media print {
            body { padding: 20px; }
            pre { background: #f1f5f9 !important; color: #1e293b !important; }
            .footer { display: none; }
        }
    </style>
</head>
<body>
    <div class="page-title">${title}</div>
    ${blocksHtml}
    <div class="footer">Exported from Workspace Hub • ${new Date().toLocaleString()}</div>
</body>
</html>`;

    // Download
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/\s+/g, '_')}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('✅ HTML exported!', 'success');
}

// ============================================================
// ADD NEW BLOCK
// ============================================================
function addNewBlockToPage() {
    const page = hubState.pages[hubState.activePageId];
    if (!page) {
        showToast('⚠️ Select a page first.', 'warning');
        return;
    }
    page.blocks.push({ time: "", content: "", type: "bullet" });
    saveHubState();
    renderCurriculumLedger();
    setTimeout(() => {
        const last = document.querySelector('#live-ledger-output .notion-row-node:last-child .editable-line');
        if (last) last.focus();
    }, 50);
    showToast('➕ New block added!', 'info');
}

// ============================================================
// DRAG & DROP (block reorder)
// ============================================================
let draggedBlockIndex = null;

function handleBlockDragStart(e) {
    const row = e.target.closest('.notion-row-node');
    if (!row) return;

    draggedBlockIndex = Number(row.dataset.index);
    row.style.opacity = '0.5';
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggedBlockIndex);
}

function handleBlockDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const row = e.target.closest('.notion-row-node');
    if (!row) return;

    row.style.background = 'var(--bg-hover)';
}

function handleBlockDragLeave(e) {
    const row = e.target.closest('.notion-row-node');
    if (row) {
        row.style.background = '';
    }
}

function handleBlockDrop(e) {
    e.preventDefault();

    const row = e.target.closest('.notion-row-node');
    if (!row || draggedBlockIndex === null) return;

    const targetIndex = Number(row.dataset.index);
    if (targetIndex === draggedBlockIndex) return;

    const page = hubState.pages[hubState.activePageId];
    if (!page) return;

    const blocks = page.blocks;
    const draggedBlock = blocks[draggedBlockIndex];

    blocks.splice(draggedBlockIndex, 1);
    blocks.splice(targetIndex, 0, draggedBlock);

    saveHubState();
    renderCurriculumLedger();

    showToast('Block reordered', 'info');
}

function handleBlockDragEnd(e) {
    const row = e.target.closest('.notion-row-node');
    if (row) {
        row.style.opacity = '1';
        row.style.background = '';
    }
    draggedBlockIndex = null;
}

// ============================================================
// SIDEBAR TOGGLE
// ============================================================
function toggleSidebar() {
    console.log('🔘 toggleSidebar triggered');
    const sidebar = document.getElementById('app-sidebar');
    const btn = document.getElementById('toggle-creator-btn');

    if (!sidebar) {
        showToast('Sidebar not found.', 'error');
        return;
    }

    sidebar.classList.toggle('collapsed');

    const isCollapsed = sidebar.classList.contains('collapsed');
    if (btn) {
        btn.textContent = isCollapsed ? '▣ Show Lesson Menu' : '▢ Hide Lesson Menu';
    }

    try {
        localStorage.setItem('sidebarCollapsed', isCollapsed ? 'true' : 'false');
    } catch (_) {}
}

function restoreSidebarState() {
    const sidebar = document.getElementById('app-sidebar');
    const btn = document.getElementById('toggle-creator-btn');
    if (!sidebar) return;

    try {
        const wasCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
        if (wasCollapsed) {
            sidebar.classList.add('collapsed');
            if (btn) btn.textContent = '▣ Show Lesson Menu';
        } else {
            sidebar.classList.remove('collapsed');
            if (btn) btn.textContent = '▢ Hide Lesson Menu';
        }
    } catch (_) {
        sidebar.classList.remove('collapsed');
        if (btn) btn.textContent = '▢ Hide Lesson Menu';
    }
}

// ============================================================
// EXPLORER DROPDOWN
// ============================================================
function toggleExplorerDropdown(e) {
    e.stopPropagation();
    const menu = document.getElementById('explorerDropdownMenu');
    const btn = document.getElementById('explorerDropdownBtn');
    if (!menu || !btn) return;

    const isOpen = menu.style.display === 'block';
    menu.style.display = isOpen ? 'none' : 'block';

    if (!isOpen) {
        const rect = btn.getBoundingClientRect();
        menu.style.position = 'fixed';
        menu.style.top = (rect.bottom + 4) + 'px';
        menu.style.right = (window.innerWidth - rect.right) + 'px';

        const menuHeight = 80;
        if (rect.bottom + menuHeight > window.innerHeight) {
            menu.style.top = (rect.top - menuHeight) + 'px';
        }
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const menu = document.getElementById('explorerDropdownMenu');
    if (menu) {
        menu.addEventListener('click', async function(e) {
            const item = e.target.closest('.menu-item');
            if (!item) return;
            const action = item.dataset.action;
            menu.style.display = 'none';

            if (action === 'folder') {
                const result = await showCustomModal({
                    title: 'Create Folder',
                    description: 'Enter a name for the new folder:',
                    placeholder: 'Folder name...',
                    confirmText: 'Create'
                });
                if (result && result.value) {
                    const name = result.value;
                    const id = `folder_${Date.now()}`;
                    hubState.folders[id] = { id, title: name.trim(), icon: '📁', children: [] };
                    hubState.rootFolderIds.push(id);
                    refreshWorkspace();
                    showToast(`✅ Folder "${escapeHtml(name.trim())}" created!`, 'success');
                }
            } else if (action === 'page') {
                if (hubState.rootFolderIds.length === 0) {
                    showToast('Create a folder first!', 'warning');
                    return;
                }
                const allFolders = Object.values(hubState.folders);
                const folderOptions = allFolders.map((f, i) => ({ value: f.id, label: f.title }));
                const result = await showCustomModal({
                    title: 'Create Page',
                    description: 'Select a folder and enter a page title:',
                    placeholder: 'Page title...',
                    confirmText: 'Create',
                    selectOptions: folderOptions
                });
                if (result && result.value) {
                    const folderId = result.selected;
                    const folder = hubState.folders[folderId];
                    if (!folder) { showToast('Folder not found.', 'error'); return; }
                    const title = result.value;
                    const pid = `page_${Date.now()}`;
                    const pageId = pid.replace('page_', '');
                    hubState.pages[pageId] = { title: title.trim(), blocks: [] };
                    folder.children.push(pid);
                    hubState.activePageId = pageId;
                    refreshWorkspace();
                    showToast(`✅ Page "${escapeHtml(title.trim())}" created!`, 'success');
                }
            }
        });
    }

    document.addEventListener('click', function(e) {
        const menu = document.getElementById('explorerDropdownMenu');
        if (menu) {
            const btn = document.getElementById('explorerDropdownBtn');
            if (!menu.contains(e.target) && !btn.contains(e.target)) {
                menu.style.display = 'none';
            }
        }
    });
});

window.showExplorerMenu = function() {
    const btn = document.getElementById('explorerDropdownBtn');
    if (btn) btn.click();
};

// ============================================================
// WIKI LINKS
// ============================================================
function openWikiLink(event, pageId) {
    event.preventDefault();
    event.stopPropagation();

    const searchInput = document.getElementById("lessonSearchInput");
    const resultsContainer = document.getElementById("lessonSearchResults");
    const treeContainer = document.getElementById("dynamic-lesson-tree");

    if (searchInput) searchInput.value = '';
    if (resultsContainer) {
        resultsContainer.style.display = 'none';
        resultsContainer.innerHTML = '';
    }
    if (treeContainer) {
        treeContainer.style.display = '';
    }

    hubState.activePageId = pageId;
    currentSearchQuery = '';
    refreshWorkspace();

    const sidebar = document.getElementById('app-sidebar');
    if (sidebar) sidebar.classList.remove('mobile-open', 'open');

    showToast('📄 Opening linked page...', 'info');
}

// ============================================================
// CLEAR SEARCH
// ============================================================
function clearSearch() {
    const input = document.getElementById('lessonSearchInput');
    if (input) {
        input.value = '';
        searchLessons('');
        const clearBtn = document.querySelector('.search-clear');
        if (clearBtn) clearBtn.style.display = 'none';
    }
}

// ============================================================
// URL PARAMETER HANDLING
// ============================================================
function handleUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const pageId = params.get('page');
    const blockIndex = params.get('block');
    if (pageId && hubState.pages[pageId]) {
        hubState.activePageId = pageId;
        refreshWorkspace();
        if (typeof switchView === 'function') {
            switchView('lessons-view');
        }
        if (blockIndex !== null) {
            setTimeout(() => {
                const blockEl = document.querySelector(`.notion-row-node[data-index="${blockIndex}"]`);
                if (blockEl) {
                    blockEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    blockEl.style.border = '2px solid var(--accent-1)';
                    setTimeout(() => {
                        blockEl.style.border = '';
                    }, 2000);
                }
            }, 500);
        }
    }
}

// ============================================================
// LANGUAGE DETECTION (unchanged)
// ============================================================
function detectLanguage(code) {
    // ... (same as original, no XSS risk)
    if (!code) return 'Text';
    const patterns = [
        { lang: 'JavaScript', regex: /\b(function|const|let|var|=>|console\.log|export|import|class\s+\w+\s+extends)\b/ },
        { lang: 'Python', regex: /\b(def\s+\w+|import\s+\w+|from\s+\w+\s+import|print\(|class\s+\w+:|if\s+__name__)\b/ },
        { lang: 'C++', regex: /\b(#include\s*<|using namespace std|int main\(|std::|cout\s*<<|cin\s*>>)\b/ },
        { lang: 'Java', regex: /\b(public\s+class|System\.out\.println|String\[\]|@Override|import\s+java\.)\b/ },
        { lang: 'C#', regex: /\b(using\s+System|namespace\s+\w+|class\s+\w+\s*{|Console\.WriteLine)\b/ },
        { lang: 'HTML', regex: /<\/?[a-z][\s\S]*>/i },
        { lang: 'CSS', regex: /[{}:;]\s*[a-z-]+\s*:\s*[^;]+;/ },
        { lang: 'PHP', regex: /<\?php|\$[a-zA-Z_]\w*|echo\s+|function\s+\w+\s*\(/ },
        { lang: 'Ruby', regex: /\b(def\s+\w+|class\s+\w+|require\s+['"]|puts\s+)/ },
        { lang: 'Go', regex: /\b(func\s+\w+|package\s+\w+|import\s+\(|fmt\.Println)\b/ },
        { lang: 'Rust', regex: /\b(fn\s+\w+|let\s+mut|println!|use\s+\w+::)\b/ },
        { lang: 'SQL', regex: /\b(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|JOIN|GROUP BY)\b/i },
        { lang: 'JSON', regex: /^\{[\s\S]*\}$|^\[[\s\S]*\]$/ },
        { lang: 'YAML', regex: /^[a-z_-]+:\s*[^\s]+/mi },
        { lang: 'Markdown', regex: /^#{1,6}\s+\w+|^[-*]\s+/m },
        { lang: 'Shell', regex: /^#!\/bin\/bash|^echo\s+|^export\s+|^[a-z]+=\w+/m },
    ];
    for (const p of patterns) {
        if (p.regex.test(code)) return p.lang;
    }
    return 'Text';
}

// ============================================================
// MODALS (custom, color, language)
// ============================================================

let modalResolve = null;

function showCustomModal(options) {
    return new Promise((resolve) => {
        const modal = document.getElementById('customModal');
        const title = document.getElementById('customModalTitle');
        const desc = document.getElementById('customModalDesc');
        const input = document.getElementById('customModalInput');
        const select = document.getElementById('customModalSelect');
        const selectContainer = document.getElementById('customModalSelectContainer');
        const confirmBtn = document.getElementById('customModalConfirm');
        const cancelBtn = document.getElementById('customModalCancel');

        title.textContent = options.title || 'Create';
        desc.textContent = options.description || '';
        input.placeholder = options.placeholder || 'Enter name...';
        input.value = options.defaultValue || '';
        confirmBtn.textContent = options.confirmText || 'Create';
        confirmBtn.style.background = options.confirmColor || 'var(--accent-gradient)';

        if (options.selectOptions && options.selectOptions.length) {
            selectContainer.style.display = 'block';
            select.innerHTML = options.selectOptions.map(opt =>
                `<option value="${opt.value}">${opt.label}</option>`
            ).join('');
        } else {
            selectContainer.style.display = 'none';
        }

        setTimeout(() => input.focus(), 50);

        modalResolve = (value) => {
            modal.style.display = 'none';
            resolve(value);
        };

        const onConfirm = () => {
            const val = input.value.trim();
            if (!val) {
                input.style.borderColor = '#ef4444';
                input.style.boxShadow = '0 0 0 3px rgba(239,68,68,0.2)';
                setTimeout(() => {
                    input.style.borderColor = '';
                    input.style.boxShadow = '';
                }, 800);
                return;
            }
            const selectedValue = selectContainer.style.display !== 'none' ? select.value : null;
            modalResolve({ value: val, selected: selectedValue });
        };

        const onCancel = () => modalResolve(null);

        confirmBtn.onclick = onConfirm;
        cancelBtn.onclick = onCancel;
        input.onkeydown = (e) => { if (e.key === 'Enter') onConfirm(); };
        input.onkeyup = () => { input.style.borderColor = ''; input.style.boxShadow = ''; };

        modal.onclick = (e) => { if (e.target === modal) onCancel(); };

        modal.style.display = 'flex';
    });
}

function showCustomConfirm(message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('customModal');
        const title = document.getElementById('customModalTitle');
        const desc = document.getElementById('customModalDesc');
        const input = document.getElementById('customModalInput');
        const selectContainer = document.getElementById('customModalSelectContainer');
        const confirmBtn = document.getElementById('customModalConfirm');
        const cancelBtn = document.getElementById('customModalCancel');

        title.textContent = 'Confirm';
        desc.textContent = message;
        input.style.display = 'none';
        selectContainer.style.display = 'none';
        confirmBtn.textContent = 'Yes';
        confirmBtn.style.background = '#ef4444';

        modalResolve = (result) => {
            modal.style.display = 'none';
            input.style.display = '';
            resolve(result);
        };

        confirmBtn.onclick = () => modalResolve(true);
        cancelBtn.onclick = () => modalResolve(false);
        modal.onclick = (e) => { if (e.target === modal) modalResolve(false); };

        modal.style.display = 'flex';
    });
}

function showColorPicker() {
    return new Promise((resolve) => {
        const modal = document.getElementById('colorPickerModal');
        const colorInput = document.getElementById('colorPickerInput');
        const bgCheckbox = document.getElementById('colorPickerBackground');
        const confirmBtn = document.getElementById('colorPickerConfirm');
        const cancelBtn = document.getElementById('colorPickerCancel');

        colorInput.value = '#7c6df0';
        bgCheckbox.checked = false;
        modal.style.display = 'flex';

        const cleanup = () => { modal.style.display = 'none'; };

        confirmBtn.onclick = () => {
            const color = colorInput.value;
            const isBg = bgCheckbox.checked;
            cleanup();
            resolve({ color, isBg });
        };

        cancelBtn.onclick = () => {
            cleanup();
            resolve(null);
        };

        modal.onclick = (e) => {
            if (e.target === modal) {
                cleanup();
                resolve(null);
            }
        };

        colorInput.onkeydown = (e) => {
            if (e.key === 'Enter') confirmBtn.click();
        };
    });
}

const LANGUAGES = [
    'JavaScript', 'TypeScript', 'Python', 'C++', 'C#', 'C',
    'HTML', 'CSS', 'PHP', 'Java', 'Ruby', 'Go',
    'Rust', 'Swift', 'Kotlin', 'Dart', 'Shell', 'SQL',
    'JSON', 'YAML', 'Markdown', 'Text'
];

function showLanguagePicker(detectedLang) {
    return new Promise((resolve) => {
        const modal = document.getElementById('languagePickerModal');
        const grid = document.getElementById('languagePickerGrid');
        const cancelBtn = document.getElementById('languagePickerCancel');

        let html = LANGUAGES.map(lang => {
            const selected = (detectedLang && lang.toLowerCase() === detectedLang.toLowerCase()) ? 'border-color:var(--accent-1);background:rgba(124,109,240,0.1);' : '';
            return `<div class="lang-option" data-lang="${lang}" style="padding:8px 12px; background:var(--bg-primary); border:1px solid ${selected ? 'var(--accent-1)' : 'var(--border-color)'}; border-radius:var(--radius-sm); cursor:pointer; text-align:center; font-size:0.85rem; transition:var(--transition); ${selected}"
                onmouseover="this.style.borderColor='var(--accent-1)';this.style.background='rgba(124,109,240,0.05)'"
                onmouseout="this.style.borderColor='${selected ? 'var(--accent-1)' : 'var(--border-color)'}';this.style.background='${selected ? 'rgba(124,109,240,0.1)' : 'var(--bg-primary)'}'">${lang}</div>`;
        }).join('');
        grid.innerHTML = html;

        modal.style.display = 'flex';

        const cleanup = () => { modal.style.display = 'none'; };

        grid.querySelectorAll('.lang-option').forEach(el => {
            el.addEventListener('click', () => {
                const lang = el.dataset.lang;
                cleanup();
                resolve(lang);
            });
        });

        cancelBtn.onclick = () => {
            cleanup();
            resolve(null);
        };

        modal.onclick = (e) => {
            if (e.target === modal) {
                cleanup();
                resolve(null);
            }
        };
    });
}

// ============================================================
// INIT ON LOAD
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('📚 Initializing Lessons module...');
    refreshWorkspace();
    restoreSidebarState();
    handleUrlParams();
    const toggleBtn = document.getElementById('toggleFindBtn');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', toggleFindBar);
    }
    const findBar = document.querySelector('.find-bar');
    if (findBar) findBar.style.display = 'none';
});

// ============================================================
// EXPORT DROPDOWN TOGGLE
// ============================================================
function toggleExportOptions() {
    const panel = document.getElementById('exportOptions');
    if (!panel) return;
    const isOpen = panel.style.display === 'block';
    panel.style.display = isOpen ? 'none' : 'block';
    const btn = document.querySelector('.export-toggle');
    if (btn) {
        btn.textContent = isOpen ? '📤 Export / Print ▾' : '📤 Export / Print ▴';
    }
}

// Close dropdown when clicking outside
document.addEventListener('click', function(e) {
    const dropdown = document.querySelector('.export-dropdown');
    if (!dropdown) return;
    if (!dropdown.contains(e.target)) {
        const panel = document.getElementById('exportOptions');
        if (panel) panel.style.display = 'none';
        const btn = document.querySelector('.export-toggle');
        if (btn) btn.textContent = '📤 Export / Print ▾';
    }
});

// ============================================================
// EXPOSE GLOBALLY
// ============================================================
window.refreshWorkspace = refreshWorkspace;
window.exportBackup = exportBackup;
window.importBackup = importBackup;
window.exportPageAsMarkdown = exportPageAsMarkdown;
window.toggleExplorerDropdown = toggleExplorerDropdown;
window.showExplorerMenu = showExplorerMenu;
window.applyTemplate = applyTemplate;
window.toggleFindBar = toggleFindBar;
window.addNewBlockToPage = addNewBlockToPage;
window.exportPageAsHTML = exportPageAsHTML;
window.toggleExportOptions = toggleExportOptions;

console.log('📚 lessons.js loaded with backup/restore and XSS fixes.');
