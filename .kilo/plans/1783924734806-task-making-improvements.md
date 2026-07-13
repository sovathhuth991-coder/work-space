# Schedule: Task-Making Improvements

## Goal
Improve the "add task" flow in the Schedule day-diagram modal:
1. **Edit existing tasks** — clicking a timeline task must update it in place, not create a duplicate.
2. **Inline recurrence count** — replace the blocking native `prompt()` with an inline field.

Scope (confirmed): edit-existing + inline-recurrence only.
Out of scope: series/whole-recurrence editing, time-picker UX, sticky buttons, the weekday-based (non-date) recurrence model itself.

## Files
- `WorkspaceFeatures/schedule/schedule-planner.js` — primary changes (form build, timeline item, submit, selection, edit-mode fns).
- `WorkspaceFeatures/schedule/schedule-core.js` — two small changes: `updateModalFormFeedback` excludeId (1.6) and reset edit state in `closeDayDiagram` (1.8). (The `validateTaskTimes(start, end, day, excludeId)` signature already exists at `schedule-core.js:296` and already skips `e.id === excludeId`; no signature change needed — 1.6 only passes the argument.)

---

## 1. Edit existing tasks

### 1.1 State — single source of truth
- Use `window.editingEventId` as the **only** edit-state variable (init `window.editingEventId = null;` near top of `schedule-planner.js`). Do **not** also declare a module-scoped `let editingEventId`, to avoid the planner/core files falling out of sync. Reference `window.editingEventId` everywhere (both files).

### 1.2 Reset on (re)open
- In `openDayDiagram(day)`, set `window.editingEventId = null;` at the very top. Every open/refresh/day-switch starts in Add mode. (`openDayDiagram` fully rebuilds the form, so Add mode is always the default DOM state.)

### 1.3 Form markup (`buildFormZone`, form-actions row ~line 241)
- Give the submit button an id:
  `<button type="submit" id="submitTaskBtn" class="btn-primary">➕ Add Task</button>`
- Add a hidden Cancel button next to it:
  `<button type="button" id="cancelEditBtn" class="btn-preset" style="display:none;" onclick="exitEditMode()">✕ Cancel</button>`

### 1.4 Trigger — change timeline click (`buildTimelineItem`, line 275)
- Change `onclick="selectTimelineTask(${ev.id}, '${ev.day}')"` to `onclick="enterEditMode(${ev.id})"`.
- `ev.id` is numeric; pass it **unquoted** so `events.find(e => e.id === eventId)` matches by number.
- Row action buttons (timer/complete/delete) already `stopPropagation`, so they won't trigger edit.
- Keep `selectTimelineTask` defined and window-exposed (called internally by `enterEditMode`).

### 1.5 New functions
- `enterEditMode(id)`
  1. `const ev = events.find(e => e.id === id); if (!ev) return;`
  2. `selectTimelineTask(id, ev.day)` — populates title, category, start/end wheels, highlights row (existing behavior).
  3. **Populate the fields `selectTimelineTask` misses:**
     - `document.getElementById('linked-lesson-page').value = ev.linkedPageId || '';` (CRITICAL — otherwise update wipes the lesson link).
     - `document.getElementById('recurrence').value = 'none';` then `toggleRecurrenceCountUI('none');` (recurrence is disabled while editing).
  4. **Day checkboxes = single "move to day":** uncheck all `.day-select`, then check the one whose `value === ev.day`.
  5. `window.editingEventId = id;`
  6. UI: `#submitTaskBtn` textContent = `✏️ Update Task`; show `#cancelEditBtn`; hide the `#recurrence` row and `#recurrenceCountRow` (edit = single occurrence, no recurrence UI).
- `exitEditMode()` — cleanest reset is a full rebuild:
  1. `window.editingEventId = null;`
  2. `openDayDiagram(currentOpenDay);` — rebuilds the form to default Add state (clears title, resets wheels/day checkboxes, restores `➕ Add Task` button, re-shows recurrence UI, hides Cancel). This deliberately clears the edited values so the user can't accidentally submit them as a new task after cancelling.
- Expose both on `window`.

### 1.6 Live-feedback self-conflict fix
- `updateModalFormFeedback(day)` (in `schedule-core.js:317`) calls `validateTaskTimes(start, end, day)` with no excludeId, so an edited task flags itself as an overlap. Change that call to `validateTaskTimes(start, end, day, window.editingEventId ?? null)`.
- **`validateTaskTimes` already supports `excludeId`** — signature is `validateTaskTimes(startTime, endTime, day, excludeId = null)` at `schedule-core.js:296`, and the loop filters `events.filter(e => e.day === day && e.id !== excludeId)`. No signature change required; 1.6 only supplies the argument. (Documented here per spec note so the implementer does not add a redundant param.)
- No separate variable to sync — both files read the single `window.editingEventId` global (1.1).

### 1.7 Submit — update branch (`handleModalSubmit`)
- Insert **after** the existing validation (after the `title` check, ~line 502; `start24`, `end24`, `title`, `category`, `linkedPageId` already computed by then) and **before** `baseEvent` creation:
  ```js
  if (window.editingEventId != null) {
      const idx = events.findIndex(ev => ev.id === window.editingEventId);
      if (idx === -1) { showToast('Task not found.', 'error'); window.editingEventId = null; return; }
      saveStateForUndo();
      const targetDay = selectedDays[0]; // "move to one day"; extras ignored
      events[idx] = {
          ...events[idx],           // preserve notes, link, color, reminder*, completed, weekId, id
          title,
          category,
          start: start24,
          end: end24,
          day: targetDay,
          linkedPageId: linkedPageId || undefined,
          recurrence: null
      };
      saveEvents();
      renderSchedule();
      window.editingEventId = null;
      openDayDiagram(targetDay);   // rebuilds form -> back to Add mode
      showToast('Task updated', 'success');
      return;
  }
  ```
