const supabase = window.supabase.createClient(
  'https://xxxxx.supabase.co',   // your Project URL
  'your-anon-public-key'          // your anon public key
);

async function signUp(email, password) {
  return supabase.auth.signUp({ email, password });
}

async function signIn(email, password) {
  return supabase.auth.signInWithPassword({ email, password });
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
