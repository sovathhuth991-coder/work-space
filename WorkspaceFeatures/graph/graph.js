// graph.js - Knowledge Graph renderer

function renderKnowledgeGraph() {
    const container = document.getElementById('graphContainer');
    if (!container) {
        console.warn('Graph container not found');
        return;
    }

    if (typeof cytoscape === 'undefined') {
        console.warn('Cytoscape not loaded yet, retrying...');
        setTimeout(renderKnowledgeGraph, 500);
        return;
    }

    // Destroy existing instance if it exists
    if (container._cy) {
        try {
            container._cy.destroy();
        } catch (e) {
            // Ignore cleanup errors
        }
    }

    // Ensure container has dimensions
    if (container.offsetWidth === 0 || container.offsetHeight === 0) {
        console.warn('Graph container has no dimensions, retrying...');
        setTimeout(renderKnowledgeGraph, 100);
        return;
    }

    // Add graph controls
    if (!document.getElementById('graphControls')) {
        const controls = document.createElement('div');
        controls.id = 'graphControls';
        controls.style.cssText = 'position:absolute;top:16px;right:16px;z-index:10;display:flex;flex-direction:column;gap:8px;';
        controls.innerHTML = `
            <input type="text" id="graphSearch" placeholder="🔍 Search nodes..." style="padding:8px 12px;border-radius:6px;border:1px solid var(--border-color);background:var(--bg-secondary);color:var(--text-primary);font-size:0.85rem;width:180px;outline:none;">
            <div style="display:flex;gap:4px;">
                <button id="graphZoomIn" style="flex:1;padding:8px;border-radius:6px;border:1px solid var(--border-color);background:var(--bg-secondary);color:var(--text-primary);cursor:pointer;font-size:1.2rem;">+</button>
                <button id="graphZoomOut" style="flex:1;padding:8px;border-radius:6px;border:1px solid var(--border-color);background:var(--bg-secondary);color:var(--text-primary);cursor:pointer;font-size:1.2rem;">−</button>
                <button id="graphReset" style="flex:1;padding:8px;border-radius:6px;border:1px solid var(--border-color);background:var(--bg-secondary);color:var(--text-primary);cursor:pointer;font-size:0.8rem;">⟲</button>
            </div>
        `;
        container.parentNode.style.position = 'relative';
        container.parentNode.appendChild(controls);
    }

    const nodes = [];
    const edges = [];

    // Safety check for hubState
    if (!hubState || !hubState.folders) {
        container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted);font-size:1.1rem;">No folders created yet. Start organizing in the Lessons view!</div>`;
        return;
    }

    // Use Object.values(hubState.folders) to iterate
    Object.values(hubState.folders).forEach(folder => {
        nodes.push({
            data: {
                id: folder.id,
                label: folder.title,
                type: 'folder'
            }
        });

        if (folder.children) {
            folder.children.forEach(childId => {
                if (childId.startsWith('page_')) {
                    const pageId = childId.replace('page_', '');
                    const page = hubState.pages[pageId];
                    if (!page) return;

                    nodes.push({
                        data: {
                            id: pageId,
                            label: page.title,
                            type: 'page'
                        }
                    });

                    edges.push({
                        data: {
                            id: `edge-${folder.id}-${pageId}`,
                            source: folder.id,
                            target: pageId
                        }
                    });
                }
            });
        }
    });

    // Add Backlink Edges (scan for [[Page Title]] patterns)
    const backlinkEdges = new Set();

    Object.values(hubState.folders).forEach(folder => {
        if (!folder.children) return;
        folder.children.forEach(childId => {
            if (!childId.startsWith('page_')) return;
            const sourcePageId = childId.replace('page_', '');
            const sourcePage = hubState.pages[sourcePageId];
            if (!sourcePage) return;

            // Scan all blocks in this page for [[...]] references
            sourcePage.blocks.forEach(block => {
                if (!block.content) return;

                const linkPattern = /\[\[(.*?)\]\]/g;
                let match;
                while ((match = linkPattern.exec(block.content)) !== null) {
                    const referencedTitle = match[1].trim();

                    // Find the page with this title
                    let targetPageId = null;
                    Object.values(hubState.folders).forEach(f => {
                        if (!f.children) return;
                        f.children.forEach(cid => {
                            if (!cid.startsWith('page_')) return;
                            const pid = cid.replace('page_', '');
                            const p = hubState.pages[pid];
                            if (p && p.title.toLowerCase() === referencedTitle.toLowerCase()) {
                                targetPageId = pid;
                            }
                        });
                    });

                    if (targetPageId && targetPageId !== sourcePageId) {
                        const edgeId = `backlink-${sourcePageId}-${targetPageId}`;
                        if (!backlinkEdges.has(edgeId)) {
                            backlinkEdges.add(edgeId);
                            edges.push({
                                data: {
                                    id: edgeId,
                                    source: sourcePageId,
                                    target: targetPageId,
                                    type: 'backlink'
                                }
                            });
                        }
                    }
                }
            });
        });
    });

    if (nodes.length === 0) {
        container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted);font-size:1.1rem;">Create some folders and pages in the Lessons view to see your graph!</div>`;
        return;
    }

    const cy = cytoscape({
        container: container,
        elements: { nodes, edges },
        style: [
            {
                selector: 'node',
                style: {
                    'label': 'data(label)',
                    'color': '#ffffff',
                    'text-valign': 'center',
                    'text-halign': 'center',
                    'font-size': '12px',
                    'font-weight': '600',
                    'border-width': 2,
                    'border-color': 'rgba(255,255,255,0.2)'
                }
            },
            {
                selector: 'node[type="folder"]',
                style: {
                    'shape': 'rectangle',
                    'background-color': '#7c6df0'
                }
            },
            {
                selector: 'node[type="page"]',
                style: {
                    'shape': 'ellipse',
                    'background-color': '#38bdf8'
                }
            },
            {
                selector: 'edge',
                style: {
                    'width': 2,
                    'line-color': '#64748b',
                    'curve-style': 'bezier',
                    'target-arrow-color': '#64748b',
                    'target-arrow-shape': 'triangle',
                    'opacity': 0.7
                }
            },
            {
                selector: 'edge[type="backlink"]',
                style: {
                    'width': 2,
                    'line-color': '#a855f7',
                    'curve-style': 'bezier',
                    'target-arrow-color': '#a855f7',
                    'target-arrow-shape': 'triangle',
                    'opacity': 0.6,
                    'line-style': 'dashed'
                }
            }
        ],
        layout: {
            name: 'cose',
            idealEdgeLength: 120,
            nodeOverlap: 20,
            refresh: 20,
            fit: true,
            padding: 30,
            randomize: false,
            componentSpacing: 100,
            nodeRepulsion: 450000,
            edgeElasticity: 100,
            nestingFactor: 0.1,
            gravity: 0.25,
            numIter: 1000,
            tile: true
        }
    });

    // Enable dragging
    cy.nodes().grabbable(true);

    // Enable panning and zooming with mouse
    cy.panningEnabled(true);
    cy.zoomingEnabled(true);

    // Add hover preview
    cy.on('mouseover', 'node', function(evt) {
        const node = evt.target;
        const label = node.data('label');
        const type = node.data('type');

        // Show tooltip
        const tooltip = document.createElement('div');
        tooltip.id = 'graphTooltip';
        tooltip.style.cssText = `position:fixed;padding:8px 12px;background:var(--bg-card);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);font-size:0.85rem;z-index:10000;pointer-events:none;box-shadow:var(--shadow-elevated);`;
        tooltip.textContent = `${type === 'folder' ? '📁' : '📄'} ${label}`;
        document.body.appendChild(tooltip);

        node.data('tooltip', tooltip);
    });

    cy.on('mouseout', 'node', function(evt) {
        const tooltip = evt.target.data('tooltip');
        if (tooltip) {
            tooltip.remove();
        }
    });

    cy.on('position', 'node', function(evt) {
        const tooltip = evt.target.data('tooltip');
        if (tooltip) {
            const pos = evt.target.renderedPosition();
            tooltip.style.left = (pos.x + 10) + 'px';
            tooltip.style.top = (pos.y - 30) + 'px';
        }
    });

    cy.on('tap', 'node', function(evt) {
        const nodeId = evt.target.id();
        const page = hubState.pages[nodeId];

        if (page) {
            hubState.activePageId = nodeId;
            refreshWorkspace();
            switchView('lessons-view');
        } else {
            const label = evt.target.data('label');
            showToast(`📁 Folder: ${label}`, 'info');
        }
    });

    const resizeHandler = () => {
        if (cy) cy.fit();
    };
    window.removeEventListener('resize', resizeHandler);
    window.addEventListener('resize', resizeHandler);

    // Setup controls
    setupGraphControls(cy);

    container._cy = cy;
}

