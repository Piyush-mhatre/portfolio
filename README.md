# Piyush Mhatre — Portfolio

Static site. No build step, no dependencies. Just `index.html`, `styles.css`, `script.js`.

## Run it locally right now

Just double-click `index.html` — it opens in your browser. That's it, no server needed.

(If fonts don't load because you're offline, the page still works — it falls back to system fonts cleanly.)

---

## Host it for free — Option A: GitHub Pages (simplest, recommended for v1)

1. Create a new **public** GitHub repo — name it `portfolio` (or anything you like).
2. Upload these 3 files (`index.html`, `styles.css`, `script.js`) to the repo root.
   - Easiest way: on the repo page, click **Add file → Upload files**, drag all three in, commit.
3. Go to the repo's **Settings → Pages**.
4. Under "Build and deployment," set **Source: Deploy from a branch**, **Branch: main**, folder **/ (root)**. Save.
5. Wait ~1 minute. Your site will be live at:
   `https://<your-github-username>.github.io/<repo-name>/`
   e.g. `https://piyush-mhatre.github.io/portfolio/`
6. Any time you edit a file and push/upload again, the live site updates automatically in ~1 minute.

---

## Host it for free — Option B: Vercel (if you want it under Vercel instead)

1. Push the same 3 files to a GitHub repo (same as steps 1-2 above).
2. Go to vercel.com → sign up/log in with your GitHub account.
3. Click **Add New → Project**, select your repo.
4. Framework preset: choose **Other** (it's a plain static site, no build command needed).
5. Click **Deploy**.
6. You'll get a live URL like `https://portfolio-piyush.vercel.app`.
7. Every future push to `main` auto-redeploys.

---

## What to update as you go

- **Project GitHub links** — currently all point to your GitHub profile as a placeholder. Once each project has its own repo (or a proper README describing it), update the `href` on each "View on GitHub ↗" link in `index.html` to point directly to that repo.
- **Live demo line** — on the Explainable AI Financial Advisor project, there's a line: `Live demo coming soon — currently rebuilding on FastAPI + React`. Once that rebuild is deployed (Render/Railway), replace that `<span class="project__note">` with a real `<a href="your-deployed-url">Live demo ↗</a>` link, styled the same as the GitHub link next to it.
- **New projects** — copy one `<article class="project fade-section">...</article>` block in `index.html`, edit the year/title/description/tags/links. The tag colors are controlled by class name: `tag--lang`, `tag--backend`, `tag--db`, `tag--ai`, `tag--core`, `tag--tools` (see `styles.css` for the color mapping if you want to adjust).

---

## Notes

- All fonts load from Google Fonts via CDN (Newsreader, Inter, JetBrains Mono) — requires internet on first load, cached after.
- Site respects `prefers-reduced-motion` — the scroll fade-in is disabled automatically for users who've turned off animations at the OS level.
- No analytics, no tracking, no cookies — nothing to configure or disclose.
