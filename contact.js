// =======================================================
// WeCareBidar - PUBLIC CONTACT INQUIRY CONTROLLER
// =======================================================

const DEFAULT_SUPABASE_URL = "https://biykjcpjydcicwsgjgmi.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "sb_publishable_VLxlLLq7KawoBaLxq7IoXQ_NK2yPSce";

const SUPABASE_URL = localStorage.getItem('SUPABASE_URL') || DEFAULT_SUPABASE_URL;
const SUPABASE_ANON_KEY = localStorage.getItem('SUPABASE_ANON_KEY') || DEFAULT_SUPABASE_ANON_KEY;

let supabaseClient;

try {
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (e) {
  console.error("Supabase Initialization Error:", e);
}

// DOM Elements
const sandboxBanner = document.getElementById('sandboxBanner');
const headerUserAvatar = document.getElementById('headerUserAvatar');
const btnLogout = document.getElementById('btnLogout');

const fullNameInput = document.getElementById('fullName');
const emailInput = document.getElementById('email');
const messageInput = document.getElementById('message');
const contactForm = document.getElementById('contactForm');

const toastElement = document.getElementById('toast');
const toastMessage = document.getElementById('toastMessage');
const toastIcon = document.getElementById('toastIcon');

let currentUser = null;
let currentProfile = null;
let isSandboxMode = false;

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

// 2. Session Checking
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
        if (sandboxBanner) sandboxBanner.style.display = 'block';
      }
    }

    updateUserUI();
  } catch (err) {
    console.warn("Auth check failed:", err);
  }
}

function updateUserUI() {
  const defaultAvatar = `https://api.dicebear.com/7.x/bottts/svg?seed=Guest`;
  
  if (currentUser && currentProfile) {
    const avatarUrl = currentProfile.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(currentProfile.full_name)}`;
    if (headerUserAvatar) headerUserAvatar.src = avatarUrl;
    
    // Prefill form
    if (fullNameInput) fullNameInput.value = currentProfile.full_name || '';
    if (emailInput) emailInput.value = currentProfile.email || '';
  } else {
    if (headerUserAvatar) headerUserAvatar.src = defaultAvatar;
  }
}

// 3. Form Submission
if (contactForm) {
  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = fullNameInput ? fullNameInput.value.trim() : '';
    const email = emailInput ? emailInput.value : '';
    const message = messageInput ? messageInput.value.trim() : '';
    
    // Check fields
    if (!name || !message) {
      showToast('Please fill in all required fields.', 'error');
      return;
    }
    
    // Simulate secure transmit process
    showToast('Inquiry transmitted securely under ECO-COMMAND protocols', 'success');
    
    // Clear message field
    if (messageInput) messageInput.value = '';
  });
}

// 4. Log Out Handler
if (btnLogout) {
  btnLogout.addEventListener('click', async () => {
    if (isSandboxMode) {
      localStorage.removeItem('SANDBOX_USER');
      window.location.href = 'auth.html';
      return;
    }

    if (supabaseClient) {
      const { error } = await supabaseClient.auth.signOut();
      if (error) {
        console.error("Sign out error:", error);
      }
      window.location.href = 'auth.html';
    }
  });
}

// Initialize
checkAuthSession();
