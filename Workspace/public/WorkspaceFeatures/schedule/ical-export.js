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

// ============================================================
// ICAL IMPORT
// This app's schedule is a weekly template (day-of-week + time),
// not a dated calendar — so a specific-dated event from an
// imported .ics file gets mapped onto the weekday its start date
// falls on, and becomes a recurring weekly slot here. That's
// disclosed in the completion toast since it changes what the
// event means going forward.
// ============================================================

// RFC 5545: a line starting with a space/tab is a continuation of
// the previous line. Real .ics files (Google Calendar, Outlook)
// rely on this for long SUMMARY/DESCRIPTION values.
function unfoldIcalLines(text) {
  return text.replace(/\r\n/g, '\n').split('\n').reduce((lines, line) => {
    if ((line.startsWith(' ') || line.startsWith('\t')) && lines.length) {
      lines[lines.length - 1] += line.slice(1);
    } else {
      lines.push(line);
    }
    return lines;
  }, []);
}

function unescapeIcalText(str) {
  return (str || '')
    .replace(/\\n/gi, ' ')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

// "20260720T090000Z" / "20260720T090000" -> { date, hasTime: true }
// "20260720" (all-day) -> { hasTime: false }
function parseIcalDateTime(raw) {
  if (!raw) return null;
  const isUtc = raw.endsWith('Z');
  const clean = raw.replace('Z', '');
  const m = clean.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  if (h === undefined) return { hasTime: false };
  const date = isUtc
    ? new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi))
    : new Date(+y, +mo - 1, +d, +h, +mi);
  return { date, hasTime: true };
}

function parseIcalFile(text) {
  const lines = unfoldIcalLines(text);
  const vevents = [];
  let current = null;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === 'BEGIN:VEVENT') { current = {}; continue; }
    if (line === 'END:VEVENT') { if (current) vevents.push(current); current = null; continue; }
    if (!current) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    let key = line.slice(0, idx);
    const value = line.slice(idx + 1);
    const semiIdx = key.indexOf(';');
    const params = semiIdx !== -1 ? key.slice(semiIdx + 1) : '';
    if (semiIdx !== -1) key = key.slice(0, semiIdx);
    if (key === 'SUMMARY') current.summary = unescapeIcalText(value);
    else if (key === 'CATEGORIES') current.categories = unescapeIcalText(value);
    else if (key === 'DTSTART') { current.dtstart = value; current.dtstartAllDay = /VALUE=DATE\b/.test(params) || !/T/.test(value); }
    else if (key === 'DTEND') { current.dtend = value; }
  }
  return vevents;
}

async function importIcalFile(file) {
  if (!file) return;
  const text = await file.text();
  const vevents = parseIcalFile(text);
  if (!vevents.length) { showToast('No events found in that file.', 'warning'); return; }

  let added = 0, skippedAllDay = 0, skippedUnparsed = 0, skippedInvalid = 0;

  vevents.forEach(v => {
    if (v.dtstartAllDay || !v.dtstart) { skippedAllDay++; return; }
    const start = parseIcalDateTime(v.dtstart);
    const end = v.dtend ? parseIcalDateTime(v.dtend) : null;
    if (!start || !start.hasTime) { skippedAllDay++; return; }
    if (!end || !end.hasTime) { skippedUnparsed++; return; }

    const day = DAYS[start.date.getDay()];
    const pad = n => String(n).padStart(2, '0');
    const startStr = `${pad(start.date.getHours())}:${pad(start.date.getMinutes())}`;
    const endStr = `${pad(end.date.getHours())}:${pad(end.date.getMinutes())}`;

    const issues = (typeof validateTaskTimes === 'function') ? validateTaskTimes(startStr, endStr, day) : [];
    if (issues.find(i => i.type === 'error')) { skippedInvalid++; return; }

    events.push({
      id: Date.now() + added,
      title: v.summary || 'Imported event',
      category: (v.categories || 'study').toLowerCase(),
      start: startStr, end: endStr, day,
      completed: false, notes: '', link: '', color: 'default',
      reminderEnabled: false, reminderMinutes: 15, reminderShown: false,
      linkedPageId: undefined, recurrence: null,
      weekId: (typeof getWeekId === 'function') ? getWeekId(new Date()) : undefined
    });
    added++;
  });

  if (added > 0) {
    saveEvents();
    if (typeof renderSchedule === 'function') renderSchedule();
  }

  let msg = `Imported ${added} event${added === 1 ? '' : 's'}.`;
  if (skippedAllDay) msg += ` Skipped ${skippedAllDay} all-day event${skippedAllDay === 1 ? '' : 's'} (not supported here).`;
  if (skippedInvalid) msg += ` Skipped ${skippedInvalid} with time conflicts.`;
  if (skippedUnparsed) msg += ` Couldn't read ${skippedUnparsed}.`;
  if (added > 0) msg += ' Note: since your schedule repeats weekly, each imported event now recurs on that weekday every week.';
  showToast(msg, added > 0 ? 'success' : 'warning');
}

function triggerIcalImport() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.ics,text/calendar';
  input.onchange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) importIcalFile(file);
  };
  input.click();
}
