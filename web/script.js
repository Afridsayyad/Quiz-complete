import {
  fetchUserDoc,
  fetchLeaderboard,
  updateProfileFullName,
  changeUserPassword,
  submitFeedback,
  signOutUser
} from "./firebase-service.js";

const navItems = document.querySelectorAll(".navigation .list");
const dashboardGrid = document.querySelector(".dashboard-grid");
const startTopbar = document.querySelector(".start-topbar");
const leftPanel = document.querySelector(".left-panel");

const profileSection = document.getElementById("profileSection");
const favoritesSection = document.getElementById("favoritesSection");
const leaderboardSection = document.getElementById("leaderboardSection");
const achievementsSection = document.getElementById("achievementsSection");
const searchSection = document.getElementById("searchSection");
const settingsSection = document.getElementById("settingsSection");

const topbarPlayerName = document.querySelector(".start-topbar .player-name");
const topbarPoints = document.getElementById("topbarPoints");
const profileTitle = document.getElementById("profileTitle");
const playerAvatar = document.getElementById("playerAvatar");
const profileAvatar = document.getElementById("profileAvatar");
const profilePoints = document.getElementById("profilePoints");
const profileStreak = document.getElementById("profileStreak");
const profileSolved = document.getElementById("profileSolved");
const dailyTaskMeta = document.getElementById("dailyTaskMeta");
const dailyTaskProgress = document.getElementById("dailyTaskProgress");
const dailyTaskFill = document.getElementById("dailyTaskFill");
const dailyTaskMessage = document.getElementById("dailyTaskMessage");
const dailyTaskCount = document.getElementById("dailyTaskCount");

const favoritesGrid = document.getElementById("favoritesGrid");
const favoritesStatus = document.getElementById("favoritesStatus");
const leaderboardList = document.getElementById("leaderboardList");
const leaderboardStatus = document.getElementById("leaderboardStatus");
const achievementsList = document.getElementById("achievementsList");
const achievementsStatus = document.getElementById("achievementsStatus");
const searchInput = document.getElementById("searchInput");
const searchResults = document.getElementById("searchResults");
const searchStatus = document.getElementById("searchStatus");
const settingsStatus = document.getElementById("settingsStatus");
const settingsShowAllBtn = document.getElementById("settingsShowAllBtn");
const settingsChangePasswordBtn = document.getElementById("settingsChangePasswordBtn");
const settingsFeedbackBtn = document.getElementById("settingsFeedbackBtn");
const settingsClearFavBtn = document.getElementById("settingsClearFavBtn");
const settingsLogoutBtn = document.getElementById("settingsLogoutBtn");
const startQuizBtn = document.getElementById("startQuizBtn");
const leaderboardBtn = document.getElementById("leaderboardBtn");
const editProfileBtn = document.getElementById("editProfileBtn");
const viewAchievementsBtn = document.getElementById("viewAchievementsBtn");
const bottomHomeBtn = document.getElementById("bottomHomeBtn");
const bottomProfileBtn = document.getElementById("bottomProfileBtn");
const bottomFavoritesBtn = document.getElementById("bottomFavoritesBtn");
const bottomSearchBtn = document.getElementById("bottomSearchBtn");
const bottomSettingsBtn = document.getElementById("bottomSettingsBtn");
const editProfileModal = document.getElementById("editProfileModal");
const editProfileForm = document.getElementById("editProfileForm");
const editProfileNameInput = document.getElementById("editProfileNameInput");
const editProfileSaveBtn = document.getElementById("editProfileSaveBtn");
const editProfileCloseBtn = document.getElementById("editProfileCloseBtn");
const changePasswordModal = document.getElementById("changePasswordModal");
const changePasswordForm = document.getElementById("changePasswordForm");
const changeCurrentPasswordInput = document.getElementById("changeCurrentPasswordInput");
const changeNewPasswordInput = document.getElementById("changeNewPasswordInput");
const changeConfirmPasswordInput = document.getElementById("changeConfirmPasswordInput");
const changePasswordSaveBtn = document.getElementById("changePasswordSaveBtn");
const changePasswordCloseBtn = document.getElementById("changePasswordCloseBtn");
const feedbackModal = document.getElementById("feedbackModal");
const feedbackForm = document.getElementById("feedbackForm");
const feedbackMessageInput = document.getElementById("feedbackMessageInput");
const feedbackSendBtn = document.getElementById("feedbackSendBtn");
const feedbackCloseBtn = document.getElementById("feedbackCloseBtn");
const quizCards = Array.from(document.querySelectorAll(".quiz-grid .quiz-card"));
const navigationRoot = document.querySelector(".navigation");
const toastEl = document.getElementById("toast");
let toastHideTimer = null;
const quizCatalog = quizCards.map((card) => {
  const label = card.querySelector("p");
  const icon = card.querySelector(".icon");
  return {
    topic: (label ? label.textContent : "").trim(),
    icon: (icon ? icon.textContent : "").trim()
  };
});

