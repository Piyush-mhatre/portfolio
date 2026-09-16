// =====================================================================
// FINPLAN DEMO — calls the live FastAPI backend and renders the result.
//
// IMPORTANT: update API_BASE_URL below to match your real Render URL.
// This URL is NOT a secret — it's fine for it to be visible in this
// public JS file. The actual API keys (for future features) live only
// in Render's environment variables and are never referenced here.
//
// No trailing slash needed — if you paste one by accident, .replace()
// below strips it automatically, so both "https://x.onrender.com/" and
// "https://x.onrender.com" work correctly either way.
// =====================================================================
const API_BASE_URL = "https://piyush-api-demo.onrender.com".replace(/\/+$/, "");

const form = document.getElementById("finplan-form");
const statusEl = document.getElementById("finplan-status");
const resultsSection = document.getElementById("finplan-results");
const summaryEl = document.getElementById("finplan-summary");
const riskTableBody = document.querySelector("#finplan-risk-table tbody");
const submitBtn = form.querySelector(".finplan-submit");
const zoomEnableBtn = document.getElementById("finplan-zoom-enable");
const zoomDisableBtn = document.getElementById("finplan-zoom-disable");
const resetViewBtn = document.getElementById("finplan-reset-view");

let chart = null;
let isZoomEnabled = true;

// One color per investment category — matches the original app's palette
// exactly, so the same category always reads as the same color.
const CATEGORY_COLORS = {
  "Emergency Fund": "#CBD5E0",
  "Mutual Funds - Large Cap": "#4299E1",
  "Mutual Funds - Mid Cap": "#3182CE",
  "Mutual Funds - Small Cap": "#2B6CB0",
  "PPF": "#48BB78",
  "NPS": "#38A169",
  "Fixed Deposits": "#9F7AEA",
  "REIT (Real Estate)": "#F56565",
  "Corporate Bonds": "#805AD5",
  "Government Bonds": "#553C9A",
  "Gold": "#D69E2E",
  "Equity Stocks": "#E53E3E",
  "SIP": "#F6AD55",
};

function formatINR(value) {
  if (value >= 10000000) return "₹" + (value / 10000000).toFixed(2) + " Cr";
  if (value >= 100000) return "₹" + (value / 100000).toFixed(2) + " L";
  return "₹" + Math.round(value).toLocaleString("en-IN");
}

function riskLabel(level) {
  if (level === 1) return { text: "Low", cls: "finplan-risk-badge-low" };
  if (level === 2) return { text: "Medium", cls: "finplan-risk-badge-mid" };
  return { text: "High", cls: "finplan-risk-badge-high" };
}

