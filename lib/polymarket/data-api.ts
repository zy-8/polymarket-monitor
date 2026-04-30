// Wrappers for the public Polymarket data-api & polymarket.com/api endpoints
// used by the event detail page. Browser goes through /api/pm and /api/pmweb
// proxies; server hits upstream directly.

const DATA_BASE =
  typeof window === "undefined" ? "https://data-api.polymarket.com" : "/api/pm"
const PMWEB_BASE =
  typeof window === "undefined" ? "https://polymarket.com/api" : "/api/pmweb"

export interface Trade {
  proxyWallet: string
  side: "BUY" | "SELL"
  asset: string
  conditionId: string
  size: number
  price: number
  /** USDC settled on this trade. Authoritative; prefer over `price * size`. */
  usdcSize?: number
  timestamp: number
  title: string
  slug: string
  icon?: string
  outcome: string
  outcomeIndex: number
  name?: string
  pseudonym?: string
  profileImage?: string
  transactionHash?: string
}

export interface PastResult {
  startTime: string
  endTime: string
  openPrice: number
  closePrice: number
  outcome: "up" | "down"
  percentChange: number
}

interface PastResultsResp {
  status: "success" | "error"
  data?: { results: PastResult[] }
  error?: string
}

export async function fetchPastResults(opts: {
  symbol: string
  variant: "five" | "fifteen" | "hourly" | "fourhour" | "daily"
  assetType?: string
  currentEventStartTime: string
}): Promise<PastResult[]> {
  const qs = new URLSearchParams({
    symbol: opts.symbol,
    variant: opts.variant,
    assetType: opts.assetType ?? "crypto",
    currentEventStartTime: opts.currentEventStartTime,
  })
  const res = await fetch(`${PMWEB_BASE}/past-results?${qs.toString()}`)
  if (!res.ok) return []
  const json = (await res.json()) as PastResultsResp
  return json.data?.results ?? []
}

export interface MarketPosition {
  proxyWallet: string
  name?: string
  profileImage?: string
  verified?: boolean
  asset: string
  conditionId: string
  avgPrice: number
  size: number
  currPrice: number
  currentValue: number
  cashPnl: number
  totalBought: number
  realizedPnl: number
  totalPnl: number
  outcome: string
  outcomeIndex: number
}

export interface MarketPositionsByToken {
  token: string
  positions: MarketPosition[]
}

export async function fetchMarketPositions(
  conditionId: string,
  opts: { limit?: number; user?: string; sortBy?: "TOKENS" | "CASH_PNL" | "REALIZED_PNL" | "TOTAL_PNL" } = {},
): Promise<MarketPositionsByToken[]> {
  // Per docs: https://docs.polymarket.com/api-reference/core/get-positions-for-a-market
  //   - `limit` is per outcome token (so 100 → up to 200 rows for a binary market)
  //   - `status=ALL` keeps closed-out rows (size ≤ 0.01) so we still surface
  //     wallets that already exited — their realised PnL is meaningful
  //     context (whale who got out at the top, etc.)
  //   - default `sortBy` upstream is TOTAL_PNL; we override to TOKENS so the
  //     panel shows the largest holders first (closest to "whale watch")
  //   - `user=<addr>` scopes the query to a single proxy wallet — useful for
  //     looking up holders that fall outside the global top-N
  const qs = new URLSearchParams({
    market: conditionId,
    limit: String(opts.limit ?? 100),
    offset: "0",
    status: "ALL",
    sortBy: opts.sortBy ?? "TOKENS",
    sortDirection: "DESC",
  })
  if (opts.user) qs.set("user", opts.user)
  const res = await fetch(`${DATA_BASE}/v1/market-positions?${qs.toString()}`)
  if (!res.ok) throw new Error(`market-positions ${res.status}`)
  return (await res.json()) as MarketPositionsByToken[]
}

export interface ActivityTrade extends Trade {
  bio?: string
  profileImageOptimized?: string
}

export async function fetchUserActivity(
  address: string,
  opts: { limit?: number; eventId?: string } = {},
): Promise<ActivityTrade[]> {
  // Per Polymarket docs (https://docs.polymarket.com/api-reference/core/get-user-activity)
  // the supported filter params are: user (required), limit (≤500),
  // offset (≤10000 documented; 3000 in practice), market (conditionId,
  // comma-separated), eventId (integer, comma-separated), type, side, start,
  // end, sortBy, sortDirection. `eventSlug` / `slug` are NOT supported and
  // are silently ignored — use `eventId` for event-wide scope.
  const qs = new URLSearchParams({
    user: address,
    limit: String(Math.min(opts.limit ?? 500, 500)),
    type: "TRADE",
  })
  if (opts.eventId) qs.set("eventId", opts.eventId)
  const res = await fetch(`${DATA_BASE}/activity?${qs.toString()}`)
  if (!res.ok) throw new Error(`user-activity ${res.status}`)
  return (await res.json()) as ActivityTrade[]
}

export interface SeriesEventRef {
  id: string
  slug: string
  title: string
  startTime?: string
  endDate?: string
}

export interface SeriesData {
  id: string
  slug: string
  title: string
  recurrence?: string
  events?: SeriesEventRef[]
}

export async function fetchSeriesBySlug(slug: string): Promise<SeriesData | null> {
  const res = await fetch(`${PMWEB_BASE}/series?slug=${encodeURIComponent(slug)}`)
  if (!res.ok) return null
  return (await res.json()) as SeriesData
}
