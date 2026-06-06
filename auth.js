// =======================================================
// WeCareBidar - PHONE OTP AUTH & PROFILE LOGIC
// =======================================================

// 1. Supabase Initialization Configuration
const DEFAULT_SUPABASE_URL = "https://biykjcpjydcicwsgjgmi.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "sb_publishable_VLxlLLq7KawoBaLxq7IoXQ_NK2yPSce";
const SUPABASE_SERVICE_ROLE_KEY = localStorage.getItem('SUPABASE_KEY') || "";

const SUPABASE_URL = localStorage.getItem('SUPABASE_URL') || DEFAULT_SUPABASE_URL;
const SUPABASE_ANON_KEY = localStorage.getItem('SUPABASE_ANON_KEY') || DEFAULT_SUPABASE_ANON_KEY;

let supabaseClient;
let supabaseAdmin; // Used to bypass RLS in Sandbox Dev Mode

try {
  // Initialize standard client
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  // Initialize admin client as a fallback for local testing sandbox
  supabaseAdmin = supabase.createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
} catch (e) {
  console.error("Supabase Initialization Error:", e);
}

// 2. State Management
let currentStep = 1;
let currentPhoneNumber = "";
let isSandboxMode = false;
let verifiedUserId = null;
let profileName = "";
let profileEmail = "";
let profileAvatarUrl = "";

// DOM Elements
const sandboxBanner = document.getElementById('sandboxBanner');
const btnBack = document.getElementById('btnBack');

// Step 1: Phone input
const phoneForm = document.getElementById('phoneForm');
const phoneInput = document.getElementById('phoneInput');
const btnSendOtp = document.getElementById('btnSendOtp');
const btnSendOtpText = document.getElementById('btnSendOtpText');

// Step 2: OTP input
const otpForm = document.getElementById('otpForm');
const otpSubheader = document.getElementById('otpSubheader');
const otpInputs = document.querySelectorAll('.otp-input');
const fullOtpCode = document.getElementById('fullOtpCode');
const btnVerifyOtp = document.getElementById('btnVerifyOtp');
const btnVerifyOtpText = document.getElementById('btnVerifyOtpText');

// Step 3: Profile setup
const profileForm = document.getElementById('profileForm');
const avatarUploadTrigger = document.getElementById('avatarUploadTrigger');
const avatarFileInput = document.getElementById('avatarFileInput');
const avatarPreviewImg = document.getElementById('avatarPreviewImg');
const avatarPlaceholderIcon = document.getElementById('avatarPlaceholderIcon');
const fullNameInput = document.getElementById('fullNameInput');
const emailInput = document.getElementById('emailInput');
const btnSaveProfile = document.getElementById('btnSaveProfile');
const btnSaveProfileText = document.getElementById('btnSaveProfileText');

// Step 4: Pledge
const interestsContainer = document.getElementById('interestsContainer');
const pledgeCheckbox = document.getElementById('pledgeCheckbox');
const btnFinish = document.getElementById('btnFinish');
const btnFinishText = document.getElementById('btnFinishText');
const btnFinishIcon = document.getElementById('btnFinishIcon');

// General UI elements
const toastElement = document.getElementById('toast');
const toastMessage = document.getElementById('toastMessage');
const toastIcon = document.getElementById('toastIcon');