// --- Zoom control buttons ---
function updateZoomButtons() {
  zoomEnableBtn.classList.toggle("finplan-chip-active", isZoomEnabled);
  zoomEnableBtn.textContent = "Zoom: On";
  zoomDisableBtn.classList.toggle("finplan-chip-active", !isZoomEnabled);
  zoomDisableBtn.textContent = "Zoom: Off";
}
function applyZoomMode() {
  if (!chart) return;
  const z = chart.options.plugins.zoom.zoom;
  z.wheel.enabled = isZoomEnabled;
  z.pinch.enabled = isZoomEnabled;
  z.drag.enabled = isZoomEnabled;
  chart.options.plugins.zoom.pan.enabled = isZoomEnabled;
  chart.update();
}
zoomEnableBtn.addEventListener("click", () => {
  isZoomEnabled = true;
  updateZoomButtons();
  applyZoomMode();
});
zoomDisableBtn.addEventListener("click", () => {
  isZoomEnabled = false;
  updateZoomButtons();
  applyZoomMode();
});
resetViewBtn.addEventListener("click", () => {
  if (chart) chart.resetZoom();
});
updateZoomButtons();

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const payload = {
    income: parseFloat(document.getElementById("income").value),
    age: parseInt(document.getElementById("age").value, 10),
    salaryGrowth: parseFloat(document.getElementById("salaryGrowth").value),
    investmentPercentage: parseFloat(document.getElementById("investmentPercentage").value),
    riskProfile: form.querySelector('input[name="riskProfile"]:checked').value,
  };

  submitBtn.disabled = true;
  statusEl.textContent = "Calculating — waking up the backend if it's been idle (free tier can take up to ~40s on a cold start)...";
  statusEl.classList.remove("is-error");
  resultsSection.style.display = "none";

  try {
    const response = await fetch(`${API_BASE_URL}/calculate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody.detail || `Server returned ${response.status}`);
    }

    const data = await response.json();
    renderResults(data);
    statusEl.textContent = "";
  } catch (err) {
    console.error(err);
    statusEl.textContent = `Something went wrong: ${err.message}`;
    statusEl.classList.add("is-error");
  } finally {
    submitBtn.disabled = false;
  }
});

function renderResults(data) {
  resultsSection.style.display = "block";

  // --- Summary cards: total corpus at final year, split by a couple of headline categories ---
  const lastIndex = data.years.length - 1;
  const totalFinal = Object.values(data.investments).reduce(
    (sum, series) => sum + series[lastIndex], 0
  );

  summaryEl.innerHTML = `
    <div class="finplan-summary-card">
      <div class="finplan-summary-card-label">Projected total, age ${data.years[lastIndex]}</div>
      <div class="finplan-summary-card-value">${formatINR(totalFinal)}</div>
    </div>
    <div class="finplan-summary-card">
      <div class="finplan-summary-card-label">Projection span</div>
      <div class="finplan-summary-card-value">${data.years[0]} → ${data.years[lastIndex]}</div>
    </div>
  `;

  // --- Chart: every investment category as its own colored line, so the
  // "explainable" part of the project is actually visible — hovering any
  // age shows every category's value at that point together, matching
  // the legend colors above the chart. ---
  const ctx = document.getElementById("finplan-chart").getContext("2d");
  if (chart) chart.destroy();

  const datasets = Object.entries(data.investments).map(([type, series]) => ({
    label: type,
    data: series,
    borderColor: CATEGORY_COLORS[type] || "#888",
    backgroundColor: (CATEGORY_COLORS[type] || "#888") + "22", // ~13% alpha fill
    borderWidth: 2,
    pointRadius: 0,
    pointHoverRadius: 4,
    tension: 0.25,
    fill: false,
  }));

  chart = new Chart(ctx, {
    type: "line",
    data: { labels: data.years, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      interaction: {
        // "nearest" + intersect:false means hovering ANY point at a given
        // age shows every dataset's value at that age together, in one
        // combined tooltip — this is what gives the per-category popup.
        mode: "nearest",
        axis: "x",
        intersect: false,
      },
      plugins: {
        legend: {
          position: "top",
          labels: {
            usePointStyle: true,
            padding: 14,
            font: { size: 11, family: "JetBrains Mono, monospace" },
            color: "#5B6169",
          },
        },
        tooltip: {
          backgroundColor: "rgba(22, 25, 28, 0.92)",
          padding: 12,
          titleFont: { family: "JetBrains Mono, monospace", size: 12 },
          bodyFont: { family: "Inter, sans-serif", size: 12 },
          callbacks: {
            title: (items) => `Age ${items[0].label}`,
            label: (context) => {
              const type = context.dataset.label;
              const growthPct = data.growth_rates[type]
                ? ` (${(data.growth_rates[type] * 100).toFixed(1)}%)`
                : "";
              return `${type}${growthPct}: ${formatINR(context.parsed.y)}`;
            },
          },
        },
        zoom: {
          pan: {
            enabled: isZoomEnabled,
            mode: "xy",
          },
          zoom: {
            wheel: { enabled: isZoomEnabled },
            pinch: { enabled: isZoomEnabled },
            drag: {
              enabled: isZoomEnabled,
              backgroundColor: "rgba(31, 95, 91, 0.12)",
              borderColor: "rgba(31, 95, 91, 0.4)",
              borderWidth: 1,
            },
            mode: "xy",
            limits: {
              x: { min: "original", max: "original", minRange: 2 },
              y: { min: "original", max: "original", minRange: 1000 },
            },
          },
        },
      },
      scales: {
        x: {
          title: { display: true, text: "Age", color: "#5B6169" },
          grid: { color: "rgba(91, 97, 105, 0.08)" },
          ticks: { color: "#5B6169" },
        },
        y: {
          title: { display: true, text: "Investment Value", color: "#5B6169" },
          grid: { color: "rgba(91, 97, 105, 0.08)" },
          ticks: {
            color: "#5B6169",
            callback: (value) => formatINR(value),
          },
        },
      },
    },
  });

  applyZoomMode();

  // --- Risk table ---
  riskTableBody.innerHTML = "";
  Object.entries(data.risk_factors).forEach(([type, level]) => {
    if (type === "Emergency Fund") return; // no growth rate to show, skip
    const { text, cls } = riskLabel(level);
    const growthPct = (data.growth_rates[type] * 100).toFixed(2);
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${type}</td>
      <td><span class="finplan-risk-badge ${cls}">${text}</span></td>
      <td>${growthPct}%</td>
    `;
    riskTableBody.appendChild(row);
  });

  resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
}
