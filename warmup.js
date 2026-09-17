// =====================================================================
// BACKEND WARM-UP PING
//
// Render's free tier spins the backend down after 15 minutes idle; the
// next real request then has to wait 30-60s for a cold start. This file
// fires a silent, fire-and-forget request to the backend's /health route
// the moment ANY portfolio page loads — so if a visitor lands on the
// homepage and spends even a few seconds reading before clicking into a
// project, the backend has already been woken up in the background.
//
// This asks nothing of the visitor and shows them nothing — if it fails
// (backend not deployed yet, offline, whatever), the rest of the page
// works exactly as normal. It's purely a head start, not a dependency.
//
// Include this on every page that might lead to a backend-powered
// feature: index.html, project.html, and each individual feature page
// (finplan.html, and future ones — gold.html, etc.) so the lead time
// stacks the earlier a visitor lands anywhere in the site.
//
// Update BACKEND_URL to match the same Render URL used in finplan.js.
// =====================================================================
(function warmUpBackend() {
  const BACKEND_URL = "https://piyush-api-demo.onrender.com";

  fetch(`${BACKEND_URL}/health`, { mode: "cors" }).catch(() => {
    // Intentionally silent — see comment above.
  });
})();
