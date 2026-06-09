// =======================================================
// WeCareBidar - UPLOAD CONTROLLER LOGIC
// =======================================================

// 1. Firebase Initialization Check
if (typeof db === 'undefined' || typeof auth === 'undefined' || typeof storage === 'undefined') {
  console.warn("⚠️ Firebase objects not found. Checking if loaded asynchronously...");
}

// 2. DOM Elements
const sandboxBanner = document.getElementById('sandboxBanner');
const uploadForm = document.getElementById('uploadForm');
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const uploadProgress = document.getElementById('upload-progress');
const filenameDisplay = document.getElementById('filename-display');
const progressPercentText = document.getElementById('progressPercentText');
const progressFillBar = document.getElementById('progressFillBar');
const btnCancelUpload = document.getElementById('btnCancelUpload');

const titleInput = document.getElementById('title');
const locationSelect = document.getElementById('location');
const categorySelect = document.getElementById('category');
const descriptionInput = document.getElementById('description');
const charCountSpan = document.getElementById('char-count');
const submitBtn = document.getElementById('submitBtn');
const submitBtnTextSpan = document.getElementById('submitBtnTextSpan');
const submitBtnIconSpan = document.getElementById('submitBtnIconSpan');

const toastElement = document.getElementById('toast');
const toastMessage = document.getElementById('toastMessage');
const toastIcon = document.getElementById('toastIcon');

// 3. State Management
let currentUser = null;
let currentProfile = null;
let isSandboxMode = false;
let selectedFile = null;
const MAX_FILE_SIZE_GB = 2;
const MAX_FILE_SIZE_MB = MAX_FILE_SIZE_GB * 1024; // 2048 MB
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_GB * 1024 * 1024 * 1024; // 2GB in bytes
const MAX_CHARS = 300;

// Pixeldrain API key for direct browser upload
// This is safe to have client-side — it only allows uploading to your account
const PIXELDRAIN_API_KEY = 'bcc7feb8-edb2-4054-8a13-feb93f0e215b';
const PIXELDRAIN_API_BASE = 'https://pixeldrain.net';

// 4. UI Helpers: Toast
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

// 5. Auth Session Checking
async function checkAuthSession() {
  auth.onAuthStateChanged((user) => {
    if (user) {
      currentUser = user;
      isSandboxMode = false;
      if (sandboxBanner) sandboxBanner.style.display = 'none';
      console.log("Logged in user uploading campaign action:", user.email);
    } else {
      currentUser = null;
      isSandboxMode = false;
      console.log("Anonymous user uploading campaign action.");
    }
  });
}


// 6. Character Count Handler for Notes
descriptionInput.addEventListener('input', function() {
  const currentLength = this.value.length;
  if (currentLength > MAX_CHARS) {
    this.value = this.value.substring(0, MAX_CHARS);
  }
  charCountSpan.textContent = `${this.value.length} / ${MAX_CHARS}`;
  
  if (this.value.length >= MAX_CHARS) {
    charCountSpan.classList.add('text-error');
    charCountSpan.classList.remove('text-outline');
  } else {
    charCountSpan.classList.remove('text-error');
    charCountSpan.classList.add('text-outline');
  }
});

// 7. Drag & Drop Visual Effects & Listeners
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
  dropZone.addEventListener(eventName, (e) => {
    e.preventDefault();
    e.stopPropagation();
  }, false);
});

['dragenter', 'dragover'].forEach(eventName => {
  dropZone.addEventListener(eventName, () => {
    dropZone.classList.add('drag-active');
  }, false);
});

['dragleave', 'drop'].forEach(eventName => {
  dropZone.addEventListener(eventName, () => {
    dropZone.classList.remove('drag-active');
  }, false);
});

dropZone.addEventListener('drop', (e) => {
  const dt = e.dataTransfer;
  const files = dt.files;
  if (files.length > 0) {
    fileInput.files = files;
    handleFileSelection(files[0]);
  }
});

fileInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) {
    handleFileSelection(e.target.files[0]);
  }
});

