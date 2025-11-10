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
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
} catch (error) {
  console.log("Firebase initialization error:", error);
}

const auth = firebase.auth();
const db = firebase.database();

// API-like functions using Firebase directly
const EarnAppAPI = {
  // Get user data
  getUser: (userId) => {
    return db.ref('users/' + userId).once('value')
      .then(snapshot => {
        if (snapshot.exists()) {
          return { success: true, data: snapshot.val() };
        } else {
          return { success: false, message: 'User not found' };
        }
      })
      .catch(error => {
        return { success: false, message: error.message };
      });
  },

  // Get user earnings
  getEarnings: (userId) => {
    return db.ref('earnings/' + userId).once('value')
      .then(snapshot => {
        return { success: true, data: snapshot.val() || {} };
      })
      .catch(error => {
        return { success: false, message: error.message };
      });
  },

  // Add earnings
  addEarnings: (userId, type, amount) => {
    const earningRef = db.ref('earnings/' + userId).push();
    return earningRef.set({
      type: type,
      amount: parseInt(amount),
      timestamp: new Date().toISOString()
    }).then(() => {
      // Update user's total coins
      return db.ref('users/' + userId).once('value')
        .then(snapshot => {
          const userData = snapshot.val();
          return db.ref('users/' + userId).update({
            coins: (userData.coins || 0) + parseInt(amount)
          });
        });
    }).then(() => {
      return { success: true, message: 'Earnings added successfully' };
    }).catch(error => {
      return { success: false, message: error.message };
    });
  },

  // Complete task
  completeTask: (userId, taskId, taskName, reward) => {
    const earningRef = db.ref('earnings/' + userId).push();
    return earningRef.set({
      type: `Task: ${taskName}`,
      amount: parseInt(reward),
      timestamp: new Date().toISOString(),
      taskId: taskId
    }).then(() => {
      // Update user's coins and tasks completed
      return db.ref('users/' + userId).transaction(userData => {
        if (userData) {
          userData.coins = (userData.coins || 0) + parseInt(reward);
          userData.tasksCompleted = (userData.tasksCompleted || 0) + 1;
        }
        return userData;
      });
    }).then(() => {
      return { success: true, message: 'Task completed successfully' };
    }).catch(error => {
      return { success: false, message: error.message };
    });
  },

  // Connect WhatsApp
  connectWhatsApp: (userId) => {
    return db.ref('users/' + userId).update({
      whatsappConnected: true,
      whatsappConnectedAt: new Date().toISOString(),
      lastWhatsAppEarning: new Date().toISOString()
    }).then(() => {
      return { success: true, message: 'WhatsApp connected successfully' };
    }).catch(error => {
      return { success: false, message: error.message };
    });
  },

  // Get referrals
  getReferrals: (userId) => {
    return db.ref('users/' + userId).once('value')
      .then(userSnapshot => {
        const userData = userSnapshot.val();
        if (!userData || !userData.referralCode) {
          return { success: true, data: {} };
        }
        
        return db.ref('users').orderByChild('referredBy').equalTo(userData.referralCode).once('value')
          .then(snapshot => {
            return { success: true, data: snapshot.val() || {} };
          });
      })
      .catch(error => {
        return { success: false, message: error.message };
      });
  },

  // Use referral code
  useReferral: (newUserId, referralCode) => {
    // Find user with this referral code
    return db.ref('users').orderByChild('referralCode').equalTo(referralCode).once('value')
      .then(snapshot => {
        if (!snapshot.exists()) {
          return { success: false, message: 'Invalid referral code' };
        }

        const referrerData = snapshot.val();
        const referrerId = Object.keys(referrerData)[0];
        const referrer = referrerData[referrerId];

        // Update new user
        return db.ref('users/' + newUserId).update({
          referredBy: referralCode,
          coins: firebase.database.ServerValue.increment(50)
        }).then(() => {
          // Add referral bonus to referrer
          const earningRef = db.ref('earnings/' + referrerId).push();
          return earningRef.set({
            type: 'Referral Bonus',
            amount: 100,
            timestamp: new Date().toISOString()
          });
        }).then(() => {
          // Update referrer's coins
          return db.ref('users/' + referrerId).update({
            coins: firebase.database.ServerValue.increment(100)
          });
        }).then(() => {
          return { success: true, message: 'Referral applied successfully' };
        });
      })
      .catch(error => {
        return { success: false, message: error.message };
      });
  }
};

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
  const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
  return new Date(dateString).toLocaleDateString(undefined, options);
}

function showNotification(message, type = 'success') {
  // Remove existing notifications
  const existingNotifications = document.querySelectorAll('.custom-notification');
  existingNotifications.forEach(notification => notification.remove());

  const notification = document.createElement('div');
  notification.className = `custom-notification alert alert-${type} alert-dismissible fade show position-fixed`;
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