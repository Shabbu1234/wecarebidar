// =======================================================
// WeCareBidar - FIREBASE CONFIGURATION & INITIALIZATION
// =======================================================

// 1. Default Firebase Configurations (Use local storage if set)
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyDjlhHUc7rGgq4MuxJoeNc_-lgzhHO2fMY",
  authDomain: "wecarebidar-79a83.firebaseapp.com",
  projectId: "wecarebidar-79a83",
  storageBucket: "wecarebidar-79a83.firebasestorage.app",
  messagingSenderId: "312661221535",
  appId: "1:312661221535:web:9807b2d0b6ac1fc13502aa",
  measurementId: "G-LZRX1JM5D4"
};


const firebaseConfig = {
  apiKey: localStorage.getItem('FIREBASE_API_KEY') || DEFAULT_FIREBASE_CONFIG.apiKey,
  authDomain: localStorage.getItem('FIREBASE_AUTH_DOMAIN') || DEFAULT_FIREBASE_CONFIG.authDomain,
  projectId: localStorage.getItem('FIREBASE_PROJECT_ID') || DEFAULT_FIREBASE_CONFIG.projectId,
  storageBucket: localStorage.getItem('FIREBASE_STORAGE_BUCKET') || DEFAULT_FIREBASE_CONFIG.storageBucket,
  messagingSenderId: localStorage.getItem('FIREBASE_MESSAGING_SENDER_ID') || DEFAULT_FIREBASE_CONFIG.messagingSenderId,
  appId: localStorage.getItem('FIREBASE_APP_ID') || DEFAULT_FIREBASE_CONFIG.appId
};

// Initialize Firebase
let db, auth, storage;

if (typeof firebase !== 'undefined') {
  firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
  auth = firebase.auth();
  storage = firebase.storage();
  console.log("🔥 Firebase initialized successfully!");
} else {
  console.warn("⚠️ Firebase SDK not loaded yet. Make sure script tags are included in HTML.");
}

// 2. Cloudinary configuration for direct unsigned uploads
const cloudinaryConfig = {
  cloudName: localStorage.getItem('CLOUDINARY_CLOUD_NAME') || 'dqm62mqbs',
  uploadPreset: localStorage.getItem('CLOUDINARY_UPLOAD_PRESET') || 'wecare_preset'
};

