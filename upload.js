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
const CHUNK_SIZE = 6 * 1024 * 1024; // 6MB chunks for resumable upload
const MAX_CHARS = 300;

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

// 5. Auth Session Checking (Disabled)
async function checkAuthSession() {
  // Authentication is disabled as per user request.
  currentUser = null;
  isSandboxMode = false;
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
      window.activeUploadTask.cancel();
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

    // Create a unique clean file name
    const ext = selectedFile.name.split('.').pop().toLowerCase();
    const prefix = currentUser ? 'action' : 'anon';
    const cleanFileName = `${Date.now()}_${prefix}_${Math.random().toString(36).substring(2, 9)}.${ext}`;

    // Upload to Firebase Storage
    const publicVideoUrl = await new Promise((resolve, reject) => {
      const storageRef = storage.ref().child(`temporary-videos/${cleanFileName}`);
      const uploadTask = storageRef.put(selectedFile);
      window.activeUploadTask = uploadTask;

      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          const percent = Math.round(progress);
          const loadedMB = (snapshot.bytesTransferred / (1024 * 1024)).toFixed(1);
          const totalMB = (snapshot.totalBytes / (1024 * 1024)).toFixed(1);
          const totalDisplay = snapshot.totalBytes >= 1024 * 1024 * 1024
            ? `${(snapshot.totalBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
            : `${totalMB} MB`;
          const loadedDisplay = snapshot.bytesTransferred >= 1024 * 1024 * 1024
            ? `${(snapshot.bytesTransferred / (1024 * 1024 * 1024)).toFixed(2)} GB`
            : `${loadedMB} MB`;
          updateProgress(percent, `${loadedDisplay} / ${totalDisplay} uploaded...`);
          submitBtnTextSpan.textContent = `Uploading Video (${percent}%)`;
        }, 
        (error) => {
          window.activeUploadTask = null;
          reject(error);
        }, 
        async () => {
          window.activeUploadTask = null;
          try {
            const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
            resolve(downloadURL);
          } catch (err) {
            reject(err);
          }
        }
      );
    });

    updateProgress(100, 'Registering environmental action record...');
    submitBtnTextSpan.textContent = 'Saving details...';

    // Format user description to display beautifully in admin and automation
    const unifiedDescription = `Campaign: ${title}\nZone: ${location}\nCategory: ${category}\nNotes: ${notes}`;

    // Write to submissions collection in Firestore
    try {
      await db.collection('submissions').add({
        user_id: currentUser ? currentUser.uid : null,
        user_description: unifiedDescription,
        video_url: publicVideoUrl,
        title: title,
        location: location,
        category: category,
        status: 'pending',
        created_at: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (dbError) {
      // Rollback video upload if DB record fails
      try {
        await storage.ref().child(`temporary-videos/${cleanFileName}`).delete();
      } catch (delError) {
        console.error("Cleanup upload rollback failed:", delError);
      }
      throw dbError;
    }

    // Success state
    submitBtnIconSpan.classList.remove('animate-spin');
    submitBtnIconSpan.textContent = "check_circle";
    submitBtnTextSpan.textContent = "Action Submitted!";
    submitBtn.classList.add('bg-tertiary-container', 'text-on-tertiary-container');

    // Animate lifecycle stepper to Verification (Step 2)
    const step2Circle = document.getElementById('step2Circle');
    const step2Text = document.getElementById('step2Text');
    if (step2Circle) {
      step2Circle.className = "w-12 h-12 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-lg shadow-primary/20";
    }
    if (step2Text) {
      step2Text.className = "font-label-caps text-label-caps text-primary";
    }

    showToast('Campaign action submitted for verification!', 'success');

    setTimeout(() => {
      window.location.href = 'index.html';
    }, 2000);

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


