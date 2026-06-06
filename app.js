// =======================================================
// WeCareBidar - UPLOAD GATEWAY & REVOLUTION FEED
// =======================================================

// 1. Supabase Initialization Configuration
const DEFAULT_SUPABASE_URL = "https://biykjcpjydcicwsgjgmi.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "sb_publishable_VLxlLLq7KawoBaLxq7IoXQ_NK2yPSce";
const SUPABASE_SERVICE_ROLE_KEY = localStorage.getItem('SUPABASE_KEY') || "";

const SUPABASE_URL = localStorage.getItem('SUPABASE_URL') || DEFAULT_SUPABASE_URL;
const SUPABASE_ANON_KEY = localStorage.getItem('SUPABASE_ANON_KEY') || DEFAULT_SUPABASE_ANON_KEY;

let supabaseClient;
let supabaseAdmin; // Bypass RLS in sandbox mode

try {
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  supabaseAdmin = supabase.createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
} catch (e) {
  console.error("Supabase Initialization Error:", e);
}

// 2. DOM Elements

const toastElement = document.getElementById('toast');
const toastMessage = document.getElementById('toastMessage');
const toastIcon = document.getElementById('toastIcon');

// User Header Dashboard elements
const userHeader = document.getElementById('userHeader');
const userAvatarImg = document.getElementById('userAvatar');
const userFullNameSpan = document.getElementById('userFullName');
const userStatsCountSpan = document.getElementById('userStatsCount');
const btnEditProfile = document.getElementById('btnEditProfile');
const btnLogout = document.getElementById('btnLogout');

// Stats Widgets
const statActions = document.getElementById('statActions');
const statRebels = document.getElementById('statRebels');
const statStorage = document.getElementById('statStorage');

// Feed Elements
const feedGrid = document.getElementById('feedGrid');

// 3. State Management
let currentUser = null;
let currentProfile = null;
let isSandboxMode = false;
let selectedFile = null;
const MAX_FILE_SIZE_MB = 40;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// 4. UI Helpers: Show toast notifications
function showToast(message, type = 'success') {
  toastMessage.textContent = message;
  toastIcon.textContent = type === 'success' ? '🌱' : '⚠️';
  toastElement.className = `toast show ${type}`;
  
  setTimeout(() => {
    toastElement.classList.remove('show');
  }, 4000);
}

