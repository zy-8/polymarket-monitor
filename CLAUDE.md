# polymarket-monitor

Next.js 16 + React 19 dashboard that visualizes live Polymarket prediction markets.
Read-only, no database, no API keys, no env vars.

## Architecture

Browser → Next.js Edge Route Handlers (`/api/*`) → Polymarket public APIs.
The proxies exist purely to bypass CORS — Polymarket itself is the source of truth.

| Local proxy            | Upstream                                   | Used for                           |
| ---------------------- | ------------------------------------------ | ---------------------------------- |
| `/api/gamma/[...path]` | `https://gamma-api.polymarket.com`         | events, tags, search               |
| `/api/clob/[...path]`  | `https://clob.polymarket.com`              | orderbook, midpoint, price history |
| `/api/pm/[...path]`    | `https://data-api.polymarket.com`          | positions, user activity           |
| `/api/pmweb/[...path]` | `https://polymarket.com/api`               | crypto category endpoints          |
| `/api/crypto-counts`   | `https://polymarket.com/api/crypto/counts` | category sidebar counts            |

Live price stream uses `wss://ws-live-data.polymarket.com/` directly from the
browser (WebSocket has no CORS).

`lib/polymarket/data-api.ts` and `lib/pm-crypto.ts` use isomorphic base URLs:
direct upstream on the server, local proxy in the browser.

## Project layout

```
app/
├── api/{clob,gamma,pm,pmweb,crypto-counts}/   # Edge proxies
├── crypto/{page,[filter]/page}.tsx            # crypto market lists
├── event/[slug]/page.tsx                      # event detail page
├── layout.tsx · page.tsx · globals.css
components/
├── dashboard/{shell,crypto-page}.tsx          # shell + crypto landing
├── markets/event-detail-pm.tsx                # event detail UI
└── theme-provider.tsx
hooks/                                         # SWR hooks per resource
lib/
├── polymarket/{data-api,gamma,types,utils,ws-live}.ts
├── pm-crypto.ts · crypto-nav.ts · format.ts · utils.ts (cn)
```

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind 4 · SWR · `lucide-react` · `next-themes`.
No shadcn/ui components are currently used; styling is hand-written with Tailwind.

## Local development

```bash
npm install
npm run dev          # http://localhost:3000
npm run build && npm run start
```

## Deployment

Vercel — connect the GitHub repo, accept defaults. The `/api/*` routes run on the
Edge runtime; no env vars needed. Free tier compatible.

## Notes for future work

- All shadcn/ui boilerplate (28 Radix packages, vaul, recharts, react-hook-form,
  zod, etc.) has been removed. If a UI primitive is needed, run
  `npx shadcn add <component>` and let it pull just what's required.
- `components.json` is kept to make future shadcn additions painless.
