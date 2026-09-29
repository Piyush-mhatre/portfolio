// =====================================================================
// AI FINANCIAL ADVISOR CHATBOT — calls the live FastAPI backend's
// /chatbot/message and /chatbot/limit routes.
//
// This URL is not a secret — see finplan.js for the full explanation.
//
// STATE (there's no login on this portfolio, everything lives client-side):
//   - CLIENT ID: one random ID per browser (crypto.randomUUID), kept in
//     localStorage forever. Identifies this browser to the backend's
//     per-visitor daily message counter — nothing else.
//   - CONVERSATIONS: an array of separate named chats, each with its own
//     message list, stored in localStorage. The backend is stateless —
//     every request sends that one conversation's history back with it.
//   - Only one conversation is ever "active" at a time; switching,
//     renaming, and deleting are all local/instant (no backend calls).
// =====================================================================
const API_BASE_URL = "https://piyush-api-demo.onrender.com".replace(/\/+$/, "");

const CLIENT_ID_KEY = "pm_chatbot_client_id";
const CONVERSATIONS_KEY = "pm_chatbot_conversations_v1";
const ACTIVE_ID_KEY = "pm_chatbot_active_id_v1";

const MAX_CONVERSATIONS = 25;            // matches the on-page disclaimer text
const MAX_STORED_MESSAGES_PER_CHAT = 30; // per-chat history kept + sent (backend accepts up to 60)
const MAX_TURN_CHARS = 4000;             // backend rejects any single history turn longer than this
const TITLE_WORD_COUNT = 7;              // fallback title = first ~7 words of the opening message

const layoutEl = document.getElementById("chat-layout");
const sidebarEl = document.getElementById("chat-sidebar");
const sidebarToggleBtn = document.getElementById("chat-sidebar-toggle");
const newChatBtn = document.getElementById("chat-new");
const listEl = document.getElementById("chat-list");
const deleteAllBtn = document.getElementById("chat-delete-all");

const windowEl = document.getElementById("chat-window");
const formEl = document.getElementById("chat-form");
const inputEl = document.getElementById("chat-input");
const sendBtn = document.getElementById("chat-send");
const usageEl = document.getElementById("chat-usage");

const SUGGESTIONS = [
  "How should I start investing with ₹10,000 a month?",
  "What's the difference between a SIP and a lump-sum investment?",
  "How big should my emergency fund be?",
  "PPF vs NPS — which suits a long-term goal?",
];

let conversations = [];   // [{ id, title, autoTitled, createdAt, updatedAt, messages: [{role, text}] }]
let activeId = null;      // null = a fresh, not-yet-saved draft chat (nothing sent in it yet)
let isBusy = false;
let limitReached = false;

// --- Safe localStorage wrappers (private browsing can make these throw) ---
function storageGet(key) {
  try { return localStorage.getItem(key); } catch (e) { return null; }
}
function storageSet(key, value) {
  try { localStorage.setItem(key, value); } catch (e) { /* storage unavailable — chat still works this visit, just won't persist */ }
}
function storageRemove(key) {
  try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
}

// --- Client ID (unrelated to which conversation is open — one per browser) ---
function generateId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
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

