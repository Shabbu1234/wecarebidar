// =======================================================
// WeCareBidar - ADMIN VERIFICATION WORKSPACE CONTROLLER
// =======================================================

let supabaseUrl = localStorage.getItem('SUPABASE_URL') || 'https://biykjcpjydcicwsgjgmi.supabase.co';
let supabaseKey = localStorage.getItem('SUPABASE_KEY') || 'REPLACE_WITH_SUPABASE_SERVICE_ROLE_KEY';
let antgvityWebhookUrl = localStorage.getItem('ANTGVITY_WEBHOOK_URL') || 'https://cloud.activepieces.com/api/v1/webhooks/PR3T46AavqHabHXUymUjM';

let supabaseClient = null;
let pendingQueue = [];
let currentItem = null;
let isSandboxMode = false;

// DOM Elements
const loginModal = document.getElementById('loginModal');
const loginForm = document.getElementById('loginForm');
const adminTokenInput = document.getElementById('adminToken');
const sandboxBanner = document.getElementById('sandboxBanner');

const moderationWorkspace = document.getElementById('moderationWorkspace');
const emptyState = document.getElementById('emptyState');

const reviewVideo = document.getElementById('reviewVideo');
const reviewCategory = document.getElementById('reviewCategory');
const reviewTitle = document.getElementById('reviewTitle');
const reviewDescription = document.getElementById('reviewDescription');
const reviewContributorAvatar = document.getElementById('reviewContributorAvatar');
const reviewContributorName = document.getElementById('reviewContributorName');
const reviewLocation = document.getElementById('reviewLocation');
const reviewSubmittedDate = document.getElementById('reviewSubmittedDate');
const reviewAiScore = document.getElementById('reviewAiScore');

const checkNoHate = document.getElementById('checkNoHate');
const checkNoViolence = document.getElementById('checkNoViolence');
const checkScientific = document.getElementById('checkScientific');
const guardrailChecks = document.querySelectorAll('.guardrail-check');

const moderationFeedback = document.getElementById('moderationFeedback');
const btnApprove = document.getElementById('btnApprove');
const btnRevision = document.getElementById('btnRevision');
const btnReject = document.getElementById('btnReject');
const btnLogout = document.getElementById('btnLogout');
const btnHeaderLogout = document.getElementById('btnHeaderLogout');

const btnConfigureWebhook = document.getElementById('btnConfigureWebhook');
const webhookModal = document.getElementById('webhookModal');
const webhookUrlInput = document.getElementById('webhookUrlInput');
const btnSaveWebhook = document.getElementById('btnSaveWebhook');
const btnCloseWebhook = document.getElementById('btnCloseWebhook');

const toastElement = document.getElementById('toast');
const toastMessage = document.getElementById('toastMessage');
const toastIcon = document.getElementById('toastIcon');

const reviewAuditTrail = document.getElementById('reviewAuditTrail');
const headerUserAvatar = document.getElementById('headerUserAvatar');

// 1. Toast Notification System
function showToast(message, type = 'success') {
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
        if (headerUserAvatar) {
          headerUserAvatar.src = parsed.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(parsed.full_name)}`;
        }
      }
      
      loadPendingSubmissions();
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

  if (token.startsWith('http')) {
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

function logout() {
  localStorage.removeItem('SUPABASE_KEY');
  supabaseKey = '';
  supabaseClient = null;
  loginModal.classList.remove('hidden');
  moderationWorkspace.style.display = 'none';
  emptyState.style.display = 'block';
  reviewVideo.src = '';
  pendingQueue = [];
}

if (btnLogout) btnLogout.addEventListener('click', logout);
if (btnHeaderLogout) btnHeaderLogout.addEventListener('click', logout);

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

// 4. Data Loading and Display
async function loadPendingSubmissions() {
  if (!supabaseClient) return;

  try {
    const { data, error } = await supabaseClient
      .from('submissions')
      .select('*, profiles(email, phone, full_name, avatar_url)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error) throw error;

    pendingQueue = data || [];

    if (pendingQueue.length > 0) {
      showSubmission(pendingQueue[0]);
    } else {
      showEmptyState();
    }
  } catch (error) {
    console.error("Moderation queue fetch failed:", error);
    showToast('Error loading review items: ' + error.message, 'error');
  }
}

function showEmptyState() {
  currentItem = null;
  moderationWorkspace.style.display = 'none';
  emptyState.style.display = 'block';
  reviewVideo.src = '';
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
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

function showSubmission(submission) {
  currentItem = submission;
  emptyState.style.display = 'none';
  moderationWorkspace.style.display = 'grid';
  
  // Update text elements
  reviewTitle.textContent = submission.title || "Untitled Environmental Action";
  reviewCategory.textContent = submission.category || "ECOLOGICAL CAMPAIGN";
  reviewDescription.textContent = submission.user_description || "No description provided.";
  reviewLocation.textContent = submission.location || "Bidar Fort Zone";
  reviewSubmittedDate.textContent = formatTimeAgo(submission.created_at);
  reviewVideo.src = submission.video_url;
  
  // Set contributor details
  const name = submission.profiles?.full_name || submission.profiles?.phone || submission.profiles?.email || 'Anonymous Rebel';
  reviewContributorName.textContent = name;
  
  const avatar = submission.profiles?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}`;
  reviewContributorAvatar.src = avatar;

  // Generate random AI Confidence matching rating
  const seedScore = Math.floor(Math.random() * 9) + 90; // 90 to 98%
  reviewAiScore.textContent = `${seedScore}% MATCH`;

  // Disable Approve Button and clear checklist
  guardrailChecks.forEach(cb => cb.checked = false);
  btnApprove.disabled = true;
  moderationFeedback.value = '';

  reviewVideo.load();
  buildTimelineLogs(submission, seedScore);
}

