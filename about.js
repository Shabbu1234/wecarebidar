// =======================================================
// WeCareBidar - MANIFESTO ABOUT PAGE CONTROLLER
// =======================================================

const DEFAULT_SUPABASE_URL = "https://biykjcpjydcicwsgjgmi.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "sb_publishable_VLxlLLq7KawoBaLxq7IoXQ_NK2yPSce";
const SUPABASE_SERVICE_ROLE_KEY = localStorage.getItem('SUPABASE_KEY') || "";

const SUPABASE_URL = localStorage.getItem('SUPABASE_URL') || DEFAULT_SUPABASE_URL;
const SUPABASE_ANON_KEY = localStorage.getItem('SUPABASE_ANON_KEY') || DEFAULT_SUPABASE_ANON_KEY;

let supabaseClient;
let supabaseAdmin; // Sandbox Mode bypass

try {
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  supabaseAdmin = supabase.createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
} catch (e) {
  console.error("Supabase Initialization Error:", e);
}

const sandboxBanner = document.getElementById('sandboxBanner');
const desktopJoinBtn = document.getElementById('desktopJoinBtn');
const desktopJoinBtnText = document.getElementById('desktopJoinBtnText');
const mobileJoinBtn = document.getElementById('mobileJoinBtn');
const mobileUserHeader = document.getElementById('mobileUserHeader');
const mobileUserAvatar = document.getElementById('mobileUserAvatar');
const mobileUserFullName = document.getElementById('mobileUserFullName');
const mobileUserStatsCount = document.getElementById('mobileUserStatsCount');

let currentUser = null;
let currentProfile = null;
let isSandboxMode = false;

async function checkAuthSession() {
  if (!supabaseClient) return;

  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (session && session.user) {
      currentUser = session.user;
      isSandboxMode = false;

      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();
      
      currentProfile = profile;
    } else {
      const sandboxUser = localStorage.getItem('SANDBOX_USER');
      if (sandboxUser) {
        currentProfile = JSON.parse(sandboxUser);
        currentUser = { id: currentProfile.id, isSandbox: true };
        isSandboxMode = true;
        sandboxBanner.style.display = 'block';
      }
    }

    updateNavbarUI();
  } catch (err) {
    console.warn("Auth check failed:", err);
  }
}

async function updateNavbarUI() {
  if (currentUser && currentProfile) {
    if (desktopJoinBtnText) desktopJoinBtnText.textContent = "Dashboard";
    desktopJoinBtn.href = "index.html";
    mobileJoinBtn.textContent = "Dashboard";
    mobileJoinBtn.href = "index.html";

    // Fetch user approved submissions for mobile info panel
    const client = isSandboxMode ? supabaseAdmin : supabaseClient;
    const { count } = await client
      .from('submissions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', currentUser.id)
      .eq('status', 'approved');

    const uploadsCount = count || 0;
    const avatarUrl = currentProfile.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(currentProfile.full_name)}`;
    mobileUserAvatar.src = avatarUrl;
    mobileUserFullName.textContent = currentProfile.full_name || "Citizen Rebel";
    mobileUserStatsCount.textContent = `${uploadsCount} upload${uploadsCount === 1 ? '' : 's'} verified`;
    mobileUserHeader.classList.remove('hidden');
  } else {
    if (desktopJoinBtnText) desktopJoinBtnText.textContent = "Join The Revolution";
    desktopJoinBtn.href = "auth.html";
    mobileJoinBtn.textContent = "Join The Revolution";
    mobileJoinBtn.href = "auth.html";
    mobileUserHeader.classList.add('hidden');
  }
}

checkAuthSession();


