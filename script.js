// Subtle fade-up on scroll. No other motion on the page.
const sections = document.querySelectorAll(".fade-section");

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
);

sections.forEach((section) => observer.observe(section));

// Reveal hero immediately (it's above the fold, no need to wait on scroll)
const hero = document.querySelector(".hero");
if (hero) {
  requestAnimationFrame(() => hero.classList.add("is-visible"));
}

// --- Full-page dot-grid wave ---
// A quiet field of dots fixed behind all content, rippling like a slow sine
// wave. Stays pinned to the viewport as the page scrolls over it.
(function initDotWave() {
  const canvas = document.getElementById("heroCanvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const SPACING = 26;
  const RADIUS = 1.7;
  const AMPLITUDE = 11;      // vertical displacement in px
  const WAVELENGTH = 150;    // px per full sine cycle
  const SPEED = 0.0013;      // radians per ms

  let width = 0, height = 0, dpr = 1;
  let dots = [];
  let rafId = null;
  let startTime = null;

  function buildDots() {
    dots = [];
    const cols = Math.ceil(width / SPACING) + 1;
    const rows = Math.ceil(height / SPACING) + 1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        dots.push({ x: c * SPACING, y: r * SPACING, rowPhase: r * 0.4 });
      }
    }
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildDots();
  }

  function draw(t) {
    ctx.clearRect(0, 0, width, height);
    for (const d of dots) {
      const phase = (d.x / WAVELENGTH) + d.rowPhase + t * SPEED;
      const yOff = Math.sin(phase) * AMPLITUDE;
      const alpha = 0.13 + Math.sin(phase * 1.15) * 0.08;
      ctx.beginPath();
      ctx.arc(d.x, d.y + yOff, RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(31, 95, 91, ${Math.max(alpha, 0.03).toFixed(3)})`;
      ctx.fill();
    }
  }

  function loop(timestamp) {
    if (startTime === null) startTime = timestamp;
    draw(timestamp - startTime);
    rafId = requestAnimationFrame(loop);
  }

  function start() {
    if (rafId !== null) return;
    if (prefersReducedMotion) {
      draw(0); // single static frame, no motion for reduced-motion users
      return;
    }
    rafId = requestAnimationFrame(loop);
  }

  function stop() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  window.addEventListener("resize", () => {
    resize();
    if (prefersReducedMotion) draw(0);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else start();
  });

  resize();
  start();
})();
