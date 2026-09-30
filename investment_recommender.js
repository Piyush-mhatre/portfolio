// =====================================================================
// INVESTMENT RECOMMENDER DEMO — calls the live FastAPI backend
// (POST /investment/recommend) and renders the pick + alternatives.
//
// API_BASE_URL is the same Render URL used by finplan.js / warmup.js.
// It is not a secret. No trailing slash needed (stripped below).
// =====================================================================
const API_BASE_URL = "https://piyush-api-demo.onrender.com".replace(/\/+$/, "");

const form = document.getElementById("rec-form");
const statusEl = document.getElementById("rec-status");
const resultsSection = document.getElementById("rec-results");
const topEl = document.getElementById("rec-top");
const altsEl = document.getElementById("rec-alts");
const submitBtn = form.querySelector(".rec-submit");

// Everything rendered below comes from our own backend, but it's still
// escaped before going into innerHTML — cheap insurance.
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function cardHTML(opt, { top = false } = {}) {
  const reasons = opt.reasons
    .map(
      (r) => `
      <li class="${r.match ? "is-match" : "is-miss"}">
        <span class="rec-reason-icon" aria-hidden="true">${r.match ? "✓" : "✗"}</span>
        <span>${esc(r.text)}</span>
      </li>`
    )
    .join("");

  return `
    <article class="rec-card ${top ? "rec-card-top" : ""}">
      ${top ? '<p class="rec-kicker">Best match</p>' : ""}
      <div class="rec-card-head">
        <h3 class="rec-name">${esc(opt.name)}</h3>
        <span class="rec-score" title="${opt.matched} of 4 preferences matched">
          <b aria-hidden="true">${"●".repeat(opt.matched)}${"○".repeat(4 - opt.matched)}</b> ${opt.matched}/4 match
        </span>
      </div>
      <p class="rec-desc">${esc(opt.description)}</p>
      <div class="rec-tags">
        <span class="rec-tag">~${opt.return_rate}% / yr (illustrative)</span>
        <span class="rec-tag">${cap(esc(opt.risk_level))} risk</span>
        <span class="rec-tag">${cap(esc(opt.liquidity))} liquidity</span>
        <span class="rec-tag">${opt.tax_benefits === "yes" ? "Tax benefits" : "No tax benefits"}</span>
        <span class="rec-tag">Min ${opt.min_duration} yr${opt.min_duration === 1 ? "" : "s"}</span>
      </div>
      <ul class="rec-reasons">${reasons}</ul>
    </article>`;
}

function renderResults(data) {
  topEl.innerHTML = cardHTML(data.recommendation, { top: true });
  altsEl.innerHTML = data.alternatives.map((a) => cardHTML(a)).join("");
  resultsSection.style.display = "block";
  resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const payload = {
    risk: form.querySelector('input[name="risk"]:checked').value,
    liquidity: form.querySelector('input[name="liquidity"]:checked').value,
    tax: form.querySelector('input[name="tax"]:checked').value,
    duration: parseInt(document.getElementById("duration").value, 10),
  };

  submitBtn.disabled = true;
  statusEl.textContent = "Finding your match — waking up the backend if it's been idle (free tier can take up to ~40s on a cold start)...";
  statusEl.classList.remove("is-error");
  resultsSection.style.display = "none";

  try {
    const response = await fetch(`${API_BASE_URL}/investment/recommend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      // FastAPI validation errors come back as a list in `detail`
      const detail = Array.isArray(errBody.detail) ? "Please check your inputs." : errBody.detail;
      throw new Error(detail || `Server returned ${response.status}`);
    }

    renderResults(await response.json());
    statusEl.textContent = "";
  } catch (err) {
    console.error(err);
    statusEl.textContent = `Something went wrong: ${err.message}`;
    statusEl.classList.add("is-error");
  } finally {
    submitBtn.disabled = false;
  }
});