- Validation parity: overlaps stay non-blocking warnings (same as Add mode); only title-required and `start24 !== end24` block — those checks already run before this branch.
- **Day-selection guard (per spec note):** the existing top-level `if (selectedDays.length === 0)` check in `handleModalSubmit` (line 468) runs *before* this edit branch and shows "Please select at least one day." then returns. In edit mode `enterEditMode` pre-checks exactly one box, but if the user unchecks it, the same guard fires first and the update is blocked — no duplicate/orphan task is created. Do **not** add a second day-check inside this branch (already covered). See Validation #9.
- "Move to one day": if multiple day checkboxes are somehow checked in edit mode, `selectedDays[0]` wins and the rest are ignored (no duplicates). Edit mode UI only pre-checks one box anyway.

### 1.8 Reset edit state on close
- In `closeDayDiagram()` (`schedule-core.js:330`), add `window.editingEventId = null;`. Guards against a stale edit flag if the user opens a day, enters edit mode, then closes via Escape/backdrop. (Reopening already resets via 1.2, so this is defensive but cheap.)

---

## 2. Inline recurrence count

### 2.1 Form markup (`buildFormZone`, immediately after the `#recurrence` select block ~line 168)
```html
<div class="form-row" id="recurrenceCountRow" style="display:none;">
  <label style="display:block;margin-bottom:4px;font-size:0.85rem;color:var(--text-muted);">🔁 How many occurrences?</label>
  <input type="number" id="recurrenceCount" class="form-input" min="2" value="4" />
</div>
```
- Add `onchange="toggleRecurrenceCountUI(this.value)"` to the existing `#recurrence` `<select>`.

### 2.2 Toggle function
- `toggleRecurrenceCountUI(value)`: show `#recurrenceCountRow` when `value !== 'none'`, else hide. Expose on `window`.
- Call once at the end of `openDayDiagram` (after the form is in the DOM, e.g. in the existing `setTimeout` that inits wheels) to sync initial state (default `none` → hidden).

### 2.3 Submit — replace `prompt()` (`handleModalSubmit` ~line 547)
- Remove:
  ```js
  const countPrompt = prompt('How many occurrences? (e.g. 4 for 4 weeks)', '4');
  if (countPrompt && !isNaN(countPrompt) && parseInt(countPrompt) > 1) {
      const count = parseInt(countPrompt);
      ...
  ```
- Replace the count source with:
  ```js
  const count = parseInt(document.getElementById('recurrenceCount')?.value, 10);
  if (!Number.isNaN(count) && count > 1) {
      // existing base-day / copy loop unchanged
  } else {
      showToast('Occurrences must be at least 2.', 'warning');
  }
  ```
- The inner copy loop (daily/weekly/monthly → `toLocaleDateString(... weekday: 'long')`) is unchanged.
- Behavior note (not changing): recurrence maps onto the weekday-based grid, so occurrences beyond 7 days can land on an already-populated weekday. Pre-existing; out of scope.

---

## Risks / notes
- **Single edit-state global:** `window.editingEventId` is the one source of truth, read/written in both files. No module-local copy (prevents desync between planner and core).
- **Event id type:** ids are numbers (`Date.now()+i`, or float from templates). Always compare with `===` and pass unquoted in `enterEditMode(${ev.id})`. (Note: the pre-existing `toggleTaskComplete('${ev.id}', ...)` passes a quoted string — not touched here, but do not copy that pattern for edit.)
- **Undo:** update branch calls `saveStateForUndo()` before mutating, matching Add mode.
- **linkedPageId preservation:** covered by populating the dropdown in `enterEditMode` (1.5.3). Do not "preserve when blank," because that would prevent the user from clearing a link.
- **No recurring-series model:** events are independent rows after creation; editing one never touches "siblings." Consistent with series-editing being out of scope.
- **Presets during edit:** `injectPreset('study'|'break')` just overwrites title/time fields; harmless while `window.editingEventId` is set (submit still updates the same task). No change needed.
- **Cancel clears the form** (via `openDayDiagram` rebuild in `exitEditMode`) so cancelled edits can't be accidentally re-submitted as new tasks.
- `openDayDiagram` rebuilding the DOM guarantees Add mode is the resting state; edit UI exists only transiently while `window.editingEventId` is set.

## Validation
1. Add a Weekly ×4 task → **no `prompt()`** appears; 4 events created across weeks; setting count to 1/blank shows the warning and creates only the base event.
2. Click a timeline task → form fills (incl. linked lesson), button = "Update Task", Cancel shown, recurrence rows hidden, one day checkbox checked.
3. Edit title/time and Update → same task changes in place (no duplicate); linked lesson preserved.
4. In edit mode, change the checked day → task moves to that day (original removed).
5. While editing, the task no longer flags itself as an overlap in the feedback panel.
6. Cancel → form clears to a blank Add state (title empty, "➕ Add Task", recurrence UI restored); pressing Add now creates a fresh task, not a duplicate of the cancelled edit.
7. Enter edit mode, then close via Escape/backdrop and reopen the day → back in Add mode (no stale edit state).
8. **Edit a task, uncheck its day checkbox, and click Update → warning "Please select at least one day." appears and the task is NOT updated** (covered by the top-level day guard, 1.7).
9. `node --check WorkspaceFeatures/schedule/schedule-planner.js` and `node --check WorkspaceFeatures/schedule/schedule-core.js` pass.

## Note for implementer
This plan requires source edits: `schedule-planner.js` (main), plus two small edits in `schedule-core.js` (1.6 excludeId, 1.8 close reset). Switch to an implementation-capable agent to execute.
