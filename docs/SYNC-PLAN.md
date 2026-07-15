# Workspace Hub — Accounts & Cross-Device Sync Plan

This is the reference doc for adding real user accounts and sync to Workspace
Hub. Read this before starting any of the phases below — it's meant to save
you from re-deciding the architecture every session.

## The goal

- You can sign in on your phone and your desktop and see the same tasks,
  habits, journal, library, schedule, etc. on both.
- If other people start using the app, each person gets their own account and
  their own private data — nobody sees anyone else's.
- The app keeps working offline and feels instant, exactly like it does today
  — sync happens in the background, it never blocks the UI.

## Why Supabase

GitHub Pages only serves static files — no server-side code can run there,
which is also why PHP was never an option (see earlier conversation). Any
real sync needs a service *outside* GitHub Pages that can hold shared state
and know who's who.

Supabase is the best fit for how this project is built:
- Free tier is generous for personal/small-scale use.
- Real Postgres database — normal SQL, inspectable, not a proprietary format.
- Built-in authentication (email/password or magic-link sign-in) — you don't
  write your own login system.
- The client library loads from a CDN with a plain `<script>` tag, same as
  every other library already used in this project. No npm, no build step,
  no bundler.
- Row-level security (RLS) enforces "you only see your own data" *inside the
  database itself* — not just hidden in the UI, which matters once other
  people are using it.

(Firebase is the other well-known option and would also work. Supabase is
recommended mainly because its data lives in a normal SQL database you can
query and inspect directly, which tends to be easier to debug later than
Firestore's document model.)

## Architecture: local-first

`localStorage` stays exactly as it is today — it's the fast, offline-capable
local cache every part of the app already reads and writes. Nothing about
today's behavior changes for someone who never signs in.

**Signing in is always optional, permanently.** The app works fully,
forever, without an account — sync is an opt-in extra for anyone who wants
their data on more than one device, not a requirement to use the app at
all. Nobody should ever be forced to create an account just to add a task.

Signing in adds a sync layer on top:
- **On save**: write to `localStorage` immediately (instant, same as now),
  then push the change to Supabase in the background.
- **On load / sign-in on a new device**: pull your rows down from Supabase
  and merge them into `localStorage`.
- **Conflict handling**: last-write-wins, using a timestamp on every row.
  Good enough for one person using two devices. Real-time collaborative
  editing (two people editing live) is a different, much bigger problem —
  not needed here and not part of this plan.

## What actually needs to sync

Pulled directly from the app's real `localStorage` keys (found by grepping
the codebase, not guessed):

**User content — sync these (Phase 3):**

| Key | What it is |
|---|---|
| `myTasks` | To-do items |
| `habits` | Habit tracker |
| `libraryItems` | Knowledge library |
| `taskTemplates` | Reusable task templates |
| `scheduleEvents` | Weekly schedule |
| `journalEntries` | Journal |
| `readingItems` | Reading tracker |
| `dashTodos` | Dashboard quick todos |
| `quickNotes` | Quick notes widget |
| `userGoals` | Goals feature |
| `customTimers` | Custom timer/pomodoro presets |
| `completedSessions`, `sessionHistory`, `focusHistory`, `accumulatedFocusTime`, `pomodoroStats`, `dailyFocusGoal` | Focus/session tracking |
| `dashboardCardVisibility`, `customWidgets` | Dashboard layout — which cards are shown, positions, sizes |

**Device/UI preferences — leave local-only, don't sync:**

`currentTheme`, `collapsedFolders`, `collapsedNavGroups`, `activeView`,
`sidebarCollapsed`, `hubState`, `dev_color_overrides`, `dev_custom_css`,
`tourCompleted`, `tourSkipped`, `focusStatsVisible`.

---

## Part 1 — Setting up Supabase (walkthrough)

1. Go to `supabase.com` and click **Start your project**. Sign up with
   GitHub (fastest, and matches how this project is already hosted) or
   email.
