// Firebase Functions for API endpoints
// Deploy this to Firebase Cloud Functions

const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

// API to get user data
exports.getUser = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    try {
        const userId = context.auth.uid;
        const userDoc = await admin.database().ref(`users/${userId}`).once('value');
        
        if (!userDoc.exists()) {
            throw new functions.https.HttpsError('not-found', 'User not found');
        }

        return {
            success: true,
            data: userDoc.val()
        };
    } catch (error) {
        throw new functions.https.HttpsError('internal', error.message);
    }
});

// API to add earnings
exports.addEarnings = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    try {
        const { type, amount } = data;
        const userId = context.auth.uid;

        if (!type || !amount) {
            throw new functions.https.HttpsError('invalid-argument', 'Type and amount are required');
        }

        const earningRef = admin.database().ref(`earnings/${userId}`).push();
        await earningRef.set({
            type: type,
            amount: parseInt(amount),
            timestamp: new Date().toISOString()
        });

        // Update user's total coins
        const userRef = admin.database().ref(`users/${userId}`);
        const userSnapshot = await userRef.once('value');
        const userData = userSnapshot.val();

        await userRef.update({
            coins: (userData.coins || 0) + parseInt(amount)
        });

        return {
            success: true,
            message: 'Earnings added successfully'
        };
    } catch (error) {
        throw new functions.https.HttpsError('internal', error.message);
    }
});

// API to process referral
exports.processReferral = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    try {
        const { referralCode } = data;
        const newUserId = context.auth.uid;

        if (!referralCode) {
            throw new functions.https.HttpsError('invalid-argument', 'Referral code is required');
        }

        // Find user with this referral code
        const usersRef = admin.database().ref('users');
        const snapshot = await usersRef.orderByChild('referralCode').equalTo(referralCode).once('value');

        if (!snapshot.exists()) {
            throw new functions.https.HttpsError('not-found', 'Invalid referral code');
        }

        const referrerData = snapshot.val();
        const referrerId = Object.keys(referrerData)[0];
        const referrer = referrerData[referrerId];

        // Update new user to mark as referred
        await admin.database().ref(`users/${newUserId}`).update({
            referredBy: referralCode
        });

        // Add bonus to new user
        await admin.database().ref(`users/${newUserId}`).update({
            coins: (referrerData.coins || 0) + 50
        });

        // Add referral earnings to referrer
        const earningsRef = admin.database().ref(`earnings/${referrerId}`).push();
        await earningsRef.set({
            type: 'Referral Bonus',
            amount: 100,
            timestamp: new Date().toISOString()
        });

        // Update referrer's coins
        await admin.database().ref(`users/${referrerId}`).update({
            coins: (referrer.coins || 0) + 100
        });

        return {
            success: true,
            message: 'Referral applied successfully'
        };
    } catch (error) {
        throw new functions.https.HttpsError('internal', error.message);
    }
});

// Scheduled function for WhatsApp earnings (runs every 20 minutes)
exports.processWhatsAppEarnings = functions.pubsub.schedule('every 20 minutes').onRun(async (context) => {
    try {
        const usersRef = admin.database().ref('users');
        const snapshot = await usersRef.once('value');
        const users = snapshot.val();

        if (!users) return null;

        const promises = [];
        Object.keys(users).forEach(userId => {
            const user = users[userId];
            if (user.whatsappConnected) {
                const earningRef = admin.database().ref(`earnings/${userId}`).push();
                promises.push(
                    earningRef.set({
                        type: 'WhatsApp Earnings',
                        amount: 50,
                        timestamp: new Date().toISOString()
                    }).then(() => {
                        return admin.database().ref(`users/${userId}`).update({
                            coins: (user.coins || 0) + 50,
                            lastWhatsAppEarning: new Date().toISOString()
                        });
                    })
                );
            }
        });

        await Promise.all(promises);
        console.log(`Processed WhatsApp earnings for ${promises.length} users`);
        return null;
    } catch (error) {
        console.error('Error processing WhatsApp earnings:', error);
        return null;
    }
});