// =======================================================
// WeCareBidar - MANIFESTO ABOUT PAGE CONTROLLER
// =======================================================

// 1. Firebase Initialization Check
if (typeof db === 'undefined' || typeof auth === 'undefined' || typeof storage === 'undefined') {
  console.warn("⚠️ Firebase objects not found. Checking if loaded asynchronously...");
}

// Authentication UI logic removed as per user request.
// Only public information is now accessible.