2. Click **New project**. Pick any name (e.g. `workspace-hub`), set a
   database password (save it somewhere — you likely won't need it day to
   day, but you'll want it if you ever connect a SQL client directly), and
   pick the region closest to you. Free tier, no card required to start.
3. Wait ~2 minutes for the project to provision.
4. In the left sidebar, go to **Settings → API Keys**. You'll need two
   values from this page later:
   - **Project URL** (shown at the top of this page, looks like
     `https://xxxxx.supabase.co`)
   - **Publishable key** (starts with `sb_publishable_...`). Supabase
     renamed this recently — older tutorials call it the "anon key" or
     "anon public key"; if your project only shows a **Legacy API Keys**
     tab with an `anon` key on it instead, that's the same thing under the
     old name and works exactly the same way here. Either one is safe to
     use in client-side code — it's row-level security (Part 2), not this
     key, that actually protects your data.
   - Do **not** use the **Secret key** (or legacy `service_role` key)
     anywhere in this project's code — that one bypasses row-level security
     entirely and is only for trusted server-side code, which this project
     doesn't have.
5. In the left sidebar, go to **Authentication → Providers**. Email is
   enabled by default. Under its settings, make sure **Magic Link** is
   turned on alongside password sign-in — both are enabled from this one
   toggle, no separate provider needed. Leave everything else off for now.
6. In the left sidebar, go to **Table Editor** or **SQL Editor** — this is
   where the tables from Part 2 below get created.

That's the whole account-creation part. Everything else happens in code.

---

## Part 2 — Database schema

Run this once in Supabase's **SQL Editor**. It creates one table per synced
data type, all following the same pattern: a row belongs to exactly one
user (`user_id`), and RLS policies make sure a signed-in user can only ever
read or write their own rows.

```sql
-- One table per synced data type. Same shape every time:
-- id, user_id (owner), data (the actual item as JSON), timestamps.
-- Storing each item's fields as JSONB rather than a rigid column-per-field
-- schema means the existing JS objects can be synced close to as-is,
-- without a separate migration every time a new field gets added to a task
-- or habit in the app itself.

-- The app supplies each item's own string id (e.g. "mytask_1700000000000"),
-- so the primary key is the composite (id, user_id) rather than a server
-- generated uuid. `data` holds the full JS object as-is; `updated_at`
-- powers last-push-wins merge + conflict tracking.
create table if not exists tasks (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (id, user_id)
);

alter table tasks enable row level security;
create policy "Users manage their own tasks"
  on tasks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Keep updated_at fresh on every update (the app also sets it on push).
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace trigger tasks_set_updated_at
  before update on tasks
  for each row execute function set_updated_at();

-- Same shape for every item-collection table: composite PK (id, user_id),
-- `data` jsonb, `updated_at`. Add the next one when its feature gets synced.
create table habits (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (id, user_id)
);

create table library_items (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (id, user_id)
);

create table schedule_events (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (id, user_id)
);

create table journal_entries (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (id, user_id)
);

create table reading_items (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (id, user_id)
);

-- Repeat the same pattern for: task_templates, dash_todos, quick_notes,
-- user_goals, custom_timers, focus_sessions — add these as each feature
-- gets synced in Phase 3, not all at once.

-- Dashboard layout is different from the tables above: it's one row per
-- user (your whole layout), not a collection of separate items.
create table dashboard_layout (
  user_id uuid references auth.users primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table dashboard_layout enable row level security;
create policy "Users manage their own dashboard layout"
  on dashboard_layout for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Row-level security: the `tasks` table already has it enabled above with
-- its policy. Repeat that same enable + policy pair for every other table
-- listed above (habits, library_items, etc.), swapping the table name.
-- This is the part that actually enforces "you only see your own data" even
-- if someone else has the anon key.
```

## Part 3 — Client-side setup

Add the Supabase client via CDN, same pattern as every other library in this
project (`index.html`, alongside the other `<script>` tags):

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
```

Then a small new file, e.g. `WorkspaceShared/sync.js`:

```js
const supabase = window.supabase.createClient(
  'https://xxxxx.supabase.co',   // your Project URL
  'sb_publishable_...'            // your Publishable key (or legacy anon key — either works)
);

async function signUp(email, password) {
  return supabase.auth.signUp({ email, password });
}

async function signIn(email, password) {
  return supabase.auth.signInWithPassword({ email, password });
}

// Magic-link: no password, sends a one-time sign-in link to the email.
// Good as an alternative option on the sign-in screen — some people would
// rather not manage another password for a personal tool like this.
async function signInWithMagicLink(email) {
  return supabase.auth.signInWithOtp({ email });
}

async function signOut() {
  return supabase.auth.signOut();
}

// Pull this user's rows down and merge into localStorage
async function pullFromCloud(table, localStorageKey) {
  const { data, error } = await supabase.from(table).select('*');
  if (error) { console.error(error); return; }
  const items = data.map(row => row.data);
  saveToLocalStorage(localStorageKey, items);
}

// Push a local change up (called after the existing saveToLocalStorage calls)
async function pushToCloud(table, item) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return; // not signed in — stays local-only, same as today
  await supabase.from(table).upsert({
    id: item.id,
    user_id: user.id,
    data: item,
    updated_at: new Date().toISOString()
  });
}
```

The key integration point: every existing call to `saveToLocalStorage(key,
data)` across the codebase (tasks.js, habits, journal-ui.js, etc.) gets a
sibling call to `pushToCloud(...)` right after it, gated on whether someone's
signed in. Nothing about the local-first save path changes.

---

## Phased rollout

**Phase 1 — Accounts only, no sync yet.**
Add a sign-up/sign-in screen. Wire up `signUp`/`signIn`/`signOut`. At the end
of this phase you can create an account and log in, but your data still only
lives in `localStorage` — signing in doesn't do anything to your tasks yet.
This is the safest place to stop and test before touching any real data sync.

**Phase 2 — Proof of concept: sync one feature.**
Pick `myTasks` (smallest, most self-contained). Wire up the `tasks` table,
`pushToCloud`/`pullFromCloud` for it specifically, and test the full loop:
add a task on desktop, sign in on phone, see it appear. This phase proves the
whole approach works before it's repeated 12 more times.

**Phase 3 — Expand to everything else.**
Repeat the Phase 2 pattern for each remaining data type in the sync table
above, one at a time, testing after each.

Each phase should be its own session with its own testing pass — same
approach as the mobile bug fixes: change something, verify it in a real
browser test, then move on.

---

## Costs and limits (free tier, as of this plan)

Supabase's free tier includes a real Postgres database, auth, and generous
request limits — comfortably enough for personal use and a modest number of
other people using the app. If it's ever outgrown, the same schema and code
work unchanged on a paid tier; nothing here is throwaway work if usage grows.
Worth checking Supabase's current pricing page before committing, since free
tier details can change.

---

## Decisions

These were open questions in the first draft of this plan — now settled:

- **Dashboard layout syncs too.** `dashboardCardVisibility`/`customWidgets`
  are in the synced list above, with their own `dashboard_layout` table.
- **Both email/password and magic-link sign-in**, from day one — Supabase
  makes this a single toggle, not extra work, so no reason to pick just one.
- **Local-only/guest use is permanent**, not a stepping-stone to be removed
  later — see "Architecture: local-first" above.
