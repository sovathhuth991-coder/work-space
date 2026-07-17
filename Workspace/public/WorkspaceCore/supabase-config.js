// ============================================================
// SUPABASE CONFIGURATION
// ============================================================
// Fill in the two values below from your Supabase project:
// Settings → API Keys → Project URL, and Publishable key (or the
// legacy "anon" key if your project shows that instead — either works).
//
// This key is meant to be public / safe to ship in client-side code —
// it's row-level security (see docs/SYNC-PLAN.md) that actually protects
// your data, not secrecy of this value. Never put the Secret/service_role
// key here or anywhere else in this project.
// ============================================================

const SUPABASE_URL = 'https://iuhqixdvwhenqdbczcvj.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1aHFpeGR2d2hlbnFkYmN6Y3ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4MzQzODcsImV4cCI6MjA5OTQxMDM4N30.4IfeNCTtkcRF8hW3j0N4YhOH2S2c5P-rgAeEQnh45FM';

window.SUPABASE_URL = SUPABASE_URL;
window.SUPABASE_PUBLISHABLE_KEY = SUPABASE_PUBLISHABLE_KEY;
