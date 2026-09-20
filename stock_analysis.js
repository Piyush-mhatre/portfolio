// =====================================================================
// STOCK ANALYSIS DEMO — calls the live FastAPI backend's /analyze route
// and renders all four pieces: Piotroski F-Score, forecast, candlestick
// + company info, and sector performance.
//
// This URL is not a secret — see finplan.js for the full explanation.
// =====================================================================
const API_BASE_URL = "https://piyush-api-demo.onrender.com".replace(/\/+$/, "");

const form = document.getElementById("stock-form");
const statusEl = document.getElementById("stock-status");
const resultsSection = document.getElementById("stock-results");
const submitBtn = form.querySelector(".stock-submit");

function formatMoney(value, currency) {
  if (value === null || value === undefined) return "—";
  return `${currency || "$"} ${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const ticker = document.getElementById("ticker").value.trim().toUpperCase();
  if (!ticker) return;

  submitBtn.disabled = true;
  statusEl.classList.remove("is-error");
  statusEl.textContent = "Analyzing — waking up the backend if it's been idle (free tier can take up to ~40s on a cold start)...";
  resultsSection.style.display = "none";

  try {
    const response = await fetch(`${API_BASE_URL}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker }),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody.detail || `Server returned ${response.status}`);
    }

    const data = await response.json();
    renderPiotroski(data.piotroski);
    renderForecast(data.prophet); // backend keeps the key name "prophet" regardless of engine used
    renderCandlestickAndInfo(data.candlestick);
    renderSector(data.sector);

    resultsSection.style.display = "block";
    statusEl.textContent = "";
    resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    console.error(err);
    statusEl.textContent = `Something went wrong: ${err.message}`;
    statusEl.classList.add("is-error");
  } finally {
    submitBtn.disabled = false;
  }
});

