// =====================================================================
// FINPLAN DEMO — calls the live FastAPI backend and renders the result.
//
// IMPORTANT: update API_BASE_URL below once your backend is deployed to
// Render. This URL is NOT a secret — it's fine for it to be visible in
// this public JS file. The actual API keys (for future features) live
// only in Render's environment variables and are never referenced here.
// =====================================================================
const API_BASE_URL = "https://piyush-api-demo.onrender.com/"; // ← replace after deploying to Render

const form = document.getElementById("finplan-form");
const statusEl = document.getElementById("finplan-status");
const resultsSection = document.getElementById("finplan-results");
const summaryEl = document.getElementById("finplan-summary");
const riskTableBody = document.querySelector("#finplan-risk-table tbody");
const submitBtn = form.querySelector(".finplan-submit");

let chart = null;

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

  // --- Chart: total portfolio value per year, plus the two largest categories ---
  const totalsByYear = data.years.map((_, i) =>
    Object.values(data.investments).reduce((sum, series) => sum + series[i], 0)
  );

  const ctx = document.getElementById("finplan-chart").getContext("2d");
  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: data.years,
      datasets: [
        {
          label: "Total portfolio value",
          data: totalsByYear,
          borderColor: "#1F5F5B",
          backgroundColor: "rgba(31, 95, 91, 0.08)",
          borderWidth: 2,
          fill: true,
          tension: 0.25,
          pointRadius: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => formatINR(context.parsed.y),
          },
        },
      },
      scales: {
        x: { title: { display: true, text: "Age" } },
        y: {
          title: { display: true, text: "Portfolio value" },
          ticks: { callback: (value) => formatINR(value) },
        },
      },
    },
  });
  document.getElementById("finplan-chart").parentElement.style.height = "320px";

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