// --- Conversations: load/save ---
function loadConversations() {
  try {
    const parsed = JSON.parse(storageGet(CONVERSATIONS_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((c) => c && typeof c.id === "string" && Array.isArray(c.messages));
  } catch (e) {
    return [];
  }
}
function saveConversations() {
  storageSet(CONVERSATIONS_KEY, JSON.stringify(conversations));
}
function saveActiveId() {
  if (activeId) storageSet(ACTIVE_ID_KEY, activeId);
  else storageRemove(ACTIVE_ID_KEY);
}
function getConversation(id) {
  return conversations.find((c) => c.id === id) || null;
}
function getActiveConversation() {
  return activeId ? getConversation(activeId) : null;
}
function sortedConversations() {
  return [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);
}

// --- Title derivation ---
// Real Gemini-generated titles aren't wired up on the backend yet — this
// is the "no response received" fallback the whole feature currently
// runs on. If a later backend update ever includes a `title` field in
// the response to a conversation's first message, applyServerTitleIfAny()
// below already knows to adopt it (only while autoTitled is still true,
// i.e. the person hasn't renamed the chat themselves).
function deriveFallbackTitle(firstMessageText) {
  const words = firstMessageText.trim().split(/\s+/);
  const truncated = words.slice(0, TITLE_WORD_COUNT).join(" ");
  return words.length > TITLE_WORD_COUNT ? truncated + "…" : truncated;
}
function applyServerTitleIfAny(conversation, body) {
  if (conversation.autoTitled && typeof body.title === "string" && body.title.trim()) {
    conversation.title = body.title.trim();
  }
}

// --- Conversation CRUD ---
function trimMessages(list) {
  return list.slice(-MAX_STORED_MESSAGES_PER_CHAT);
}
function buildHistoryPayload(conversation) {
  return trimMessages(conversation.messages).map((t) => ({ role: t.role, text: t.text.slice(0, MAX_TURN_CHARS) }));
}

function startNewChat() {
  if (isBusy) return;
  // Already sitting on an empty, unsaved draft — nothing to do.
  if (activeId === null && windowEl.querySelector(".chat-empty")) {
    collapseSidebarOnMobile();
    return;
  }
  activeId = null;
  saveActiveId();
  renderActiveConversation();
  renderSidebar();
  collapseSidebarOnMobile();
  inputEl.focus();
}

function createConversationFromFirstMessage(text) {
  const now = Date.now();
  const conversation = {
    id: generateId(),
    title: deriveFallbackTitle(text),
    autoTitled: true,
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
  conversations.push(conversation);
  // Keep the list bounded — drop the oldest conversation once past the cap.
  if (conversations.length > MAX_CONVERSATIONS) {
    conversations.sort((a, b) => a.updatedAt - b.updatedAt);
    conversations.shift();
  }
  activeId = conversation.id;
  saveConversations();
  saveActiveId();
  return conversation;
}

function removeConversation(id) {
  conversations = conversations.filter((c) => c.id !== id);
  saveConversations();
}

function switchToConversation(id) {
  if (isBusy || id === activeId) return;
  activeId = id;
  saveActiveId();
  renderActiveConversation();
  renderSidebar();
  collapseSidebarOnMobile();
}

function deleteConversation(id) {
  if (isBusy) return;
  const conversation = getConversation(id);
  if (!conversation) return;
  if (!window.confirm(`Delete "${conversation.title}"? This can't be undone.`)) return;

  removeConversation(id);
  if (activeId === id) {
    const next = sortedConversations()[0];
    activeId = next ? next.id : null;
    saveActiveId();
  }
  renderActiveConversation();
  renderSidebar();
}

function deleteAllConversations() {
  if (isBusy || !conversations.length) return;
  if (!window.confirm("Delete ALL your chats? This can't be undone.")) return;
  conversations = [];
  activeId = null;
  saveConversations();
  saveActiveId();
  renderActiveConversation();
  renderSidebar();
}

function commitRename(id, newTitle) {
  const conversation = getConversation(id);
  if (!conversation) return;
  const trimmed = newTitle.trim();
  if (trimmed) {
    conversation.title = trimmed.slice(0, 80);
    conversation.autoTitled = false; // a manual rename always wins from now on
  }
  saveConversations();
  renderSidebar();
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

// --- Chat window rendering ---
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
function renderActiveConversation() {
  windowEl.innerHTML = "";
  const conversation = getActiveConversation();
  if (!conversation || !conversation.messages.length) {
    renderEmptyState();
    return;
  }
  conversation.messages.forEach((turn) => addBubble(turn.role, turn.text));
}

// --- Sidebar rendering ---
function collapseSidebarOnMobile() {
  layoutEl.classList.remove("sidebar-open");
  sidebarToggleBtn.setAttribute("aria-expanded", "false");
}
function renderSidebar() {
  listEl.innerHTML = "";

  if (!conversations.length) {
    const empty = document.createElement("li");
    empty.className = "chat-list-empty";
    empty.textContent = "No chats yet";
    listEl.appendChild(empty);
    return;
  }

  sortedConversations().forEach((conversation) => {
    const li = document.createElement("li");
    li.className = "chat-item" + (conversation.id === activeId ? " is-active" : "");

    const titleBtn = document.createElement("button");
    titleBtn.type = "button";
    titleBtn.className = "chat-item-title";
    titleBtn.textContent = conversation.title;
    titleBtn.title = conversation.title;
    titleBtn.addEventListener("click", () => switchToConversation(conversation.id));

    const actions = document.createElement("span");
    actions.className = "chat-item-actions";

    const renameBtn = document.createElement("button");
    renameBtn.type = "button";
    renameBtn.className = "chat-item-action";
    renameBtn.setAttribute("aria-label", "Rename chat");
    renameBtn.textContent = "✎";
    renameBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      beginRename(li, conversation, titleBtn);
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "chat-item-action is-delete";
    deleteBtn.setAttribute("aria-label", "Delete chat");
    deleteBtn.textContent = "✕";
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteConversation(conversation.id);
    });

    actions.append(renameBtn, deleteBtn);
    li.append(titleBtn, actions);
    listEl.appendChild(li);
  });
}
function beginRename(li, conversation, titleBtn) {
  const input = document.createElement("input");
  input.type = "text";
  input.className = "chat-item-rename";
  input.value = conversation.title;
  input.maxLength = 80;

  const finish = (commit) => {
    if (commit) commitRename(conversation.id, input.value);
    else renderSidebar(); // just redraw to discard the in-progress edit
  };
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); finish(true); }
    else if (e.key === "Escape") { e.preventDefault(); finish(false); }
  });
  input.addEventListener("blur", () => finish(true));

  li.replaceChild(input, titleBtn);
  input.focus();
  input.select();
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
  newChatBtn.disabled = busy;
  deleteAllBtn.disabled = busy;
  sidebarEl.classList.toggle("is-locked", busy);
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

  // A message typed into a fresh, unsaved draft is what actually creates
  // the conversation — remember whether that's what's happening here, so
  // a failed first message can be cleanly rolled back (no stray empty
  // chat left in the sidebar).
  const isNewConversation = activeId === null;
  const conversation = isNewConversation ? createConversationFromFirstMessage(text) : getActiveConversation();
  if (!conversation) return; // shouldn't happen, but don't send into nothing

  const historyPayload = buildHistoryPayload(conversation); // conversation BEFORE this message
  if (isNewConversation) renderSidebar();

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
      userBubble.remove();
      inputEl.value = text;
      autoGrowInput();
      addNote(message, true);
      if (response.status === 429) setLimitReached();

      // A first message that failed shouldn't leave an empty chat behind.
      if (isNewConversation) {
        removeConversation(conversation.id);
        activeId = null;
        saveActiveId();
        renderSidebar();
      }
      return;
    }

    typingEl.remove();
    conversation.messages.push({ role: "user", text });
    conversation.messages.push({ role: "assistant", text: body.reply });
    conversation.messages = trimMessages(conversation.messages);
    conversation.updatedAt = Date.now();
    applyServerTitleIfAny(conversation, body);
    saveConversations();

    addBubble("assistant", body.reply);
    showUsage(body.messages_used_today, body.messages_limit_per_day);
    renderSidebar();
  } catch (err) {
    console.error(err);
    typingEl.remove();
    userBubble.remove();
    inputEl.value = text;
    autoGrowInput();
    addNote("Couldn't reach the backend — check your connection and try again.", true);

    if (isNewConversation) {
      removeConversation(conversation.id);
      activeId = null;
      saveActiveId();
      renderSidebar();
    }
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

newChatBtn.addEventListener("click", startNewChat);
deleteAllBtn.addEventListener("click", deleteAllConversations);
sidebarToggleBtn.addEventListener("click", () => {
  const isOpen = layoutEl.classList.toggle("sidebar-open");
  sidebarToggleBtn.setAttribute("aria-expanded", String(isOpen));
});

// --- Init ---
conversations = loadConversations();
const storedActiveId = storageGet(ACTIVE_ID_KEY);
activeId = storedActiveId && getConversation(storedActiveId) ? storedActiveId : (sortedConversations()[0]?.id ?? null);
saveActiveId();
renderSidebar();
renderActiveConversation();
loadUsage();
