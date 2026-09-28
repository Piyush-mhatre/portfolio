// =====================================================================
// AI FINANCIAL ADVISOR CHATBOT — calls the live FastAPI backend's
// /chatbot/message and /chatbot/limit routes.
//
// This URL is not a secret — see finplan.js for the full explanation.
//
// How state works (there's no login on this portfolio):
//   - CLIENT ID: a random ID generated once (crypto.randomUUID) and kept
//     in localStorage. It identifies this browser to the backend's
//     per-visitor daily message counter, and keys nothing else.
//   - HISTORY: the visible conversation is stored in localStorage only
//     and sent back to the backend with every message, because the
//     backend is stateless — it keeps no conversations. Capped at the
//     last MAX_STORED_MESSAGES so storage never grows unbounded.
// =====================================================================
const API_BASE_URL = "https://piyush-api-demo.onrender.com".replace(/\/+$/, "");

const CLIENT_ID_KEY = "pm_chatbot_client_id";
const HISTORY_KEY = "pm_chatbot_history_v1";
const MAX_STORED_MESSAGES = 30;     // history kept + sent (backend accepts up to 60)
const MAX_TURN_CHARS = 4000;        // backend rejects any single history turn longer than this

const windowEl = document.getElementById("chat-window");
const formEl = document.getElementById("chat-form");
const inputEl = document.getElementById("chat-input");
const sendBtn = document.getElementById("chat-send");
const clearBtn = document.getElementById("chat-clear");
const usageEl = document.getElementById("chat-usage");

const SUGGESTIONS = [
  "How should I start investing with ₹10,000 a month?",
  "What's the difference between a SIP and a lump-sum investment?",
  "How big should my emergency fund be?",
  "PPF vs NPS — which suits a long-term goal?",
];

let history = [];      // [{ role: "user" | "assistant", text }]
let isBusy = false;
let limitReached = false;

// --- Safe localStorage wrappers (private browsing can make it throw) ---
function storageGet(key) {
  try { return localStorage.getItem(key); } catch (e) { return null; }
}
function storageSet(key, value) {
  try { localStorage.setItem(key, value); } catch (e) { /* storage unavailable — chat still works, just won't persist */ }
}
function storageRemove(key) {
  try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
}

// --- Client ID ---
function generateId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  // Fallback for older browsers — not cryptographically strong, but this
  // ID is only a rate-limit bucket key, not a secret or credential.
  return "c-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 12);
}
let cachedClientId = null;
function getClientId() {
  if (cachedClientId) return cachedClientId;
  let id = storageGet(CLIENT_ID_KEY);
  if (!id || id.length < 8) {
    id = generateId();
    storageSet(CLIENT_ID_KEY, id);
  }
  cachedClientId = id;
  return id;
}

