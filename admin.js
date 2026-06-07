// =======================================================
// WeCareBidar - ADMIN COMMAND CENTER CONTROLLER
// =======================================================

let supabaseUrl = localStorage.getItem('SUPABASE_URL') || '';
let supabaseKey = localStorage.getItem('SUPABASE_KEY') || '';
let antgvityWebhookUrl = localStorage.getItem('ANTGVITY_WEBHOOK_URL') || 'https://cloud.activepieces.com/api/v1/webhooks/PR3T46AavqHabHXUymUjM';

let supabaseClient = null;
let isSandboxMode = false;

// DOM Elements
const loginModal = document.getElementById('loginModal');
const loginForm = document.getElementById('loginForm');
const adminTokenInput = document.getElementById('adminToken');
const sandboxBanner = document.getElementById('sandboxBanner');

const sidebarUserAvatar = document.getElementById('sidebarUserAvatar');
const sidebarUserFullName = document.getElementById('sidebarUserFullName');
const sidebarUserRole = document.getElementById('sidebarUserRole');

const statReviewQueue = document.getElementById('statReviewQueue');
const statActiveMods = document.getElementById('statActiveMods');
const statPlatformHealth = document.getElementById('statPlatformHealth');

const statTreesText = document.getElementById('statTreesText');
const statTreesBar = document.getElementById('statTreesBar');
const statWasteText = document.getElementById('statWasteText');
const statWasteBar = document.getElementById('statWasteBar');

const activityFeedContainer = document.getElementById('activityFeedContainer');
const btnLogout = document.getElementById('btnLogout');

const btnConfigureWebhook = document.getElementById('btnConfigureWebhook');
const webhookModal = document.getElementById('webhookModal');
const webhookUrlInput = document.getElementById('webhookUrlInput');
const btnSaveWebhook = document.getElementById('btnSaveWebhook');
const btnCloseWebhook = document.getElementById('btnCloseWebhook');

const toastElement = document.getElementById('toast');
const toastMessage = document.getElementById('toastMessage');
const toastIcon = document.getElementById('toastIcon');

// 1. Toast Notification System
function showToast(message, type = 'success') {
  if (!toastMessage || !toastElement) return;
  toastMessage.textContent = message;
  toastIcon.textContent = type === 'success' ? '🌱' : '⚠️';
  
  if (type === 'success') {
    toastElement.classList.add('bg-on-surface');
    toastElement.classList.remove('bg-error');
  } else {
    toastElement.classList.add('bg-error');
    toastElement.classList.remove('bg-on-surface');
  }

  toastElement.className = toastElement.className.replace('translate-y-24 opacity-0', 'translate-y-0 opacity-100');
  
  setTimeout(() => {
    toastElement.className = toastElement.className.replace('translate-y-0 opacity-100', 'translate-y-24 opacity-0');
  }, 4000);
}

// 2. Authentication Check
function checkAuthentication() {
  if (supabaseUrl && supabaseKey) {
    try {
      supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);
      loginModal.classList.add('hidden');
      
      // Update admin avatar representation
      const sandboxUser = localStorage.getItem('SANDBOX_USER');
      if (sandboxUser) {
        const parsed = JSON.parse(sandboxUser);
        isSandboxMode = true;
        if (sandboxBanner) sandboxBanner.style.display = 'block';
        if (sidebarUserAvatar) {
          sidebarUserAvatar.src = parsed.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(parsed.full_name)}`;
        }
        if (sidebarUserFullName) {
          sidebarUserFullName.textContent = parsed.full_name || "Mission Control";
        }
        if (sidebarUserRole) {
          sidebarUserRole.textContent = "Status: SANDBOX ADMIN";
        }
      } else {
        if (sidebarUserAvatar) {
          sidebarUserAvatar.src = `https://api.dicebear.com/7.x/bottts/svg?seed=Admin`;
        }
        if (sidebarUserFullName) {
          sidebarUserFullName.textContent = "Mission Control";
        }
        if (sidebarUserRole) {
          sidebarUserRole.textContent = "Status: ACTIVE ADMIN";
        }
      }
      
      loadDashboardData();
    } catch (e) {
      console.error(e);
      showToast('Decryption failed. Re-enter service token.', 'error');
      logout();
    }
  } else {
    loginModal.classList.remove('hidden');
  }
}

loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const token = adminTokenInput.value.trim();
  
  if (!token) {
    showToast('Token key is required.', 'error');
    return;
  }

  // Custom Static Password Check
  if (token === 'WeCareEnvironment_5854') {
    supabaseUrl = 'https://biykjcpjydcicwsgjgmi.supabase.co';
    supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpeWprY3BqeWRjaWN3c2dqZ21pIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDcyNjExMiwiZXhwIjoyMDk2MzAyMTEyfQ.i8lAIPqGlCR1FQBqCHNpBbX5MnZJ73nD1DIkbNQtJMU';
  } else if (token.startsWith('http')) {
    const parts = token.split('|');
    if (parts.length === 2) {
      supabaseUrl = parts[0].trim();
      supabaseKey = parts[1].trim();
    } else {
      showToast('Use format: URL|key', 'error');
      return;
    }
  } else {
    supabaseKey = token;
  }

  localStorage.setItem('SUPABASE_URL', supabaseUrl);
  localStorage.setItem('SUPABASE_KEY', supabaseKey);
  
  checkAuthentication();
});

// Password Toggle Visibility
const togglePasswordBtn = document.getElementById('togglePassword');
const eyeIcon = document.getElementById('eyeIcon');
if (togglePasswordBtn && adminTokenInput) {
    togglePasswordBtn.addEventListener('click', () => {
        const isPassword = adminTokenInput.type === 'password';
        adminTokenInput.type = isPassword ? 'text' : 'password';
        eyeIcon.textContent = isPassword ? 'visibility_off' : 'visibility';
    });
}

function logout() {
  localStorage.removeItem('SUPABASE_KEY');
  supabaseKey = '';
  supabaseClient = null;
  loginModal.classList.remove('hidden');
  
  // Clear counts/feed to hide admin data
  if (statReviewQueue) statReviewQueue.textContent = '0';
  if (statActiveMods) statActiveMods.textContent = '0';
  if (activityFeedContainer) activityFeedContainer.innerHTML = '';
}

if (btnLogout) btnLogout.addEventListener('click', logout);

// 3. Webhook Settings Configuration
if (btnConfigureWebhook) {
  btnConfigureWebhook.addEventListener('click', () => {
    webhookUrlInput.value = antgvityWebhookUrl;
    webhookModal.classList.remove('hidden');
  });
}

if (btnCloseWebhook) {
  btnCloseWebhook.addEventListener('click', () => {
    webhookModal.classList.add('hidden');
  });
}

if (btnSaveWebhook) {
  btnSaveWebhook.addEventListener('click', () => {
    const val = webhookUrlInput.value.trim();
    if (!val) {
      showToast('Webhook endpoint URL is required.', 'error');
      return;
    }
    antgvityWebhookUrl = val;
    localStorage.setItem('ANTGVITY_WEBHOOK_URL', val);
    webhookModal.classList.add('hidden');
    showToast('Webhook settings updated.');
  });
}

