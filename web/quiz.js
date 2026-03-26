import { recordQuizProgress, getAuthInstance } from "./firebase-service.js";

const fallbackQuizData = [
  {
    question: "Which language is primarily used for Android development?",
    options: ["Swift", "Kotlin", "Ruby", "Go"],
    answer: 1
  },
  {
    question: "What does HTML stand for?",
    options: ["Hyper Text Markup Language", "Home Tool Markup Language", "Hyperlinks and Text Management Language", "High Text Machine Language"],
    answer: 0
  },
  {
    question: "Which symbol is used for single-line comments in Java?",
    options: ["<!-- -->", "#", "//", "**"],
    answer: 2
  },
  {
    question: "Which company developed Java?",
    options: ["Sun Microsystems", "Microsoft", "Apple", "IBM"],
    answer: 0
  },
  {
    question: "CSS is mainly used for?",
    options: ["Styling web pages", "Database queries", "Server-side routing", "Version control"],
    answer: 0
  }
];

const questionEl = document.getElementById("question");
const optionsEl = document.getElementById("options");
const statusEl = document.getElementById("status");
const progressEl = document.getElementById("progress");
const timerEl = document.getElementById("timer");
const quizTitleEl = document.getElementById("quizTitle");
const nextBtn = document.getElementById("nextBtn");
const SELECTED_CATEGORY_KEY = "quiz_selected_category";
const QUESTION_TIME_LIMIT_SECONDS = 20;
const OPEN_TDB_TOPICS = new Set([
  "general knowledge",
  "science",
  "sport",
  "computer science",
  "entertainment film",
  "history",
  "geography",
  "anime",
  "mathematics",
  "art",
  "animal",
  "politics",
  "mythology"
]);
const CATEGORY_ENDPOINTS = {
  "general knowledge": "https://opentdb.com/api.php?amount=10&category=9&difficulty=easy&type=multiple",
  "science": "https://opentdb.com/api.php?amount=10&category=17&difficulty=easy&type=multiple",
  "sport": "https://opentdb.com/api.php?amount=10&category=21&difficulty=easy&type=multiple",
  "computer science": "https://opentdb.com/api.php?amount=10&category=18&difficulty=easy&type=multiple",
  "entertainment film": "https://opentdb.com/api.php?amount=10&category=11&difficulty=easy&type=multiple",
  "history": "https://opentdb.com/api.php?amount=10&category=23&difficulty=easy&type=multiple",
  "geography": "https://opentdb.com/api.php?amount=10&category=22&difficulty=easy&type=multiple",
  "anime": "https://opentdb.com/api.php?amount=10&category=31&difficulty=easy&type=multiple",
  "mathematics": "https://opentdb.com/api.php?amount=10&category=19&difficulty=easy&type=multiple",
  "art": "https://opentdb.com/api.php?amount=10&category=25&difficulty=easy&type=multiple",
  "animal": "https://opentdb.com/api.php?amount=10&category=27&difficulty=easy&type=multiple",
  "politics": "https://opentdb.com/api.php?amount=10&category=24&difficulty=easy&type=multiple",
  "mythology": "https://opentdb.com/api.php?amount=10&category=20&difficulty=easy&type=multiple"
};

let current = 0;
let score = 0;
let answered = false;
let resultRecorded = false;
let quizData = [];
let questionTimerId = null;
let autoAdvanceTimeoutId = null;
let timeLeftSeconds = QUESTION_TIME_LIMIT_SECONDS;
let timerDeadlineMs = 0;
const selectedCategory = (localStorage.getItem(SELECTED_CATEGORY_KEY) || "General Knowledge").trim() || "General Knowledge";
const categoryKey = selectedCategory.toLowerCase();
let recordingInFlight = false;
const auth = getAuthInstance();
const USER_UID_KEY = "quiz_user_uid";