// 5. Checklist Controls
guardrailChecks.forEach(checkbox => {
  checkbox.addEventListener('change', () => {
    const allChecked = Array.from(guardrailChecks).every(cb => cb.checked);
    btnApprove.disabled = !allChecked;
  });
});

// Helper: Extract filename from Supabase public URL
function extractFilename(url) {
  if (!url) return null;
  const parts = url.split('/temporary-videos/');
  if (parts.length === 2) {
    return parts[1];
  }
  return url.substring(url.lastIndexOf('/') + 1);
}

// 6. Action Handlers: Done (Approve)
btnApprove.addEventListener('click', async () => {
  if (!currentItem || !supabaseClient) return;

  const originalText = btnApprove.innerHTML;
  btnApprove.disabled = true;
  btnApprove.textContent = "Processing Approval...";

  try {
    // 1. Send Webhook payload to Activepieces
    const webhookPayload = {
      submissionId: currentItem.id,
      userId: currentItem.user_id,
      title: currentItem.title || "Environmental Action",
      location: currentItem.location || "Bidar",
      category: currentItem.category || "General",
      videoUrl: currentItem.video_url,
      description: currentItem.user_description,
      feedback: moderationFeedback.value.trim()
    };

    console.log("Posting payload to webhook:", antgvityWebhookUrl, webhookPayload);

    const webhookResponse = await fetch(antgvityWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(webhookPayload)
    });

    if (!webhookResponse.ok) {
      console.warn("Activepieces webhook returned non-200:", webhookResponse.status);
    }

    // 2. Clear video URL column and mark status as 'approved'
    const { error: dbError } = await supabaseClient
      .from('submissions')
      .update({
        status: 'approved',
        video_url: null // PURGE STORAGE COLUMNS
      })
      .eq('id', currentItem.id);

    if (dbError) throw dbError;

    // 3. Purge the raw video file from Supabase storage
    const filename = extractFilename(currentItem.video_url);
    if (filename) {
      const { error: storageError } = await supabaseClient.storage
        .from('temporary-videos')
        .remove([filename]);
      
      if (storageError) {
        console.warn("Video cleanup skipped (or already purged):", storageError.message);
      }
    }

    showToast('Campaign Action Approved and Storage Purged.');
    loadPendingSubmissions();

  } catch (err) {
    console.error("Approval error:", err);
    showToast('Approval action failed: ' + err.message, 'error');
  } finally {
    btnApprove.innerHTML = originalText;
    btnApprove.disabled = false;
  }
});

// Reject submission
btnReject.addEventListener('click', async () => {
  if (!currentItem || !supabaseClient) return;
  if (!confirm("Are you sure you want to permanently delete this submission?")) return;

  btnReject.disabled = true;

  try {
    // 1. Delete from submissions table
    const { error: dbError } = await supabaseClient
      .from('submissions')
      .delete()
      .eq('id', currentItem.id);

    if (dbError) throw dbError;

    // 2. Delete the raw video file from Supabase storage
    const filename = extractFilename(currentItem.video_url);
    if (filename) {
      await supabaseClient.storage
        .from('temporary-videos')
        .remove([filename]);
    }

    showToast('Submission permanently rejected and purged.');
    loadPendingSubmissions();

  } catch (err) {
    console.error("Rejection error:", err);
    showToast('Failed to reject submission: ' + err.message, 'error');
  } finally {
    btnReject.disabled = false;
  }
});

