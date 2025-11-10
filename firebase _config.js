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
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();