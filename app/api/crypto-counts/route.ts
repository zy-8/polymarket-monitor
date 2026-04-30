// Proxies polymarket.com/api/crypto/counts and remaps a couple of keys
// (`pre-market` -> `preMarket`, `fourhour` -> `fourHour`) so the sidebar
// can look counts up by CRYPTO_SIDEBAR.countKey directly.

import { NextResponse } from "next/server"

export const runtime = "edge"
export const revalidate = 30

const UPSTREAM = "https://polymarket.com/api/crypto/counts"

const KEY_REMAP: Record<string, string> = {
  "pre-market": "preMarket",
  fourhour: "fourHour",
}

export async function GET() {
  const upstream = await fetch(UPSTREAM, {
    headers: {
      accept: "application/json",
      "user-agent": "Mozilla/5.0 (compatible; polymarket-monitor/1.0)",
    },
    next: { revalidate: 30 },
  })

  if (!upstream.ok) {
    return NextResponse.json({}, { status: upstream.status })
  }

  const raw = (await upstream.json()) as Record<string, string>
  const data: Record<string, string> = {}
  for (const [k, v] of Object.entries(raw)) {
    data[KEY_REMAP[k] ?? k] = v
  }

  return NextResponse.json(data, {
    headers: {
      "cache-control": "public, s-maxage=30, stale-while-revalidate=120",
    },
  })
}
