// ============================================================
// SYNC.JS — Phase 1: accounts only, no data sync yet.
// ============================================================
// Signing in here doesn't touch any of the app's data (tasks, habits,
// etc.) — it only proves accounts work end to end. Phase 2 wires actual
// syncing on top of this, one feature at a time. See docs/SYNC-PLAN.md.
//
// Signing in is always optional — every part of the app keeps working
// exactly as before for anyone who never opens this modal.
// ============================================================

let supabaseClient = null;

function initSupabase() {
    if (!window.supabase || !window.SUPABASE_URL || !window.SUPABASE_PUBLISHABLE_KEY) {
        console.warn('Supabase not configured yet — fill in WorkspaceCore/supabase-config.js. Account features are disabled until then.');
        return null;
    }
    if (window.SUPABASE_URL.includes('YOUR-PROJECT-REF')) {
        console.warn('supabase-config.js still has placeholder values — account features are disabled until you fill in your real Project URL and key.');
        return null;
    }
    supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_PUBLISHABLE_KEY);
    window.supabaseClient = supabaseClient;
    return supabaseClient;
}

async function signUp(email, password) {
    if (!supabaseClient) return { error: { message: 'Supabase is not configured.' } };
    return supabaseClient.auth.signUp({ email, password });
}

async function signIn(email, password) {
    if (!supabaseClient) return { error: { message: 'Supabase is not configured.' } };
    return supabaseClient.auth.signInWithPassword({ email, password });
}

async function signInWithMagicLink(email) {
    if (!supabaseClient) return { error: { message: 'Supabase is not configured.' } };
    return supabaseClient.auth.signInWithOtp({ email });
}

async function signOutAccount() {
    if (!supabaseClient) return;
    await supabaseClient.auth.signOut();
}

async function getCurrentUser() {
    if (!supabaseClient) return null;
    const { data } = await supabaseClient.auth.getUser();
    return data ? data.user : null;
}

// ============================================================
// PHASE 2: Tasks sync (proof of concept)
// ============================================================
// Each app feature stores its data in localStorage as an array of plain
// JS objects, each with its own string `id`. The plan (docs/SYNC-PLAN.md)
// mirrors every item into a Supabase table shaped as
//   (id text, user_id uuid, data jsonb, updated_at timestamptz)
// with a composite primary key on (id, user_id). The existing JS objects
// sync close to as-is, with no per-field migration. Sync is "last push
// wins": the app pushes on every local save and pulls (merging by id)
// whenever the user signs in. Deletions delete the cloud row and keep a
// small tombstone list so a later pull can't resurrect a deleted item.

const DELETED_TASKS_KEY = 'deletedTaskIds';
let lastSyncErrorAt = 0;

function toastSyncError(message) {
    console.warn('[sync] ' + message);
    if (typeof showToast === 'function') {
        const now = Date.now();
        if (now - lastSyncErrorAt < 15000) return; // throttle to avoid spam
        lastSyncErrorAt = now;
        showToast('Sync error: ' + message, 'error', 5000);
    }
}

function toastSyncInfo(message) {
    if (typeof showToast === 'function') showToast(message, 'success', 2500);
}

function getSupabaseClient() { return supabaseClient; }

function safeParseArray(json) {
    try {
        const v = JSON.parse(json);
        return Array.isArray(v) ? v : [];
    } catch (_) {
        return [];
    }
}

// Generic: push every item currently in `localKey` to `table`.
// Returns the Supabase error (or null) so callers can surface it.
async function pushToCloud(table, localKey) {
    const user = await getCurrentUser();
    if (!user) return null;
    const local = safeParseArray(localStorage.getItem(localKey));
    if (!local.length) return null;
    const now = new Date().toISOString();
    const rows = local.map(item => ({
        id: String(item.id),
        user_id: user.id,
        data: item,
        updated_at: now
    }));
    const { error } = await supabaseClient.from(table).upsert(rows, { onConflict: 'id,user_id' });
    if (error) { toastSyncError('pushToCloud(' + table + '): ' + error.message); return error; }
    return null;
}