function setupGraphControls(cy) {
    // Zoom controls
    const zoomIn = document.getElementById('graphZoomIn');
    const zoomOut = document.getElementById('graphZoomOut');
    const reset = document.getElementById('graphReset');
    const search = document.getElementById('graphSearch');

    if (zoomIn) {
        zoomIn.addEventListener('click', () => {
            cy.zoom(cy.zoom() * 1.2);
        });
    }

    if (zoomOut) {
        zoomOut.addEventListener('click', () => {
            cy.zoom(cy.zoom() / 1.2);
        });
    }

    if (reset) {
        reset.addEventListener('click', () => {
            cy.fit();
            cy.nodes().unselect();
        });
    }

    // Search functionality
    if (search) {
        search.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();

            if (!query) {
                // Reset all nodes
                cy.nodes().style('opacity', 1);
                cy.edges().style('opacity', 0.7);
                return;
            }

            // Find matching nodes
            const matchedNodes = cy.nodes().filter(node => {
                const label = node.data('label').toLowerCase();
                return label.includes(query);
            });

            // Dim non-matching nodes and edges
            cy.nodes().style('opacity', 0.2);
            cy.edges().style('opacity', 0.1);

            // Highlight matching nodes and their edges
            matchedNodes.style('opacity', 1);
            matchedNodes.connectedEdges().style('opacity', 0.7);

            // Center on first match
            if (matchedNodes.length > 0) {
                cy.animate({
                    center: { eles: matchedNodes.first() },
                    zoom: 1.5
                }, { duration: 300 });
            }
        });
    }
}