// 3. UI Helpers: Toast Notifications
function showToast(message, type = 'success') {
  toastMessage.textContent = message;
  toastIcon.textContent = type === 'success' ? 'check_circle' : 'warning';
  
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

// 4. Session Verification: Redirect if already logged in
async function checkActiveSession() {
  if (supabaseClient) {
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (session && session.user) {
        // Check if profile exists
        const { data: profile } = await supabaseClient
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        
        if (profile && profile.full_name) {
          // Check if interest pledge is signed, if not go to step 4
          if (profile.interests && profile.interests.length > 0) {
            window.location.href = 'index.html';
            return;
          } else {
            verifiedUserId = session.user.id;
            goToStep(4);
            return;
          }
        } else {
          // If authenticated but profile is not completed, show Profile Step 3
          verifiedUserId = session.user.id;
          goToStep(3);
          return;
        }
      }
    } catch (err) {
      console.warn("Standard session check failed:", err);
    }
  }

  // Check Sandbox Mode Session
  const sandboxUser = localStorage.getItem('SANDBOX_USER');
  if (sandboxUser) {
    const user = JSON.parse(sandboxUser);
    if (user.full_name) {
      if (user.interests && user.interests.length > 0) {
        window.location.href = 'index.html';
      } else {
        verifiedUserId = user.id;
        isSandboxMode = true;
        sandboxBanner.style.display = 'block';
        goToStep(4);
      }
    } else {
      verifiedUserId = user.id;
      isSandboxMode = true;
      sandboxBanner.style.display = 'block';
      goToStep(3);
    }
  }
}

// Helper to switch steps with Tailwind animations
function goToStep(stepNumber) {
  currentStep = stepNumber;

  // Hide all steps
  document.querySelectorAll('.step-transition').forEach(el => {
    el.classList.remove('active-step');
    el.classList.add('hidden-step');
  });
  
  // Show target step
  const targetStep = document.getElementById(`step-${stepNumber}`);
  if(targetStep) {
    targetStep.classList.remove('hidden-step');
    targetStep.classList.add('active-step');
  }

  // Update dots
  for(let i=1; i<=4; i++) {
    const dot = document.getElementById(`dot-${i}`);
    if(dot) {
      if(i <= stepNumber) {
        dot.classList.remove('bg-surface-variant');
        dot.classList.add('bg-primary');
      } else {
        dot.classList.remove('bg-primary');
        dot.classList.add('bg-surface-variant');
      }
    }
  }
}

// Back Button Handler
btnBack.addEventListener('click', () => {
  if (currentStep === 1) {
    window.location.href = 'index.html';
  } else if (currentStep === 2) {
    goToStep(1);
  } else if (currentStep === 3) {
    // If they verified OTP already, they shouldn't easily change phone, but we let them go back to step 1 to restart
    goToStep(1);
  } else if (currentStep === 4) {
    goToStep(3);
  }
});

// 5. OTP Inputs auto advance
otpInputs.forEach((input, index) => {
  input.addEventListener('input', (e) => {
    input.value = input.value.replace(/[^0-9]/g, '');
    if (input.value && index < otpInputs.length - 1) {
      otpInputs[index + 1].focus();
    }
    gatherOtpCode();
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' && !input.value && index > 0) {
      otpInputs[index - 1].focus();
    }
  });
});

function gatherOtpCode() {
  const code = Array.from(otpInputs).map(input => input.value).join('');
  fullOtpCode.value = code;
}

// 6. Impact Tags Toggling (Step 4)
const tagButtons = document.querySelectorAll('.tag-btn');
tagButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    btn.classList.toggle('border-outline-variant');
    btn.classList.toggle('text-on-surface');
    
    btn.classList.toggle('border-primary');
    btn.classList.toggle('bg-primary/5');
    btn.classList.toggle('text-primary');
    
    // Add/remove checkmark icon if selected
    if (btn.classList.contains('text-primary')) {
      if (!btn.querySelector('.checkmark-icon')) {
        btn.insertAdjacentHTML('afterbegin', '<span class="material-symbols-outlined text-[14px] checkmark-icon">check</span> ');
      }
    } else {
      const check = btn.querySelector('.checkmark-icon');
      if (check) check.remove();
    }
  });
});

function getSelectedTags() {
  const selected = [];
  document.querySelectorAll('.tag-btn.text-primary').forEach(btn => {
    selected.push(btn.getAttribute('data-tag'));
  });
  return selected;
}

// 7. Form Actions handlers