// 4. Load statistics and recent actions
async function loadDashboardData() {
  if (!supabaseClient) return;

  try {
    // 1. Fetch pending submissions count
    const { count: pendingCount, error: pErr } = await supabaseClient
      .from('submissions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');
    
    if (pErr) throw pErr;
    animateCounter(statReviewQueue, pendingCount || 0);

    // 2. Fetch profiles count as Active Rebels
    const { count: rebelsCount, error: rErr } = await supabaseClient
      .from('profiles')
      .select('*', { count: 'exact', head: true });
    
    if (rErr) throw rErr;
    animateCounter(statActiveMods, rebelsCount || 0);

    // 3. Fetch approved submissions to count impact and show logs
    const { data: approvedSubmissions, error: aErr } = await supabaseClient
      .from('submissions')
      .select('id, category, user_id, location, title, created_at, profiles(full_name)')
      .eq('status', 'approved')
      .order('created_at', { ascending: false });
    
    if (aErr) throw aErr;

    const approvedList = approvedSubmissions || [];

    // Calculate dynamic tree and waste count
    const treeCount = approvedList.filter(s => s.category === "Afforestation / Tree Plantation").length;
    const wasteCount = approvedList.filter(s => s.category === "Waste & Plastic Eradication").length;

    const totalTrees = treeCount * 50;
    const totalWasteKg = wasteCount * 150;

    // Update Text and Progress bar width style
    if (statTreesText) statTreesText.textContent = totalTrees.toLocaleString();
    if (statTreesBar) {
      const treeProgress = Math.min((totalTrees / 1000) * 100, 100);
      statTreesBar.style.width = `${treeProgress}%`;
    }

    if (statWasteText) statWasteText.textContent = `${totalWasteKg.toLocaleString()} kg`;
    if (statWasteBar) {
      const wasteProgress = Math.min((totalWasteKg / 5000) * 100, 100);
      statWasteBar.style.width = `${wasteProgress}%`;
    }

    // Populate Activity Center logs
    renderEventFeed(approvedList);

  } catch (err) {
    console.error("Dashboard statistics loading failed:", err);
    if (activityFeedContainer) {
      activityFeedContainer.innerHTML = `
        <div class="py-12 text-center text-error font-semibold">
          Error loading command logs: ${err.message || 'Database error.'}
        </div>
      `;
    }
  }
}

function formatTimeAgo(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "Just now";
  if (diffMins < 60) return `${diffMins} min${diffMins === 1 ? '' : 's'} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
}

function renderEventFeed(events) {
  if (!activityFeedContainer) return;
  activityFeedContainer.innerHTML = '';

  if (events.length === 0) {
    activityFeedContainer.innerHTML = `
      <div class="py-12 text-center text-on-surface-variant italic">
        No verified actions listed in the activity log yet.
      </div>
    `;
    return;
  }

  // Show top 5 latest approved actions
  const displayEvents = events.slice(0, 5);

  displayEvents.forEach(event => {
    const name = event.profiles?.full_name || "Citizen Rebel";
    const location = event.location || "Bidar";
    const timeAgo = formatTimeAgo(event.created_at);
    
    let icon = "nature_people";
    let bgClass = "bg-primary-container text-on-primary-container";
    
    if (event.category === "Waste & Plastic Eradication") {
      icon = "recycling";
      bgClass = "bg-tertiary-container text-on-tertiary-container";
    } else if (event.category === "Water Body Restoration") {
      icon = "water_drop";
      bgClass = "bg-blue-100 text-blue-800";
    } else if (event.category === "Civic Awareness Drive") {
      icon = "campaign";
      bgClass = "bg-surface-container-high border border-primary/20 text-primary";
    }

    const item = document.createElement('div');
    item.className = "flex items-start gap-4 p-4 rounded-xl hover:bg-surface-container transition-colors border-b border-outline-variant/20 last:border-0";
    item.innerHTML = `
      <div class="${bgClass} p-2 rounded-full flex-shrink-0">
        <span class="material-symbols-outlined text-sm">${icon}</span>
      </div>
      <div>
        <p class="font-body-md text-body-md text-on-surface">
          <span class="font-bold">${name}</span> completed a verified <strong>${event.category}</strong> action at <span class="font-semibold">${location}</span>.
        </p>
        <p class="font-label-caps text-[10px] text-on-surface-variant mt-1 font-bold">${timeAgo}</p>
      </div>
    `;
    
    activityFeedContainer.appendChild(item);
  });
}

function animateCounter(element, endValue) {
  if (!element) return;
  const start = 0;
  const duration = 1000; // 1s
  let startTimestamp = null;
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    element.innerHTML = Math.floor(progress * (endValue - start) + start).toLocaleString();
    if (progress < 1) {
      window.requestAnimationFrame(step);
    } else {
      element.innerHTML = endValue.toLocaleString();
    }
  };
  window.requestAnimationFrame(step);
}

// Init
checkAuthentication();

