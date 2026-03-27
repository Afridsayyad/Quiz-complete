import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  signOut,
  updateProfile,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  reload
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  increment,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDqEFLx1bSoWGza3QOmtqO5K1hKTMqZ8lI",
  authDomain: "quizgame-b419f.firebaseapp.com",
  projectId: "quizgame-b419f",
  storageBucket: "quizgame-b419f.firebasestorage.app",
  messagingSenderId: "1016649455433",
  appId: "1:1016649455433:web:ae020b76ded240405cec98",
  measurementId: "G-7W1558JF6P"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const USERS_COLLECTION = "users";
const FEEDBACK_COLLECTION = "feedback";
const DEFAULT_STATS = {
  points: 0,
  solvedCount: 0,
  streakDays: 0,
  dailySolvedToday: 0,
  dailyTarget: 30,
  dailyBonusDate: "",
  lastSolvedDate: "",
  categorySolved: {}
};

async function ensureUserDoc(user) {
  if (!user) return null;
  const userRef = doc(db, USERS_COLLECTION, user.uid);
  const snapshot = await getDoc(userRef);
  if (!snapshot.exists()) {
    const baseline = {
      ...DEFAULT_STATS,
      email: user.email || "",
      fullName: user.displayName || "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    await setDoc(userRef, baseline);
    return baseline;
  }
  return snapshot.data();
}

export async function registerUser({ fullName, email, password }) {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(credential.user, { displayName: fullName });
  await ensureUserDoc(credential.user);
  await sendEmailVerification(credential.user);
  // enforce verified login; sign out to avoid unverified session
  await signOut(auth);
  return credential.user;
}

export async function loginUser({ email, password }) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  await reload(credential.user);
  if (!credential.user.emailVerified) {
    await sendEmailVerification(credential.user);
    await signOut(auth);
    const error = new Error("Email not verified. Verification link sent again.");
    error.code = "auth/email-not-verified";
    throw error;
  }
  await ensureUserDoc(credential.user);
  return credential.user;
}

export async function sendPasswordResetLink(email) {
  return sendPasswordResetEmail(auth, email);
}

export async function changeUserPassword(currentPassword, newPassword) {
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error("No authenticated user.");
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPassword);
  return true;
}

export async function updateProfileFullName(fullName) {
  const user = auth.currentUser;
  if (!user) throw new Error("No authenticated user.");
  await updateProfile(user, { displayName: fullName });
  const userRef = doc(db, USERS_COLLECTION, user.uid);
  await updateDoc(userRef, {
    fullName,
    updatedAt: serverTimestamp()
  });
  return fullName;
}

export async function fetchUserDoc(uid) {
  if (!uid) return null;
  const userRef = doc(db, USERS_COLLECTION, uid);
  const snapshot = await getDoc(userRef);
  return snapshot.exists() ? snapshot.data() : null;
}

export async function recordQuizProgress({ correct = 0, total = 0, categoryKey = "" }) {
  const user = auth.currentUser;
  if (!user) throw new Error("No authenticated user.");
  const userRef = doc(db, USERS_COLLECTION, user.uid);
  const solvedInc = Math.max(0, Math.floor(total));
  const pointsEarned = Math.max(0, Math.floor(correct * 10));

  const snapshot = await getDoc(userRef);
  const data = snapshot.exists() ? snapshot.data() : {};
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)

  const lastSolvedDate = data.lastSolvedDate || "";
  const streakPrev = Number.isFinite(data.streakDays) ? data.streakDays : 0;
  const dailyPrev = Number.isFinite(data.dailySolvedToday) ? data.dailySolvedToday : 0;
  const dailyTarget = Math.max(30, Number.isFinite(data.dailyTarget) ? Math.floor(data.dailyTarget) : 0);
  const lastBonusDate = data.dailyBonusDate || "";

  const isSameDay = lastSolvedDate === today;
  const isYesterday = (() => {
    if (!lastSolvedDate) return false;
    const todayDate = new Date(today + "T00:00:00Z");
    const lastDate = new Date(lastSolvedDate + "T00:00:00Z");
    const diffDays = Math.round((todayDate - lastDate) / 86400000);
    return diffDays === 1;
  })();

  const streak = isSameDay ? streakPrev : isYesterday ? streakPrev + 1 : 1;
  const dailySolvedToday = (isSameDay ? dailyPrev : 0) + solvedInc;
  const bonusEarned = dailySolvedToday >= dailyTarget && lastBonusDate !== today ? 50 : 0;

  const updatePayload = {
    points: increment(pointsEarned + bonusEarned),
    solvedCount: increment(solvedInc),
    dailySolvedToday,
    streakDays: streak,
    dailyTarget,
    dailyBonusDate: bonusEarned > 0 ? today : lastBonusDate,
    lastSolvedDate: today,
    updatedAt: serverTimestamp()
  };

  if (categoryKey) {
    updatePayload[`categorySolved.${categoryKey}`] = increment(solvedInc);
  }

  await updateDoc(userRef, updatePayload);
  return { pointsEarned: pointsEarned + bonusEarned, solvedInc, bonusEarned };
}

export async function fetchLeaderboard(limitCount = 25) {
  const leaderboardQuery = query(
    collection(db, USERS_COLLECTION),
    orderBy("points", "desc"),
    limit(limitCount)
  );
  const snapshot = await getDocs(leaderboardQuery);
  const seen = new Set();
  const rows = [];

  snapshot.docs.forEach((docSnapshot) => {
    const data = docSnapshot.data();
    const key = (data.email || docSnapshot.id || "").trim().toLowerCase();
    if (key && seen.has(key)) return; // avoid duplicate account rows by email/uid
    if (key) seen.add(key);
    rows.push({
      name: data.fullName || (data.email || "Player"),
      points: data.points || 0,
      solved: data.solvedCount || 0,
      streak: data.streakDays || 0
    });
  });

  return rows;
}

export async function submitFeedback(message) {
  const user = auth.currentUser;
  if (!user) throw new Error("No authenticated user.");
  await addDoc(collection(db, FEEDBACK_COLLECTION), {
    uid: user.uid,
    email: user.email || "",
    message: message.trim(),
    createdAt: serverTimestamp(),
    userName: user.displayName || ""
  });
  return true;
}

export function signOutUser() {
  return signOut(auth);
}

export function getAuthInstance() {
  return auth;
}

export async function sendVerificationEmail(user = auth.currentUser) {
  if (!user) throw new Error("No authenticated user.");
  await sendEmailVerification(user);
  return true;
}
