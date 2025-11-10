const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initialize Firebase Admin
const serviceAccount = {
  "type": "service_account",
  "project_id": "rn-gfx",
  "private_key_id": "your_private_key_id",
  "private_key": process.env.FIREBASE_PRIVATE_KEY || "your_private_key_here",
  "client_email": "firebase-adminsdk-xxxxx@rn-gfx.iam.gserviceaccount.com",
  "client_id": "your_client_id",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxxxx%40rn-gfx.iam.gserviceaccount.com"
};

try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://rn-gfx-default-rtdb.asia-southeast1.firebasedatabase.app'
  });
  console.log('Firebase Admin initialized successfully');
} catch (error) {
  console.log('Firebase Admin already initialized');
}

const db = admin.database();

// Serve static files for GitHub Pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'EarnApp API is running successfully',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Get user data
app.get('/api/user/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const userRef = db.ref('users/' + userId);
    const snapshot = await userRef.once('value');
    
    if (snapshot.exists()) {
      res.json({
        success: true,
        data: snapshot.val()
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
  } catch (error) {
    console.error('Error getting user:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get user earnings
app.get('/api/earnings/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const earningsRef = db.ref('earnings/' + userId);
    const snapshot = await earningsRef.once('value');
    
    const earnings = snapshot.val() || {};
    
    // Convert to array and sort by timestamp
    const earningsArray = Object.keys(earnings).map(key => ({
      id: key,
      ...earnings[key]
    })).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    res.json({
      success: true,
      data: earningsArray
    });
  } catch (error) {
    console.error('Error getting earnings:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Add earnings (for WhatsApp or tasks)
app.post('/api/earnings/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const { type, amount } = req.body;
    
    if (!userId || !type || !amount) {
      return res.status(400).json({
        success: false,
        message: 'User ID, type, and amount are required'
      });
    }

    const earningsRef = db.ref('earnings/' + userId);
    const newEarningRef = earningsRef.push();
    
    const earningData = {
      type: type,
      amount: parseInt(amount),
      timestamp: new Date().toISOString()
    };
    
    await newEarningRef.set(earningData);
    
    // Update user's total coins
    const userRef = db.ref('users/' + userId);
    const userSnapshot = await userRef.once('value');
    const userData = userSnapshot.val();
    
    const newCoins = (userData?.coins || 0) + parseInt(amount);
    
    await userRef.update({
      coins: newCoins
    });
    
    res.json({
      success: true,
      message: 'Earnings added successfully',
      data: {
        earning: earningData,
        newBalance: newCoins
      }
    });
  } catch (error) {
    console.error('Error adding earnings:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get available tasks
app.get('/api/tasks', async (req, res) => {
  try {
    const tasksRef = db.ref('tasks');
    const snapshot = await tasksRef.once('value');
    
    let tasks = snapshot.val();
    
    // If no tasks in database, provide default tasks
    if (!tasks) {
      tasks = {
        'task1': {
          id: 'task1',
          title: 'Download App A',
          description: 'Install and open the app for 30 seconds',
          reward: 50,
          category: 'download',
          status: 'active'
        },
        'task2': {
          id: 'task2',
          title: 'Complete Survey',
          description: 'Answer a quick survey about your preferences',
          reward: 30,
          category: 'survey',
          status: 'active'
        },
        'task3': {
          id: 'task3',
          title: 'Watch Video',
          description: 'Watch a short video advertisement',
          reward: 20,
          category: 'video',
          status: 'active'
        },
        'task4': {
          id: 'task4',
          title: 'Sign Up for Newsletter',
          description: 'Subscribe to our newsletter',
          reward: 25,
          category: 'signup',
          status: 'active'
        },
        'task5': {
          id: 'task5',
          title: 'Download App B',
          description: 'Install and run the app once',
          reward: 75,
          category: 'download',
          status: 'active'
        }
      };
      
      // Save default tasks to database
      await tasksRef.set(tasks);
    }
    
    // Convert to array
    const tasksArray = Object.keys(tasks).map(key => tasks[key]);
    
    res.json({
      success: true,
      data: tasksArray
    });
  } catch (error) {
    console.error('Error getting tasks:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Complete task
app.post('/api/complete-task/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const { taskId, taskName, reward } = req.body;
    
    if (!userId || !taskId || !taskName || !reward) {
      return res.status(400).json({
        success: false,
        message: 'User ID, task ID, task name, and reward are required'
      });
    }

    // Add earnings
    const earningsRef = db.ref('earnings/' + userId);
    const newEarningRef = earningsRef.push();
    
    const earningData = {
      type: `Task: ${taskName}`,
      amount: parseInt(reward),
      timestamp: new Date().toISOString(),
      taskId: taskId
    };
    
    await newEarningRef.set(earningData);
    
    // Update user's total coins and tasks completed
    const userRef = db.ref('users/' + userId);
    const userSnapshot = await userRef.once('value');
    const userData = userSnapshot.val();
    
    const newCoins = (userData?.coins || 0) + parseInt(reward);
    const tasksCompleted = (userData?.tasksCompleted || 0) + 1;
    
    await userRef.update({
      coins: newCoins,
      tasksCompleted: tasksCompleted
    });
    
    res.json({
      success: true,
      message: 'Task completed successfully',
      data: {
        earning: earningData,
        newBalance: newCoins,
        tasksCompleted: tasksCompleted
      }
    });
  } catch (error) {
    console.error('Error completing task:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Connect WhatsApp
app.post('/api/connect-whatsapp/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    await db.ref('users/' + userId).update({
      whatsappConnected: true,
      whatsappConnectedAt: new Date().toISOString(),
      lastWhatsAppEarning: null
    });
    
    res.json({
      success: true,
      message: 'WhatsApp connected successfully'
    });
  } catch (error) {
    console.error('Error connecting WhatsApp:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get user referrals
app.get('/api/referrals/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    // Get user's referral code first
    const userRef = db.ref('users/' + userId);
    const userSnapshot = await userRef.once('value');
    const userData = userSnapshot.val();
    
    if (!userData || !userData.referralCode) {
      return res.json({
        success: true,
        data: []
      });
    }
    
    // Find users who used this referral code
    const referralsRef = db.ref('users');
    const snapshot = await referralsRef.orderByChild('referredBy').equalTo(userData.referralCode).once('value');
    
    const referrals = snapshot.val() || {};
    
    // Convert to array
    const referralsArray = Object.keys(referrals).map(key => ({
      id: key,
      ...referrals[key]
    }));
    
    res.json({
      success: true,
      data: {
        referralCode: userData.referralCode,
        referrals: referralsArray,
        totalReferrals: referralsArray.length,
        earnedFromReferrals: referralsArray.length * 100
      }
    });
  } catch (error) {
    console.error('Error getting referrals:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Use referral code
app.post('/api/use-referral', async (req, res) => {
  try {
    const { referralCode, newUserId } = req.body;
    
    if (!referralCode || !newUserId) {
      return res.status(400).json({
        success: false,
        message: 'Referral code and user ID are required'
      });
    }

    // Find user with this referral code
    const usersRef = db.ref('users');
    const snapshot = await usersRef.orderByChild('referralCode').equalTo(referralCode).once('value');
    
    if (!snapshot.exists()) {
      return res.status(404).json({
        success: false,
        message: 'Invalid referral code'
      });
    }
    
    const referrerData = snapshot.val();
    const referrerId = Object.keys(referrerData)[0];
    const referrer = referrerData[referrerId];
    
    // Update new user to mark as referred and add bonus
    const newUserRef = db.ref('users/' + newUserId);
    await newUserRef.update({
      referredBy: referralCode,
      coins: admin.database.ServerValue.increment(50)
    });
    
    // Add referral earnings to referrer
    const earningsRef = db.ref('earnings/' + referrerId);
    await earningsRef.push().set({
      type: 'Referral Bonus',
      amount: 100,
      timestamp: new Date().toISOString()
    });
    
    // Update referrer's coins
    await db.ref('users/' + referrerId).update({
      coins: admin.database.ServerValue.increment(100)
    });
    
    res.json({
      success: true,
      message: 'Referral applied successfully',
      data: {
        newUserBonus: 50,
        referrerBonus: 100
      }
    });
  } catch (error) {
    console.error('Error using referral:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Process WhatsApp earnings for all connected users
app.post('/api/process-whatsapp-earnings', async (req, res) => {
  try {
    const usersRef = db.ref('users');
    const snapshot = await usersRef.once('value');
    const users = snapshot.val();
    
    if (!users) {
      return res.json({
        success: true,
        message: 'No users found',
        processed: 0
      });
    }
    
    const promises = [];
    let processedCount = 0;
    
    Object.keys(users).forEach(userId => {
      const user = users[userId];
      if (user.whatsappConnected) {
        const earningRef = db.ref('earnings/' + userId).push();
        const promise = earningRef.set({
          type: 'WhatsApp Earnings',
          amount: 50,
          timestamp: new Date().toISOString()
        }).then(() => {
          return db.ref('users/' + userId).update({
            coins: admin.database.ServerValue.increment(50),
            lastWhatsAppEarning: new Date().toISOString()
          });
        });
        promises.push(promise);
        processedCount++;
      }
    });
    
    await Promise.all(promises);
    
    res.json({
      success: true,
      message: `WhatsApp earnings processed for ${processedCount} users`,
      processed: processedCount
    });
  } catch (error) {
    console.error('Error processing WhatsApp earnings:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Update user profile
app.put('/api/user/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const { fullName, phone } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }
    
    const updates = {};
    if (fullName) updates.fullName = fullName;
    if (phone) updates.phone = phone;
    
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }
    
    await db.ref('users/' + userId).update(updates);
    
    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: updates
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get leaderboard
app.get('/api/leaderboard', async (req, res) => {
  try {
    const usersRef = db.ref('users');
    const snapshot = await usersRef.orderByChild('coins').limitToLast(10).once('value');
    
    const users = snapshot.val() || {};
    
    // Convert to array and sort by coins
    const leaderboard = Object.keys(users).map(key => ({
      id: key,
      fullName: users[key].fullName,
      coins: users[key].coins || 0,
      tasksCompleted: users[key].tasksCompleted || 0
    })).sort((a, b) => b.coins - a.coins);
    
    res.json({
      success: true,
      data: leaderboard
    });
  } catch (error) {
    console.error('Error getting leaderboard:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found'
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 EarnApp API server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📍 API Base URL: http://localhost:${PORT}/api`);
});