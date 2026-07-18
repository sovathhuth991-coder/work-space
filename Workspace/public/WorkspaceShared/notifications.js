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

// Short two-tone chime (C5 then G5) via Web Audio API. No audio file
// needed — the app's only existing audio asset is a 5.8MB ambience
// track, the wrong tool for a short completion cue — so this works
// immediately with no extra download.
function playChime() {
    try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        const ctx = new Ctx();
        const now = ctx.currentTime;
        [523.25, 783.99].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            const start = now + i * 0.15;
            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(0.2, start + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(start);
            osc.stop(start + 0.4);
        });
        setTimeout(() => ctx.close(), 800);
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