// Generic: pull this user's rows from `table` and merge into `localKey`.
// `afterMerge(mergedArray)`, if provided, is called once after a successful
// merge — the caller is responsible for updating whatever in-memory
// variable the feature actually renders from (e.g. tasks.js's `myTasks`),
// not just localStorage. Returns the Supabase error (or null).
async function pullFromCloud(table, localKey, afterMerge) {
    const user = await getCurrentUser();
    if (!user) return null;
    const { data, error } = await supabaseClient.from(table).select('*').eq('user_id', user.id);
    if (error) { toastSyncError('pullFromCloud(' + table + '): ' + error.message); return error; }
    if (!data || !data.length) return null;

    const local = safeParseArray(localStorage.getItem(localKey));
    const byId = new Map(local.map(t => [String(t.id), t]));
    const tombstones = safeParseArray(localStorage.getItem(DELETED_TASKS_KEY));
    let changed = false;

    for (const row of data) {
        if (tombstones.includes(row.id)) continue;
        byId.set(row.id, row.data);
        changed = true;
    }

    if (changed) {
        const merged = [...byId.values()];
        localStorage.setItem(localKey, JSON.stringify(merged));
        if (typeof afterMerge === 'function') afterMerge(merged);
    }
    return null;
}

async function deleteItemInCloud(table, id) {
    const user = await getCurrentUser();
    if (!user) return null;
    const { error } = await supabaseClient.from(table).delete().eq('id', String(id)).eq('user_id', user.id);
    if (error) { toastSyncError('deleteItemInCloud(' + table + '): ' + error.message); return error; }
    return null;
}

// --- Tasks ---
async function pushMyTasks() { return await pushToCloud('tasks', 'myTasks'); }

async function pullMyTasks() {
    return await pullFromCloud('tasks', 'myTasks', (merged) => {
        // setMyTasks is exposed on window by tasks.js and updates both the
        // in-memory array (the one renderMyTasks reads) and localStorage, so
        // pulled tasks show up immediately. The other two are optional globals
        // guarded via window.* so a missing definition can never throw.
        if (typeof window.setMyTasks === 'function') window.setMyTasks(merged);
        if (typeof window.renderMyTasks === 'function') window.renderMyTasks();
        if (typeof window.updateDashboardStats === 'function') window.updateDashboardStats();
    });
}

async function deleteTaskInCloud(id) { return await deleteItemInCloud('tasks', id); }

function markTaskDeleted(id) {
    const tombstones = safeParseArray(localStorage.getItem(DELETED_TASKS_KEY));
    if (!tombstones.includes(id)) {
        tombstones.push(id);
        localStorage.setItem(DELETED_TASKS_KEY, JSON.stringify(tombstones));
    }
}

// Manual sync: pull remote changes, then push local ones. Driven by the
// "Sync now" button; reports the result in the account modal + a toast.
async function handleAccountSyncNow() {
    const statusEl = document.getElementById('accountSyncStatus');
    if (statusEl) statusEl.textContent = 'Syncing…';
    const user = await getCurrentUser();
    if (!user) {
        if (statusEl) statusEl.textContent = 'You are not signed in.';
        return;
    }
    const pullErr = await pullMyTasks();
    const pushErr = await pushMyTasks();
    if (pullErr || pushErr) {
        if (statusEl) statusEl.textContent = 'Sync failed — see console for details.';
    } else {
        if (statusEl) statusEl.textContent = 'Synced at ' + new Date().toLocaleTimeString();
        toastSyncInfo('Synced across devices');
    }
}

// Pull remote changes on a timer and when the tab regains focus, so edits
// made on another device show up here without a manual re-sign-in.
let syncIntervalStarted = false;
function startBackgroundSync() {
    if (syncIntervalStarted) return;
    syncIntervalStarted = true;
    setInterval(async () => {
        const user = await getCurrentUser();
        if (user) pullMyTasks();
    }, 15000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) pullMyTasks(); });
    window.addEventListener('focus', () => pullMyTasks());
}

function markTaskDeleted(id) {
    const tombstones = safeParseArray(localStorage.getItem(DELETED_TASKS_KEY));
    if (!tombstones.includes(id)) {
        tombstones.push(id);
        localStorage.setItem(DELETED_TASKS_KEY, JSON.stringify(tombstones));
    }
}

// ============================================================
// UI WIRING
// ============================================================

let accountModalTab = 'signin'; // 'signin' | 'signup' | 'magiclink'

function openAccountModal() {
    const modal = document.getElementById('accountModal');
    if (!modal) return;
    setAccountModalMessage('');
    modal.style.display = 'flex';
}

function closeAccountModal() {
    const modal = document.getElementById('accountModal');
    if (modal) modal.style.display = 'none';
}

function switchAccountTab(tab) {
    accountModalTab = tab;
    setAccountModalMessage('');
    ['signin', 'signup', 'magiclink'].forEach(t => {
        const tabBtn = document.getElementById('accountTab_' + t);
        const panel = document.getElementById('accountPanel_' + t);
        if (tabBtn) tabBtn.classList.toggle('active', t === tab);
        if (panel) panel.style.display = t === tab ? 'block' : 'none';
    });
}

