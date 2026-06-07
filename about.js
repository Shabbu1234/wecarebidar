// =======================================================
// WeCareBidar - MANIFESTO ABOUT PAGE CONTROLLER
// =======================================================

const DEFAULT_SUPABASE_URL = "https://biykjcpjydcicwsgjgmi.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpeWprY3BqeWRjaWN3c2dqZ21pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3MjYxMTIsImV4cCI6MjA5NjMwMjExMn0.UlOP5KBZzCoEy4fUeytx7nEcz4Xv7F-rGhs5Mib6u9M";

const SUPABASE_URL = localStorage.getItem('SUPABASE_URL') || DEFAULT_SUPABASE_URL;
const SUPABASE_ANON_KEY = localStorage.getItem('SUPABASE_ANON_KEY') || DEFAULT_SUPABASE_ANON_KEY;

let supabaseClient;

try {
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (e) {
  console.error("Supabase Initialization Error:", e);
}

// Authentication UI logic removed as per user request.
// Only public information is now accessible.
