const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");

const app = express();
app.use(cors());
app.use(express.json());

// Firebase Admin initialization (Vercel-safe)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      type: "service_account",
      project_id: "rn-gfx",
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: process.env.FIREBASE_CERT_URL
    }),
    databaseURL: "https://rn-gfx-default-rtdb.asia-southeast1.firebasedatabase.app"
  });
}

const db = admin.database();

// ✅ Health Check
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "API Running ✔️",
    version: "1.0.0",
    time: new Date().toISOString(),
  });
});

// ✅ Get User
app.get("/api/user/:userId", async (req, res) => {
  const snapshot = await db.ref("users/" + req.params.userId).once("value");
  if (!snapshot.exists()) return res.status(404).json({ success: false, message: "User not found" });
  res.json({ success: true, data: snapshot.val() });
});

// ✅ Add Earnings
app.post("/api/earnings/:userId", async (req, res) => {
  const { amount, type } = req.body;
  const userId = req.params.userId;

  if (!amount || !type) {
    return res.status(400).json({ success: false, message: "amount & type required" });
  }

  const earningsRef = db.ref("earnings/" + userId).push();
  const data = {
    type,
    amount,
    timestamp: new Date().toISOString()
  };

  await earningsRef.set(data);
  await db.ref("users/" + userId).update({
    coins: admin.database.ServerValue.increment(amount),
  });

  res.json({ success: true, message: "Earning added", data });
});

// ✅ 404 fallback
app.use("*", (req, res) => {
  res.status(404).json({ success: false, message: "Endpoint not found" });
});

app.listen(3000, () => console.log("✅ API running on port 3000"));