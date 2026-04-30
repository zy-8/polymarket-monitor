"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import useSWR from "swr"
import { subscribeLive, type LiveActivityTrade } from "@/lib/polymarket/ws-live"
import {
  fetchMarketPositions,
  fetchPastResults,
  fetchUserActivity,
  type ActivityTrade,
  type MarketPosition,
  type MarketPositionsByToken,
  type PastResult,
} from "@/lib/polymarket/data-api"

export function useMarketPositions(
  conditionId: string | null,
  opts: { enabled?: boolean } = {},
) {
  const enabled = opts.enabled !== false
  const { data, isLoading } = useSWR<MarketPositionsByToken[]>(
    enabled && conditionId ? ["market-positions", conditionId] : null,
    () => fetchMarketPositions(conditionId!),
    {
      // Holdings move much slower than the price stream; 5 s gives a
      // near-live feel without hammering the data API every second.
      refreshInterval: 5_000,
      revalidateOnFocus: false,
      dedupingInterval: 4_000,
      keepPreviousData: true,
    },
  )
  return { positions: data ?? [], isLoading }
}

// Display-only buffer cap. Old trades fall off, so do their stat
// contributions — keep this small (a few screens of scroll) and rely on
// `liveCount` for honest lifetime stats. Bigger ≠ better here, just slower.
const ACTIVITY_BUFFER_CAP = 200

function tradeKey(t: Pick<ActivityTrade, "transactionHash" | "timestamp" | "proxyWallet" | "size" | "price">) {
  return t.transactionHash || `${t.timestamp}-${t.proxyWallet}-${t.size}-${t.price}`
}

export interface LivePriceTick {
  price: number
  ts: number
}

/**
 * Live trade activity for an event over a single ws-live-data subscription.
 * Returns the running activity buffer plus the latest trade price per outcome
 * token (for the OddsCard probability display) — both derived from the same
 * `trades` stream so callers don't need a second WS connection.
 *
 * The REST `/trades?eventId=…` endpoint is intentionally not used (it caps at
 * offset 3000 and errors beyond it); historical lookups for a specific
 * address go through `useUserActivity`.
 */
