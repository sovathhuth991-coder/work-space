// ============================================================
// WIDGETS – FIXED: Only add default audio if no audio widgets exist
// ============================================================

let customWidgets = JSON.parse(localStorage.getItem('customWidgets') || '[]');

function saveCustomWidgets() {
    localStorage.setItem('customWidgets', JSON.stringify(customWidgets));
}

function renderWidgets() {
    const grid = document.getElementById('dashWidgetsGrid');
    if (!grid) return;
    if (!customWidgets.length) {
        grid.innerHTML = '<p style="color:#475569;font-style:italic;grid-column:1/-1;text-align:center;padding:40px;">No widgets yet.</p>';
        return;
    }
    grid.innerHTML = customWidgets.map(widget => {
        let content = '';
        switch (widget.type) {
            case 'notes':
                content = `<textarea placeholder="Write your notes..." onchange="updateWidgetContent('${widget.id}', this.value)">${escapeHtml(widget.content || '')}</textarea>`;
                break;
            case 'links':
                content = `<div class="widget-links">${(widget.links || []).map(l => `<a href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer" class="widget-link-item">🔗 ${escapeHtml(l.name)}</a>`).join('')}</div>`;
                break;
            case 'stats':
                content = `<div class="widget-stats">${(widget.stats || []).map(s => `<div class="widget-stat-item"><span class="widget-stat-label">${escapeHtml(s.label)}</span><span class="widget-stat-value">${escapeHtml(s.value)}</span></div>`).join('')}</div>`;
                break;
            case 'timer': {
                const m = Math.floor(widget.remainingSeconds / 60),
                    s = widget.remainingSeconds % 60;
                content = `<div class="widget-timer"><div class="widget-timer-display" id="timer-${widget.id}">${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}</div><div class="widget-timer-controls"><button class="widget-timer-btn" onclick="toggleWidgetTimer('${widget.id}')">${widget.timerRunning ? 'Pause' : 'Start'}</button><button class="widget-timer-btn" onclick="resetWidgetTimer('${widget.id}')">Reset</button></div></div>`;
                break;
            }
            case 'chart': {
                const total = events.length || 1;
                const completed = events.filter(e => e.completed).length;
                const pct = Math.round((completed / total) * 100);
                content = `
                    <div class="widget-chart">
                        <div class="widget-chart-label">Completion: ${pct}%</div>
                        <div class="widget-chart-bar">
                            <div class="widget-chart-fill" style="width:${pct}%;"></div>
                        </div>
                        <div style="display:flex; justify-content:space-between; font-size:0.7rem; color:var(--text-muted);">
                            <span>${completed} done</span>
                            <span>${total - completed} left</span>
                        </div>
                    </div>
                `;
                break;
            }
            case 'schedule': {
                const todayTasks = events.filter(e => e.day === getTodayName()).sort((a,b) => a.start.localeCompare(b.start));
                content = `
                    <div class="widget-schedule">
                        ${todayTasks.length === 0 ? '<p style="color:var(--text-muted);font-style:italic;">No tasks today</p>' :
                        todayTasks.slice(0, 5).map(t => `
                            <div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid var(--border-color);">
                                <span>${escapeHtml(t.title)}</span>
                                <span style="color:var(--accent-1);font-size:0.8rem;">${t.start}</span>
                            </div>
                        `).join('')}
                        ${todayTasks.length > 5 ? `<div style="color:var(--text-muted);font-size:0.7rem;margin-top:4px;">+ ${todayTasks.length - 5} more</div>` : ''}
                    </div>
                `;
                break;
            }
            case 'quote':
                content = `<div class="widget-quote">"${escapeHtml(widget.quoteText || 'No quote set')}"${widget.quoteAuthor ? `<div class="widget-quote-author">— ${escapeHtml(widget.quoteAuthor)}</div>` : ''}</div>`;
                break;
            case 'weather':
                content = `<div class="widget-weather"><div class="widget-weather-icon">${escapeHtml(widget.icon || '🌤️')}</div><div class="widget-weather-temp">${escapeHtml(widget.temp || 28)}°C</div><div class="widget-weather-desc">${escapeHtml(widget.condition || 'Sunny')} · ${escapeHtml(widget.location || 'Unknown')}</div></div>`;
                break;
            case 'local-audio': {
                const widgetId = widget.id;
                const audioSrc = widget.src || '';
                const label = widget.label || '';
                const title = widget.title || '🎵 Audio';

                content = `
                    <div class="custom-audio-player" data-widget-id="${widgetId}">
                        <audio class="custom-audio-element" src="${escapeHtml(audioSrc)}" preload="metadata" loop></audio>
                        <div class="audio-player-inner">
                            <div class="audio-info">
                                <span class="audio-title">${escapeHtml(title)}</span>
                                ${label ? `<span class="audio-label">${escapeHtml(label)}</span>` : ''}
                            </div>
                            <div class="audio-controls">
                                <button class="audio-play-btn" onclick="toggleAudioPlayer('${widgetId}')">
                                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                                        <polygon points="5,3 19,12 5,21" id="playIcon-${widgetId}" />
                                        <rect x="6" y="4" width="3" height="16" id="pauseIcon1-${widgetId}" style="display:none;" />
                                        <rect x="13" y="4" width="3" height="16" id="pauseIcon2-${widgetId}" style="display:none;" />
                                    </svg>
                                </button>
                                <div class="audio-progress-container">
                                    <span class="audio-current-time" id="currentTime-${widgetId}">0:00</span>
                                    <div class="audio-progress-bar" id="progressBar-${widgetId}" onclick="seekAudio(event, '${widgetId}')">
                                        <div class="audio-progress-fill" id="progressFill-${widgetId}" style="width:0%;"></div>
                                    </div>
                                    <span class="audio-duration" id="duration-${widgetId}">0:00</span>
                                </div>
                                <div class="audio-volume-container">
                                    <button class="audio-volume-btn" onclick="toggleMute('${widgetId}')" id="volumeBtn-${widgetId}">🔊</button>
                                    <input type="range" class="audio-volume-slider" min="0" max="1" step="0.05" value="0.8"
                                           oninput="setVolume('${widgetId}', this.value)" />
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                break;
            }
            default:
                content = `<p>Unknown widget type</p>`;
        }
        return `<div class="widget-card widget-${widget.type}"><div class="widget-header"><div class="widget-title">${escapeHtml(widget.title)}</div><div class="widget-actions"><button class="widget-btn delete" onclick="deleteWidget('${widget.id}')">✕</button></div></div><div class="widget-content">${content}</div></div>`;
    }).join('');

    initAudioPlayers();
}

// ============================================================
// AUDIO PLAYER FUNCTIONS (unchanged)
// ============================================================
function initAudioPlayers() {
    document.querySelectorAll('.custom-audio-player').forEach(player => {
        if (player.dataset.initialized) return;
        player.dataset.initialized = 'true';

        const widgetId = player.dataset.widgetId;
        const audio = player.querySelector('.custom-audio-element');

        audio.addEventListener('loadedmetadata', () => {
            const duration = document.getElementById(`duration-${widgetId}`);
            if (duration) duration.textContent = formatAudioTime(audio.duration);
        });

        audio.addEventListener('timeupdate', () => {
            updateAudioProgress(widgetId);
        });

        audio.addEventListener('ended', () => {
            const playIcon = document.getElementById(`playIcon-${widgetId}`);
            const pause1 = document.getElementById(`pauseIcon1-${widgetId}`);
            const pause2 = document.getElementById(`pauseIcon2-${widgetId}`);
            if (playIcon) playIcon.style.display = 'block';
            if (pause1) pause1.style.display = 'none';
            if (pause2) pause2.style.display = 'none';
            const progressFill = document.getElementById(`progressFill-${widgetId}`);
            if (progressFill) progressFill.style.width = '0%';
        });

        const volumeSlider = player.querySelector('.audio-volume-slider');
        if (volumeSlider) {
            volumeSlider.value = audio.volume;
        }
    });
}

function toggleAudioPlayer(widgetId) {
    const audio = document.querySelector(`.custom-audio-player[data-widget-id="${widgetId}"] .custom-audio-element`);
    if (!audio) return;

    const playIcon = document.getElementById(`playIcon-${widgetId}`);
    const pause1 = document.getElementById(`pauseIcon1-${widgetId}`);
    const pause2 = document.getElementById(`pauseIcon2-${widgetId}`);

    if (audio.paused) {
        audio.play();
        playIcon.style.display = 'none';
        pause1.style.display = 'block';
        pause2.style.display = 'block';
    } else {
        audio.pause();
        playIcon.style.display = 'block';
        pause1.style.display = 'none';
        pause2.style.display = 'none';
    }
}

function formatAudioTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
}

function updateAudioProgress(widgetId) {
    const audio = document.querySelector(`.custom-audio-player[data-widget-id="${widgetId}"] .custom-audio-element`);
    if (!audio) return;
    const progressFill = document.getElementById(`progressFill-${widgetId}`);
    const currentTime = document.getElementById(`currentTime-${widgetId}`);

    if (audio.duration && !isNaN(audio.duration)) {
        const pct = (audio.currentTime / audio.duration) * 100;
        if (progressFill) progressFill.style.width = `${pct}%`;
        if (currentTime) currentTime.textContent = formatAudioTime(audio.currentTime);
    }
}

function seekAudio(event, widgetId) {
    const audio = document.querySelector(`.custom-audio-player[data-widget-id="${widgetId}"] .custom-audio-element`);
    if (!audio || !audio.duration) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const pct = (event.clientX - rect.left) / rect.width;
    audio.currentTime = pct * audio.duration;
    updateAudioProgress(widgetId);
}

function setVolume(widgetId, value) {
    const audio = document.querySelector(`.custom-audio-player[data-widget-id="${widgetId}"] .custom-audio-element`);
    if (!audio) return;
    audio.volume = parseFloat(value);
    const btn = document.getElementById(`volumeBtn-${widgetId}`);
    if (btn) {
        btn.textContent = parseFloat(value) === 0 ? '🔇' : '🔊';
    }
}

function toggleMute(widgetId) {
    const audio = document.querySelector(`.custom-audio-player[data-widget-id="${widgetId}"] .custom-audio-element`);
    if (!audio) return;
    const btn = document.getElementById(`volumeBtn-${widgetId}`);
    const slider = document.querySelector(`.custom-audio-player[data-widget-id="${widgetId}"] .audio-volume-slider`);
    if (!btn || !slider) return;

    if (audio.muted) {
        audio.muted = false;
        btn.textContent = '🔊';
        slider.value = audio.volume;
    } else {
        audio.muted = true;
        btn.textContent = '🔇';
    }
}

// ============================================================
// OTHER WIDGET FUNCTIONS
// ============================================================
function updateWidgetContent(id, newContent) {
    const w = customWidgets.find(w => w.id === id);
    if (w && w.type === 'notes') {
        w.content = newContent;
        saveCustomWidgets();
    }
}

function toggleWidgetTimer(id) {
    const w = customWidgets.find(w => w.id === id);
    if (!w || w.type !== 'timer') return;
    w.timerRunning = !w.timerRunning;
    if (w.timerRunning) {
        w.timerInterval = setInterval(() => {
            if (w.remainingSeconds > 0) {
                w.remainingSeconds--;
                updateTimerDisplay(w);
            } else {
                clearInterval(w.timerInterval);
                w.timerRunning = false;
                w.remainingSeconds = w.minutes * 60;
                showToast('Timer finished!', 'success');
                renderWidgets();
            }
        }, 1000);
    } else {
        clearInterval(w.timerInterval);
    }
    saveCustomWidgets();
    renderWidgets();
}

function resetWidgetTimer(id) {
    const w = customWidgets.find(w => w.id === id);
    if (!w || w.type !== 'timer') return;
    if (w.timerInterval) clearInterval(w.timerInterval);
    w.timerRunning = false;
    w.remainingSeconds = w.minutes * 60;
    saveCustomWidgets();
    renderWidgets();
}

function updateTimerDisplay(w) {
    if (!w) return;
    const display = document.getElementById(`timer-${w.id}`);
    if (!display) return;
    const m = Math.floor(w.remainingSeconds / 60),
        s = w.remainingSeconds % 60;
    display.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function deleteWidget(id) {
    const widget = customWidgets.find(w => w.id === id);
    if (widget && widget.type === 'timer' && widget.timerInterval) {
        clearInterval(widget.timerInterval);
    }
    customWidgets = customWidgets.filter(w => w.id !== id);
    saveCustomWidgets();
    renderWidgets();
}

// ============================================================
// DEFAULT WIDGETS – FIXED: only add if no audio/chart widgets exist
// ============================================================
(function initDefaultWidgets() {
    // Remove duplicate audio widgets (keep only the first one)
    const audioWidgets = customWidgets.filter(w => w.type === 'local-audio');
    if (audioWidgets.length > 1) {
        // Keep the first audio widget, remove the rest
        const firstAudioId = audioWidgets[0].id;
        customWidgets = customWidgets.filter(w => w.type !== 'local-audio' || w.id === firstAudioId);
        saveCustomWidgets();
    }

    const hasAudioWidget = customWidgets.some(w => w.type === 'local-audio');
    if (!hasAudioWidget) {
        customWidgets.push({
            id: `widget_${Date.now()}`,
            type: 'local-audio',
            title: '🎵 Study Beats',
            src: 'Assets/Rain-Music.mp3',
            label: 'My favourite focus playlist'
        });
        saveCustomWidgets();
    }

    // Add a default chart widget if none exists
    if (!customWidgets.some(w => w.type === 'chart')) {
        customWidgets.push({
            id: `widget_${Date.now() + 1}`,
            type: 'chart',
            title: '📊 Progress Overview'
        });
        saveCustomWidgets();
    }

    renderWidgets();
})();

// Expose functions globally
window.toggleAudioPlayer = toggleAudioPlayer;
window.seekAudio = seekAudio;
window.updateAudioProgress = updateAudioProgress;
window.setVolume = setVolume;
window.toggleMute = toggleMute;
window.initAudioPlayers = initAudioPlayers;
