// =====================================================================
// SCROLL-REVEAL — fades/rises each .reveal element into view the first
// time it enters the viewport. Skips straight to visible for anyone with
// reduced-motion enabled at the OS level.
// =====================================================================
const revealElements = document.querySelectorAll(".reveal");

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("reveal-visible");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
);

revealElements.forEach((el) => revealObserver.observe(el));

// The hero is above the fold on first load — reveal it immediately rather
// than waiting for a scroll event that may never come.
const heroSection = document.querySelector(".hero-section");
if (heroSection) {
  requestAnimationFrame(() => heroSection.classList.add("reveal-visible"));
}

// =====================================================================
// DOT-WAVE BACKGROUND ANIMATION
//
// A quiet field of dots that ripples like a slow sine wave, sitting
// behind everything inside the .animated-content wrapper (hero through
// experience). It is sized to that WRAPPER, not the browser viewport —
// so it starts right below the header and ends exactly where the
// wrapper ends, right before the footer. It scrolls normally with the
// page (it is not pinned/fixed), which is what makes it stop in the
// right place instead of covering the whole screen forever.
// =====================================================================
(function initDotWave() {
  const canvas = document.getElementById("dotWave");
  const wrapper = document.querySelector(".animated-content");
  if (!canvas || !wrapper) return;

  const ctx = canvas.getContext("2d");
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const SPACING = 32;
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
    // Size the canvas to the wrapper's full content height (which can be
    // much taller than the viewport, since it spans hero → experience),
    // not just the visible viewport.
    width = wrapper.offsetWidth;
    height = wrapper.offsetHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
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

  function handleResize() {
    resize();
    if (prefersReducedMotion) draw(0);
  }

  window.addEventListener("resize", handleResize);

  // Recompute once web fonts finish loading — font swaps can change text
  // height/line-wrapping, which changes how tall the wrapper is.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(handleResize);
  }

  // Recompute if the wrapper's own height changes for any other reason
  // (e.g. content added later, images loading, window zoom).
  if (typeof ResizeObserver !== "undefined") {
    const ro = new ResizeObserver(() => handleResize());
    ro.observe(wrapper);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else start();
  });

  resize();
  start();
})();
