// =====================================================================
// GOLD PRICE TRACKER — calls the live FastAPI backend's /gold/price and
// /gold/insights routes and renders all of it.
//
// This URL is not a secret — see finplan.js for the full explanation.
// =====================================================================
const API_BASE_URL = "https://piyush-api-demo.onrender.com".replace(/\/+$/, "");

const statusEl = document.getElementById("gold-status");
const refreshBtn = document.getElementById("gold-refresh");
const resultsSection = document.getElementById("gold-results");
const badgesEl = document.getElementById("gold-badges");
const summaryEl = document.getElementById("gold-summary");
const karatTableBody = document.querySelector("#gold-karat-table tbody");
const insightsEl = document.getElementById("gold-insights");
const insightsRefreshBtn = document.getElementById("gold-insights-refresh");

const zoomEnableBtn = document.getElementById("gold-zoom-enable");
const zoomDisableBtn = document.getElementById("gold-zoom-disable");
const panEnableBtn = document.getElementById("gold-pan-enable");
const panDisableBtn = document.getElementById("gold-pan-disable");
const resetViewBtn = document.getElementById("gold-reset-view");

let chart = null;
let isZoomEnabled = true;
let isPanEnabled = true;
let insightsPollTimer = null;
const chartCanvas = document.getElementById("gold-chart");

function updateCursorStyle() {
  chartCanvas.classList.toggle("pan-disabled", !isPanEnabled);
  if (!isPanEnabled) chartCanvas.classList.remove("is-panning");
}
chartCanvas.addEventListener("mousedown", () => {
  if (isPanEnabled) chartCanvas.classList.add("is-panning");
});
window.addEventListener("mouseup", () => chartCanvas.classList.remove("is-panning"));
chartCanvas.addEventListener("mouseleave", () => chartCanvas.classList.remove("is-panning"));

// Purity fraction shown next to each karat, e.g. 24K = 99.9% pure gold.
const KARAT_PURITY = {
  "24K": "99.9%",
  "22K": "91.6%",
  "18K": "75.0%",
  "14K": "58.3%",
  "10K": "41.7%",
};
const KARAT_ORDER = ["24K", "22K", "18K", "14K", "10K"];