export function useActivity(eventSlug: string | null) {
  // Newest-first buffer of WS-pushed trades. We mirror this into a Set held
  // in a ref so the dedup check in the message handler is O(1) instead of
  // rebuilding a Set from the array on every push.
  const [live, setLive] = useState<ActivityTrade[]>([])
  const [livePrices, setLivePrices] = useState<Record<string, LivePriceTick>>({})
  // Session-lifetime counters — counts every distinct trade we've ever seen
  // for this event since the page opened. NOT shrunk by buffer eviction so
  // tab badges & summary stats keep growing honestly even after the
  // display buffer rolls over.
  const [liveStats, setLiveStats] = useState({
    count: 0,
    buys: 0,
    sells: 0,
    countUp: 0,
    countDown: 0,
    cashUp: 0,
    cashDown: 0,
  })
  const seenRef = useRef<Set<string>>(new Set())
  // Pending buffer + scheduled-flush handle: WS messages on a busy market can
  // arrive 10+ times per second; flushing each one through setState forces a
  // re-render of every component reading these states. We coalesce arrivals
  // into 200 ms windows so the UI repaints at most ~5×/s.
  const pendingRef = useRef<{
    trades: ActivityTrade[]
    prices: Record<string, LivePriceTick>
  }>({ trades: [], prices: {} })
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setLive([])
    setLivePrices({})
    setLiveStats({ count: 0, buys: 0, sells: 0, countUp: 0, countDown: 0, cashUp: 0, cashDown: 0 })
    seenRef.current = new Set()
    pendingRef.current = { trades: [], prices: {} }
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current)
      flushTimerRef.current = null
    }
    if (!eventSlug) return
    let alive = true

    const flush = () => {
      flushTimerRef.current = null
      if (!alive) return
      const { trades: pendingTrades, prices: pendingPrices } = pendingRef.current
      pendingRef.current = { trades: [], prices: {} }
      if (pendingTrades.length > 0) {
        // Tally lifetime stats from every trade in this batch — these
        // counters never shrink even when the display buffer rolls over.
        let buys = 0
        let sells = 0
        let countUp = 0
        let countDown = 0
        let cashUp = 0
        let cashDown = 0
        for (const t of pendingTrades) {
          if (t.side === "BUY") buys++
          else sells++
          const cash =
            typeof t.usdcSize === "number" && Number.isFinite(t.usdcSize)
              ? t.usdcSize
              : t.price * t.size
          if (t.outcomeIndex === 0) {
            countUp++
            cashUp += cash
          } else if (t.outcomeIndex === 1) {
            countDown++
            cashDown += cash
          }
        }
        setLiveStats((prev) => ({
          count: prev.count + pendingTrades.length,
          buys: prev.buys + buys,
          sells: prev.sells + sells,
          countUp: prev.countUp + countUp,
          countDown: prev.countDown + countDown,
          cashUp: prev.cashUp + cashUp,
          cashDown: prev.cashDown + cashDown,
        }))
        setLive((prev) => {
          const next = [...pendingTrades, ...prev]
          if (next.length <= ACTIVITY_BUFFER_CAP) return next
          const dropped = next.slice(ACTIVITY_BUFFER_CAP)
          // NB: leave seenRef intact so a delayed dup of an evicted trade
          // doesn't double-count the lifetime stats.
          return next.slice(0, ACTIVITY_BUFFER_CAP)
        })
      }
      if (Object.keys(pendingPrices).length > 0) {
        setLivePrices((prev) => {
          let changed = false
          const next = { ...prev }
          for (const [asset, tick] of Object.entries(pendingPrices)) {
            const cur = next[asset]
            if (!cur || tick.ts >= cur.ts) {
              next[asset] = tick
              changed = true
            }
          }
          return changed ? next : prev
        })
      }
    }
    const scheduleFlush = () => {
      if (flushTimerRef.current != null) return
      flushTimerRef.current = setTimeout(flush, 200)
    }

    const handle = subscribeLive(
      [
        {
          topic: "activity",
          type: "trades",
          filters: { event_slug: eventSlug },
        },
      ],
      (msg) => {
        if (!alive || msg.topic !== "activity") return
        const payload = msg.payload as
          | LiveActivityTrade
          | LiveActivityTrade[]
          | { data?: LiveActivityTrade[] }
          | undefined
        const rows: LiveActivityTrade[] = Array.isArray(payload)
          ? payload
          : payload && typeof payload === "object" && "data" in payload && Array.isArray(payload.data)
          ? payload.data ?? []
          : payload && typeof payload === "object"
          ? [payload as LiveActivityTrade]
          : []

        let touched = false
        for (const r of rows) {
          if (!r || typeof r !== "object" || !("proxyWallet" in r)) continue
          const trade: ActivityTrade = {
            ...r,
            size: Number(r.size),
            price: Number(r.price),
            // upstream timestamps are unix-seconds (REST) or unix-millis (WS).
            timestamp: r.timestamp > 1e12 ? Math.floor(r.timestamp / 1000) : r.timestamp,
            title: r.title ?? "",
            slug: r.slug ?? "",
          }
          const k = tradeKey(trade)
          if (seenRef.current.has(k)) continue
          seenRef.current.add(k)
          // Newest first; the buffer the flush prepends with is also newest-
          // first so we just unshift here.
          pendingRef.current.trades.unshift(trade)
          if (trade.asset && Number.isFinite(trade.price)) {
            const cur = pendingRef.current.prices[trade.asset]
            if (!cur || trade.timestamp >= cur.ts) {
              pendingRef.current.prices[trade.asset] = { price: trade.price, ts: trade.timestamp }
            }
          }
          touched = true
        }
        if (touched) scheduleFlush()
      },
    )
    return () => {
      alive = false
      handle.close()
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current)
        flushTimerRef.current = null
      }
    }
  }, [eventSlug])

  // `live` is inserted newest-first; sort defensively in case a stream
  // message arrives out-of-order. Memoised so we don't re-sort each render.
  const activity = useMemo(() => [...live].sort((a, b) => b.timestamp - a.timestamp), [live])
  return { activity, livePrices, liveStats }
}

