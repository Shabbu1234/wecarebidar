// =======================================================
// WeCareBidar - CITIZEN PROFILE CONTROLLER
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
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  supabaseAdmin = supabase.createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
} catch (e) {
  console.error("Supabase Initialization Error:", e);
}

// 2. DOM Elements
const sandboxBanner = document.getElementById('sandboxBanner');

// Navbar
const btnLogout = document.getElementById('btnLogout');
const btnLogoutMobile = document.getElementById('btnLogoutMobile');
const mobileMenu = document.getElementById('mobileMenu');

// Left Column - ID Card Elements
const cardAvatar = document.getElementById('cardAvatar');
const cardFullName = document.getElementById('cardFullName');
const cardUserId = document.getElementById('cardUserId');
const cardUserRank = document.getElementById('cardUserRank');
const cardValidThru = document.getElementById('cardValidThru');
const cardQrCode = document.getElementById('cardQrCode');
const cardJoinedDate = document.getElementById('cardJoinedDate');
const cardImpactScore = document.getElementById('cardImpactScore');
const btnUpdatePhoto = document.getElementById('btnUpdatePhoto');
const btnUpdatePhotoBtn = document.getElementById('btnUpdatePhotoBtn');
const avatarFileInput = document.getElementById('avatarFileInput');

// Right Column - Personal Info Elements
const btnEditSaveProfile = document.getElementById('btnEditSaveProfile');
const editSaveIcon = document.getElementById('editSaveIcon');
const editSaveText = document.getElementById('editSaveText');
const profileForm = document.getElementById('profileForm');
const inputFullName = document.getElementById('inputFullName');
const inputMobile = document.getElementById('inputMobile');
const inputEmail = document.getElementById('inputEmail');
const inputDistrict = document.getElementById('inputDistrict');
const interestsContainer = document.getElementById('interestsContainer');

// Account Settings
const btnDeleteAccount = document.getElementById('btnDeleteAccount');

// Toast
const toastElement = document.getElementById('toast');
const toastMessage = document.getElementById('toastMessage');
const toastIcon = document.getElementById('toastIcon');

// 3. State Management
let currentUser = null;
let currentProfile = null;
let isSandboxMode = false;
let editMode = false;
let selectedInterests = [];
const ALL_INTERESTS = [
  "Tree Plantation",
  "Waste Management",
  "Water Conservation",
  "Clean Energy",
  "Community Leadership",
  "Organic Farming"
];

// Interest Category Icon Helper Map
const INTEREST_ICONS = {
  "Tree Plantation": "forest",
  "Waste Management": "recycling",
  "Water Conservation": "water_drop",
  "Clean Energy": "bolt",
  "Community Leadership": "groups",
  "Organic Farming": "local_florist"
};

// 4. UI Helpers
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