const USER_UID_KEY = "quiz_user_uid";
const USER_EMAIL_KEY = "quiz_user_email";
const USER_FULL_NAME_KEY = "quiz_user_full_name";
const FAVORITES_KEY = "quiz_favorite_topics";
const SELECTED_CATEGORY_KEY = "quiz_selected_category";
const SELECTED_CATEGORY_ID_KEY = "quiz_selected_category_id";

const TOPIC_TO_TRIVIA_CATEGORY = {
  "general knowledge": 9,
  science: 17,
  sport: 21,
  "computer science": 18,
  "entertainment film": 11,
  history: 23,
  geography: 22,
  anime: 31,
  mathematics: 19,
  art: 25,
  animal: 27,
  politics: 24,
  mythology: 20
};

let selectedQuizCard = null;
let latestStats = null;
const POINT_TIERS = [
  { name: "Master", threshold: 7500 },
  { name: "Diamond", threshold: 5000 },
  { name: "Platinum", threshold: 2500 },
  { name: "Gold", threshold: 1000 }
];

function getStoredSessionValue(key) {
  try {
    return (localStorage.getItem(key) || "").trim();
  } catch (error) {
    return "";
  }
}

function getSessionUid() {
  return getStoredSessionValue(USER_UID_KEY);
}

function applyProfileName(fullName) {
  if (!fullName) return;
  const initials = (() => {
    const words = fullName.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return "U";
    if (words.length === 1) return words[0].charAt(0).toUpperCase();
    return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
  })();
  if (topbarPlayerName) topbarPlayerName.textContent = fullName;
  if (profileTitle) profileTitle.textContent = fullName;
  if (playerAvatar) playerAvatar.textContent = initials;
  if (profileAvatar) profileAvatar.textContent = initials;
}

function getPointTier(points) {
  const safe = Number.isFinite(points) ? points : 0;
  const tier = POINT_TIERS.find((t) => safe >= t.threshold);
  return tier ? tier.name : "Rookie";
}

function applyProfileTier(points) {
  const badge = document.getElementById("profileBadge");
  if (!badge) return;
  badge.textContent = getPointTier(points);
}

function applyProfileStats(points, solved, streak) {
  const safePoints = Number.isFinite(points) ? Math.max(0, Math.floor(points)) : 0;
  const safeSolved = Number.isFinite(solved) ? Math.max(0, Math.floor(solved)) : 0;
  const safeStreak = Number.isFinite(streak) ? Math.max(0, Math.floor(streak)) : 0;
  if (topbarPoints) topbarPoints.textContent = String(safePoints);
  if (profilePoints) profilePoints.textContent = String(safePoints);
  if (profileSolved) profileSolved.textContent = String(safeSolved);
  if (profileStreak) profileStreak.textContent = `${safeStreak} Day${safeStreak === 1 ? "" : "s"}`;
  applyProfileTier(safePoints);
}

