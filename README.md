# TrendWatcher — Breakout Watchlist Dashboard

Cyberpunk-themed equity watchlist with **live AI commentary** and **news feed** for mid-cap breakout candidates (6-18 month horizon). Built for a €30-100k portfolio focused on AI infrastructure, AI energy, industrial automation, defense, and crypto-mining themes.

**Live demo:** https://trendwatcher.netlify.app

## Features

- **30 curated picks** across 5 themes (AI_INFRA, AI_ENERGY, INDUSTRIAL, DEFENSE, CRYPTO)
- **Bull / Base / Bear scenarios** with explicit probabilities + expected value (EV)
- **Position Sizer** — portfolio €, max % per pick, risk tolerance → suggested allocation per ticker
- **Pre-trade checklist** — 5 discipline items per pick, persisted in `localStorage`
- **AI Daily Brief** — auto-generated 4-5 sentence market summary, cached 6h
- **AI Q&A chat** — ask anything about the watchlist ("top 3 risk/reward", "CRDO vs VRT", etc.)
- **News feed per ticker** — pulls latest Google News headlines
- **AI deep-dive on click** — 200-word analysis combining thesis + scenarios + fresh news
- **Conviction & risk filters** + theme color-coding
- **Personal watchlist** (star tickers) — saved per-browser
- **Cyberpunk dark theme** with scanlines, glitch effects, neon accents

## Stack

- Single-file vanilla HTML/CSS/JS frontend (no build step, no framework)
- **Netlify Functions** as a serverless backend:
  - `/api/ai` → proxies to **Pollinations.ai** (free, no API key) for AI completions
  - `/api/news` → fetches Google News RSS per ticker (free, no API key)
- `localStorage` for watchlist + checklist state + daily brief cache

## Why this design

- **Zero monthly cost.** Netlify Functions free tier covers 125k invocations/month — more than enough. Pollinations.ai is free with no key. Google News RSS is free.
- **No API keys to manage.** No NVIDIA, no OpenAI, no Anthropic, no Groq — just public endpoints.
- **Static site, dynamic features.** The HTML is fully self-contained; AI just adds a layer on top.

## Local development

Open `index.html` in any modern browser. AI features will be inactive (the `/api/*` endpoints only exist on Netlify) but everything else works.

For local AI testing, install Netlify CLI and run:
```bash
npx netlify dev
```

## Deployment

This repo is wired for **continuous deployment**: every push to `main` triggers a Netlify rebuild in ~15 seconds. No manual steps needed.

Build settings (handled by `netlify.toml`):
- Publish directory: `.`
- Build command: *(empty)*
- Functions directory: `netlify/functions`

## Refreshing the watchlist

The picks, prices, scenarios, and consensus targets are hard-coded in `index.html` (`PICKS`, `LIVE`, `SCENARIOS`). To refresh:

1. Open this repo in Cowork mode and ask Claude to re-research the tickers
2. Or edit `index.html` directly
3. Commit + push → Netlify auto-rebuilds

## Disclaimer

Not investment advice. Educational / personal-research tool. Do your own due diligence before trading.