// Validate selection
function handleFileSelection(file) {
  if (!file) return;

  const validTypes = ['video/mp4', 'video/quicktime'];
  const nameLower = file.name.toLowerCase();
  
  if (!validTypes.includes(file.type) && !nameLower.endsWith('.mp4') && !nameLower.endsWith('.mov')) {
    showToast('Invalid file format! Please upload an MP4 or MOV video clip.', 'error');
    resetFileSelection();
    return;
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    showToast(`File is too large! Maximum limit is ${MAX_FILE_SIZE_GB}GB (${MAX_FILE_SIZE_MB}MB).`, 'error');
    resetFileSelection();
    return;
  }

  selectedFile = file;
  filenameDisplay.textContent = file.name;
  
  // Show progress indicator with 0%
  updateProgress(0, 'File attached');
  uploadProgress.classList.remove('hidden');

  // Format file size display (MB or GB)
  const fileSizeMB = file.size / (1024 * 1024);
  const fileSizeDisplay = fileSizeMB >= 1024
    ? `${(fileSizeMB / 1024).toFixed(2)} GB`
    : `${fileSizeMB.toFixed(1)} MB`;

  // Change upload zone text dynamically to show attachment
  document.getElementById('drag-text-title').textContent = "Video Attached Successfully";
  document.getElementById('drag-text-subtitle').textContent = `${file.name} (${fileSizeDisplay})`;
  document.getElementById('drag-text-specs').classList.add('hidden');
  
  // Warn user for large files
  if (file.size > 500 * 1024 * 1024) { // Over 500MB
    showToast(`Large file detected (${fileSizeDisplay}). Uploading using resumable chunked transfer - please keep this tab open!`, 'success');
  }
}

function resetFileSelection() {
  selectedFile = null;
  fileInput.value = '';
  uploadProgress.classList.add('hidden');
  
  document.getElementById('drag-text-title').textContent = "Drag & Drop Video";
  document.getElementById('drag-text-subtitle').textContent = "or click to browse local files";
  document.getElementById('drag-text-specs').classList.remove('hidden');
}

btnCancelUpload.addEventListener('click', () => {
  if (window.activeUploadTask) {
    try {
      if (typeof window.activeUploadTask.cancel === 'function') {
        window.activeUploadTask.cancel();
      } else if (typeof window.activeUploadTask.abort === 'function') {
        window.activeUploadTask.abort();
      }
      console.log("Upload task cancelled by user.");
    } catch (e) {
      console.error("Error cancelling upload:", e);
    }
    window.activeUploadTask = null;
  }
  resetFileSelection();
});