function applyDailyTaskStatus(solvedToday, target) {
  const safeTarget = Number.isFinite(target) ? Math.max(1, Math.floor(target)) : 10;
  const safeSolved = Number.isFinite(solvedToday) ? Math.max(0, Math.floor(solvedToday)) : 0;
  const remaining = Math.max(0, safeTarget - safeSolved);
  const progress = Math.min(100, Math.round((Math.min(safeSolved, safeTarget) / safeTarget) * 100));
  if (dailyTaskMeta) dailyTaskMeta.textContent = `${safeTarget} Questions`;
  if (dailyTaskFill) dailyTaskFill.style.width = `${progress}%`;
  if (dailyTaskProgress) {
    dailyTaskProgress.setAttribute("aria-valuenow", String(progress));
    dailyTaskProgress.setAttribute("aria-valuetext", `${safeSolved} out of ${safeTarget} solved today`);
  }
  if (dailyTaskMessage) {
    dailyTaskMessage.textContent = remaining === 0
      ? "Daily task complete! Keep the streak alive."
      : `Solve ${remaining} to keep your streak!`;
  }
  if (dailyTaskCount) dailyTaskCount.textContent = `${safeSolved}/${safeTarget}`;
}

function displayNameFromEmail(email) {
  if (!email || !email.includes("@")) return "";
  const local = email.split("@")[0].replace(/[._-]+/g, " ").trim();
  if (!local) return "";
  return local
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function setVisible(element, visible) {
  if (!element) return;
  if (visible) {
    element.removeAttribute("hidden");
    element.style.display = "";
  } else {
    element.setAttribute("hidden", "");
    element.style.display = "none";
  }
}

function hideAllPanels() {
  setVisible(profileSection, false);
  setVisible(favoritesSection, false);
  setVisible(leaderboardSection, false);
  setVisible(achievementsSection, false);
  setVisible(searchSection, false);
  setVisible(settingsSection, false);
}

function showHome() {
  setVisible(leftPanel, true);
  hideAllPanels();
  setVisible(startTopbar, true);
}

function openPanel(panel) {
  hideAllPanels();
  setVisible(leftPanel, false);
  setVisible(panel, true);
  setVisible(startTopbar, false);
}

function normalizeTopic(topic) {
  return topic.trim().toLowerCase();
}

function getCardTopic(card) {
  const label = card.querySelector("p");
  return (label ? label.textContent : "").trim();
}

function loadFavorites() {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.map((item) => normalizeTopic(String(item))).filter(Boolean));
  } catch (error) {
    return new Set();
  }
}

function saveFavorites(favorites) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(Array.from(favorites)));
}

function updateFavoriteButton(card, isFavorite) {
  const button = card.querySelector(".quiz-favorite-btn");
  if (!button) return;
  button.textContent = isFavorite ? "♥" : "♡";
  button.setAttribute("aria-label", isFavorite ? "Remove from favorites" : "Add to favorites");
  card.classList.toggle("is-favorite", isFavorite);
}

function persistSelectedCategory(topic) {
  if (!topic) return;
  try {
    localStorage.setItem(SELECTED_CATEGORY_KEY, topic);
    const categoryId = TOPIC_TO_TRIVIA_CATEGORY[normalizeTopic(topic)] || 9;
    localStorage.setItem(SELECTED_CATEGORY_ID_KEY, String(categoryId));
  } catch (error) { }
}

function updateStartButtonLabel() {
  if (!startQuizBtn) return;
  const topic = selectedQuizCard ? getCardTopic(selectedQuizCard) : "";
  startQuizBtn.textContent = topic ? `Start ${topic} Quiz` : "Start Quiz";
}

function selectCategoryCard(card) {
  if (!card) return;
  quizCards.forEach((item) => {
    const active = item === card;
    item.classList.toggle("is-selected", active);
    item.setAttribute("aria-selected", active ? "true" : "false");
  });
  selectedQuizCard = card;
  const topic = getCardTopic(selectedQuizCard);
  persistSelectedCategory(topic);
  updateStartButtonLabel();
}

