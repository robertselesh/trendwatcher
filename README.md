# TrendWatcher — Breakout Watchlist Dashboard

Cyberpunk-themed equity watchlist with **live AI commentary** and **news feed** for mid-cap breakout candidates (6-18 month horizon). Built for a €30-100k portfolio focused on AI infrastructure, AI energy, industrial automation, defense, and crypto-mining themes.

**Live demo:** https://trendwatcher.netlify.app

## Features

- **62 curated picks** across 13 themes (AI_INFRA, AI_ENERGY, INDUSTRIAL, DEFENSE, CRYPTO, MEGA_CAP, SEMI, CLOUD_SAAS, CYBER, FINTECH, BIOTECH, EV, EMERGING)
- **Bull / Base / Bear scenarios** with explicit probabilities + expected value (EV)
- **Live Yahoo prices** — batched fetch, 15min cache, % change + sparkline + 52w range per card
- **Live analyst consensus** — auto-pulled target mean/high/low, recommendation, # analysts per ticker (computed upside vs live price); refreshes every 6h, no manual maintenance
- **Today's Signals bar** — top movers, 52w extremes, earnings within 45d (each row clickable → deep-dive)
- **Earnings badge** per card — auto-pulled from Yahoo, color-coded by proximity (≤7d imminent, ≤21d soon)
- **Position tracker** — per-ticker status (WATCHING / OPEN / CLOSED), entry, size €, exit, private notes; auto P&L on open positions; portfolio summary chip in header (open count, invested €, P&L %/€)
- **Position Sizer** — portfolio €, max % per pick, risk tolerance → suggested allocation per ticker
- **Pre-trade checklist** — 5 discipline items per pick, persisted in `localStorage`
- **AI Daily Brief** — auto-generated 4-5 sentence market summary, cached 6h
- **AI Q&A chat** — ask anything about the watchlist ("top 3 risk/reward", "CRDO vs VRT", etc.)
- **News feed per ticker** — pulls latest Google News headlines
- **AI deep-dive on click** — 200-word analysis combining thesis + scenarios + fresh news
- **Sector heatmap** + **correlation matrix** for diversification
- **Sort by** conviction / mcap / today % / P&L %; **filter by** sector / star / position status
- **Personal watchlist** (star tickers) — saved per-browser
- **Theme switcher** — toggle between **Cyberpunk** (default: neon, monospace, scanlines) and **Clean** (professional dark dashboard: sans-serif, subtle borders, no glow/animation, GitHub-Dark-style palette). Click the `◑ CLEAN_THEME` button in the header; choice persists.

## Stack

- Single-file vanilla HTML/CSS/JS frontend (no build step, no framework)
- **Netlify Functions** as a serverless backend:
  - `/api/ai` → **NVIDIA NIM** (Llama 3.3 70B) primary, **Pollinations.ai** fallback. Requires `NVIDIA_API_KEY` env var.
  - `/api/news` → fetches Google News RSS per ticker (free, no API key)
  - `/api/yfinance` → Yahoo chart endpoint: live price, % change, 52w range, earnings date, 60d history (free, no API key)
  - `/api/targets` → Yahoo quoteSummary (crumb+cookie auth): analyst target mean/high/low, recommendation, # analysts (free, no API key)
- `localStorage` for watchlist + checklist + positions + price/target caches + daily brief cache

## Setup: NVIDIA API key (one-time, ~2 minutes)

The AI features (daily brief, Q&A chat, deep-dive) use **NVIDIA's free NIM tier** for Llama 3.3 70B. To enable:

1. Go to **[build.nvidia.com](https://build.nvidia.com)** → sign up (free, GitHub/Google OAuth)
2. Click any model card (e.g. `meta/llama-3.3-70b-instruct`) → **Get API Key** → copy the `nvapi-xxxxxxxxxxxxx` key
3. In Netlify: **Site settings → Environment variables → Add a variable**
   - Key: `NVIDIA_API_KEY`
   - Value: your `nvapi-...` key
   - Scope: All deploy contexts
4. Trigger a redeploy (push a commit, or Netlify UI → Deploys → Trigger deploy)

**Without the key**, `/api/ai` automatically falls back to Pollinations (rate-limited, less reliable). With the key, NVIDIA handles everything; Pollinations only kicks in if NVIDIA itself errors out.

Free tier: NVIDIA gives ~1000 credits/month on signup. Daily brief + ~50 deep-dives + ~100 Q&A messages = well under that cap. If you exhaust it, just generate a new key.

To override the model per-call, pass `{ model: 'nemotron' | 'mistral' | 'r1' | 'meta/llama-3.3-70b-instruct' | ... }` in the request body.

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

## What's automatic vs manual

**Automatic (no maintenance):**
- Live prices, % change, 52w range, sparklines — refresh on load + every 15min (`/api/yfinance`)
- Earnings dates / badges — from Yahoo, auto
- Analyst consensus targets + recommendation — refresh on load + every 6h (`/api/targets`)
- Today's Signals, sector heatmap, open-position P&L — all derived from the live feeds
- **Weekday earnings-radar briefing** — a Cowork scheduled task (`trendwatcher-earnings-radar`, runs 07:30 Mon-Fri) detects imminent earnings across the 62 names, web-researches consensus/revisions/analyst actions, and delivers a Hungarian briefing. Edit schedule/scope from the Scheduled section in the sidebar.

**Manual (judgment layer — needs re-research + redeploy):**
- The qualitative `thesis`, `catalysts`, `risks`, `conviction` in `PICKS`
- The `SCENARIOS` bull/base/bear targets + probabilities
- The hand-written notes in the `LIVE` block

To refresh the manual layer: open this repo in Cowork mode and ask Claude to re-research the tickers (the earnings-radar briefing is a good trigger), then run `deploy.bat` → Netlify auto-rebuilds in ~15s.

## Disclaimer

Not investment advice. Educational / personal-research tool. Do your own due diligence before trading.