// STEP 1: Phone submission
phoneForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const rawPhone = phoneInput.value.trim().replace(/\s/g, '');
  
  if (rawPhone.length < 10) {
    showToast('Please enter a valid 10-digit mobile number.', 'error');
    return;
  }

  // Prepend +91 if it doesn't already start with country code
  const phone = rawPhone.startsWith('+') ? rawPhone : '+91' + rawPhone.slice(-10);
  
  btnSendOtp.disabled = true;
  btnSendOtpText.textContent = "SENDING CODE...";
  currentPhoneNumber = phone;

  try {
    // Attempt standard Supabase Phone OTP
    const { error } = await supabaseClient.auth.signInWithOtp({
      phone: phone
    });

    if (error) {
      if (error.message.includes('SMS') || error.message.includes('provider') || error.message.includes('not configured')) {
        console.warn("SMS provider not configured. Switching to Sandbox Mode.");
        isSandboxMode = true;
        sandboxBanner.style.display = 'block';
        showToast('Entering sandbox verification mode.', 'success');
      } else {
        throw error;
      }
    }

    // Advance to step 2 (OTP code input)
    otpSubheader.textContent = `We sent a 6-digit verification code to ${phone}`;
    goToStep(2);
    otpInputs[0].focus();

  } catch (err) {
    console.error("OTP send failed:", err);
    showToast('Failed to send OTP. Sandbox Mode active.', 'error');
    isSandboxMode = true;
    sandboxBanner.style.display = 'block';
    otpSubheader.textContent = `[Sandbox] Enter any OTP code to verify ${phone}`;
    goToStep(2);
    otpInputs[0].focus();
  } finally {
    btnSendOtp.disabled = false;
    btnSendOtpText.textContent = "SEND VERIFICATION CODE";
  }
});

// STEP 2: Verify OTP
otpForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  gatherOtpCode();
  const code = fullOtpCode.value;

  if (code.length !== 6) {
    showToast('Please enter the full 6-digit code.', 'error');
    return;
  }

  btnVerifyOtp.disabled = true;
  btnVerifyOtpText.textContent = "VERIFYING...";

  try {
    if (isSandboxMode) {
      // Simulate verification
      const cleanPhone = currentPhoneNumber.replace(/[^0-9]/g, '');
      verifiedUserId = '11111111-1111-1111-1111-' + cleanPhone.padEnd(12, '0').substring(0, 12);
      
      localStorage.setItem('SANDBOX_USER', JSON.stringify({
        id: verifiedUserId,
        phone: currentPhoneNumber,
        full_name: null,
        email: null,
        avatar_url: null,
        interests: null
      }));

      showToast('OTP verified (Sandbox)! Complete your profile.', 'success');
      setTimeout(() => {
        goToStep(3);
      }, 800);
    } else {
      // Standard Supabase verification
      const { data, error } = await supabaseClient.auth.verifyOtp({
        phone: currentPhoneNumber,
        token: code,
        type: 'sms'
      });

      if (error) throw error;

      verifiedUserId = data.user.id;
      
      // Fetch profile
      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', verifiedUserId)
        .single();

      if (profile && profile.full_name) {
        // If profile exists but interests missing, go to step 4
        if (profile.interests && profile.interests.length > 0) {
          showToast('Logged in successfully!', 'success');
          setTimeout(() => {
            window.location.href = 'index.html';
          }, 1200);
        } else {
          showToast('Code verified! Complete your pledge.', 'success');
          goToStep(4);
        }
      } else {
        showToast('Code verified! Setup your profile.', 'success');
        goToStep(3);
      }
    }
  } catch (err) {
    console.error("OTP Verification failed:", err);
    showToast(err.message || 'Invalid code. Please try again.', 'error');
  } finally {
    btnVerifyOtp.disabled = false;
    btnVerifyOtpText.textContent = "VERIFY & CONTINUE";
  }
});