function initializeCategorySelection() {
  if (quizCards.length === 0) return;
  let preferredTopic = "";
  try {
    preferredTopic = (localStorage.getItem(SELECTED_CATEGORY_KEY) || "").trim();
  } catch (error) { }
  const preferredCard = quizCards.find((card) => getCardTopic(card) === preferredTopic);
  const initialCard = preferredCard || quizCards.find((card) => card.classList.contains("is-selected")) || quizCards[0];
  selectCategoryCard(initialCard);
  quizCards.forEach((card) => {
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    card.addEventListener("click", () => selectCategoryCard(card));
    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      selectCategoryCard(card);
    });
  });
}

function applyHomeFavoritesState() {
  const favorites = loadFavorites();
  quizCards.forEach((card) => {
    const key = normalizeTopic(getCardTopic(card));
    updateFavoriteButton(card, favorites.has(key));
  });
}

function initializeFavoriteButtons() {
  quizCards.forEach((card) => {
    if (card.querySelector(".quiz-favorite-btn")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "quiz-favorite-btn";
    button.textContent = "♡";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const topicKey = normalizeTopic(getCardTopic(card));
      if (!topicKey) return;
      const favorites = loadFavorites();
      if (favorites.has(topicKey)) favorites.delete(topicKey);
      else favorites.add(topicKey);
      saveFavorites(favorites);
      applyHomeFavoritesState();
      renderFavoritesPanel();
    });
    const icon = card.querySelector(".icon");
    const label = card.querySelector("p");
    const header = document.createElement("div");
    header.className = "quiz-card-header";
    header.appendChild(button);
    card.innerHTML = "";
    card.appendChild(header);
    if (icon) {
      card.appendChild(icon);
    }
    if (label) {
      label.style.textAlign = "center";
      card.appendChild(label);
    }
  });
  applyHomeFavoritesState();
}

function createPanelCard(topic, icon) {
  const card = document.createElement("article");
  card.className = "quiz-card";
  const iconSpan = document.createElement("span");
  iconSpan.className = "icon";
  iconSpan.textContent = icon || "?";
  const title = document.createElement("p");
  title.textContent = topic;
  card.appendChild(iconSpan);
  card.appendChild(title);
  return card;
}

function renderFavoritesPanel() {
  if (!favoritesGrid) return;
  favoritesGrid.innerHTML = "";
  const favorites = loadFavorites();
  const items = quizCatalog.filter((item) => favorites.has(normalizeTopic(item.topic)));
  items.forEach((item) => favoritesGrid.appendChild(createPanelCard(item.topic, item.icon)));
  if (favoritesStatus) {
    favoritesStatus.textContent = items.length === 0
      ? "No favorites yet. Add hearts on Home."
      : `${items.length} favorite topic${items.length === 1 ? "" : "s"}.`;
  }
}

function renderSearchPanel(query) {
  if (!searchResults) return;
  const text = (query || "").trim().toLowerCase();
  searchResults.innerHTML = "";
  const items = text
    ? quizCatalog.filter((item) => item.topic.toLowerCase().includes(text))
    : quizCatalog;
  items.forEach((item) => searchResults.appendChild(createPanelCard(item.topic, item.icon)));
  if (searchStatus) {
    searchStatus.textContent = items.length === 0
      ? "No matching topics."
      : `${items.length} topic${items.length === 1 ? "" : "s"} found.`;
  }
}

function openHomeSection() {
  showHome();
}

function openProfileSection() {
  if (!profileSection) return;
  openPanel(profileSection);
}

function openFavoritesSection() {
  if (!favoritesSection) return;
  renderFavoritesPanel();
  openPanel(favoritesSection);
}

function openAchievementsSection() {
  if (!achievementsSection) return;
  renderAchievementsPanel();
  openPanel(achievementsSection);
}

function openLeaderboardSection() {
  if (!leaderboardSection) return;
  renderLeaderboardPanel();
  openPanel(leaderboardSection);
}

async function renderLeaderboardPanel() {
  if (!leaderboardSection || !leaderboardList) return;
  leaderboardList.innerHTML = "";
  if (leaderboardStatus) leaderboardStatus.textContent = "Loading leaderboard...";
  try {
    const rows = await fetchLeaderboard(25);
    if (rows.length === 0) {
      if (leaderboardStatus) leaderboardStatus.textContent = "No leaderboard data yet.";
      return;
    }
    rows.forEach((entry, index) => leaderboardList.appendChild(createLeaderboardRow(index + 1, entry)));
    if (leaderboardStatus) leaderboardStatus.textContent = `Top ${rows.length} players by points.`;
  } catch (error) {
    if (leaderboardStatus) leaderboardStatus.textContent = "Unable to load leaderboard now.";
  }
}