function ensureLoggedIn() {
  const uid = (localStorage.getItem(USER_UID_KEY) || "").trim();
  if (!uid || !auth.currentUser) {
    window.location.href = "index.html";
    return false;
  }
  return true;
}

const resetQuiz = () => {
  clearQuestionTimers();
  current = 0;
  score = 0;
  answered = false;
  resultRecorded = false;
  nextBtn.style.display = "";
  nextBtn.textContent = "Next";
  renderQuestion();
};

function clearQuestionTimers() {
  if (questionTimerId) {
    clearInterval(questionTimerId);
    questionTimerId = null;
  }
  if (autoAdvanceTimeoutId) {
    clearTimeout(autoAdvanceTimeoutId);
    autoAdvanceTimeoutId = null;
  }
}

function updateTimerDisplay() {
  if (!timerEl) return;
  timerEl.textContent = `Time: ${Math.max(0, timeLeftSeconds)}s`;
  timerEl.classList.toggle("is-warning", timeLeftSeconds <= 3);
}

function updateStatusForTimer() {
  if (!statusEl || answered) return;
  statusEl.textContent = `Select an answer (${Math.max(0, timeLeftSeconds)}s left)`;
}

function tickQuestionTimer() {
  if (answered) return clearQuestionTimers();
  const remainingMs = timerDeadlineMs - Date.now();
  timeLeftSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  updateTimerDisplay();
  updateStatusForTimer();

  if (remainingMs <= 0) {
    clearQuestionTimers();
    handleQuestionTimeout();
    return;
  }
  questionTimerId = setTimeout(tickQuestionTimer, 250);
}

function startQuestionTimer() {
  clearQuestionTimers();
  timerDeadlineMs = Date.now() + QUESTION_TIME_LIMIT_SECONDS * 1000;
  timeLeftSeconds = QUESTION_TIME_LIMIT_SECONDS;
  updateTimerDisplay();
  updateStatusForTimer();
  questionTimerId = setTimeout(tickQuestionTimer, 250);
}

function recordQuizResult() {
  if (resultRecorded) return;
  resultRecorded = true;
  const correct = score;
  const total = quizData.length;
  if (recordingInFlight) return;
  recordingInFlight = true;
  recordQuizProgress({ correct, total, categoryKey })
    .catch((error) => {
      console.error("Recording quiz progress failed", error);
      statusEl.textContent = "Saved locally. Re-login to sync score.";
    })
    .finally(() => {
      recordingInFlight = false;
    });
}

function decodeHtml(text) {
  const parser = document.createElement("textarea");
  parser.innerHTML = text == null ? "" : String(text);
  return parser.value;
}

function shuffle(items) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = arr[i];
    arr[i] = arr[j];
    arr[j] = temp;
  }
  return arr;
}

function normalizeOpenTdbQuestions(payload) {
  if (!payload || payload.response_code !== 0 || !Array.isArray(payload.results) || payload.results.length === 0) {
    throw new Error("No OpenTDB questions available.");
  }
  return payload.results.map((item) => {
    const correct = decodeHtml(item.correct_answer);
    const options = shuffle([correct, ...item.incorrect_answers.map((entry) => decodeHtml(entry))]);
    return {
      question: decodeHtml(item.question),
      options,
      answer: options.indexOf(correct)
    };
  });
}

async function loadQuizByCategory(topic) {
  let normalized = (topic || "").trim().toLowerCase();
  if (normalized === "entertairment film") normalized = "entertainment film";
  if (normalized === "mytholodgy") normalized = "mythology";
  const endpoint = CATEGORY_ENDPOINTS[normalized];
  if (!endpoint) throw new Error("No API configured for selected category.");

  if (OPEN_TDB_TOPICS.has(normalized)) {
    const response = await fetch(endpoint);
    if (!response.ok) throw new Error("Failed to fetch OpenTDB questions.");
    const payload = await response.json();
    return normalizeOpenTdbQuestions(payload);
  }

  throw new Error("Unsupported category API.");
}

