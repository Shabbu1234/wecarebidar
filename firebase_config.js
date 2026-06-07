// =======================================================
# WeCareBidar - FIREBASE CONFIGURATION & INITIALIZATION
# =======================================================

// 1. Default Firebase Configurations (Use local storage if set)
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyFakeKeyHereForDevelopmentOnly_12345",
  authDomain: "wecarebidar-dev.firebaseapp.com",
  projectId: "wecarebidar-dev",
  storageBucket: "wecarebidar-dev.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:1234567890abcdef"
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
