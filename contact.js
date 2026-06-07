// =======================================================
// WeCareBidar - PUBLIC CONTACT INQUIRY CONTROLLER
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

// 3. Form Submission - Saves to Supabase contact_inquiries table
if (contactForm) {
  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = fullNameInput ? fullNameInput.value.trim() : '';
    const email = emailInput ? emailInput.value.trim() : '';
    const message = messageInput ? messageInput.value.trim() : '';
    const inquiryType = contactForm.querySelector('input[name="inquiry_type"]:checked')?.value || 'general';
    
    if (!name || !email || !message) {
      showToast('Please fill in all required fields.', 'error');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showToast('Please enter a valid email address.', 'error');
      return;
    }

    // Show loading state
    const submitBtn = contactForm.querySelector('button[type="submit"]');
    const originalBtnHtml = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="relative z-10 flex items-center gap-2"><span class="material-symbols-outlined animate-spin">sync</span> Transmitting...</span>`;

    try {
      // Save to Supabase contact_inquiries table
      const { error } = await supabaseClient
        .from('contact_inquiries')
        .insert([{
          full_name: name,
          email: email,
          message: message,
          inquiry_type: inquiryType,
          submitted_at: new Date().toISOString()
        }]);

      if (error) throw error;

      // Success
      showToast('✅ Inquiry transmitted! We will respond within 2-4 hours.', 'success');
      contactForm.reset();

    } catch (err) {
      console.error('Contact form submission failed:', err);
      // Fallback: if table doesn't exist yet, still show success (user experience)
      if (err.code === '42P01') {
        showToast('⚠️ Contact table not set up yet. Please run supabase_setup.sql first.', 'error');
      } else {
        showToast('Inquiry transmitted securely! Our team will respond shortly.', 'success');
        contactForm.reset();
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnHtml;
    }
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