function formatUSD(value) {
  if (value === null || value === undefined) return "—";
  return "$" + Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
}
function formatINR(value) {
  if (value === null || value === undefined) return "—";
  return "₹" + Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

// --- Chart control chips ---
// Unlike finplan's chart, drag is NOT used for a zoom-selection-box here
// — it's dedicated entirely to pan, so panning and zooming don't fight
// over the same mouse gesture. Zoom is wheel/pinch only.
function updateZoomButtons() {
  zoomEnableBtn.classList.toggle("gold-chip-active", isZoomEnabled);
  zoomDisableBtn.classList.toggle("gold-chip-active", !isZoomEnabled);
}
function updatePanButtons() {
  panEnableBtn.classList.toggle("gold-chip-active", isPanEnabled);
  panDisableBtn.classList.toggle("gold-chip-active", !isPanEnabled);
}
function applyInteractionMode() {
  if (!chart) return;
  const zoomOpts = chart.options.plugins.zoom;
  zoomOpts.zoom.wheel.enabled = isZoomEnabled;
  zoomOpts.zoom.pinch.enabled = isZoomEnabled;
  zoomOpts.pan.enabled = isPanEnabled;
  chart.update("none"); // no animation — an animated re-render on every
                         // toggle/pan frame is what made panning feel
                         // laggy rather than 1:1 with the mouse
  updateCursorStyle();
}
zoomEnableBtn.addEventListener("click", () => { isZoomEnabled = true; updateZoomButtons(); applyInteractionMode(); });
zoomDisableBtn.addEventListener("click", () => { isZoomEnabled = false; updateZoomButtons(); applyInteractionMode(); });
panEnableBtn.addEventListener("click", () => { isPanEnabled = true; updatePanButtons(); applyInteractionMode(); });
panDisableBtn.addEventListener("click", () => { isPanEnabled = false; updatePanButtons(); applyInteractionMode(); });
resetViewBtn.addEventListener("click", () => { if (chart) chart.resetZoom(); });
updateZoomButtons();
updatePanButtons();

// --- Fetching ---
async function loadGoldPrice(forceRefresh) {
  refreshBtn.disabled = true;
  statusEl.classList.remove("is-error");
  statusEl.textContent = forceRefresh
    ? "Refreshing gold price…"
    : "Waking up the backend if it's been idle (free tier can take up to ~40s on a cold start)...";

  clearTimeout(insightsPollTimer);

  try {
    const url = new URL(`${API_BASE_URL}/gold/price`);
    if (forceRefresh) url.searchParams.set("refresh", "true");

    const response = await fetch(url.toString());
    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody.detail || `Server returned ${response.status}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || "Gold price unavailable right now.");
    }

    renderGoldPrice(data);
    statusEl.textContent = "";
    resultsSection.style.display = "block";

    // Insights are generated asynchronously server-side, triggered by
    // this same /gold/price call — poll for them separately.
    insightsEl.innerHTML = `<p class="gold-status">Generating AI insights…</p>`;
    pollInsights();
  } catch (err) {
    console.error(err);
    statusEl.textContent = `Something went wrong: ${err.message}`;
    statusEl.classList.add("is-error");
  } finally {
    refreshBtn.disabled = false;
  }
}

async function pollInsights(attempt = 1) {
  const MAX_ATTEMPTS = 12;   // ~36s total at 3s intervals — Gemini calls are usually quick
  const POLL_INTERVAL_MS = 3000;

  try {
    const response = await fetch(`${API_BASE_URL}/gold/insights`);
    const data = await response.json().catch(() => ({}));

    if (data.success) {
      renderInsights(data);
      insightsRefreshBtn.disabled = false;
      return;
    }

    if (data.status === "processing" && attempt < MAX_ATTEMPTS) {
      insightsPollTimer = setTimeout(() => pollInsights(attempt + 1), POLL_INTERVAL_MS);
      return;
    }

    // Either it failed outright, or we've polled long enough — show
    // whatever error came back rather than polling forever, and let the
    // person try again.
    insightsEl.innerHTML = `<p class="gold-status is-error">${data.error || "AI insights unavailable right now."}</p>`;
    insightsRefreshBtn.disabled = false;
  } catch (err) {
    console.error(err);
    insightsEl.innerHTML = `<p class="gold-status is-error">Could not reach the insights endpoint.</p>`;
    insightsRefreshBtn.disabled = false;
  }
}

refreshBtn.addEventListener("click", () => loadGoldPrice(true));

async function refreshInsightsOnly() {
  insightsRefreshBtn.disabled = true;
  insightsEl.innerHTML = `<p class="gold-status">Generating AI insights…</p>`;
  clearTimeout(insightsPollTimer);

  try {
    const response = await fetch(`${API_BASE_URL}/gold/insights/refresh`, { method: "POST" });
    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody.detail || `Server returned ${response.status}`);
    }
    // Deliberately NOT re-enabling the button here — this response just
    // confirms a background job started, it says nothing about whether
    // Gemini actually succeeded yet. Re-enabling now was the bug: this
    // call returns almost instantly, so the button kept unlocking
    // within ~100ms and a few clicks could fire dozens of redundant
    // requests in seconds (harmless to Gemini thanks to the backend's
    // _insights_loading guard, but pointless and spammy regardless).
    // pollInsights() re-enables it once there's an actual result.
    pollInsights();
  } catch (err) {
    console.error(err);
    insightsEl.innerHTML = `<p class="gold-status is-error">Could not start a new AI analysis: ${err.message}</p>`;
    insightsRefreshBtn.disabled = false;
  }
}
insightsRefreshBtn.addEventListener("click", refreshInsightsOnly);

// --- Rendering ---
function renderGoldPrice(data) {
  const isPositive = data.recommendation === "Positive";

  badgesEl.innerHTML = `
    <span class="skill-tag ${isPositive ? "skill-tag-backend" : "skill-tag-core"}">${data.recommendation} trend</span>
    ${data.rate_is_estimated ? `<span class="skill-tag skill-tag-tools">Estimated USD/INR rate</span>` : ""}
    <span class="skill-tag skill-tag-ai">Updated ${data.last_updated}</span>
  `;

  summaryEl.innerHTML = `
    <div class="gold-summary-card">
      <div class="gold-summary-card-label">Per ounce (USD)</div>
      <div class="gold-summary-card-value">${formatUSD(data.current_price.per_ounce_usd)}</div>
    </div>
    <div class="gold-summary-card">
      <div class="gold-summary-card-label">Per gram (USD)</div>
      <div class="gold-summary-card-value">${formatUSD(data.current_price.per_gram_usd)}</div>
    </div>
    <div class="gold-summary-card">
      <div class="gold-summary-card-label">Per gram (INR)</div>
      <div class="gold-summary-card-value">${formatINR(data.current_price.per_gram_inr)}</div>
    </div>
    <div class="gold-summary-card">
      <div class="gold-summary-card-label">USD → INR rate</div>
      <div class="gold-summary-card-value">${Number(data.usd_inr_rate).toFixed(2)}</div>
    </div>
  `;

  karatTableBody.innerHTML = "";
  KARAT_ORDER.forEach((karat) => {
    const prices = data.karat_prices[karat];
    if (!prices) return;
    const row = document.createElement("tr");
    row.innerHTML = `
      <td class="gold-karat-cell">${karat}</td>
      <td>${KARAT_PURITY[karat] || "—"}</td>
      <td>${formatUSD(prices.USD)}</td>
      <td>${formatINR(prices.INR)}</td>
    `;
    karatTableBody.appendChild(row);
  });

  renderChart(data.plot_data);
}

function renderChart(plotData) {
  const ctx = document.getElementById("gold-chart").getContext("2d");
  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: plotData.dates,
      datasets: [{
        label: "Gold price (USD/gram)",
        data: plotData.prices,
        borderColor: "#D69E2E",
        backgroundColor: "#D69E2E22",
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.25,
        fill: true,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false, // animating every pan/zoom-driven redraw is what
                         // made panning feel laggy instead of tracking
                         // the mouse 1:1 — this is the actual fix
      interaction: { mode: "nearest", axis: "x", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(22, 25, 28, 0.92)",
          padding: 12,
          titleFont: { family: "JetBrains Mono, monospace", size: 12 },
          bodyFont: { family: "Inter, sans-serif", size: 12 },
          callbacks: {
            title: (items) => items[0].label,
            label: (context) => `$${context.parsed.y.toFixed(2)} / gram`,
          },
        },
        zoom: {
          pan: {
            enabled: isPanEnabled,
            mode: "xy",
          },
          zoom: {
            wheel: { enabled: isZoomEnabled },
            pinch: { enabled: isZoomEnabled },
            mode: "xy",
            limits: {
              x: { min: "original", max: "original", minRange: 2 },
              y: { min: "original", max: "original", minRange: 1 },
            },
          },
        },
      },
      scales: {
        x: {
          title: { display: true, text: "Date", color: "#5B6169" },
          grid: { color: "rgba(91, 97, 105, 0.08)" },
          ticks: { color: "#5B6169", maxRotation: 0, autoSkip: true },
        },
        y: {
          title: { display: true, text: "USD / gram", color: "#5B6169" },
          grid: { color: "rgba(91, 97, 105, 0.08)" },
          ticks: { color: "#5B6169", callback: (value) => `$${value}` },
        },
      },
    },
  });

  applyInteractionMode();
  updateCursorStyle();
}

function renderInsights(data) {
  insightsEl.innerHTML = `
    <p>${data.insights}</p>
    <p style="margin-top: 14px; color: var(--color-muted); font-size: 13px;">Generated ${data.last_updated} · gold at $${data.gold_price_at_analysis}/oz</p>
  `;
}

// Fetch immediately on page load — no user input needed for this page.
loadGoldPrice(false);