// STEP 3: Profile Configuration
avatarUploadTrigger.addEventListener('click', () => {
  avatarFileInput.click();
});

avatarFileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (event) => {
      avatarPreviewImg.src = event.target.result;
      avatarPreviewImg.classList.remove('hidden');
      avatarPlaceholderIcon.classList.add('hidden');
    };
    reader.readAsDataURL(file);
  }
});

profileForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = fullNameInput.value.trim();
  const email = emailInput.value.trim();
  const file = avatarFileInput.files[0];

  if (!name) {
    showToast('Name is required.', 'error');
    return;
  }

  btnSaveProfile.disabled = true;
  btnSaveProfileText.textContent = "UPLOADING PROFILE...";

  try {
    let avatarUrl = '';
    const client = isSandboxMode ? supabaseAdmin : supabaseClient;

    // Upload Avatar to bucket
    if (file) {
      const extension = file.name.split('.').pop();
      const fileName = `${verifiedUserId}_avatar_${Date.now()}.${extension}`;
      
      const { data: uploadData, error: uploadError } = await client.storage
        .from('avatars')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = client.storage
        .from('avatars')
        .getPublicUrl(fileName);

      avatarUrl = publicUrlData.publicUrl;
    } else {
      avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}`;
    }

    profileName = name;
    profileEmail = email;
    profileAvatarUrl = avatarUrl;

    showToast('Profile saved. Final step: Civic Pledge.', 'success');
    setTimeout(() => {
      goToStep(4);
    }, 800);

  } catch (err) {
    console.error("Profile saving failed:", err);
    showToast(err.message || 'Failed to upload profile info.', 'error');
  } finally {
    btnSaveProfile.disabled = false;
    btnSaveProfileText.textContent = "CONTINUE";
  }
});

// STEP 4: Pledge & Completion
btnFinish.addEventListener('click', async () => {
  if (!pledgeCheckbox.checked) {
    showToast('Please check the Civic Pledge box to continue.', 'error');
    return;
  }

  const interests = getSelectedTags();
  if (interests.length === 0) {
    showToast('Please select at least one area of interest.', 'error');
    return;
  }

  btnFinish.disabled = true;
  btnFinishText.textContent = "PROCESSING...";
  btnFinishIcon.textContent = "progress_activity";
  btnFinishIcon.classList.add('animate-spin');

  try {
    const client = isSandboxMode ? supabaseAdmin : supabaseClient;

    // Save profile to profiles table including selected interests
    const { error: dbError } = await client
      .from('profiles')
      .upsert({
        id: verifiedUserId,
        phone: currentPhoneNumber,
        full_name: profileName,
        email: profileEmail || null,
        avatar_url: profileAvatarUrl,
        interests: interests
      });

    if (dbError) throw dbError;

    // Update localStorage state if sandbox
    if (isSandboxMode) {
      localStorage.setItem('SANDBOX_USER', JSON.stringify({
        id: verifiedUserId,
        phone: currentPhoneNumber,
        full_name: profileName,
        email: profileEmail || null,
        avatar_url: profileAvatarUrl,
        interests: interests
      }));
    }

    btnFinishIcon.classList.remove('animate-spin');
    btnFinishIcon.textContent = "check_circle";
    btnFinishText.textContent = "WELCOME";
    btnFinish.classList.add('bg-tertiary-container', 'text-on-tertiary-container');

    showToast('Revolution joined! Opening portal...', 'success');

    setTimeout(() => {
      window.location.href = 'index.html';
    }, 1500);

  } catch (err) {
    console.error("Pledge completion failed:", err);
    showToast(err.message || 'Failed to complete registration.', 'error');
    btnFinish.disabled = false;
    btnFinishText.textContent = "JOIN THE REVOLUTION";
    btnFinishIcon.textContent = "celebration";
    btnFinishIcon.classList.remove('animate-spin');
  }
});

// Run session check on load
checkActiveSession();


