# TrendWatcher — Breakout Watchlist Dashboard

Cyberpunk-themed equity watchlist for mid-cap breakout candidates (6-18 month horizon).
Built for a €30-100k portfolio focused on AI infrastructure, AI energy, industrial automation, defense, and crypto-mining themes.

**Live demo:** https://trendwatcher.netlify.app

## Features

- **30 curated picks** across 5 themes (AI_INFRA, AI_ENERGY, INDUSTRIAL, DEFENSE, CRYPTO)
- **Bull / Base / Bear scenarios** with explicit probabilities + expected value (EV) calculation
- **Position Sizer** — portfolio €, max % per pick, risk tolerance → suggested allocation per ticker
- **Pre-trade checklist** — 5 discipline items per pick, persisted in localStorage
- **Conviction & risk filters** + theme color-coding
- **Personal watchlist** (star tickers) — saved per-browser
- **Cyberpunk dark theme** with scanlines, glitch effects, neon accents

## Stack

- Single-file vanilla HTML/CSS/JS (no build step, no framework)
- Allowed CDNs only: Chart.js, Grid.js, Mermaid (currently none loaded — fully self-contained)
- `localStorage` for personal watchlist + checklist state
- `window.cowork.askClaude()` integration when run inside Cowork mode (graceful degrade outside)

## Local development

Just open `index.html` in any modern browser. No server needed.

```bash
# macOS
open index.html

# Linux
xdg-open index.html

# Windows
start index.html
```

## Deployment

### Netlify (auto-deploy from this repo)

1. Connect this GitHub repo on https://app.netlify.com
2. Build command: *(empty)*
3. Publish directory: `.`
4. Push to `main` → Netlify auto-rebuilds

### Manual Netlify Drop

Drag `index.html` to https://app.netlify.com/drop — done.

## Data refresh workflow

The picks, prices, scenarios, and consensus targets are hard-coded in `index.html`. To refresh:

1. Open this repo in Cowork mode
2. Ask Claude to re-research the tickers via WebSearch
3. Update the `LIVE` and `SCENARIOS` maps in `index.html`
4. `git commit -am "refresh: prices + scenarios YYYY-MM-DD"` and push

## Disclaimer

Not investment advice. Educational / personal-research tool. Do your own due diligence before trading.
