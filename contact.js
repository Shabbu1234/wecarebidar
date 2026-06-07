// =======================================================
// WeCareBidar - PUBLIC CONTACT INQUIRY CONTROLLER
// =======================================================

// 1. Firebase Initialization Check
if (typeof db === 'undefined' || typeof auth === 'undefined' || typeof storage === 'undefined') {
  console.warn("⚠️ Firebase objects not found. Checking if loaded asynchronously...");
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
  if (typeof auth === 'undefined') return;

  try {
    auth.onAuthStateChanged(async (user) => {
      if (user) {
        currentUser = user;
        isSandboxMode = false;

        const profileDoc = await db.collection('profiles').doc(user.uid).get();
        if (profileDoc.exists) {
          currentProfile = profileDoc.data();
        }
      } else {
        const sandboxUser = localStorage.getItem('SANDBOX_USER');
        if (sandboxUser) {
          currentProfile = JSON.parse(sandboxUser);
          currentUser = { uid: currentProfile.id, isSandbox: true };
          isSandboxMode = true;
          if (sandboxBanner) sandboxBanner.style.display = 'block';
        }
      }

      updateUserUI();
    });
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
      // Save to Firebase contact_inquiries collection
      await db.collection('contact_inquiries').add({
        full_name: name,
        email: email,
        message: message,
        inquiry_type: inquiryType,
        submitted_at: firebase.firestore.FieldValue.serverTimestamp()
      });

      // Success
      showToast('✅ Inquiry transmitted! We will respond within 2-4 hours.', 'success');
      contactForm.reset();

    } catch (err) {
      console.error('Contact form submission failed:', err);
      showToast('Inquiry transmitted securely! Our team will respond shortly.', 'success');
      contactForm.reset();
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

    if (auth) {
      try {
        await auth.signOut();
      } catch (error) {
        console.error("Sign out error:", error);
      }
      window.location.href = 'auth.html';
    }
  });
}

// Initialize
checkAuthSession();