export function usePastResults(opts: {
  symbol: string | null
  variant: "five" | "fifteen" | "hourly" | "fourhour" | "daily" | null
  currentEventStartTime: string | null
}) {
  const enabled = !!(opts.symbol && opts.variant && opts.currentEventStartTime)
  const { data } = useSWR<PastResult[]>(
    enabled ? ["pastResults", opts.symbol, opts.variant, opts.currentEventStartTime] : null,
    () =>
      fetchPastResults({
        symbol: opts.symbol!,
        variant: opts.variant!,
        currentEventStartTime: opts.currentEventStartTime!,
      }),
    { refreshInterval: 60_000, revalidateOnFocus: false },
  )
  return { results: data ?? [] }
}

/**
 * Fetch positions for one or more wallet addresses on a specific market.
 * Backs the address-search filter on the 持仓 tab so we can surface holders
 * who are outside the top-N returned by the unfiltered query — `user=<addr>`
 * is honoured upstream and scopes the result to that single wallet.
 */
export function useUserPositions(
  addresses: string[],
  conditionId: string | null,
): { groups: MarketPositionsByToken[]; isLoading: boolean } {
  const key =
    addresses.length && conditionId ? ["user-market-positions", conditionId, addresses.join(",")] : null
  const { data, isLoading } = useSWR<MarketPositionsByToken[]>(
    key,
    async () => {
      const lists = await Promise.all(
        addresses.map((a) =>
          fetchMarketPositions(conditionId!, { user: a }).catch(() => []),
        ),
      )
      // Merge per-address results back into the shared {token, positions[]}
      // shape the UI expects, deduping by (token, proxyWallet).
      const byToken = new Map<string, { token: string; positions: MarketPosition[] }>()
      for (const groups of lists) {
        for (const g of groups) {
          let bucket = byToken.get(g.token)
          if (!bucket) {
            bucket = { token: g.token, positions: [] }
            byToken.set(g.token, bucket)
          }
          for (const p of g.positions) {
            if (!bucket.positions.some((q) => q.proxyWallet === p.proxyWallet)) {
              bucket.positions.push(p)
            }
          }
        }
      }
      return Array.from(byToken.values())
    },
    { revalidateOnFocus: false, keepPreviousData: true },
  )
  return { groups: data ?? [], isLoading }
}

/**
 * Fetch historical activity for one or more wallet addresses, scoped to an
 * event via the upstream `eventId` filter. Backs the address-search filter
 * in the activity panel: the WS buffer only contains trades since page load,
 * so an address typed into the search box needs an explicit history fetch.
 */
export function useUserActivity(
  addresses: string[],
  eventId: string | null,
): { trades: ActivityTrade[]; isLoading: boolean } {
  const key = addresses.length && eventId ? ["user-activity", eventId, addresses.join(",")] : null
  const { data, isLoading } = useSWR<ActivityTrade[]>(
    key,
    async () => {
      const lists = await Promise.all(
        addresses.map((a) =>
          fetchUserActivity(a, { eventId: eventId!, limit: 500 }).catch(() => []),
        ),
      )
      const seen = new Set<string>()
      const out: ActivityTrade[] = []
      for (const t of lists.flat()) {
        const k = tradeKey(t)
        if (seen.has(k)) continue
        seen.add(k)
        out.push(t)
      }
      out.sort((a, b) => b.timestamp - a.timestamp)
      return out
    },
    { revalidateOnFocus: false, keepPreviousData: true },
  )
  return { trades: data ?? [], isLoading }
}