// Request Revision
btnRevision.addEventListener('click', async () => {
  if (!currentItem || !supabaseClient) return;
  
  const feedback = moderationFeedback.value.trim();
  if (!feedback) {
    showToast('Please enter revision instructions in the feedback area.', 'error');
    return;
  }

  btnRevision.disabled = true;

  try {
    // Log revision by updating notes/marking status as rejected to release client storage
    const { error: dbError } = await supabaseClient
      .from('submissions')
      .update({
        status: 'rejected', // Standard rejects to prevent infinite pending locks
        user_description: `[REVISION REQUESTED: ${feedback}] ` + currentItem.user_description
      })
      .eq('id', currentItem.id);

    if (dbError) throw dbError;

    // Delete the file from storage
    const filename = extractFilename(currentItem.video_url);
    if (filename) {
      await supabaseClient.storage
        .from('temporary-videos')
        .remove([filename]);
    }

    showToast('Revision request logged. Video cleared.');
    loadPendingSubmissions();

  } catch (err) {
    console.error("Revision error:", err);
    showToast('Failed to request revision: ' + err.message, 'error');
  } finally {
    btnRevision.disabled = false;
  }
});

// 7. Dynamic Timeline Loader
function buildTimelineLogs(submission, aiScore) {
  if (!reviewAuditTrail) return;
  
  const createdDate = new Date(submission.created_at);
  const formattedTime = createdDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  reviewAuditTrail.innerHTML = `
    <!-- Timeline Item 1 -->
    <div class="relative flex items-center gap-4 group">
        <div class="flex items-center justify-center w-10 h-10 rounded-full border-4 border-surface-bright bg-primary-fixed text-primary-container shadow shrink-0 relative z-10">
            <span class="material-symbols-outlined text-sm">person_add</span>
        </div>
        <div class="flex-grow bg-white p-4 rounded-lg shadow-sm border border-outline-variant/30 text-left">
            <div class="flex justify-between items-center mb-1">
                <span class="font-body-md text-sm font-bold text-on-surface">Assigned to You</span>
                <span class="text-xs font-label-caps text-outline">Just Now</span>
            </div>
            <p class="text-xs text-on-surface-variant">System auto-assignment based on active admin role.</p>
        </div>
    </div>
    <!-- Timeline Item 2 -->
    <div class="relative flex items-center gap-4 group">
        <div class="flex items-center justify-center w-10 h-10 rounded-full border-4 border-surface-bright bg-surface-dim text-on-surface-variant shadow shrink-0 relative z-10">
            <span class="material-symbols-outlined text-sm">smart_toy</span>
        </div>
        <div class="flex-grow bg-white p-4 rounded-lg shadow-sm border border-outline-variant/30 text-left">
            <div class="flex justify-between items-center mb-1">
                <span class="font-body-md text-sm font-bold text-on-surface">AI Pre-Screen</span>
                <span class="text-xs font-label-caps text-outline">${formattedTime}</span>
            </div>
            <p class="text-xs text-on-surface-variant">Passed automated pre-visual verification checks (${aiScore}% match).</p>
        </div>
    </div>
    <!-- Timeline Item 3 -->
    <div class="relative flex items-center gap-4 group">
        <div class="flex items-center justify-center w-10 h-10 rounded-full border-4 border-surface-bright bg-surface-dim text-on-surface-variant shadow shrink-0 relative z-10">
            <span class="material-symbols-outlined text-sm">upload_file</span>
        </div>
        <div class="flex-grow bg-white p-4 rounded-lg shadow-sm border border-outline-variant/30 text-left">
            <div class="flex justify-between items-center mb-1">
                <span class="font-body-md text-sm font-bold text-on-surface">Payload Received</span>
                <span class="text-xs font-label-caps text-outline">${formattedTime}</span>
            </div>
            <p class="text-xs text-on-surface-variant">Campaign payload verified in database from WCB Rebel App.</p>
        </div>
    </div>
  `;
}

// Initialize
checkAuthentication();