function createLeaderboardRow(rank, entry) {
  const row = document.createElement("article");
  row.className = "leaderboard-row";
  const rankEl = document.createElement("strong");
  rankEl.className = "leaderboard-rank";
  rankEl.textContent = `#${rank}`;
  const nameEl = document.createElement("span");
  nameEl.className = "leaderboard-name";
  nameEl.textContent = entry.name;
  const scoreEl = document.createElement("span");
  scoreEl.className = "leaderboard-score";
  scoreEl.textContent = `${entry.points} pts`;
  const tierEl = document.createElement("span");
  tierEl.className = "leaderboard-tier";
  tierEl.textContent = getPointTier(entry.points);
  const metaEl = document.createElement("span");
  metaEl.className = "leaderboard-meta";
  metaEl.textContent = `${entry.solved} solved | ${entry.streak} day streak`;
  row.appendChild(rankEl);
  row.appendChild(nameEl);
  row.appendChild(scoreEl);
  row.appendChild(tierEl);
  row.appendChild(metaEl);
  return row;
}

function createAchievementItem(title, description, unlocked) {
  const card = document.createElement("article");
  card.className = `achievement-item${unlocked ? " unlocked" : ""}`;
  const badge = document.createElement("span");
  badge.className = "achievement-badge";
  badge.textContent = unlocked ? "Unlocked" : "Locked";
  const heading = document.createElement("h3");
  heading.className = "achievement-title";
  heading.textContent = title;
  const desc = document.createElement("p");
  desc.className = "achievement-desc";
  desc.textContent = description;
  card.appendChild(badge);
  card.appendChild(heading);
  card.appendChild(desc);
  return card;
}

function pickFallbackName() {
  const cached = getStoredSessionValue(USER_FULL_NAME_KEY);
  if (cached) return cached;
  const email = getStoredSessionValue(USER_EMAIL_KEY);
  return displayNameFromEmail(email) || "Player";
}

async function renderAchievementsPanel() {
  if (!achievementsSection || !achievementsList) return;
  achievementsList.innerHTML = "";
  if (!latestStats) {
    if (achievementsStatus) achievementsStatus.textContent = "Login required to view achievements.";
    return;
  }
  const target = Math.max(30, latestStats.dailyTarget || 0);
  const solvedToday = latestStats.dailySolvedToday || 0;
  const stats = {
    points: latestStats.points || 0,
    solved: latestStats.solvedCount || 0,
    streak: latestStats.streakDays || 0
  };
  const categorySolved = latestStats.categorySolved || {};
  const categoryAchievements = Object.keys(TOPIC_TO_TRIVIA_CATEGORY).map((key) => {
    const label = key
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
    const solvedCount = Number.isFinite(categorySolved[key]) ? categorySolved[key] : 0;
    const required = 30;
    return {
      title: `${label} Pro`,
      description: `Solve ${required}+ questions in ${label}.`,
      unlocked: solvedCount >= required
    };
  });
  const achievements = [
    { title: "First Win", description: "Score your first 100 points.", unlocked: stats.points >= 100 },
    { title: "Quiz Explorer", description: "Solve at least 25 questions.", unlocked: stats.solved >= 25 },
    { title: "Sharp Streak", description: "Reach a 3-day streak.", unlocked: stats.streak >= 3 },
    { title: "Daily Hero", description: `Complete today's daily target (${target} questions).`, unlocked: solvedToday >= target },
    { title: "Gold", description: "Reach 1,000 total points.", unlocked: stats.points >= 1000 },
    { title: "Platinum", description: "Reach 2,500 total points.", unlocked: stats.points >= 2500 },
    { title: "Diamond", description: "Reach 5,000 total points.", unlocked: stats.points >= 5000 },
    { title: "Master", description: "Reach 7,500 total points.", unlocked: stats.points >= 7500 }
  ].concat(categoryAchievements);
  let unlockedCount = 0;
  achievements.forEach((item) => {
    if (item.unlocked) unlockedCount++;
    achievementsList.appendChild(createAchievementItem(item.title, item.description, item.unlocked));
  });
  if (achievementsStatus) achievementsStatus.textContent = `${unlockedCount}/${achievements.length} achievements unlocked.`;
}

