# Piyush Mhatre — Portfolio & Interactive Showcase

[![Site Status](https://img.shields.io/badge/status-live-success.svg)](#)
[![Stack](https://img.shields.io/badge/stack-HTML5%20%7C%20CSS3%20%7C%20Vanilla%20JS-blue.svg)](#)
[![Visualization](https://img.shields.io/badge/charts-Chart.js%20%7C%20Canvas%20API-orange.svg)](#)
[![Design](https://img.shields.io/badge/style-Minimalist%20Terminal-lightgrey.svg)](#)

A modern, responsive personal portfolio and interactive frontend showcase. Built with a terminal-inspired developer aesthetic, fluid typography, and zero-dependency vanilla web technologies.

In addition to serving as a developer portfolio, this repository houses the interactive frontend client and demo hub for multiple modules from the **Explainable AI Financial Advisor** platform (published at IEEE CONIT 2025).

---

## ⚡ Key Highlights

- **Terminal-Inspired Minimalist UI:** Clean, developer-focused aesthetic featuring interactive shell prompts (`whoami`, `cat about.md`, `ls ./projects`), custom typography (`JetBrains Mono`, `Inter`, `Newsreader`), and smooth reveal animations.
- **Interactive Dot-Wave Canvas:** A custom HTML5 Canvas background animation with real-time mouse interaction and physics.
- **Zero-Dependency Architecture:** Pure vanilla HTML5, CSS3, and modern ES6+ JavaScript. No complex build pipelines, node modules, or bundler overhead.
- **Smart Backend Warmup:** Includes a lightweight, non-blocking background ping (`warmup.js`) to preemptively wake remote serverless/cloud backends and eliminate cold-start latencies for visitors.
- **Accessibility & Motion First:** Responsive mobile-to-desktop layouts utilizing CSS Grid and Flexbox, with native support for `prefers-reduced-motion`.

---

## 🚀 Interactive Feature Modules

The repository includes a dedicated project hub (`project.html`) and dedicated client interfaces for various data-driven tools:

| Module | Interface | Description | Tech / APIs |
| :--- | :--- | :--- | :--- |
| **Portfolio Homepage** | `index.html` | Core personal portfolio, experience log, skill taxonomy, and project index. | Vanilla JS, Canvas API |
| **Financial Planner** | `finplan.html` | 30-year multi-asset compound growth projection across 12 Indian asset classes. | Chart.js, REST API |
| **Financial Learning Center** | `finlearn.html` | Interactive knowledge base covering asset classes, risk factors, and investment concepts. | Vanilla JS, CSS Grid |
| **Stock Analysis** | `stock_analysis.html` | Ticker analysis featuring Piotroski F-Score metrics, candlestick charts, and trend forecasting. | Chart.js, YFinance API |
| **AI Advisor Chatbot** | `chatbot.html` | Conversational financial assistant with multi-turn memory and local chat persistence. | Gemini API, LocalStorage |
| **Gold Price Tracker** | `gold.html` | Real-time multi-currency gold price tracker by karat with 30-day historical trend charts. | Chart.js, Market APIs |
| **News Sentiment Analyzer**| `news.html` | Financial news search categorized by positive, neutral, or negative sentiment. | BERT NLP Pipeline |
| **Investment Recommender** | `investment_recommender.html` | Risk tolerance and preference-based asset allocation recommendation tool. | Scikit-learn Models |

---

## 🛠️ Tech Stack

- **Markup & Layout:** Semantic HTML5, CSS3 (Custom Properties, Flexbox, CSS Grid)
- **Scripting & Logic:** JavaScript (ES6+), Fetch API, LocalStorage
- **Graphics & Visualization:** HTML5 Canvas, [Chart.js](https://www.chartjs.org/)
- **Typography:** [Google Fonts](https://fonts.google.com/) (`Newsreader`, `Inter`, `JetBrains Mono`)
- **Hosting & Deployment:** Static hosting compatible (Vercel, GitHub Pages, Netlify)

---

## 📂 Project Structure

```text
portfolio/
├── index.html                   # Main portfolio homepage
├── styles.css                   # Global styling, theme variables, and responsive layout
├── script.js                    # Homepage logic, scroll reveal, and dot-wave canvas
├── warmup.js                    # Background silent health-check ping for backend APIs
│
├── project.html                 # Interactive project hub & module selector
├── project.css                  # Project hub layout styling
│
├── finplan.html / .css / .js    # Financial Planner simulation & Chart.js engine
├── finlearn.html / .css / .js   # Financial learning knowledge base
├── stock_analysis.html / .css / .js # Stock metrics, forecasting, and candlestick visualizer
├── chatbot.html / .css / .js    # AI financial advisor chat interface
├── gold.html / .css / .js       # Precious metals pricing & historical charts
├── news.html / .css / .js       # Financial news sentiment analyzer
└── investment_recommender.html / .css / .js # Machine learning investment recommender
```

---

## 👤 Author

**Piyush Santosh Mhatre**  
*Python & Backend Developer | IEEE Published Researcher*

- **GitHub:** [@Piyush-mhatre](https://github.com/Piyush-mhatre)
- **LinkedIn:** [Piyush Mhatre](https://www.linkedin.com/in/piyush-mhatre-399536267/)
- **LeetCode:** [@piyush_11122](https://leetcode.com/u/piyush_11122/)
- **Email:** piyushsm121212@gmail.com
