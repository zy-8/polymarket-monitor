# Polymarket Monitor

A Next.js dashboard showing live Polymarket prediction markets.

## Architecture

- Browser → Next.js Edge Route Handler at `/api/gamma/*` → `gamma-api.polymarket.com` (proxy, bypasses CORS)
- Browser → `clob.polymarket.com` directly (CORS open) — orderbook, midpoint, price history
- Browser → `wss://ws-subscriptions-clob.polymarket.com` directly — live price stream

No database, no API keys, no environment variables. Read-only.

## Local development

Requires Node.js 20+.

```bash
yarn install
yarn dev
# open http://localhost:3000
```

## Production build

```bash
yarn build
yarn start
```

## Deploy to Vercel

```bash
npm i -g vercel
vercel             # first-time setup, accept defaults
vercel --prod      # deploy to production
```

Vercel auto-detects Next.js. The `/api/gamma/*` route runs as an Edge Function (free tier compatible). No env vars needed.

## Project layout

```
app/
├── api/gamma/[...path]/route.ts   # Edge proxy to gamma-api.polymarket.com
├── trending/page.tsx              # main view
└── page.tsx                       # redirect → /trending
lib/polymarket/
├── types.ts
├── gamma.ts                       # /events /tags /search via local proxy
├── clob.ts                        # /book /midpoint /prices-history (browser direct)
├── ws.ts                          # WebSocket subscribe (browser direct)
└── utils.ts
hooks/
├── use-trending.ts                # SWR + 30s refresh
├── use-orderbook.ts
└── use-live-prices.ts
components/onepiece/markets/
├── trending.tsx
├── market-card.tsx
├── sort-tabs.tsx
├── filter-bar.tsx
└── category-sidebar.tsx
```