function openSearchSection() {
  if (!searchSection) return;
  if (searchInput) searchInput.value = "";
  renderSearchPanel("");
  openPanel(searchSection);
}

async function openSettingsSection() {
  if (!settingsSection) return;
  if (settingsStatus) settingsStatus.textContent = "Choose an action below.";
  openPanel(settingsSection);
}

function getLoggedInEmail() {
  return getStoredSessionValue(USER_EMAIL_KEY);
}

function openEditProfileModal() {
  const email = getLoggedInEmail();
  if (!email) return alert("Please login again.");
  const currentName = (profileTitle && profileTitle.textContent ? profileTitle.textContent : "").trim();
  if (!editProfileModal || !editProfileNameInput) return;
  editProfileNameInput.value = currentName || "";
  editProfileModal.removeAttribute("hidden");
  editProfileNameInput.focus();
}

function closeEditProfileModal() {
  if (!editProfileModal) return;
  editProfileModal.setAttribute("hidden", "");
}

async function handleEditProfileSubmit(event) {
  if (event) event.preventDefault();
  const email = getLoggedInEmail();
  if (!email) return alert("Please login again.");
  if (!editProfileNameInput || !editProfileSaveBtn) return;
  const newName = editProfileNameInput.value.trim();
  if (!newName) return alert("Name cannot be empty.");
  const currentName = (profileTitle && profileTitle.textContent ? profileTitle.textContent : "").trim();
  if (currentName && currentName === newName) {
    showToast("Name is already saved.", "info", 1800);
    closeEditProfileModal();
    return;
  }
  showToast("Saving profile name...", "info", 1200);
  editProfileSaveBtn.disabled = true;
  editProfileSaveBtn.textContent = "Saving...";
  applyProfileName(newName);
  try { localStorage.setItem(USER_FULL_NAME_KEY, newName); } catch (error) { }
  closeEditProfileModal();
  try {
    const updatedName = await updateProfileFullName(newName);
    applyProfileName(updatedName);
    showToast("Profile name updated.", "success", 1800);
  } catch (error) {
    showToast("Unable to update profile right now.", "error", 2200);
  } finally {
    editProfileSaveBtn.disabled = false;
    editProfileSaveBtn.textContent = "Save";
  }
}

function openChangePasswordModal() {
  if (!changePasswordModal || !changePasswordForm) return;
  changePasswordForm.reset();
  changePasswordModal.removeAttribute("hidden");
  changeCurrentPasswordInput?.focus();
}

function closeChangePasswordModal() {
  if (!changePasswordModal) return;
  changePasswordModal.setAttribute("hidden", "");
}

async function handleChangePasswordSubmit(event) {
  if (event) event.preventDefault();
  const currentPassword = changeCurrentPasswordInput?.value.trim();
  const newPassword = changeNewPasswordInput?.value;
  const confirmPassword = changeConfirmPasswordInput?.value;
  if (!currentPassword || !newPassword || !confirmPassword) {
    if (settingsStatus) settingsStatus.textContent = "All password fields are required.";
    return;
  }
  if (newPassword !== confirmPassword) {
    if (settingsStatus) settingsStatus.textContent = "New password and confirm password must match.";
    return;
  }
  showToast("Updating password...", "info", 1200);
  changePasswordSaveBtn.disabled = true;
  changePasswordSaveBtn.textContent = "Updating...";
  try {
    await changeUserPassword(currentPassword, newPassword);
    if (settingsStatus) settingsStatus.textContent = "Password changed successfully.";
    closeChangePasswordModal();
    showToast("Password updated successfully.", "success", 1800);
  } catch (error) {
    if (settingsStatus) {
      settingsStatus.textContent = "Unable to change password right now.";
    }
    showToast("Password update failed.", "error", 2200);
  } finally {
    changePasswordSaveBtn.disabled = false;
    changePasswordSaveBtn.textContent = "Update Password";
  }
}