// Check Session & Load Profile Info
async function loadCitizenProfile() {
  if (!supabaseClient) return;

  try {
    // 1. Resolve Auth Session
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (session && session.user) {
      currentUser = session.user;
      isSandboxMode = false;

      // Fetch Profile Data
      const { data: profile, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

      if (error || !profile) {
        window.location.href = 'auth.html';
        return;
      }
      currentProfile = profile;
    } else {
      // Check Sandbox mode fallback
      const sandboxUser = localStorage.getItem('SANDBOX_USER');
      if (sandboxUser) {
        currentProfile = JSON.parse(sandboxUser);
        currentUser = { id: currentProfile.id, isSandbox: true };
        isSandboxMode = true;
        sandboxBanner.style.display = 'block';
      } else {
        window.location.href = 'auth.html';
        return;
      }
    }

    // 2. Fetch User Verified Action Counts
    const client = isSandboxMode ? supabaseAdmin : supabaseClient;
    const { count: approvedCount } = await client
      .from('submissions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', currentUser.id)
      .eq('status', 'approved');

    const uploadsCount = approvedCount || 0;

    // 3. Render Profile Card & Form Info
    populateIDCard(uploadsCount);
    populatePersonalInfo();
    renderAwards(uploadsCount);

    // Render header/mobile controls
    const mobileUserAvatar = document.getElementById('mobileUserAvatar');
    const mobileUserFullName = document.getElementById('mobileUserFullName');
    const mobileUserHeader = document.getElementById('mobileUserHeader');
    const mobileUserStatsCount = document.getElementById('mobileUserStatsCount');
    
    const avatarUrl = currentProfile.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(currentProfile.full_name)}`;
    if (mobileUserAvatar) mobileUserAvatar.src = avatarUrl;
    if (mobileUserFullName) mobileUserFullName.textContent = currentProfile.full_name;
    if (mobileUserHeader) mobileUserHeader.classList.remove('hidden');
    if (mobileUserStatsCount) mobileUserStatsCount.textContent = `${uploadsCount} upload${uploadsCount === 1 ? '' : 's'} verified`;

  } catch (err) {
    console.error("Profile load error:", err);
    window.location.href = 'auth.html';
  }
}

// Populate Digital ID Card UI
function populateIDCard(uploadsCount) {
  // Avatar
  cardAvatar.src = currentProfile.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(currentProfile.full_name)}`;
  
  // Full Name
  cardFullName.textContent = currentProfile.full_name || "Citizen";
  
  // WCB Citizen ID (WCB-2026-last4)
  const shortId = currentProfile.id.slice(-4).toUpperCase();
  cardUserId.textContent = `ID: WCB-2026-${shortId}`;
  
  // Eco Rank based on Level
  const rank = getEcoRank(uploadsCount);
  cardUserRank.textContent = rank;
  
  // Dynamic QR Code pointing to citizen ID details
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent('WeCareBidar Citizen: ' + currentProfile.full_name + ' ID: ' + currentProfile.id)}`;
  cardQrCode.src = qrUrl;

  // Joined Date (NICELY formatted: e.g. Jun 2026)
  if (currentProfile.created_at) {
    const joined = new Date(currentProfile.created_at);
    const options = { month: 'short', year: 'numeric' };
    cardJoinedDate.textContent = joined.toLocaleDateString('en-US', options);
    
    // Set Valid Thru to next year's December
    const nextYear = joined.getFullYear() + 1;
    cardValidThru.textContent = `12 / ${nextYear}`;
  } else {
    cardJoinedDate.textContent = "Jun 2026";
    cardValidThru.textContent = "12 / 2027";
  }

  // Impact Score (approvedUploads * 100)
  cardImpactScore.textContent = uploadsCount * 100;
}

// Resolve Rank Names
function getEcoRank(uploads) {
  if (uploads <= 1) return "Eco Recruit (Level 1)";
  if (uploads === 2) return "Eco Defender (Level 2)";
  if (uploads <= 4) return "Eco Specialist (Level 3)";
  if (uploads <= 6) return "Eco Captain (Level 4)";
  if (uploads <= 8) return "Eco Commander (Level 5)";
  if (uploads <= 10) return "Eco Leader (Level 6)";
  return "Eco Warrior (Level 7)";
}

// Populate Input Fields
function populatePersonalInfo() {
  inputFullName.value = currentProfile.full_name || "";
  inputMobile.value = currentProfile.phone || "";
  inputEmail.value = currentProfile.email || "";
  inputDistrict.value = currentProfile.district || "Bidar North";
  selectedInterests = currentProfile.interests || [];

  renderInterests();
}

// Render dynamic Interactive Interest Badges
function renderInterests() {
  interestsContainer.innerHTML = '';

  if (!editMode) {
    // View mode: Only show selected interests
    if (selectedInterests.length === 0) {
      interestsContainer.innerHTML = '<span class="text-sm text-secondary italic">No interests selected. Click Edit to add.</span>';
      return;
    }
    selectedInterests.forEach(interest => {
      const icon = INTEREST_ICONS[interest] || "eco";
      interestsContainer.appendChild(createBadge(interest, icon, true));
    });
  } else {
    // Edit mode: Show all interests, click to toggle selection
    ALL_INTERESTS.forEach(interest => {
      const isSelected = selectedInterests.includes(interest);
      const icon = INTEREST_ICONS[interest] || "eco";
      const badge = createBadge(interest, icon, isSelected, true);
      
      badge.addEventListener('click', () => {
        if (selectedInterests.includes(interest)) {
          selectedInterests = selectedInterests.filter(i => i !== interest);
        } else {
          selectedInterests.push(interest);
        }
        renderInterests(); // Re-render toggled states
      });

      interestsContainer.appendChild(badge);
    });
  }
}

// Create Tag Badge Element
function createBadge(name, icon, isSelected, interactive = false) {
  const badge = document.createElement(interactive && editMode ? 'button' : 'span');
  badge.type = "button";
  
  const baseClasses = "px-4 py-2 rounded-full font-body-md text-[14px] font-semibold border flex items-center gap-2 transition-all duration-200";
  const selectedClasses = "bg-primary/10 text-primary-container border-primary/20 hover:bg-primary/15";
  const unselectedClasses = "border-dashed border-outline-variant text-secondary hover:border-primary hover:text-primary hover:bg-primary-fixed/5";

  badge.className = `${baseClasses} ${isSelected ? selectedClasses : unselectedClasses}`;
  
  const iconMarkup = `<span class="material-symbols-outlined text-[18px]">${icon}</span>`;
  badge.innerHTML = `${iconMarkup} ${name} ${editMode ? (isSelected ? '✓' : '+') : ''}`;

  return badge;
}

// Render dynamic Recognition & Awards cards
function renderAwards(uploadsCount) {
  // Badges lock criteria
  const badgeCriteria = [
    { id: "awardBadge1", limit: 1, text: "Seed Planter", subText: "Level 1 (1+ video approved)" },
    { id: "awardBadge2", limit: 3, text: "Water Saver", subText: "Level 2 (3+ videos approved)" },
    { id: "awardBadge3", limit: 5, text: "Energy Guru", subText: "Level 3 (5+ videos approved)" },
    { id: "awardBadge4", limit: 7, text: "Community Lead", subText: "Level 4 (7+ videos approved)" }
  ];

  badgeCriteria.forEach(badge => {
    const el = document.getElementById(badge.id);
    if (el) {
      const isUnlocked = uploadsCount >= badge.limit;
      const statusTextEl = el.querySelector('.badge-status');

      if (isUnlocked) {
        el.classList.remove('opacity-50', 'grayscale');
        statusTextEl.textContent = `Unlocked (${uploadsCount}/${badge.limit})`;
        statusTextEl.classList.add('text-primary-container', 'font-bold');
        statusTextEl.classList.remove('text-secondary');
      } else {
        el.classList.add('opacity-50', 'grayscale');
        statusTextEl.textContent = `Locked (${uploadsCount}/${badge.limit})`;
        statusTextEl.classList.remove('text-primary-container', 'font-bold');
        statusTextEl.classList.add('text-secondary');
      }
    }
  });
}

// 5. Save/Edit Handler
btnEditSaveProfile.addEventListener('click', async () => {
  if (!editMode) {
    // Switch to Edit Mode
    editMode = true;
    editSaveText.textContent = "Save Changes";
    editSaveIcon.textContent = "save";
    
    // Enable inputs
    inputFullName.disabled = false;
    inputEmail.disabled = false;
    inputDistrict.disabled = false;
    
    inputFullName.focus();
    renderInterests();
  } else {
    // Perform Saving
    const updatedName = inputFullName.value.trim();
    const updatedEmail = inputEmail.value.trim();
    const updatedDistrict = inputDistrict.value.trim();

    if (!updatedName) {
      showToast("Display Name cannot be empty!", "error");
      return;
    }

    btnEditSaveProfile.disabled = true;
    editSaveText.textContent = "Saving...";

    try {
      const client = isSandboxMode ? supabaseAdmin : supabaseClient;
      
      // Update in profiles database table
      const { error } = await client
        .from('profiles')
        .update({
          full_name: updatedName,
          email: updatedEmail || null,
          district: updatedDistrict || null,
          interests: selectedInterests
        })
        .eq('id', currentProfile.id);

      if (error) throw error;

      // Update local state
      currentProfile.full_name = updatedName;
      currentProfile.email = updatedEmail || null;
      currentProfile.district = updatedDistrict || null;
      currentProfile.interests = selectedInterests;

      if (isSandboxMode) {
        localStorage.setItem('SANDBOX_USER', JSON.stringify(currentProfile));
      }

      showToast("Profile details updated successfully!", "success");

      // Switch back to view mode
      editMode = false;
      editSaveText.textContent = "Edit";
      editSaveIcon.textContent = "edit";

      inputFullName.disabled = true;
      inputEmail.disabled = true;
      inputDistrict.disabled = true;

      // Refresh UI details
      populateIDCard(currentProfile.interests ? (await fetchUserUploadsCount()) : 0);
      renderInterests();

    } catch (err) {
      console.error("Save details failed:", err);
      showToast(err.message || "Failed to update profile.", "error");
      
      editSaveText.textContent = "Save Changes";
      editSaveIcon.textContent = "save";
    } finally {
      btnEditSaveProfile.disabled = false;
    }
  }
});

async function fetchUserUploadsCount() {
  try {
    const client = isSandboxMode ? supabaseAdmin : supabaseClient;
    const { count } = await client
      .from('submissions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', currentUser.id)
      .eq('status', 'approved');
    return count || 0;
  } catch (e) {
    return 0;
  }
}

// 6. Photo Updating Logic
function triggerAvatarUpload() {
  avatarFileInput.click();
}

btnUpdatePhoto.addEventListener('click', triggerAvatarUpload);
if (btnUpdatePhotoBtn) {
  btnUpdatePhotoBtn.addEventListener('click', triggerAvatarUpload);
}

avatarFileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const validTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    showToast("Invalid file format. Please upload PNG, JPG, GIF or WebP.", "error");
    return;
  }

  // Max 5MB
  if (file.size > 5 * 1024 * 1024) {
    showToast("Avatar image is too large! Maximum limit is 5MB.", "error");
    return;
  }

  // Pre-load temporary preview
  const reader = new FileReader();
  reader.onload = (event) => {
    cardAvatar.src = event.target.result;
  };
  reader.readAsDataURL(file);

  showToast("Uploading new photo to storage tunnel...", "success");

  try {
    const client = isSandboxMode ? supabaseAdmin : supabaseClient;
    const extension = file.name.split('.').pop();
    const fileName = `${currentProfile.id}_avatar_${Date.now()}.${extension}`;

    // Upload to avatars bucket
    const { data: uploadData, error: uploadError } = await client.storage
      .from('avatars')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: publicUrlData } = client.storage
      .from('avatars')
      .getPublicUrl(fileName);

    const avatarUrl = publicUrlData.publicUrl;

    // Update in profiles table
    const { error: dbError } = await client
      .from('profiles')
      .update({ avatar_url: avatarUrl })
      .eq('id', currentProfile.id);

    if (dbError) throw dbError;

    // Update local state
    currentProfile.avatar_url = avatarUrl;
    if (isSandboxMode) {
      localStorage.setItem('SANDBOX_USER', JSON.stringify(currentProfile));
    }

    cardAvatar.src = avatarUrl;
    const mobileUserAvatar = document.getElementById('mobileUserAvatar');
    if (mobileUserAvatar) mobileUserAvatar.src = avatarUrl;

    showToast("Profile image updated successfully!", "success");

  } catch (err) {
    console.error("Avatar upload failed:", err);
    showToast("Failed to upload avatar image.", "error");
    // Revert to original url
    cardAvatar.src = currentProfile.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(currentProfile.full_name)}`;
  }
});