function setAccountModalMessage(text, isError) {
    const el = document.getElementById('accountModalMessage');
    if (!el) return;
    el.textContent = text || '';
    el.style.color = isError ? '#e57373' : 'var(--text-secondary)';
    el.style.display = text ? 'block' : 'none';
}

function setAccountFormBusy(busy) {
    document.querySelectorAll('#accountModal button, #accountModal input').forEach(el => {
        el.disabled = busy;
    });
}

async function handleAccountSignIn() {
    const email = document.getElementById('accountSignInEmail').value.trim();
    const password = document.getElementById('accountSignInPassword').value;
    if (!email || !password) return setAccountModalMessage('Enter your email and password.', true);
    setAccountFormBusy(true);
    const { error } = await signIn(email, password);
    setAccountFormBusy(false);
    if (error) return setAccountModalMessage(error.message, true);
    setAccountModalMessage('Signed in.');
    setTimeout(closeAccountModal, 600);
}

async function handleAccountSignUp() {
    const email = document.getElementById('accountSignUpEmail').value.trim();
    const password = document.getElementById('accountSignUpPassword').value;
    if (!email || !password) return setAccountModalMessage('Enter an email and password.', true);
    if (password.length < 6) return setAccountModalMessage('Password should be at least 6 characters.', true);
    setAccountFormBusy(true);
    const { error } = await signUp(email, password);
    setAccountFormBusy(false);
    if (error) return setAccountModalMessage(error.message, true);
    setAccountModalMessage('Account created. Check your email to confirm it, then sign in.');
}

async function handleAccountMagicLink() {
    const email = document.getElementById('accountMagicLinkEmail').value.trim();
    if (!email) return setAccountModalMessage('Enter your email.', true);
    setAccountFormBusy(true);
    const { error } = await signInWithMagicLink(email);
    setAccountFormBusy(false);
    if (error) return setAccountModalMessage(error.message, true);
    setAccountModalMessage('Check your email for a sign-in link.');
}

async function handleAccountSignOut() {
    await signOutAccount();
    closeAccountModal();
}

function updateAccountButtonUI(user) {
    const btn = document.getElementById('accountButton');
    const label = document.getElementById('accountButtonLabel');
    if (!btn || !label) return;
    if (user) {
        label.textContent = user.email.length > 18 ? user.email.slice(0, 16) + '\u2026' : user.email;
        btn.title = 'Signed in as ' + user.email + ' \u2014 click to manage';
        btn.dataset.signedIn = 'true';
    } else {
        label.textContent = 'Sign in';
        btn.title = 'Sign in to sync across devices (optional)';
        btn.dataset.signedIn = 'false';
    }
}

function renderAccountModalForUser(user) {
    const signedOutView = document.getElementById('accountSignedOutView');
    const signedInView = document.getElementById('accountSignedInView');
    if (!signedOutView || !signedInView) return;
    if (user) {
        signedOutView.style.display = 'none';
        signedInView.style.display = 'block';
        const emailEl = document.getElementById('accountSignedInEmail');
        if (emailEl) emailEl.textContent = user.email;
    } else {
        signedOutView.style.display = 'block';
        signedInView.style.display = 'none';
    }
}

async function refreshAuthUI() {
    const user = await getCurrentUser();
    updateAccountButtonUI(user);
    renderAccountModalForUser(user);
    if (user) pullMyTasks();
}

// ============================================================
// INIT
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    const client = initSupabase();
    if (!client) {
        // No config yet — hide the account button entirely rather than
        // show a broken feature.
        const btn = document.getElementById('accountButton');
        if (btn) btn.style.display = 'none';
        return;
    }
    refreshAuthUI();
    startBackgroundSync();
    client.auth.onAuthStateChange((event) => {
        refreshAuthUI(); // also pulls the user's cloud tasks when signed in
        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') pushMyTasks();
    });
});

window.openAccountModal = openAccountModal;
window.closeAccountModal = closeAccountModal;
window.switchAccountTab = switchAccountTab;
window.handleAccountSignIn = handleAccountSignIn;
window.handleAccountSignUp = handleAccountSignUp;
window.handleAccountMagicLink = handleAccountMagicLink;
window.handleAccountSignOut = handleAccountSignOut;
window.getCurrentUser = getCurrentUser;
window.getSupabaseClient = getSupabaseClient;
window.pushMyTasks = pushMyTasks;
window.pullMyTasks = pullMyTasks;
window.deleteTaskInCloud = deleteTaskInCloud;
window.markTaskDeleted = markTaskDeleted;
window.handleAccountSyncNow = handleAccountSyncNow;
