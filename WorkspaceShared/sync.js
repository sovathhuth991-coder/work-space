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
    client.auth.onAuthStateChange(() => refreshAuthUI());
});

window.openAccountModal = openAccountModal;
window.closeAccountModal = closeAccountModal;
window.switchAccountTab = switchAccountTab;
window.handleAccountSignIn = handleAccountSignIn;
window.handleAccountSignUp = handleAccountSignUp;
window.handleAccountMagicLink = handleAccountMagicLink;
window.handleAccountSignOut = handleAccountSignOut;
window.getCurrentUser = getCurrentUser;
