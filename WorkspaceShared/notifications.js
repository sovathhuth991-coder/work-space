// js/notifications.js
function requestNotificationPermission() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

function sendNotification(title, body, icon = '📅') {
    if (!('Notification' in window)) {
        console.log(`[Notification] ${title}: ${body}`);
        return;
    }
    if (Notification.permission !== 'granted') return;
    try {
        const n = new Notification(title, { body, icon, badge: icon, tag: 'schedule-notification' });
        n.onclick = () => { window.focus(); n.close(); };
        setTimeout(() => n.close(), 5000);
    } catch (e) {
        console.warn('Notification failed:', e);
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
    const { currentHHMM } = getTimeMetrics();
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    events.forEach(event => {
        if (event.completed || !event.reminderEnabled) return;
        const [eh, em] = event.start.split(':').map(Number);
        const eventMinutes = eh * 60 + em;
        const reminder = event.reminderMinutes || 15;
        if (eventMinutes - currentMinutes === reminder && !event.reminderShown && event.day === getTodayName()) {
            event.reminderShown = true;
            saveEvents();
            sendNotification(`⏰ Reminder: ${event.title}`, `Starts in ${reminder} minutes (${event.start})`, '⏰');
        }
    });
}
setInterval(checkUpcomingEvents, 60000);
