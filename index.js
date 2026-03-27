import express from "express";
import dotenv from "dotenv";
import admin from "firebase-admin";
import crypto from "crypto";
import nodemailer from "nodemailer";

dotenv.config();

const app = express();
app.use(express.json());

// ✅ PORT (Render compatible)
const PORT = process.env.PORT || 4000;

/* =========================
   📧 SMTP CONFIG (Brevo)
========================= */
const SMTP_HOST = process.env.SMTP_HOST || "smtp-relay.brevo.com";
const SMTP_PORT = Number(process.env.SMTP_PORT) || 587;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM_EMAIL = process.env.SMTP_FROM_EMAIL || SMTP_USER;
const SMTP_FROM_NAME = process.env.SMTP_FROM_NAME || "Quiz Game";

// 🔍 Debug logs
console.log("SMTP HOST:", SMTP_HOST);
console.log("SMTP PORT:", SMTP_PORT);
console.log("SMTP USER:", SMTP_USER ? "Loaded" : "Missing");

/* =========================
   🔥 FIREBASE INIT
========================= */
const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

if (!serviceAccountJson) {
  console.error("❌ FIREBASE_SERVICE_ACCOUNT_JSON missing");
  process.exit(1);
}

let serviceAccount;
try {
  serviceAccount = JSON.parse(
    serviceAccountJson.replace(/\\n/g, "\n") // ✅ FIX
  );
} catch (err) {
  console.error("❌ Invalid Firebase JSON:", err.message);
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

/* =========================
   📧 NODEMAILER SETUP
========================= */
if (!SMTP_USER || !SMTP_PASS) {
  console.error("❌ SMTP_USER or SMTP_PASS missing");
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: false, // ⚠️ always false for 587/2525
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000
});

// ✅ Verify SMTP
transporter.verify()
  .then(() => console.log("✅ SMTP ready"))
  .catch(err => console.error("❌ SMTP error:", err.message));

// 📩 Send Mail function
async function sendMail({ to, subject, html }) {
  const from = `${SMTP_FROM_NAME} <${SMTP_FROM_EMAIL}>`;

  const info = await transporter.sendMail({
    from,
    to,
    subject,
    html
  });

  console.log("📨 Email sent:", info.messageId);
  return info;
}

/* =========================
   🌐 CORS
========================= */
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

/* =========================
   🧪 ROUTES
========================= */

// Root
app.get("/", (_req, res) => {
  res.send("Server is running 🚀");
});

// Health check
app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// Test Email
app.get("/test-email", async (_req, res) => {
  try {
    const testTo = process.env.TEST_EMAIL || SMTP_USER;

    await sendMail({
      to: testTo,
      subject: "Test Email 🚀",
      html: "<h1>SMTP working ✅</h1>"
    });

    res.send("Email sent ✅");
  } catch (err) {
    console.error("❌ Test Error:", err);
    res.status(500).send(err.message);
  }
});

/* =========================
   🔐 OTP LOGIC
========================= */

const EMAIL_REGEX = /^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+$/;
const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const hashCode = (code) =>
  crypto.createHash("sha256").update(code).digest("hex");

const generateOtp = () =>
  String(100000 + Math.floor(Math.random() * 900000));

// Send OTP email
async function sendOtpEmail(email, code) {
  console.log("Sending OTP to:", email);

  await sendMail({
    to: email,
    subject: "Your Quiz Game OTP",
    html: `<h2>Your OTP is: ${code}</h2><p>Valid for 5 minutes</p>`
  });
}

// SEND OTP
app.post("/otp/send", async (req, res) => {
  try {
    const email = (req.body?.email || "").trim().toLowerCase();

    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Valid email required"
      });
    }

    const code = generateOtp();

    await db.collection("otp_requests").doc(email).set({
      codeHash: hashCode(code),
      attempts: 0,
      expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + OTP_TTL_MS),
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    await sendOtpEmail(email, code);

    res.json({ success: true, message: "OTP sent ✅" });

  } catch (err) {
    console.error("❌ OTP send error:", err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

// VERIFY OTP
app.post("/otp/verify", async (req, res) => {
  try {
    const email = (req.body?.email || "").trim().toLowerCase();
    const code = (req.body?.code || "").trim();

    if (!EMAIL_REGEX.test(email) || !/^\d{6}$/.test(code)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or OTP"
      });
    }

    const docRef = db.collection("otp_requests").doc(email);
    const snap = await docRef.get();

    if (!snap.exists) {
      return res.status(400).json({
        success: false,
        message: "No OTP found"
      });
    }

    const data = snap.data();

    if (data.expiresAt.toMillis() < Date.now()) {
      await docRef.delete();
      return res.status(400).json({
        success: false,
        message: "OTP expired"
      });
    }

    if (data.attempts >= MAX_ATTEMPTS) {
      await docRef.delete();
      return res.status(400).json({
        success: false,
        message: "Too many attempts"
      });
    }

    const isValid = data.codeHash === hashCode(code);

    await docRef.update({ attempts: data.attempts + 1 });

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP"
      });
    }

    await docRef.delete();

    res.json({ success: true, message: "OTP verified ✅" });

  } catch (err) {
    console.error("❌ OTP verify error:", err);
    res.status(500).json({
      success: false,
      message: "Verification failed"
    });
  }
});

/* =========================
   🚀 START SERVER
========================= */
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
