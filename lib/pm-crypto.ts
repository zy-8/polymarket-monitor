// Polymarket frontend crypto API. Mirrors polymarket.com/{zh}/crypto exactly:
//   /api/crypto/counts                              -> sidebar counts
//   /api/crypto/markets?_c=&_s=&_sts=&_l=&_offset=  -> events list
// Server-side hits polymarket.com directly, browser goes through /api/pmweb proxy.

const BASE =
  typeof window === "undefined" ? "https://polymarket.com/api" : "/api/pmweb"

const SORT_MAP: Record<string, string> = {
  volume24hr: "volume_24hr",
  volume: "volume",
  liquidity: "liquidity",
  endDate: "end_date",
  startDate: "start_date",
}

export interface CryptoEventTag {
  id?: string
  label?: string
  slug?: string
}

export interface CryptoEventMarket {
  id?: string
  conditionId?: string
  question?: string
  slug?: string
  outcomes?: string[]
  outcomePrices?: string[]
  groupItemTitle?: string
  lastTradePrice?: number
  bestBid?: number
  bestAsk?: number
  spread?: number
  volume?: number
  active?: boolean
  closed?: boolean
}

export interface CryptoEvent {
  id: string
  slug: string
  title: string
  icon?: string
  image?: string
  startDate?: string
  endDate?: string
  volume?: number
  volume24hr?: number
  liquidity?: number
  isLive?: boolean
  active?: boolean
  closed?: boolean
  tags?: CryptoEventTag[]
  markets: CryptoEventMarket[]
}

export interface CryptoEventsPage {
  data: CryptoEvent[]
  pagination: { hasMore: boolean; totalResults: number }
}

interface PmCryptoMarketsResponse {
  events: CryptoEvent[]
  hasMore: boolean
  totalCount: number
}

export interface FetchCryptoEventsOptions {
  tagSlug: string
  order?: string
  limit?: number
  offset?: number
}

export async function fetchCryptoEvents(
  opts: FetchCryptoEventsOptions,
): Promise<CryptoEventsPage> {
  const qs = new URLSearchParams()
  qs.set("_c", opts.tagSlug)
  qs.set("_s", SORT_MAP[opts.order ?? "volume24hr"] ?? "volume_24hr")
  qs.set("_sts", "active")
  qs.set("_l", String(opts.limit ?? 20))
  qs.set("_offset", String(opts.offset ?? 0))

  const res = await fetch(`${BASE}/crypto/markets?${qs.toString()}`, {
    headers: { accept: "application/json" },
  })
  if (!res.ok) throw new Error(`pm crypto/markets ${res.status}`)
  const json = (await res.json()) as PmCryptoMarketsResponse

  return {
    data: json.events ?? [],
    pagination: {
      hasMore: !!json.hasMore,
      totalResults: json.totalCount ?? 0,
    },
  }
}
