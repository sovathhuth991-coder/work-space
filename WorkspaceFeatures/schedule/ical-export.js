// WorkspaceJS/ical-export.js

function exportToIcal() {
  if (!events.length) {
    showToast('No events to export.', 'warning');
    return;
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay() + 1); // Monday
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  // Filter events for this week
  const weekEvents = events.filter(ev => {
    const dayIndex = DAYS.indexOf(ev.day);
    if (dayIndex === -1) return false;
    const eventDate = new Date(weekStart);
    eventDate.setDate(weekStart.getDate() + dayIndex);
    return eventDate >= weekStart && eventDate <= weekEnd;
  });

  if (!weekEvents.length) {
    showToast('No events this week to export.', 'warning');
    return;
  }

  // Build iCal string
  let ical = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Workspace Hub//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH'
  ];

  weekEvents.forEach(ev => {
    const dayIndex = DAYS.indexOf(ev.day);
    const eventDate = new Date(weekStart);
    eventDate.setDate(weekStart.getDate() + dayIndex);
    const startDate = new Date(eventDate);
    const [sh, sm] = ev.start.split(':').map(Number);
    startDate.setHours(sh, sm, 0);
    const endDate = new Date(eventDate);
    const [eh, em] = ev.end.split(':').map(Number);
    endDate.setHours(eh, em, 0);

    const uid = `event-${ev.id}@workspace-hub`;
    // Escape iCal special characters: \, ; , and newlines
    const escapeIcal = (str) => (str || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
    const summary = escapeIcal(ev.title) || 'Untitled';
    const cat = escapeIcal(ev.category) || 'study';
    const dtstamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const dtstart = startDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const dtend = endDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    ical.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${dtstart}`,
      `DTEND:${dtend}`,
      `SUMMARY:${summary}`,
      `CATEGORIES:${cat}`,
      'END:VEVENT'
    );
  });

  ical.push('END:VCALENDAR');

  const icalString = ical.join('\r\n');
  const blob = new Blob([icalString], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `schedule_${weekStart.toISOString().slice(0,10)}_to_${weekEnd.toISOString().slice(0,10)}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showToast('iCal exported successfully!', 'success');
}
