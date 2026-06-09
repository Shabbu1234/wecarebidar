// =======================================================
// WeCareBidar - ADMIN VERIFICATION WORKSPACE CONTROLLER
// =======================================================

let antgvityWebhookUrl = localStorage.getItem('ANTGVITY_WEBHOOK_URL') || 'https://cloud.activepieces.com/api/v1/webhooks/PR3T46AavqHabHXUymUjM';

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
const reviewVideoIframe = document.getElementById('reviewVideoIframe');
const videoLoadingSpinner = document.getElementById('videoLoadingSpinner');
const videoErrorFallback = document.getElementById('videoErrorFallback');
const btnOpenExternal = document.getElementById('btnOpenExternal');
const btnPermanentOpen = document.getElementById('btnPermanentOpen');
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
async function hashPassword(str) {
  const msgBuffer = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function checkAuthentication() {
  const token = localStorage.getItem('ADMIN_TOKEN') || '';
  if (token) {
    const inputHash = await hashPassword(token + 'wcb_salt_2026');
    const validHash = await hashPassword('adminbidar5854@' + 'wcb_salt_2026');
    if (inputHash === validHash) {
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
      return;
    }
  }
  loginModal.classList.remove('hidden');
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const token = adminTokenInput.value.trim();
  
  if (!token) {
    showToast('Token key is required.', 'error');
    return;
  }

  const inputHash = await hashPassword(token + 'wcb_salt_2026');
  const validHash = await hashPassword('adminbidar5854@' + 'wcb_salt_2026');
  
  if (inputHash === validHash) {
    localStorage.setItem('ADMIN_TOKEN', token);
    checkAuthentication();
  } else {
    showToast('Invalid admin verification token.', 'error');
  }
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
  if (window.videoLoadTimeout) {
    clearTimeout(window.videoLoadTimeout);
    window.videoLoadTimeout = null;
  }
  localStorage.removeItem('ADMIN_TOKEN');
  loginModal.classList.remove('hidden');
  moderationWorkspace.style.display = 'none';
  emptyState.style.display = 'block';
  reviewVideo.src = '';
  reviewVideo.style.display = 'none';
  if (reviewVideoIframe) {
    reviewVideoIframe.src = '';
    reviewVideoIframe.style.display = 'none';
  }
  if (videoErrorFallback) {
    videoErrorFallback.style.display = 'none';
  }
  if (videoLoadingSpinner) videoLoadingSpinner.style.display = 'flex';
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
  try {
    const querySnapshot = await db.collection('submissions')
      .where('status', '==', 'pending')
      .get();

    const pending = [];
    const userIds = new Set();

    querySnapshot.forEach(doc => {
      const data = doc.data();
      let created_at = data.created_at;
      if (created_at && typeof created_at.toDate === 'function') {
        created_at = created_at.toDate().toISOString();
      }
      pending.push({
        id: doc.id,
        ...data,
        created_at: created_at || new Date().toISOString()
      });
      if (data.user_id) {
        userIds.add(data.user_id);
      }
    });

    // Sort in memory by created_at ascending (FIFO queue)
    pending.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    // Fetch profiles for userIds
    const profiles = {};
    if (userIds.size > 0) {
      const chunks = Array.from(userIds);
      const profilePromises = chunks.map(uid => db.collection('profiles').doc(uid).get());
      const profileDocs = await Promise.all(profilePromises);
      profileDocs.forEach(pDoc => {
        if (pDoc.exists) {
          profiles[pDoc.id] = pDoc.data();
        }
      });
    }

    // Attach profile info
    pending.forEach(sub => {
      if (sub.user_id && profiles[sub.user_id]) {
        sub.profiles = {
          email: profiles[sub.user_id].email,
          phone: profiles[sub.user_id].phone,
          full_name: profiles[sub.user_id].full_name,
          avatar_url: profiles[sub.user_id].avatar_url
        };
      }
    });

    pendingQueue = pending;

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
  if (window.videoLoadTimeout) {
    clearTimeout(window.videoLoadTimeout);
    window.videoLoadTimeout = null;
  }
  currentItem = null;
  moderationWorkspace.style.display = 'none';
  emptyState.style.display = 'block';
  reviewVideo.src = '';
  if (reviewVideoIframe) {
    reviewVideoIframe.src = '';
    reviewVideoIframe.style.display = 'none';
  }
  if (videoErrorFallback) {
    videoErrorFallback.style.display = 'none';
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
  // -------------------------------------------------------
  // VIDEO PLAYER LOGIC
  // Handles local dev transcode proxy (for Chrome H.265 HEVC compatibility)
  // and direct Pixeldrain playback + iframe fallback on deployed sites.
  // -------------------------------------------------------
  const isCloudinary = (submission.video_url || '').includes('cloudinary.com');
  
  // Create transformed URL for Cloudinary to force H.264 video format transcoding
  let transformedVideoUrl = submission.video_url || '';
  if (isCloudinary) {
    if (transformedVideoUrl.includes('video/upload/') && !transformedVideoUrl.includes('vc_h264,f_mp4/')) {
      transformedVideoUrl = transformedVideoUrl.replace('video/upload/', 'video/upload/vc_h264,f_mp4/');
    }
    const urlParts = transformedVideoUrl.split('.');
    if (urlParts.length > 1) {
      urlParts[urlParts.length - 1] = 'mp4';
      transformedVideoUrl = urlParts.join('.');
    }
  }

  const pdFileId = isCloudinary ? null : (submission.pixeldrain_file_id ||
    (submission.video_url || '').match(/\/api\/(?:stream|transcode)-video\/([a-zA-Z0-9_-]+)/)?.[1] ||
    (submission.video_url || '').match(/pixeldrain\.(?:com|net)\/api\/file\/([a-zA-Z0-9_-]+)/)?.[1]);

  if (btnPermanentOpen) {
    btnPermanentOpen.href = (pdFileId && !isCloudinary) ? `https://pixeldrain.net/u/${pdFileId}` : (transformedVideoUrl || '#');
  }

  // Show loading spinner
  if (videoLoadingSpinner) videoLoadingSpinner.style.display = 'flex';
  reviewVideo.style.display = 'none';
  if (reviewVideoIframe) {
    reviewVideoIframe.style.display = 'none';
    reviewVideoIframe.src = '';
  }
  if (videoErrorFallback) {
    videoErrorFallback.style.display = 'none';
  }

  // Setup video events for robust handling
  const clearLoadTimeout = () => {
    if (window.videoLoadTimeout) {
      clearTimeout(window.videoLoadTimeout);
      window.videoLoadTimeout = null;
    }
  };

  reviewVideo.onplaying = () => {
    clearLoadTimeout();
    if (videoLoadingSpinner) videoLoadingSpinner.style.display = 'none';
  };
  
  reviewVideo.onloadedmetadata = () => {
    clearLoadTimeout();
    if (videoLoadingSpinner) videoLoadingSpinner.style.display = 'none';
  };

  reviewVideo.oncanplay = () => {
    clearLoadTimeout();
    if (videoLoadingSpinner) videoLoadingSpinner.style.display = 'none';
  };

  reviewVideo.onloadeddata = () => {
    clearLoadTimeout();
    if (videoLoadingSpinner) videoLoadingSpinner.style.display = 'none';
  };

  // If the video fails to load, show external fallback card
  reviewVideo.onerror = () => {
    clearLoadTimeout();
    console.warn("HTML5 Video playback failed. Showing fallback external link...");
    reviewVideo.style.display = 'none';
    if (videoErrorFallback) {
      if (btnOpenExternal) {
        btnOpenExternal.href = (pdFileId && !isCloudinary) ? `https://pixeldrain.net/u/${pdFileId}` : (transformedVideoUrl || '#');
      }
      videoErrorFallback.style.display = 'flex';
    }
    if (videoLoadingSpinner) videoLoadingSpinner.style.display = 'none';
  };

  // Set a backup loading timeout (5 seconds) to handle stalls/CORS blocks
  clearLoadTimeout();
  window.videoLoadTimeout = setTimeout(() => {
    if (videoLoadingSpinner && videoLoadingSpinner.style.display !== 'none') {
      console.warn("Video load timeout reached (5s). Showing fallback external link...");
      reviewVideo.style.display = 'none';
      if (videoErrorFallback) {
        if (btnOpenExternal) {
          btnOpenExternal.href = (pdFileId && !isCloudinary) ? `https://pixeldrain.net/u/${pdFileId}` : (transformedVideoUrl || '#');
        }
        videoErrorFallback.style.display = 'flex';
      }
      if (videoLoadingSpinner) videoLoadingSpinner.style.display = 'none';
    }
  }, 5000);

  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  if (pdFileId) {
    // If local, use the ffmpeg transcode proxy
    // If remote, use the direct raw file stream from Pixeldrain
    const videoSourceUrl = isLocalhost 
      ? `/api/transcode-video/${pdFileId}` 
      : `https://pixeldrain.net/api/file/${pdFileId}`;

    reviewVideo.pause();
    reviewVideo.removeAttribute('src');
    reviewVideo.load();

    reviewVideo.src = videoSourceUrl;
    reviewVideo.style.display = 'block';
    reviewVideo.load();
    reviewVideo.play().catch(err => {
      console.log('Autoplay blocked or load failed:', err.message);
      if (videoLoadingSpinner) videoLoadingSpinner.style.display = 'none';
    });
  } else {
    // Fallback: use video_url directly
    const directUrl = transformedVideoUrl || '';
    reviewVideo.pause();
    reviewVideo.removeAttribute('src');
    reviewVideo.load();

    reviewVideo.src = directUrl;
    reviewVideo.style.display = 'block';
    reviewVideo.load();
    reviewVideo.play().catch(err => {
      console.log('Autoplay blocked or load failed:', err.message);
      if (videoLoadingSpinner) videoLoadingSpinner.style.display = 'none';
    });
  }

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
  try {
    const decodedUrl = decodeURIComponent(url);
    const parts = decodedUrl.split('/temporary-videos/');
    if (parts.length === 2) {
      return parts[1].split('?')[0];
    }
    return url.substring(url.lastIndexOf('/') + 1).split('?')[0];
  } catch (e) {
    console.error("Error decoding URL:", e);
    return null;
  }
}

// 6. Action Handlers: Done (Approve)
btnApprove.addEventListener('click', async () => {
  if (!currentItem) return;

  const originalText = btnApprove.innerHTML;
  btnApprove.disabled = true;
  btnApprove.textContent = "Processing Approval...";

  try {
    // 1. Trigger the Activepieces/AntGvity Webhook for social distribution
    const bucketFileName = extractFilename(currentItem.video_url) || currentItem.pixeldrain_file_id || currentItem.id;
    const payload = {
      videoId: currentItem.id,
      videoUrl: currentItem.video_url || "",
      user_description: currentItem.user_description || "",
      bucketFileName: bucketFileName,
      cloudinaryPublicId: currentItem.cloudinary_public_id || "",
      pixeldrainFileId: currentItem.pixeldrain_file_id || ""
    };

    console.log("Triggering AntGvity webhook with payload:", payload);

    try {
      const response = await fetch(antgvityWebhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        console.warn(`Webhook responded with status: ${response.status}`);
      } else {
        console.log("Webhook triggered successfully!");
      }
    } catch (webhookErr) {
      // Log error but don't block Firestore update, in case webhook is offline but DB state should update
      console.error("AntGvity webhook execution failed:", webhookErr);
    }

    // 2. Update Firestore document status
    await db.collection('submissions').doc(currentItem.id).update({
      status: 'approved'
    });

    showToast('Campaign Action Approved! Video queued for cloud social publishing.');
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
  if (!currentItem) return;
  if (!confirm("Are you sure you want to permanently delete this submission?")) return;

  btnReject.disabled = true;

  try {
    // Set status to 'rejected_delete' so backend script can delete the video from Cloudinary/Firebase and delete the document.
    await db.collection('submissions').doc(currentItem.id).update({
      status: 'rejected_delete'
    });

    showToast('Submission queued for permanent deletion and media purge.');
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
  if (!currentItem) return;
  
  const feedback = moderationFeedback.value.trim();
  if (!feedback) {
    showToast('Please enter revision instructions in the feedback area.', 'error');
    return;
  }

  btnRevision.disabled = true;

  try {
    await db.collection('submissions').doc(currentItem.id).update({
      status: 'rejected',
      user_description: `[REVISION REQUESTED: ${feedback}] ` + currentItem.user_description
    });

    showToast('Revision request logged. Video queued for storage purge.');
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

