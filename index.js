import express from "express";
import dotenv from "dotenv";
import { Resend } from "resend";
import admin from "firebase-admin";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 4000;
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "";
const RESEND_FROM_NAME = process.env.RESEND_FROM_NAME || "Quiz Game";

let serviceAccount = null;
if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
} else {
  const keyPath = path.join(__dirname, "serviceAccountKey.json");
  if (fs.existsSync(keyPath)) {
    serviceAccount = JSON.parse(fs.readFileSync(keyPath, "utf-8"));
  }
}

if (!serviceAccount) {
  console.error("Firebase service account missing. Provide FIREBASE_SERVICE_ACCOUNT_JSON or serviceAccountKey.json");
  process.exit(1);
}

if (!RESEND_API_KEY || !RESEND_FROM_EMAIL) {
  console.warn("Resend not fully configured (RESEND_API_KEY or RESEND_FROM_EMAIL missing). OTP send will fail.");
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const resend = new Resend(RESEND_API_KEY || "dummy-key");

const app = express();
app.use(express.json());

// Simple CORS for local use
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

const EMAIL_REGEX = /^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+$/;
const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const hashCode = (code) => crypto.createHash("sha256").update(code).digest("hex");
const generateOtp = () => String(100000 + Math.floor(Math.random() * 900000));

async function sendOtpEmail(email, code) {
  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL) {
    throw new Error("OTP email provider not configured.");
  }
  const text = `Your Quiz Game OTP is ${code}. It expires in 5 minutes.`;
  await resend.emails.send({
    from: `${RESEND_FROM_NAME} <${RESEND_FROM_EMAIL}>`,
    to: [email],
    subject: "Your Quiz Game OTP",
    text
  });
}

app.post("/otp/send", async (req, res) => {
  try {
    const email = (req.body?.email || "").trim().toLowerCase();
    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ success: false, message: "Valid email required." });
    }

    const code = generateOtp();
    const docRef = db.collection("otp_requests").doc(email);
    await docRef.set({
      codeHash: hashCode(code),
      attempts: 0,
      expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + OTP_TTL_MS),
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    await sendOtpEmail(email, code);
    res.json({ success: true, message: "OTP sent." });
  } catch (error) {
    console.error("OTP send failed", error);
    res.status(500).json({ success: false, message: "Unable to send OTP." });
  }
});

app.post("/otp/verify", async (req, res) => {
  try {
    const email = (req.body?.email || "").trim().toLowerCase();
    const code = (req.body?.code || "").trim();
    if (!EMAIL_REGEX.test(email) || !/^[0-9]{6}$/.test(code)) {
      return res.status(400).json({ success: false, message: "Valid email and 6-digit OTP required." });
    }

    const docRef = db.collection("otp_requests").doc(email);
    const snap = await docRef.get();
    if (!snap.exists) {
      return res.status(400).json({ success: false, message: "No OTP requested for this email." });
    }
    const data = snap.data();
    if (data.expiresAt?.toMillis() < Date.now()) {
      await docRef.delete();
      return res.status(400).json({ success: false, message: "OTP expired. Request a new one." });
    }
    if (data.attempts >= MAX_ATTEMPTS) {
      await docRef.delete();
      return res.status(400).json({ success: false, message: "OTP attempts exceeded. Request again." });
    }

    const matches = data.codeHash === hashCode(code);
    await docRef.update({ attempts: data.attempts + 1 });

    if (!matches) {
      return res.status(400).json({ success: false, message: "Invalid OTP." });
    }

    await docRef.delete(); // one-time use
    res.json({ success: true, message: "OTP verified." });
  } catch (error) {
    console.error("OTP verify failed", error);
    res.status(500).json({ success: false, message: "Unable to verify OTP." });
  }
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

app.listen(PORT, () => {
  console.log(`OTP server listening on http://localhost:${PORT}`);
});