// --- History persistence ---
function trimHistory(list) {
  let trimmed = list.slice(-MAX_STORED_MESSAGES);
  // Always begin with a user turn so the sent history is well-formed.
  while (trimmed.length && trimmed[0].role !== "user") trimmed.shift();
  return trimmed;
}
function loadHistory() {
  try {
    const parsed = JSON.parse(storageGet(HISTORY_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return trimHistory(
      parsed.filter((t) => t && (t.role === "user" || t.role === "assistant") && typeof t.text === "string" && t.text)
    );
  } catch (e) {
    return [];
  }
}
function saveHistory() {
  storageSet(HISTORY_KEY, JSON.stringify(history));
}
function buildHistoryPayload() {
  return trimHistory(history).map((t) => ({ role: t.role, text: t.text.slice(0, MAX_TURN_CHARS) }));
}

// --- Lightweight markdown ---
// Handles only what the backend's system prompt permits: **bold**, simple
// "-" bullets, and paragraphs. HTML is escaped FIRST, so AI output can
// never inject markup. Anything else (tables, headers) is deliberately
// left as plain text rather than parsed.
function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function renderInline(escaped) {
  return escaped.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}
function renderMarkdownLite(text) {
  const lines = escapeHtml(text).split(/\r?\n/);
  const out = [];
  let paragraph = [];
  let bullets = [];

  const flushParagraph = () => {
    if (paragraph.length) out.push(`<p>${paragraph.join("<br>")}</p>`);
    paragraph = [];
  };
  const flushBullets = () => {
    if (bullets.length) out.push(`<ul>${bullets.map((b) => `<li>${b}</li>`).join("")}</ul>`);
    bullets = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    if (!line) {
      flushParagraph();
      flushBullets();
    } else if (bullet) {
      flushParagraph();
      bullets.push(renderInline(bullet[1]));
    } else {
      flushBullets();
      paragraph.push(renderInline(line));
    }
  }
  flushParagraph();
  flushBullets();
  return out.join("");
}

// --- Rendering ---
function scrollToBottom() {
  windowEl.scrollTop = windowEl.scrollHeight;
}
function removeEmptyState() {
  const empty = windowEl.querySelector(".chat-empty");
  if (empty) empty.remove();
}
function addBubble(role, text) {
  removeEmptyState();
  const el = document.createElement("div");
  el.className = `chat-msg chat-msg-${role}`;
  if (role === "assistant") {
    el.innerHTML = renderMarkdownLite(text);
  } else {
    el.textContent = text; // user text is never interpreted as HTML
  }
  windowEl.appendChild(el);
  scrollToBottom();
  return el;
}
function addNote(text, isError) {
  const el = document.createElement("div");
  el.className = "chat-note" + (isError ? " is-error" : "");
  el.textContent = text;
  windowEl.appendChild(el);
  scrollToBottom();
  return el;
}
function addTypingIndicator() {
  removeEmptyState();
  const el = document.createElement("div");
  el.className = "chat-msg chat-msg-assistant";
  el.innerHTML = `
    <span class="chat-typing" aria-label="The advisor is thinking">
      <span class="chat-typing-dot"></span><span class="chat-typing-dot"></span><span class="chat-typing-dot"></span>
      <span class="chat-typing-label">Thinking…</span>
    </span>`;
  windowEl.appendChild(el);
  scrollToBottom();
  return el;
}
function renderEmptyState() {
  windowEl.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "chat-empty";
  wrap.innerHTML = `
    <h2 class="chat-empty-title">Ask me about your money</h2>
    <p class="chat-empty-text">I can talk through investing, saving, and planning — and I'll remember what we've covered in this conversation. Try one of these, or ask your own:</p>
    <div class="chat-suggestions"></div>`;
  const suggestionsEl = wrap.querySelector(".chat-suggestions");
  SUGGESTIONS.forEach((s) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chat-suggestion";
    btn.textContent = s;
    // Fills the input rather than auto-sending: every message spends
    // from a small daily allowance, so the visitor should choose to.
    btn.addEventListener("click", () => {
      inputEl.value = s;
      autoGrowInput();
      inputEl.focus();
    });
    suggestionsEl.appendChild(btn);
  });
  windowEl.appendChild(wrap);
}
function renderHistory() {
  windowEl.innerHTML = "";
  if (!history.length) {
    renderEmptyState();
    return;
  }
  history.forEach((turn) => addBubble(turn.role, turn.text));
}

// --- Usage / limit display ---
function showUsage(used, limit) {
  const remaining = Math.max(0, limit - used);
  usageEl.textContent = `${remaining} of ${limit} messages left today`;
  if (remaining === 0) setLimitReached();
}
function setLimitReached() {
  limitReached = true;
  inputEl.disabled = true;
  sendBtn.disabled = true;
  inputEl.placeholder = "Daily message limit reached — come back tomorrow.";
}
async function loadUsage() {
  try {
    const res = await fetch(`${API_BASE_URL}/chatbot/limit/${encodeURIComponent(getClientId())}`);
    if (!res.ok) return;
    const data = await res.json();
    showUsage(data.messages_used_today, data.messages_limit_per_day);
  } catch (e) {
    // Purely informational — if the backend is asleep or unreachable the
    // chat itself will surface a proper error when a message is sent.
  }
}

// --- Sending ---
function setBusy(busy) {
  isBusy = busy;
  sendBtn.disabled = busy || limitReached;
  inputEl.disabled = busy || limitReached;
  clearBtn.disabled = busy;
}
function extractErrorMessage(status, body) {
  if (body && typeof body.detail === "string") return body.detail;
  if (status === 422) return "That message couldn't be processed — try shortening it.";
  if (status === 502 || status === 503 || status === 504) {
    return "The backend isn't responding yet (free-tier servers sleep when idle) — please try again in a moment.";
  }
  return `Server returned ${status}.`;
}

async function sendMessage(text) {
  if (isBusy || limitReached) return;

  const historyPayload = buildHistoryPayload(); // history BEFORE this message
  const userBubble = addBubble("user", text);
  const typingEl = addTypingIndicator();
  setBusy(true);
  inputEl.value = "";
  autoGrowInput();

  // Free-tier backends can take a while to wake up — say so instead of
  // leaving the visitor staring at dots.
  const slowTimer = setTimeout(() => {
    const label = typingEl.querySelector(".chat-typing-label");
    if (label) label.textContent = "Still working — the free-tier backend may be waking up…";
  }, 8000);

  try {
    const response = await fetch(`${API_BASE_URL}/chatbot/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: getClientId(), history: historyPayload, message: text }),
    });

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      const message = extractErrorMessage(response.status, body);
      typingEl.remove();
      // The message wasn't answered, so it isn't part of the conversation:
      // take it back out and put the text in the box so it can be retried.
      userBubble.remove();
      inputEl.value = text;
      autoGrowInput();
      addNote(message, true);
      if (response.status === 429) setLimitReached();
      return;
    }

    typingEl.remove();
    history.push({ role: "user", text });
    history.push({ role: "assistant", text: body.reply });
    history = trimHistory(history);
    saveHistory();
    addBubble("assistant", body.reply);
    showUsage(body.messages_used_today, body.messages_limit_per_day);
  } catch (err) {
    console.error(err);
    typingEl.remove();
    userBubble.remove();
    inputEl.value = text;
    autoGrowInput();
    addNote("Couldn't reach the backend — check your connection and try again.", true);
  } finally {
    clearTimeout(slowTimer);
    setBusy(false);
    if (!limitReached) inputEl.focus();
  }
}

// --- Input behavior ---
function autoGrowInput() {
  inputEl.style.height = "auto";
  inputEl.style.height = Math.min(inputEl.scrollHeight, 160) + "px";
}
inputEl.addEventListener("input", autoGrowInput);
inputEl.addEventListener("keydown", (e) => {
  // Enter sends, Shift+Enter inserts a newline; ignore Enter while an
  // IME composition (e.g. typing Hindi/Japanese) is still being confirmed.
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    formEl.requestSubmit();
  }
});
formEl.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = inputEl.value.trim();
  if (text) sendMessage(text);
});

clearBtn.addEventListener("click", () => {
  if (isBusy) return;
  if (history.length && !window.confirm("Clear this conversation? This can't be undone.")) return;
  history = [];
  storageRemove(HISTORY_KEY);
  renderHistory();
  inputEl.focus();
});

// --- Init ---
history = loadHistory();
renderHistory();
loadUsage();
