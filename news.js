// =====================================================================
// NEWS SENTIMENT DEMO — calls the live FastAPI backend's /news routes.
// This URL is not a secret — see finplan.js for the full explanation.
// =====================================================================
const API_BASE_URL = "https://piyush-api-demo.onrender.com".replace(/\/+$/, "");

const form = document.getElementById("news-form");
const keywordInput = document.getElementById("keyword");
const statusEl = document.getElementById("news-status");
const submitBtn = form.querySelector(".news-submit");

const resultsSection = document.getElementById("news-results");
const resultsLabel = document.getElementById("news-results-label");
const gridEl = document.getElementById("news-grid");
const emptyEl = document.getElementById("news-empty");

const modelStatusEl = document.getElementById("model-status");
const modelStatusText = document.getElementById("model-status-text");

let currentArticles = [];
let currentFilter = "all";

// =====================================================================
// Model status — the ONNX FinBERT model loads in a background thread on
// the backend at startup (see main.py's prewarm_finbert). If the backend
// just woke from a Render cold start, it may still be loading when this
// page first loads — poll every few seconds until it's ready, so the
// indicator (and a warning if someone searches too early) stays honest.
// =====================================================================
let statusPollId = null;

async function checkModelStatus() {
  try {
    const response = await fetch(`${API_BASE_URL}/news/status/model`);
    if (!response.ok) throw new Error(`Server returned ${response.status}`);
    const data = await response.json();

    modelStatusEl.classList.remove("is-ready", "is-loading", "is-error");

    if (data.ready) {
      modelStatusEl.classList.add("is-ready");
      modelStatusText.textContent = `Model ready (${data.model}, ${data.quantization})`;
      if (statusPollId) {
        clearInterval(statusPollId);
        statusPollId = null;
      }
    } else if (data.loading) {
      modelStatusEl.classList.add("is-loading");
      modelStatusText.textContent = "Model loading — first search may show neutral results until this finishes...";
    } else {
      modelStatusEl.classList.add("is-error");
      modelStatusText.textContent = "Model not loaded yet — waking up the backend, try searching in a moment.";
    }
  } catch (err) {
    modelStatusEl.classList.remove("is-ready", "is-loading");
    modelStatusEl.classList.add("is-error");
    modelStatusText.textContent = "Backend is waking up (free tier cold start can take up to ~40s)...";
  }
}

// Check immediately, then keep polling every 4s until ready (or indefinitely
// if it never becomes ready — harmless, just keeps the indicator honest).
checkModelStatus();
statusPollId = setInterval(checkModelStatus, 4000);

// =====================================================================
// Search
// =====================================================================
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const keyword = keywordInput.value.trim();
  if (!keyword) return;
  runSearch(keyword);
});

document.querySelectorAll(".news-topic-pill").forEach((pill) => {
  pill.addEventListener("click", () => {
    const topic = pill.dataset.topic;
    keywordInput.value = topic;
    runSearch(topic);
  });
});

async function runSearch(keyword) {
  submitBtn.disabled = true;
  statusEl.classList.remove("is-error");
  statusEl.textContent = "Searching — waking up the backend if it's been idle (free tier can take up to ~40s on a cold start)...";
  resultsSection.style.display = "none";

  try {
    const response = await fetch(`${API_BASE_URL}/news/${encodeURIComponent(keyword)}`);

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody.detail || `Server returned ${response.status}`);
    }

    const data = await response.json();
    currentArticles = data.articles || [];
    currentFilter = "all";
    setActiveFilterPill("all");

    resultsLabel.textContent = `$ cat results/${keyword.toLowerCase().replace(/[^a-z0-9]+/g, "_")}.json`;
    renderGrid();

    resultsSection.style.display = "block";
    statusEl.textContent = currentArticles.length
      ? `Found ${currentArticles.length} article${currentArticles.length === 1 ? "" : "s"}.`
      : "No articles found for this keyword.";
    resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    console.error(err);
    statusEl.textContent = `Something went wrong: ${err.message}`;
    statusEl.classList.add("is-error");
  } finally {
    submitBtn.disabled = false;
  }
}

// =====================================================================
// Sentiment filter (client-side — articles are already fetched)
// =====================================================================
document.querySelectorAll(".news-filter-pill").forEach((pill) => {
  pill.addEventListener("click", () => {
    currentFilter = pill.dataset.sentiment;
    setActiveFilterPill(currentFilter);
    renderGrid();
  });
});

function setActiveFilterPill(sentiment) {
  document.querySelectorAll(".news-filter-pill").forEach((p) => {
    p.classList.toggle("chip-active", p.dataset.sentiment === sentiment);
  });
}

function renderGrid() {
  const filtered = currentFilter === "all"
    ? currentArticles
    : currentArticles.filter((a) => a.sentiment === currentFilter);

  gridEl.innerHTML = "";

  if (!filtered.length) {
    emptyEl.style.display = "block";
    return;
  }
  emptyEl.style.display = "none";

  filtered.forEach((article) => {
    const card = document.createElement("article");
    card.className = "news-card";

    const description = (article.description || "").slice(0, 160);
    const truncated = (article.description || "").length > 160 ? description + "…" : description;

    card.innerHTML = `
      <img class="news-card-image" src="${article.image_url}" alt="" loading="lazy"
           onerror="this.onerror=null;this.src='https://via.placeholder.com/300';" />
      <div class="news-card-body">
        <span class="news-sentiment-badge ${article.sentiment}">${article.sentiment}</span>
        <h3 class="news-card-title">${escapeHtml(article.title)}</h3>
        <p class="news-card-desc">${escapeHtml(truncated)}</p>
        <a class="news-card-link" href="${article.url}" target="_blank" rel="noopener">Read more ↗</a>
      </div>
    `;
    gridEl.appendChild(card);
  });
}

// Basic HTML-escaping for article text pulled from an external API —
// titles/descriptions are untrusted content, never trust them raw in innerHTML.
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
