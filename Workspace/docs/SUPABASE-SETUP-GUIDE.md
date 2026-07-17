# Supabase Setup Guide — Start Here

You've never used Supabase before, so this walks through everything from a
blank browser tab to a working, verified setup. Follow it in order. It pairs
with two other files in this `docs/` folder:

- `SYNC-PLAN.md` — the overall architecture (read this first if you haven't)
- `supabase-setup-check.html` — a page you open at the end to verify
  everything here actually worked

## What Supabase actually is, in plain terms

Supabase gives your app three things it doesn't have today: a place to store
data outside your browser, a way to log people in, and rules that keep each
person's data private from everyone else's. You interact with it two ways —
a website dashboard (where you're about to spend most of this guide), and a
small JavaScript file you add to your app that talks to your project over
the internet.

Everything you do today is free. No card required.

---

## Step 1 — Create your account

1. Go to `supabase.com`.
2. Click **Start your project** (top right).
3. Sign up with **GitHub** — since Workspace Hub is already on GitHub, this
   is the fastest option and means one less password to manage. Email
   sign-up works too if you'd rather not connect GitHub.

## Step 2 — Create your project

1. Once logged in, click **New project**.
2. You'll be asked for:
   - **Name** — anything, e.g. `workspace-hub`. Purely a label, doesn't
     affect anything technical.
   - **Database password** — generate one or write your own. **Save this
     somewhere** (a password manager, a note) — you won't need it for
     anything in this guide, but you would if you ever connect a database
     tool directly to Supabase later.
   - **Region** — pick whichever is physically closest to you. This just
     affects how fast requests are; it doesn't limit who can use the app.
3. Click **Create new project**.
4. Wait. This takes 1–3 minutes while Supabase provisions a real database
   for you. The dashboard shows a progress indicator — nothing to click
   until it finishes.

You now have a real, empty Postgres database with nobody able to sign in to
it yet and nothing stored in it.

## Step 3 — A one-minute tour before you touch anything

The left sidebar is where everything lives. You'll only need four sections
for this project, ever:

- **Table Editor** — a spreadsheet-like view of your data. Good for
  glancing at what's actually stored, but you won't build the tables here.
- **SQL Editor** — where you'll paste and run the database setup in Step 4.
  This is the one you'll use right now.
- **Authentication** — manage sign-in methods and see who's created an
  account.
- **Settings → API Keys** — where you'll get the two values (Step 6) your
  app needs to actually connect.

Ignore everything else in the sidebar (Storage, Edge Functions, Realtime,
etc.) — none of it is part of this plan.

## Step 4 — Create the database tables

This is where your data will actually live — one table each for tasks,
habits, journal entries, and so on.

1. In the left sidebar, click **SQL Editor**.
2. Click **New query** (top right, or it may open a blank one automatically).
3. Open `SYNC-PLAN.md` from this same `docs/` folder, find the big SQL code
   block under **Part 2 — Database schema**, and copy the *entire* block —
   from the first `create table` down to the last `create policy` line.
4. Paste it into the SQL Editor here.
5. Click **Run** (or press Ctrl+Enter / Cmd+Enter).
6. You should see a green **Success** message at the bottom. If you see red
   text instead, see Troubleshooting below before moving on.
7. Double check it worked: click **Table Editor** in the sidebar. You should
   see 8 tables listed on the left: `tasks`, `habits`, `library_items`,
   `schedule_events`, `journal_entries`, `reading_items`,
   `dashboard_layout`. Each should be empty (0 rows) — that's expected,
   nothing has been added yet.

## Step 5 — Turn on sign-in methods

1. In the left sidebar, click **Authentication**, then **Providers** (or
   **Sign In / Providers**, depending on the current dashboard layout).
2. Find **Email** in the list — it's on by default, leave it enabled.
3. Click into the Email provider's settings. Look for a **Magic Link**
   toggle and make sure it's turned on, alongside password sign-in. Both
   ride on the same Email provider — you're not adding anything separate.
4. Leave every other provider (Google, GitHub, phone, etc.) off. Not part
   of this plan.

## Step 6 — Get your project credentials

Your app needs two values to connect to what you just built.

1. In the left sidebar, go to **Settings → API Keys**.
2. Near the top of the page you'll see your **Project URL** — looks like
   `https://xxxxxxxxxxxxx.supabase.co`. Copy it somewhere safe (a text
   file, a notes app — you'll paste it into the app's code eventually).
3. Below that, look for a key to copy:
   - If you see a **Publishable key** (starts with `sb_publishable_...`) —
     copy that one. This is the current, recommended format.
   - If instead you only see a **Legacy API Keys** tab with an `anon` key
     on it (a long string starting with `eyJ...`) — copy that instead. It
     does the same job under an older name; Supabase is mid-transition
     between the two formats, and either works fine here.
4. **Do not copy the Secret key or `service_role` key anywhere.** That one
   is allowed to bypass all your privacy rules — it's meant only for
   trusted server code, which this project doesn't have. If you ever paste
   it into a browser-facing file by mistake, treat it as compromised and
   regenerate it from this same page.

You now have both values the diagnostic page (next step) and, later, the
real app need.

## Step 7 — Verify everything

Open `supabase-setup-check.html` from this `docs/` folder directly in your
browser (just double-click the file). Paste in the Project URL and key from
Step 6, click **Run checks**, and read the results — each one explains in
plain language what it found and, if anything's red, exactly what to fix.

---

## Troubleshooting

**The SQL in Step 4 failed with a red error.**
Most likely cause: it was run twice, and the tables already exist from the
first attempt (Postgres refuses to create a table with a name that's
already taken). Check Table Editor — if the 8 tables from Step 4 are
already there, you're actually fine and can skip ahead to Step 5. If you
genuinely need to start over, you can drop a table from Table Editor (select
it, then the trash icon) and re-run just that table's `create table` block.

**I don't see "Publishable key" anywhere, only "anon" / "service_role".**
Your project is on the older key format — that's fine, nothing here
requires the new one. Use the `anon` key exactly as Step 6 describes.

**The diagnostic page's connection check fails.**
Almost always a copy-paste issue with the Project URL — check it starts
with `https://`, ends in `.supabase.co`, and has no extra spaces before or
after it (easy to accidentally include a space when copying).

**The diagnostic page says row-level security failed on a table.**
Means that table's `create policy` line either didn't run or errored
silently. Go back to the SQL Editor, find that one table's policy statement
in `SYNC-PLAN.md`, and run just that snippet on its own.

**The auth checks say an email address "is invalid."**
Not an SMTP problem — Supabase's auth server rejects known placeholder
domains like `example.com` outright, before it ever tries to send
anything. This is expected and actually confirms the endpoint is working.
You don't need to configure custom SMTP for local development or personal
use — Supabase's built-in mailer works out of the box, just with a low
rate limit (a few emails/hour) meant for testing, not production traffic.
Custom SMTP only becomes worth setting up once real strangers are signing
up in volume. To test real email delivery, sign up with an address you
actually control instead of a fake one.

---

## A few terms you'll see along the way

- **Table** — one category of data, like a spreadsheet tab. `tasks` is a
  table; each task you create is a row in it.
- **Row-level security (RLS)** — the privacy rule enforced by the database
  itself: "only show/allow changes to rows that belong to whoever's signed
  in." This is what makes multiple people sharing one app safe.
- **Publishable / anon key** — safe to put in code that runs in a browser.
  Identifies your *project*, not any specific person.
- **Secret / service_role key** — never goes in browser code. Bypasses RLS
  entirely. Not used anywhere in this plan.
- **Auth provider** — a method of signing in (email+password, magic link,
  Google, etc.). You're only using Email, which covers both password and
  magic-link.
