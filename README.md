# Polymarket Monitor

A Next.js dashboard showing live Polymarket prediction markets. Read-only, no
database, no API keys, no environment variables.

## Architecture

Browser → Next.js Edge Route Handlers at `/api/*` → Polymarket public APIs
(proxied to bypass CORS). Live prices stream via
`wss://ws-live-data.polymarket.com/` directly from the browser.

## Local development

Requires Node.js 20+.

```bash
npm install
npm run dev
# open http://localhost:3000
```

## Production build

```bash
npm run build
npm run start
```

## Deploy to Vercel

Connect the GitHub repo on [vercel.com](https://vercel.com) and accept the
defaults — Next.js is auto-detected. The `/api/*` routes run as Edge Functions
(free tier compatible). No env vars needed.

## Project layout

```
app/
├── api/{clob,gamma,pm,pmweb,crypto-counts}/   # Edge proxies to Polymarket
├── crypto/{page,[filter]/page}.tsx            # crypto market lists
├── event/[slug]/page.tsx                      # event detail page
└── layout.tsx · page.tsx · globals.css
components/
├── dashboard/{shell,crypto-page}.tsx
├── markets/event-detail-pm.tsx
└── theme-provider.tsx
lib/polymarket/                                # API clients + WS
hooks/                                         # SWR hooks
```