function openFeedbackModal() {
  feedbackForm?.reset();
  feedbackModal?.removeAttribute("hidden");
  feedbackMessageInput?.focus();
}

function closeFeedbackModal() {
  if (!feedbackModal) return;
  feedbackModal.setAttribute("hidden", "");
}

async function handleFeedbackSubmit(event) {
  if (event) event.preventDefault();
  const message = feedbackMessageInput?.value.trim();
  if (!message) {
    if (settingsStatus) settingsStatus.textContent = "Feedback cannot be empty.";
    return;
  }
  showToast("Sending feedback...", "info", 900);
  feedbackSendBtn.disabled = true;
  feedbackSendBtn.textContent = "Sending...";
  closeFeedbackModal();
  try {
    await submitFeedback(message);
    if (settingsStatus) settingsStatus.textContent = "Thanks! Feedback submitted.";
    showToast("Feedback sent. Thanks!", "success", 1800);
  } catch (error) {
    if (settingsStatus) settingsStatus.textContent = "Unable to submit feedback right now.";
    showToast("Feedback send failed.", "error", 2200);
  } finally {
    feedbackSendBtn.disabled = false;
    feedbackSendBtn.textContent = "Send";
  }
}

const navActions = {
  home: openHomeSection,
  profile: openProfileSection,
  favorites: openFavoritesSection,
  search: openSearchSection,
  settings: openSettingsSection
};

function handleNavAction(navItem, event) {
  if (event) event.preventDefault();
  if (!navItem) return;
  navItems.forEach((li) => li.classList.remove("active"));
  navItem.classList.add("active");
  const action = navItem.dataset.nav;
  if (action && navActions[action]) navActions[action]();
}

if (navigationRoot) {
  navigationRoot.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const navItem = target.closest(".list");
    if (!navItem) return;
    handleNavAction(navItem, event);
  });
}

if (searchInput) {
  searchInput.addEventListener("input", () => renderSearchPanel(searchInput.value));
}

if (settingsShowAllBtn) {
  settingsShowAllBtn.addEventListener("click", () => {
    navItems.forEach((li) => li.classList.remove("active"));
    const homeNav = document.querySelector('.navigation .list[data-nav="home"]');
    if (homeNav) homeNav.classList.add("active");
    showHome();
  });
}

if (settingsChangePasswordBtn) {
  settingsChangePasswordBtn.addEventListener("click", openChangePasswordModal);
}

if (settingsFeedbackBtn) {
  settingsFeedbackBtn.addEventListener("click", () => {
    if (!getSessionUid()) {
      if (settingsStatus) settingsStatus.textContent = "Please login again.";
      return;
    }
    openFeedbackModal();
  });
}

if (changePasswordCloseBtn) {
  changePasswordCloseBtn.addEventListener("click", closeChangePasswordModal);
}

if (changePasswordModal) {
  changePasswordModal.addEventListener("click", (event) => {
    if (event.target === changePasswordModal) closeChangePasswordModal();
  });
}

if (changePasswordForm) {
  changePasswordForm.addEventListener("submit", handleChangePasswordSubmit);
}

if (feedbackCloseBtn) {
  feedbackCloseBtn.addEventListener("click", closeFeedbackModal);
}

if (feedbackModal) {
  feedbackModal.addEventListener("click", (event) => {
    if (event.target === feedbackModal) closeFeedbackModal();
  });
}

if (feedbackForm) {
  feedbackForm.addEventListener("submit", handleFeedbackSubmit);
}

if (settingsClearFavBtn) {
  settingsClearFavBtn.addEventListener("click", () => {
    localStorage.removeItem(FAVORITES_KEY);
    applyHomeFavoritesState();
    renderFavoritesPanel();
    if (settingsStatus) settingsStatus.textContent = "Favorites cleared.";
  });
}

