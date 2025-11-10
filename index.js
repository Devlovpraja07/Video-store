const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Firebase Admin
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://rn-gfx-default-rtdb.asia-southeast1.firebasedatabase.app'
});

const db = admin.database();

// API Routes

// Get user data
app.get('/api/user/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
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
    const earningsRef = db.ref('earnings/' + userId);
    const snapshot = await earningsRef.once('value');
    
    const earnings = snapshot.val() || {};
    res.json({
      success: true,
      data: earnings
    });
  } catch (error) {
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
    
    const earningsRef = db.ref('earnings/' + userId);
    const newEarningRef = earningsRef.push();
    
    await newEarningRef.set({
      type: type,
      amount: amount,
      timestamp: new Date().toISOString()
    });
    
    // Update user's total coins
    const userRef = db.ref('users/' + userId);
    const userSnapshot = await userRef.once('value');
    const userData = userSnapshot.val();
    
    await userRef.update({
      coins: (userData.coins || 0) + amount
    });
    
    res.json({
      success: true,
      message: 'Earnings added successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get tasks
app.get('/api/tasks', async (req, res) => {
  try {
    const tasksRef = db.ref('tasks');
    const snapshot = await tasksRef.once('value');
    
    const tasks = snapshot.val() || {};
    res.json({
      success: true,
      data: tasks
    });
  } catch (error) {
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
    const { taskId } = req.body;
    
    // Get task details
    const taskRef = db.ref('tasks/' + taskId);
    const taskSnapshot = await taskRef.once('value');
    
    if (!taskSnapshot.exists()) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }
    
    const task = taskSnapshot.val();
    
    // Add earnings
    const earningsRef = db.ref('earnings/' + userId);
    const newEarningRef = earningsRef.push();
    
    await newEarningRef.set({
      type: `Task: ${task.title}`,
      amount: task.reward,
      timestamp: new Date().toISOString()
    });
    
    // Update user's total coins and tasks completed
    const userRef = db.ref('users/' + userId);
    const userSnapshot = await userRef.once('value');
    const userData = userSnapshot.val();
    
    await userRef.update({
      coins: (userData.coins || 0) + task.reward,
      tasksCompleted: (userData.tasksCompleted || 0) + 1
    });
    
    res.json({
      success: true,
      message: 'Task completed successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Referral system
app.post('/api/use-referral', async (req, res) => {
  try {
    const { referralCode, newUserId } = req.body;
    
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
    
    // Update new user to mark as referred
    const newUserRef = db.ref('users/' + newUserId);
    await newUserRef.update({
      referredBy: referralCode
    });
    
    // Add bonus to new user
    await newUserRef.update({
      coins: (referrerData.coins || 0) + 50
    });
    
    // Add referral earnings to referrer
    const earningsRef = db.ref('earnings/' + referrerId);
    await earningsRef.push().set({
      type: 'Referral Bonus',
      amount: 100,
      timestamp: new Date().toISOString()
    });
    
    // Update referrer's coins
    const referrerRef = db.ref('users/' + referrerId);
    await referrerRef.update({
      coins: (referrer.coins || 0) + 100
    });
    
    res.json({
      success: true,
      message: 'Referral applied successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});