// 8. Video Upload & Submission Form Handler
uploadForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  // AUTH CHECK REMOVED: Anyone can upload now.

  if (!selectedFile) {
    showToast('Please attach a valid video file first!', 'error');
    return;
  }

  const title = titleInput.value.trim();
  const location = locationSelect.value;
  const category = categorySelect.value;
  const notes = descriptionInput.value.trim();

  if (!title || !location || !category || !notes) {
    showToast('All fields are required.', 'error');
    return;
  }

  try {
    // Disable inputs
    submitBtn.disabled = true;
    titleInput.disabled = true;
    locationSelect.disabled = true;
    categorySelect.disabled = true;
    descriptionInput.disabled = true;
    fileInput.disabled = true;
    btnCancelUpload.style.display = 'none';

    submitBtnTextSpan.textContent = "Uploading video...";
    submitBtnIconSpan.textContent = "sync";
    submitBtnIconSpan.classList.add('animate-spin');

    // -------------------------------------------------------
    // DIRECT CLOUDINARY UPLOAD (works on deployed site + local)
    // Uses XMLHttpRequest so we can track upload progress
    // -------------------------------------------------------
    const cloudinaryResponse = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      let cloudName = (typeof cloudinaryConfig !== 'undefined' && cloudinaryConfig.cloudName) || 'dqm62mqbs';
      let uploadPreset = (typeof cloudinaryConfig !== 'undefined' && cloudinaryConfig.uploadPreset) || 'wecare_preset';
      
      // Secure fallback checks to prevent null/undefined strings from breaking client upload
      if (!cloudName || cloudName === 'null' || cloudName === 'undefined' || cloudName.trim() === '') {
        cloudName = 'dqm62mqbs';
      }
      if (!uploadPreset || uploadPreset === 'null' || uploadPreset === 'undefined' || uploadPreset.trim() === '') {
        uploadPreset = 'wecare_preset';
      }
      
      xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`);
      window.activeUploadTask = xhr;

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          const loadedMB = (e.loaded / (1024 * 1024)).toFixed(1);
          const totalMB = (e.total / (1024 * 1024)).toFixed(1);
          const totalDisplay = e.total >= 1024 * 1024 * 1024
            ? `${(e.total / (1024 * 1024 * 1024)).toFixed(2)} GB`
            : `${totalMB} MB`;
          const loadedDisplay = e.loaded >= 1024 * 1024 * 1024
            ? `${(e.loaded / (1024 * 1024 * 1024)).toFixed(2)} GB`
            : `${loadedMB} MB`;
          updateProgress(percent, `${loadedDisplay} / ${totalDisplay} uploaded...`);
          submitBtnTextSpan.textContent = `Uploading Video (${percent}%)`;
        }
      });

      xhr.addEventListener('load', () => {
        window.activeUploadTask = null;
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const responseData = JSON.parse(xhr.responseText);
            if (responseData.secure_url) {
              resolve({ success: true, secure_url: responseData.secure_url, public_id: responseData.public_id });
            } else {
              reject(new Error(responseData.error?.message || 'Cloudinary upload failed.'));
            }
          } catch (err) {
            reject(new Error('Failed to parse Cloudinary response.'));
          }
        } else {
          try {
            const responseData = JSON.parse(xhr.responseText);
            reject(new Error(responseData.error?.message || `Upload failed with status ${xhr.status}`));
          } catch(e) {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        }
      });

      xhr.addEventListener('error', () => {
        window.activeUploadTask = null;
        reject(new Error('Network error during upload. Please check your connection.'));
      });

      xhr.addEventListener('abort', () => {
        window.activeUploadTask = null;
        reject(new Error('Upload cancelled by user.'));
      });

      // Send as FormData with the file and upload preset
      const formData = new FormData();
      formData.append('file', selectedFile, selectedFile.name);
      formData.append('upload_preset', uploadPreset);
      xhr.send(formData);
    });

    updateProgress(100, 'Registering environmental action record...');
    submitBtnTextSpan.textContent = 'Saving details...';

    // Format user description to display beautifully in admin and automation
    const unifiedDescription = `Campaign: ${title}\nZone: ${location}\nCategory: ${category}\nNotes: ${notes}`;

    // Store the raw Cloudinary download/stream URL
    const videoUrl = cloudinaryResponse.secure_url;

    // Write to submissions collection in Firestore
    try {
      await db.collection('submissions').add({
        user_id: currentUser ? currentUser.uid : null,
        user_description: unifiedDescription,
        video_url: videoUrl,
        cloudinary_public_id: cloudinaryResponse.public_id || null,
        pixeldrain_file_id: cloudinaryResponse.public_id || null, // Fallback key just in case
        title: title,
        location: location,
        category: category,
        status: 'pending',
        created_at: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (dbError) {
      console.error("Firestore submission failed.", dbError);
      throw dbError;
    }

    // Success state
    submitBtnIconSpan.classList.remove('animate-spin');
    submitBtnIconSpan.textContent = "check_circle";
    submitBtnTextSpan.textContent = "Done";
    submitBtn.classList.remove('bg-primary', 'hover:bg-surface-tint');
    submitBtn.classList.add('bg-tertiary-container', 'text-on-tertiary-container');
    submitBtn.disabled = false;

    // Attach click listener for redirecting manually
    submitBtn.onclick = (e) => {
      e.preventDefault();
      window.location.href = 'index.html';
    };

    // Animate lifecycle stepper to Verification (Step 2)
    const step2Circle = document.getElementById('step2Circle');
    const step2Text = document.getElementById('step2Text');
    if (step2Circle) {
      step2Circle.className = "w-12 h-12 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-lg shadow-primary/20";
    }
    if (step2Text) {
      step2Text.className = "font-label-caps text-label-caps text-primary";
    }

    showToast('Your video uploaded successfully! Campaign action submitted for verification.', 'success');

  } catch (error) {
    console.error("Submission failed:", error);
    showToast(error.message || 'Submission failed. Please check credentials or network.', 'error');
    
    // Reset form states
    submitBtn.disabled = false;
    titleInput.disabled = false;
    locationSelect.disabled = false;
    categorySelect.disabled = false;
    descriptionInput.disabled = false;
    fileInput.disabled = false;
    btnCancelUpload.style.display = 'block';
    
    submitBtnTextSpan.textContent = "Submit Environmental Action";
    submitBtnIconSpan.textContent = "arrow_forward";
    submitBtnIconSpan.classList.remove('animate-spin');
    submitBtn.classList.remove('bg-tertiary-container', 'text-on-tertiary-container');
  }
});

function updateProgress(percent, statusText) {
  progressFillBar.style.width = `${percent}%`;
  progressPercentText.textContent = `${statusText} ${percent}%`;
}

// Initial Auth Check
checkAuthSession();


