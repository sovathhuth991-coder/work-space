// js/notifications.js
function requestNotificationPermission() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

function sendNotification(title, body, icon = '📅', tag = 'schedule-notification') {
    if (!('Notification' in window)) {
        console.log(`[Notification] ${title}: ${body}`);
        return;
    }
    if (Notification.permission !== 'granted') return;
    try {
        const n = new Notification(title, { body, icon, badge: icon, tag });
        n.onclick = () => { window.focus(); n.close(); };
        setTimeout(() => n.close(), 5000);
    } catch (e) {
        console.warn('Notification failed:', e);
    }
}

// Customizable timer completion sounds via Web Audio API.
// Reads 'timerSound' from localStorage — set by #timerSoundSelector in the timer view.
// No audio files needed; all sounds are synthesized.
function playChime() {
    try {
        const sound = localStorage.getItem('timerSound') || 'chime';
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        const ctx = new Ctx();
        const now = ctx.currentTime;

        function playTone(freq, type, start, duration, volume, endFreq) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, start);
            if (endFreq) osc.frequency.linearRampToValueAtTime(endFreq, start + duration);
            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(volume || 0.2, start + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, start + duration - 0.05);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(start);
            osc.stop(start + duration);
        }

        switch (sound) {
            case 'bell': {
                // Long sustained bell-like tone
                playTone(880, 'sine', now, 0.8, 0.25);
                playTone(1320, 'sine', now + 0.05, 0.6, 0.1);
                playTone(1760, 'sine', now + 0.1, 0.4, 0.05);
                break;
            }
            case 'digital': {
                // Three short rapid beeps
                for (let i = 0; i < 3; i++) {
                    playTone(800, 'square', now + i * 0.25, 0.15, 0.15);
                }
                break;
            }
            case 'gentle': {
                // Soft ascending tones
                playTone(392, 'sine', now, 0.5, 0.15);
                playTone(523.25, 'sine', now + 0.15, 0.5, 0.12);
                playTone(659.25, 'sine', now + 0.3, 0.5, 0.1);
                break;
            }
            case 'alarm': {
                // Aggressive alternating tones
                for (let i = 0; i < 4; i++) {
                    playTone(880, 'sawtooth', now + i * 0.3, 0.25, 0.2);
                    playTone(440, 'sawtooth', now + i * 0.3 + 0.15, 0.25, 0.2);
                }
                break;
            }
            default: {
                // Classic chime (C5 then G5) — the original sound
                [523.25, 783.99].forEach((freq, i) => {
                    playTone(freq, 'sine', now + i * 0.15, 0.35, 0.2);
                });
                break;
            }
        }
        setTimeout(() => ctx.close(), 1500);
    } catch (e) {
        console.warn('playChime failed:', e);
    }
}

function showToast(message, type = 'info', duration = 3000) {
    const sanitized = String(message).replace(/[<>]/g, '');
    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
    const iconSpan = document.createElement('span');
    iconSpan.className = 'toast-icon';
    iconSpan.textContent = icons[type] || 'ℹ';
    const msgSpan = document.createElement('span');
    msgSpan.textContent = sanitized;
    toast.appendChild(iconSpan);
    toast.appendChild(msgSpan);
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('toast-hide');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// Same shape as showToast, but with a real "Undo" button that calls back
// into whatever the action needs to reverse itself — used after deletes
// and other actions worth a second chance rather than a silent success.
function showUndoToast(message, onUndo, duration = 5000) {
    const sanitized = String(message).replace(/[<>]/g, '');
    const toast = document.createElement('div');
    toast.className = 'toast-notification toast-info toast-undo';

    const iconSpan = document.createElement('span');
    iconSpan.className = 'toast-icon';
    iconSpan.textContent = 'ℹ';

    const msgSpan = document.createElement('span');
    msgSpan.textContent = sanitized;
    msgSpan.style.flex = '1';

    const undoBtn = document.createElement('button');
    undoBtn.className = 'toast-undo-btn';
    undoBtn.textContent = 'Undo';

    let dismissed = false;
    function dismiss() {
        if (dismissed) return;
        dismissed = true;
        toast.classList.add('toast-hide');
        setTimeout(() => toast.remove(), 300);
    }

    undoBtn.addEventListener('click', () => {
        dismiss();
        if (typeof onUndo === 'function') onUndo();
    });

    toast.appendChild(iconSpan);
    toast.appendChild(msgSpan);
    toast.appendChild(undoBtn);
    document.body.appendChild(toast);

    setTimeout(dismiss, duration);
}
window.showUndoToast = showUndoToast;

function checkUpcomingEvents() {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    events.forEach(event => {
        if (event.completed || !event.reminderEnabled || event.reminderShown) return;
        if (event.day !== getTodayName()) return;
        const [eh, em] = event.start.split(':').map(Number);
        const eventMinutes = eh * 60 + em;
        const reminder = event.reminderMinutes || 15;
        const minutesUntilStart = eventMinutes - currentMinutes;
        // Was previously `=== reminder`, an exact-minute match. Background
        // or inactive tabs (very common on mobile, and under Chrome's
        // power-saving throttling) don't reliably tick this every 60s, so a
        // missed exact minute meant the reminder silently never fired at
        // all. This checks a window instead: any tick between when the
        // reminder should open and the event's actual start will catch it.
        if (minutesUntilStart <= reminder && minutesUntilStart >= 0) {
            event.reminderShown = true;
            saveEvents();
            sendNotification(`⏰ Reminder: ${event.title}`, `Starts in ${minutesUntilStart} minute${minutesUntilStart === 1 ? '' : 's'} (${event.start})`, '⏰');
        }
    });
}
setInterval(checkUpcomingEvents, 60000);
// A backgrounded tab's setInterval can go a long time between ticks, so
// also check the moment the tab becomes visible again — otherwise a
// reminder whose window opened and closed entirely while you weren't
// looking would still be silently missed.
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkUpcomingEvents();
});