// 7. Logout Action
async function handleLogout() {
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
}

btnLogout.addEventListener('click', handleLogout);
if (btnLogoutMobile) {
  btnLogoutMobile.addEventListener('click', handleLogout);
}

// 8. Delete Account Action (Danger Zone)
btnDeleteAccount.addEventListener('click', async () => {
  const confirmDelete = confirm("⚠️ WARNING: Are you sure you want to permanently delete your WeCareBidar citizen account and all your uploaded environmental actions? This action is absolute and CANNOT be undone.");
  
  if (!confirmDelete) return;

  try {
    showToast("Processing account purge. Cleaning files...", "error");
    const client = isSandboxMode ? supabaseAdmin : supabaseClient;

    if (isSandboxMode) {
      // Clean mock submissions
      await supabaseAdmin.from('submissions').delete().eq('user_id', currentUser.id);
      // Clean mock profile
      await supabaseAdmin.from('profiles').delete().eq('id', currentUser.id);
      
      localStorage.removeItem('SANDBOX_USER');
      showToast("Account purged successfully!", "success");
      setTimeout(() => {
        window.location.href = 'auth.html';
      }, 1500);
    } else {
      // 1. Delete user submissions
      const { error: subDeleteError } = await supabaseAdmin
        .from('submissions')
        .delete()
        .eq('user_id', currentUser.id);

      if (subDeleteError) console.warn("Failed to delete submissions:", subDeleteError);

      // 2. Delete profiles row
      const { error: profileDeleteError } = await supabaseAdmin
        .from('profiles')
        .delete()
        .eq('id', currentUser.id);

      if (profileDeleteError) console.warn("Failed to delete profile table row:", profileDeleteError);

      // 3. Delete auth user account using Admin client
      const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(currentUser.id);
      if (authDeleteError) throw authDeleteError;

      showToast("Your citizen profile has been permanently removed.", "success");
      
      setTimeout(() => {
        window.location.href = 'auth.html';
      }, 1500);
    }
  } catch (err) {
    console.error("Account purge failed:", err);
    showToast(err.message || "Failed to delete account. Contact support.", "error");
  }
});

// Load Profile
loadCitizenProfile();


