// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC3_hr1PPPiprghSQy8KkPndK8FV6g_yyY",
  authDomain: "rn-gfx.firebaseapp.com",
  databaseURL: "https://rn-gfx-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "rn-gfx",
  storageBucket: "rn-gfx.firebasestorage.app",
  messagingSenderId: "426859283244",
  appId: "1:426859283244:android:e96227c41057cc35c2a289"
};

// Initialize Firebase
try {
  firebase.initializeApp(firebaseConfig);
} catch (error) {
  console.log("Firebase already initialized");
}

const auth = firebase.auth();
const db = firebase.database();

// Utility functions
function generateReferralCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function formatDate(dateString) {
  const options = { year: 'numeric', month: 'short', day: 'numeric' };
  return new Date(dateString).toLocaleDateString(undefined, options);
}

function showNotification(message, type = 'success') {
  const notification = document.createElement('div');
  notification.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
  notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
  notification.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    if (notification.parentNode) {
      notification.remove();
    }
  }, 5000);
}