if (settingsLogoutBtn) {
  settingsLogoutBtn.addEventListener("click", async () => {
    try {
      await signOutUser();
    } catch (error) {
      console.warn("Unable to sign out:", error);
    }
    localStorage.removeItem(USER_UID_KEY);
    localStorage.removeItem(USER_FULL_NAME_KEY);
    localStorage.removeItem(USER_EMAIL_KEY);
    window.location.href = "index.html";
  });
}

if (startQuizBtn) {
  const triggerQuiz = () => {
    const topic = selectedQuizCard ? getCardTopic(selectedQuizCard) : "";
    if (topic) persistSelectedCategory(topic);
    window.location.href = "quiz.html";
  };
  startQuizBtn.addEventListener("click", triggerQuiz);
}

if (leaderboardBtn) {
  leaderboardBtn.addEventListener("click", () => {
    navItems.forEach((li) => li.classList.remove("active"));
    openLeaderboardSection();
  });
}

if (bottomHomeBtn) bottomHomeBtn.addEventListener("click", showHome);
if (bottomProfileBtn) bottomProfileBtn.addEventListener("click", openProfileSection);
if (bottomFavoritesBtn) bottomFavoritesBtn.addEventListener("click", openFavoritesSection);
if (bottomSearchBtn) bottomSearchBtn.addEventListener("click", openSearchSection);
if (bottomSettingsBtn) bottomSettingsBtn.addEventListener("click", openSettingsSection);

if (editProfileBtn) {
  editProfileBtn.addEventListener("click", openEditProfileModal);
}

if (editProfileCloseBtn) {
  editProfileCloseBtn.addEventListener("click", closeEditProfileModal);
}

if (editProfileModal) {
  editProfileModal.addEventListener("click", (event) => {
    if (event.target === editProfileModal) closeEditProfileModal();
  });
}

if (editProfileForm) {
  editProfileForm.addEventListener("submit", handleEditProfileSubmit);
}

if (viewAchievementsBtn) {
  viewAchievementsBtn.addEventListener("click", () => openAchievementsSection());
}

function initializeViewState() {
  showHome();
  applyHomeFavoritesState();
  initializeFavoriteButtons();
  initializeCategorySelection();
  updateStartButtonLabel();
  closeFeedbackModal();
  closeChangePasswordModal();
  closeEditProfileModal();
}

function showToast(message, type = "success", durationMs = 2600) {
  if (!toastEl) return;
  if (toastHideTimer) {
    clearTimeout(toastHideTimer);
    toastHideTimer = null;
  }
  toastEl.textContent = message;
  toastEl.classList.remove("success", "error", "info", "show");
  if (type) toastEl.classList.add(type);
  toastEl.removeAttribute("hidden");
  requestAnimationFrame(() => toastEl.classList.add("show"));
  if (durationMs !== null) {
    toastHideTimer = setTimeout(() => {
      toastEl.classList.remove("show");
      toastHideTimer = null;
    }, durationMs);
  }
}

async function refreshUserData() {
  const uid = await ensureLoggedIn();
  if (!uid) return;
  try {
    const doc = await fetchUserDoc(uid);
    if (!doc) throw new Error("User record not found.");
    latestStats = doc;
    const name = doc.fullName || pickFallbackName();
    applyProfileName(name);
    try { localStorage.setItem(USER_FULL_NAME_KEY, name); } catch (error) { }
    applyProfileStats(doc.points, doc.solvedCount, doc.streakDays);
    applyDailyTaskStatus(doc.dailySolvedToday, doc.dailyTarget);
  } catch (error) {
    console.error("Unable to refresh user data", error);
  }
}

async function ensureLoggedIn() {
  const uid = getSessionUid();
  if (!uid) {
    window.location.href = "index.html";
    return null;
  }
  return uid;
}

async function initializeApp() {
  initializeViewState();
  await refreshUserData();
  renderLeaderboardPanel();
}

initializeApp().catch((error) => {
  console.error("Initialization failed", error);
});