// --- Piotroski F-Score ---
function renderPiotroski(result) {
  const summaryEl = document.getElementById("piotroski-summary");
  const detailsEl = document.getElementById("piotroski-details");

  if (!result || !result.success) {
    summaryEl.innerHTML = `<p class="stock-status is-error">${result?.error || "Piotroski analysis unavailable for this ticker."}</p>`;
    detailsEl.innerHTML = "";
    return;
  }

  summaryEl.innerHTML = `
    <div class="piotroski-score-badge">${result.total_score}<span> / 9</span></div>
    <p class="piotroski-interpretation">${result.interpretation}</p>
  `;

  detailsEl.innerHTML = "";
  result.score_details.forEach((item) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span class="piotroski-mark ${item.score ? "pass" : "fail"}">${item.score ? "✓" : "·"}</span>
      <div>
        <div class="piotroski-criterion">${item.criterion}</div>
        <div class="piotroski-explanation">${item.explanation}</div>
      </div>
    `;
    detailsEl.appendChild(li);
  });
}

// --- Forecast (trend or prophet — same response shape either way) ---
function renderForecast(result) {
  const summaryEl = document.getElementById("forecast-summary");
  const chartEl = document.getElementById("forecast-chart");

  if (!result || !result.success) {
    summaryEl.innerHTML = `<p class="stock-status is-error">${result?.error || "Forecast unavailable for this ticker."}</p>`;
    chartEl.innerHTML = "";
    return;
  }

  const isPositive = result.price_change >= 0;
  summaryEl.innerHTML = `
    <div class="forecast-card">
      <div class="forecast-card-label">Last price</div>
      <div class="forecast-card-value">${formatMoney(result.last_price, result.currency)}</div>
    </div>
    <div class="forecast-card">
      <div class="forecast-card-label">Forecast (1yr out)</div>
      <div class="forecast-card-value ${isPositive ? "positive" : "negative"}">${formatMoney(result.forecast_end_price, result.currency)}</div>
    </div>
    <div class="forecast-card">
      <div class="forecast-card-label">Projected change</div>
      <div class="forecast-card-value ${isPositive ? "positive" : "negative"}">${isPositive ? "+" : ""}${result.percent_change.toFixed(2)}%</div>
    </div>
  `;

  const engineLabel = result.engine === "prophet" ? "Facebook Prophet model" : "lightweight linear-trend model";
  let explanationHtml = `
    <p class="forecast-engine-note">Forecast engine: ${engineLabel}</p>
    <div class="forecast-explanation">
      <p>${result.explanation.summary}</p>
      <p>${result.explanation.trend}</p>
      <p>${result.explanation.uncertainty}</p>
    </div>
  `;
  if (result.explanation.seasonality && result.explanation.seasonality.length) {
    explanationHtml += `<ul class="forecast-seasonality">${result.explanation.seasonality.map((s) => `<li>${s}</li>`).join("")}</ul>`;
  }
  summaryEl.innerHTML += explanationHtml;

  if (result.chart) {
    Plotly.newPlot(chartEl, result.chart.data, result.chart.layout, { responsive: true, displayModeBar: false });
  }
}

// --- Candlestick + company info ---
function renderCandlestickAndInfo(result) {
  const infoEl = document.getElementById("company-info");
  const chartEl = document.getElementById("candlestick-chart");
  const analysisEl = document.getElementById("chart-analysis");

  if (!result || !result.success) {
    infoEl.innerHTML = `<p class="stock-status is-error">${result?.error || "Company info unavailable for this ticker."}</p>`;
    chartEl.innerHTML = "";
    analysisEl.innerHTML = "";
    return;
  }

  const info = result.company_info;
  const hasWebsite = info.Website && info.Website !== "N/A";
  infoEl.innerHTML = `
    <div class="company-info-item">
      <div class="company-info-label">Current price</div>
      <div class="company-info-value">${formatMoney(result.current_price, result.currency)}</div>
    </div>
    <div class="company-info-item">
      <div class="company-info-label">Industry</div>
      <div class="company-info-value">${info.Industry}</div>
    </div>
    <div class="company-info-item">
      <div class="company-info-label">Country</div>
      <div class="company-info-value">${info.Country}</div>
    </div>
    <div class="company-info-item">
      <div class="company-info-label">Website</div>
      <div class="company-info-value">${
        hasWebsite
          ? `<a href="${info.Website}" target="_blank" rel="noopener noreferrer">${info.Website.replace(/^https?:\/\//, "")}</a>`
          : "N/A"
      }</div>
    </div>
    <div class="company-info-item">
      <div class="company-info-label">Analyst recommendation</div>
      <div class="company-info-value">${info.Recommendation}</div>
    </div>
    <div class="company-summary-block">
      <div class="company-info-label">Business summary</div>
      <div class="company-info-value">${info["Business Summary"]}</div>
      <p style="margin-top: 10px; color: var(--color-muted); font-size: 13.5px;">${result.recommendation_explanation}</p>
    </div>
  `;

  if (result.chart) {
    Plotly.newPlot(chartEl, result.chart.data, result.chart.layout, { responsive: true, displayModeBar: false });
  }

  const ca = result.chart_analysis;
  analysisEl.innerHTML = `
    <p>${ca.short_term}</p>
    <p>${ca.medium_term}</p>
    <p>${ca.long_term}</p>
    <p>${ca.volatility}</p>
    <p>${ca.volume}</p>
    ${ca.patterns && ca.patterns.length ? `<ul>${ca.patterns.map((p) => `<li>${p}</li>`).join("")}</ul>` : ""}
  `;
}

// --- Sector performance ---
function renderSector(result) {
  const el = document.getElementById("sector-info");

  if (!result || !result.success) {
    el.innerHTML = `<p class="stock-status is-error">${result?.error || "Sector performance unavailable for this ticker."}</p>`;
    return;
  }

  const perf = result.sector_performance;
  const top = result.sector_comparison?.top_sector;
  const bottom = result.sector_comparison?.bottom_sector;

  el.innerHTML = `
    <div class="sector-badges">
      <span class="skill-tag skill-tag-ai">${result.sector}</span>
      <span class="skill-tag skill-tag-tools">${result.industry}</span>
      <span class="skill-tag ${perf.change_percentage >= 0 ? "skill-tag-backend" : "skill-tag-core"}">${perf.change_percentage >= 0 ? "+" : ""}${perf.change_percentage.toFixed(2)}%</span>
    </div>
    <p>${result.explanation}</p>
    ${top && bottom ? `<p style="color: var(--color-muted); font-size: 13.5px;">Best sector today: ${top.sector} (${top.change_percentage.toFixed(2)}%) · Worst: ${bottom.sector} (${bottom.change_percentage.toFixed(2)}%)</p>` : ""}
  `;
}