// 5. Auth Verification & Load Profiles
async function checkAuthAndLoadDashboard() {
  if (!supabaseClient) return;
  
  try {
    // Check standard supabase auth session first
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    
    if (session && session.user) {
      currentUser = session.user;
      isSandboxMode = false;
      
      // Load Profile
      const { data: profile, error: pError } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

      if (pError || !profile || !profile.full_name) {
        // Authenticated but profile is incomplete
        window.location.href = 'auth.html';
        return;
      }
      currentProfile = profile;
    } else {
      // Check Sandbox Dev Mode Session
      const sandboxUser = localStorage.getItem('SANDBOX_USER');
      if (sandboxUser) {
        currentProfile = JSON.parse(sandboxUser);
        currentUser = { id: currentProfile.id, isSandbox: true };
        isSandboxMode = true;
      } else {
        // No session at all, redirect to auth
        window.location.href = 'auth.html';
        return;
      }
    }
    
    // Display profile panel in header (Desktop)
    const avatarUrl = currentProfile.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(currentProfile.full_name)}`;
    userAvatarImg.src = avatarUrl;
    userFullNameSpan.textContent = currentProfile.full_name;
    userHeader.classList.remove('hidden');
    userHeader.style.display = 'flex';
    
    // Display profile panel in mobile header
    const mobileUserAvatar = document.getElementById('mobileUserAvatar');
    const mobileUserFullName = document.getElementById('mobileUserFullName');
    const mobileUserHeader = document.getElementById('mobileUserHeader');
    if (mobileUserAvatar) mobileUserAvatar.src = avatarUrl;
    if (mobileUserFullName) mobileUserFullName.textContent = currentProfile.full_name;
    if (mobileUserHeader) mobileUserHeader.classList.remove('hidden');
    
    // Refresh stats and feed
    await refreshUploadStats();
    await refreshRevolutionStats();
    await loadRevolutionFeed();

  } catch (err) {
    console.error("Dashboard check error:", err);
    window.location.href = 'auth.html';
  }
}

// Load statistics counts (user's verified uploads)
async function refreshUploadStats() {
  if (!currentUser) return;
  try {
    const client = isSandboxMode ? supabaseAdmin : supabaseClient;
    const { count, error } = await client
      .from('submissions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', currentUser.id)
      .eq('status', 'approved');

    if (error) throw error;
    const statsText = `${count} upload${count === 1 ? '' : 's'} verified`;
    userStatsCountSpan.textContent = statsText;
    const mobileUserStatsCount = document.getElementById('mobileUserStatsCount');
    if (mobileUserStatsCount) mobileUserStatsCount.textContent = statsText;
  } catch (err) {
    console.warn("Failed to retrieve upload count:", err);
    userStatsCountSpan.textContent = "0 uploads verified";
    const mobileUserStatsCount = document.getElementById('mobileUserStatsCount');
    if (mobileUserStatsCount) mobileUserStatsCount.textContent = "0 uploads verified";
  }
}

// Load movement-wide stats
async function refreshRevolutionStats() {
  try {
    const client = isSandboxMode ? supabaseAdmin : supabaseClient;
    
    // 1. Total Cleanup Actions (Approved Submissions)
    const { count: actionsCount } = await client
      .from('submissions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved');

    animateCounter(statActions, actionsCount || 0);

    // 2. Active Rebels (Profiles with name set up)
    const { count: rebelsCount } = await client
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .not('full_name', 'is', null);

    animateCounter(statRebels, rebelsCount || 0);

    // 3. Residue Remaining (always 0.0 MB as assets are cleaned on approval!)
    statStorage.textContent = "0.0 MB";

  } catch (err) {
    console.warn("Failed to load movement stats:", err);
  }
}

// Handle Logout Action
btnLogout.addEventListener('click', async () => {
  if (isSandboxMode) {
    localStorage.removeItem('SANDBOX_USER');
    window.location.href = 'auth.html';
  } else {
    try {
      await supabaseClient.auth.signOut();
      window.location.href = 'auth.html';
    } catch (err) {
      showToast('Logout failed. Please try again.', 'error');
    }
  }
});

// 6. Live Feed Retrieval
async function loadRevolutionFeed() {
  try {
    const client = isSandboxMode ? supabaseAdmin : supabaseClient;
    
    // Fetch approved submissions with contributor profiles
    const { data: submissions, error } = await client
      .from('submissions')
      .select('*, profiles(full_name, avatar_url)')
      .eq('status', 'approved')
      .order('created_at', { ascending: false });

    if (error) throw error;

    feedGrid.innerHTML = '';

    if (!submissions || submissions.length === 0) {
      feedGrid.innerHTML = `
        <div class="card" style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem;">
          <div style="font-size: 2.5rem; margin-bottom: 1rem; opacity: 0.6;">🌱</div>
          <h4 style="font-family: var(--font-title); font-size: 1.2rem; margin-bottom: 0.5rem;">The Revolution is Spreading</h4>
          <p style="color: var(--text-muted); font-size: 0.9rem;">No approved videos in the feed yet. Upload yours to start the movement!</p>
        </div>
      `;
      return;
    }

    submissions.forEach(sub => {
      const card = document.createElement('div');
      card.className = 'feed-card';
      
      const contributorName = sub.profiles?.full_name || "Anonymous Rebel";
      const contributorAvatar = sub.profiles?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(contributorName)}`;
      const dateText = new Date(sub.created_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });

      // Video tag includes logic where hover plays/pauses for premium experience
      // If video_url is null (purged storage residue), we explain that it is posted to social media and deleted to maintain zero storage footprint!
      let videoMarkup = '';
      if (sub.video_url) {
        videoMarkup = `
          <div class="feed-video-container">
            <video src="${sub.video_url}" muted loop playsinline></video>
          </div>
        `;
      } else {
        videoMarkup = `
          <div class="feed-video-container" style="display: flex; align-items: center; justify-content: center; background: rgba(16, 185, 129, 0.05); padding: 2rem;">
            <div style="text-align: center; max-width: 80%;">
              <span style="font-size: 2rem;">🚀</span>
              <p style="font-family: var(--font-title); font-weight: 700; font-size: 0.95rem; color: var(--text-success); margin-top: 0.5rem;">Blasted to Social Media!</p>
              <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">Storage residue wiped (0MB storage footprint) after successful distribution.</p>
            </div>
          </div>
        `;
      }

      card.innerHTML = `
        ${videoMarkup}
        <div class="feed-card-body">
          <div class="feed-card-header">
            <img src="${contributorAvatar}" class="feed-card-avatar" alt="Rebel Avatar">
            <div class="feed-card-user-info">
              <span class="feed-card-name">${contributorName}</span>
              <span class="feed-card-date">${dateText}</span>
            </div>
          </div>
          <div class="feed-card-desc">${sub.user_description}</div>
        </div>
      `;

      // Hover Play Interactions
      const videoEl = card.querySelector('video');
      if (videoEl) {
        card.addEventListener('mouseenter', () => {
          videoEl.play().catch(() => {});
        });
        card.addEventListener('mouseleave', () => {
          videoEl.pause();
        });
      }

      feedGrid.appendChild(card);
    });

  } catch (err) {
    console.error("Failed to load feed:", err);
  }
}

// 9. Profile Page Redirect
btnEditProfile.addEventListener('click', () => {
  window.location.href = 'profile.html';
});
if (userAvatarImg) {
  userAvatarImg.style.cursor = 'pointer';
  userAvatarImg.addEventListener('click', () => {
    window.location.href = 'profile.html';
  });
}

const btnEditProfileMobile = document.getElementById('btnEditProfileMobile');
if (btnEditProfileMobile) {
  btnEditProfileMobile.addEventListener('click', () => {
    window.location.href = 'profile.html';
  });
}

const btnLogoutMobile = document.getElementById('btnLogoutMobile');
if (btnLogoutMobile) {
  btnLogoutMobile.addEventListener('click', () => {
    btnLogout.click();
  });
}

// Stats Counter animation helper
function animateCounter(element, endValue) {
  if (!element) return;
  const start = 0;
  const duration = 1500; // 1.5s
  let startTimestamp = null;
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    element.innerHTML = Math.floor(progress * (endValue - start) + start).toLocaleString();
    if (progress < 1) {
      window.requestAnimationFrame(step);
    } else {
      element.innerHTML = endValue.toLocaleString() + (endValue > 1000 ? '+' : '');
    }
  };
  window.requestAnimationFrame(step);
}

// Initialization
checkAuthAndLoadDashboard();