function renderQuestion() {
  const item = quizData[current];
  if (!item || !Array.isArray(item.options)) {
    showResult();
    return;
  }
  questionEl.textContent = item.question;
  progressEl.textContent = `Question ${current + 1} / ${quizData.length}`;
  statusEl.textContent = "Select an answer";
  answered = false;
  nextBtn.disabled = true;

  optionsEl.innerHTML = "";
  item.options.forEach((opt, index) => {
    const btn = document.createElement("button");
    btn.className = "quiz-option";
    btn.textContent = opt;
    btn.addEventListener("click", () => selectAnswer(index, btn));
    optionsEl.appendChild(btn);
  });

  startQuestionTimer();
}

function selectAnswer(index, selectedBtn) {
  if (answered) return;
  answered = true;
  clearQuestionTimers();

  const correctIndex = quizData[current].answer;
  const all = document.querySelectorAll(".quiz-option");

  all.forEach((btn, btnIndex) => {
    btn.disabled = true;
    if (btnIndex === correctIndex) btn.classList.add("correct");
  });

  if (index === correctIndex) {
    score++;
    statusEl.textContent = "Correct!";
  } else {
    selectedBtn.classList.add("wrong");
    statusEl.textContent = "Wrong answer";
  }

  nextBtn.disabled = false;
  nextBtn.textContent = current === quizData.length - 1 ? "Show Result" : "Next";
}

function handleQuestionTimeout() {
  if (answered) return;
  answered = true;

  const correctIndex = quizData[current].answer;
  const all = document.querySelectorAll(".quiz-option");

  all.forEach((btn, btnIndex) => {
    btn.disabled = true;
    if (btnIndex === correctIndex) btn.classList.add("correct");
  });

  showResult("Time out! Quiz ended.");
}

function showResult(resultMessage) {
  clearQuestionTimers();
  recordQuizResult();
  questionEl.textContent = `Your Score: ${score} / ${quizData.length}`;
  progressEl.textContent = "Completed";
  if (timerEl) {
    timerEl.textContent = "Time: --";
    timerEl.classList.remove("is-warning");
  }
  statusEl.textContent = resultMessage || "";
  optionsEl.innerHTML = "";

  const restart = document.createElement("button");
  restart.className = "quiz-option";
  restart.textContent = "Restart Quiz";
  restart.addEventListener("click", resetQuiz);
  optionsEl.appendChild(restart);

  const backHome = document.createElement("button");
  backHome.className = "quiz-option";
  backHome.textContent = "Back to Home";
  backHome.addEventListener("click", () => {
    window.location.href = "start.html";
  });
  optionsEl.appendChild(backHome);

  nextBtn.disabled = true;
  nextBtn.style.display = "none";
}

nextBtn.addEventListener("click", () => {
  if (!answered) return;
  if (current >= quizData.length - 1) return showResult();
  current++;
  nextBtn.textContent = "Next";
  renderQuestion();
});

if (quizTitleEl) quizTitleEl.textContent = `${selectedCategory} Quiz`;

async function initializeQuiz() {
  if (!ensureLoggedIn()) return;
  clearQuestionTimers();
  nextBtn.disabled = true;
  questionEl.textContent = "Loading questions...";
  optionsEl.innerHTML = "";
  statusEl.textContent = "Please wait";
  timeLeftSeconds = QUESTION_TIME_LIMIT_SECONDS;
  updateTimerDisplay();
  try {
    quizData = await loadQuizByCategory(selectedCategory);
  } catch (error) {
    quizData = fallbackQuizData;
    statusEl.textContent = "Category API unavailable. Loaded offline set.";
  }
  resetQuiz();
}

function waitForAuthAndStart() {
  const unsub = auth.onAuthStateChanged((user) => {
    if (!user) {
      window.location.href = "index.html";
      return;
    }
    unsub();
    initializeQuiz();
  });
}

waitForAuthAndStart();

