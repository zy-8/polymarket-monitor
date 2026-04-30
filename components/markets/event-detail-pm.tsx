"use client"

import { memo, useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import useSWR from "swr"
import { ArrowLeft, Check, ChevronDown, Copy, Search, X } from "lucide-react"
import { useEvent } from "@/hooks/use-event"
import {
  useActivity,
  useMarketPositions,
  usePastResults,
  useUserActivity,
  useUserPositions,
} from "@/hooks/use-event-extras"
import {
  fetchSeriesBySlug,
  type ActivityTrade,
  type MarketPositionsByToken,
  type SeriesData,
  type SeriesEventRef,
} from "@/lib/polymarket/data-api"
import type { MarketView } from "@/lib/polymarket/types"
import { cn } from "@/lib/utils"

type BottomTab = "positions" | "activity"

const VARIANT_BY_RECURRENCE: Record<string, "five" | "fifteen" | "hourly" | "fourhour" | "daily"> = {
  "5m": "five",
  "15m": "fifteen",
  "1h": "hourly",
  hourly: "hourly",
  "4h": "fourhour",
  fourhour: "fourhour",
  "1d": "daily",
  daily: "daily",
}

const STEP_SEC_BY_RECURRENCE: Record<string, number> = {
  "5m": 300,
  "15m": 900,
  "1h": 3600,
  hourly: 3600,
  "4h": 14400,
  fourhour: 14400,
  "1d": 86400,
  daily: 86400,
}

function fmtAge(sec: number): string {
  if (sec < 0) sec = 0
  if (sec < 60) return `${sec}秒前`
  if (sec < 3600) return `${Math.floor(sec / 60)}分钟前`
  if (sec < 86400) return `${Math.floor(sec / 3600)}小时前`
  return `${Math.floor(sec / 86400)}天前`
}

function tradeRowKey(t: ActivityTrade, fallback: number): string {
  return t.transactionHash || `${t.timestamp}-${t.proxyWallet}-${t.size}-${t.price}-${fallback}`
}

function tradeCash(t: ActivityTrade): number {
  return typeof t.usdcSize === "number" && Number.isFinite(t.usdcSize)
    ? t.usdcSize
    : t.price * t.size
}

/**
 * Re-render every `intervalMs` so wall-clock-derived UI (relative timestamps,
 * "5秒前") stays current without waiting for new data to arrive.
 */
function useNowTick(intervalMs = 10_000): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}

function tokenFromSeriesSlug(slug: string | undefined): string | null {
  if (!slug) return null
  const m = slug.match(/^([a-z]+)-/)
  return m ? m[1].toUpperCase() : null
}

export default function EventDetailPm({ slug }: { slug: string }) {
  const { event, isLoading } = useEvent(slug)
  const [bottomTab, setBottomTab] = useState<BottomTab>("positions")
  const [marketIdx, setMarketIdx] = useState(0)

  const market: MarketView | undefined = event?.markets[marketIdx]

  const { positions } = useMarketPositions(market?.raw.conditionId ?? null, {
    enabled: bottomTab === "positions",
  })
  const { activity, livePrices, liveStats } = useActivity(event?.raw.slug ?? null)

  const seriesSlug = (event?.raw as { seriesSlug?: string } | undefined)?.seriesSlug ?? null
  const { data: series } = useSWR<SeriesData | null>(
    seriesSlug ? ["series", seriesSlug] : null,
    () => fetchSeriesBySlug(seriesSlug!),
    { revalidateOnFocus: false },
  )
  const variant = series?.recurrence ? VARIANT_BY_RECURRENCE[series.recurrence] ?? null : null
  const symbol = tokenFromSeriesSlug(series?.slug)
  const stepSec = series?.recurrence ? STEP_SEC_BY_RECURRENCE[series.recurrence] ?? null : null
  // Real window start: prefer event.startTime if upstream provides it (5m
  // events); otherwise derive from `endDate - stepSec` (works for hourly/4h/
  // daily where startTime is missing and startDate is creation time).
  const startTime = useMemo(() => {
    const raw = event?.raw as { startTime?: string; startDate?: string; endDate?: string } | undefined
    if (raw?.startTime) return raw.startTime
    if (raw?.endDate && stepSec) {
      return new Date(new Date(raw.endDate).getTime() - stepSec * 1000).toISOString()
    }
    return raw?.startDate ?? null
  }, [event?.raw, stepSec])
  const { results: pastResults } = usePastResults({
    symbol,
    variant,
    currentEventStartTime: startTime,
  })

  // Stable outcome label array so memo'd children below don't see a new ref
  // on every render (which would defeat React.memo).
  const outcomeLabels = useMemo(
    () => market?.outcomes.map((o) => o.label) ?? [],
    [market?.outcomes],
  )

  // Unique-holder count for the 持仓 tab badge. Computed here (before early
  // returns) so the hook order stays stable across renders where event/market
  // are still loading.
  const totalHolderCount = useMemo(() => {
    const wallets = new Set<string>()
    for (const g of positions) for (const p of g.positions) wallets.add(p.proxyWallet)
    return wallets.size
  }, [positions])

  if (isLoading && !event) {
    return (
      <div className="mx-auto max-w-[1365px] px-6 py-8">
        <div className="h-8 w-1/2 bg-(--pm-neutral-50) rounded animate-pulse" />
        <div className="mt-6 h-96 bg-(--pm-neutral-50) rounded animate-pulse" />
      </div>
    )
  }
  if (!event || !market) {
    return (
      <div className="mx-auto max-w-[1365px] px-6 py-8 text-sm text-(--pm-text-secondary)">
        Event not found.
      </div>
    )
  }

  const isClosed = !!event.raw.closed

  // Probabilities for the OddsCard. Live last-trade-price comes from the
  // ws-live-data `orders_matched` stream filtered by event slug; we fall back
  // to the slower-moving gamma snapshot until a trade streams in. Up/Down
  // (Yes/No) are mirrors that sum to 1: a trade on either side updates both,
  // so we derive each side from whichever stream value is most recent.
  const upLabel = market.outcomes[0]?.label ?? "Up"
  const downLabel = market.outcomes[1]?.label ?? "Down"
  const upToken = market.outcomes[0]?.tokenId ?? ""
  const downToken = market.outcomes[1]?.tokenId ?? ""
  const liveUp = livePrices[upToken]
  const liveDown = livePrices[downToken]
  // Mirror: whichever side has the most recent trade is authoritative; the
  // other side is derived as 1 - p so both update on every match.
  let upProb: number
  let downProb: number
  if (liveUp && (!liveDown || liveUp.ts >= liveDown.ts)) {
    upProb = liveUp.price
    downProb = 1 - liveUp.price
  } else if (liveDown) {
    downProb = liveDown.price
    upProb = 1 - liveDown.price
  } else {
    upProb = market.outcomes[0]?.price ?? 0
    downProb = market.outcomes[1]?.price ?? 1 - upProb
  }
  const isBinary = market.outcomes.length === 2

  // Resolution detection: market is closed AND one outcome's price is 1.
  // Find which one. Use raw outcomePrices since closed markets settle to {1,0}.
  let resolvedWinner: 0 | 1 | null = null
  if (isClosed) {
    if (upProb >= 0.99) resolvedWinner = 0
    else if (downProb >= 0.99) resolvedWinner = 1
  }

  // Tab badge uses the lifetime count (never shrinks on buffer eviction),
  // not the current buffer length, so the badge tells the truth even after
  // the display buffer has rolled over.
  const totalActivityCount = liveStats.count

  return (
    <div className="min-h-screen bg-white text-(--pm-text-primary)">
      <div className="mx-auto max-w-[1180px] px-4 lg:px-6 py-6 lg:py-8">
        <Header event={event} seriesTitle={series?.title} />

        {resolvedWinner != null ? (
          <ResolvedBanner
            winner={resolvedWinner}
            upLabel={upLabel}
            downLabel={downLabel}
            pastResults={pastResults}
            startTime={startTime}
          />
        ) : isBinary ? (
          <OddsCard
            upLabel={upLabel}
            downLabel={downLabel}
            upProb={upProb}
            downProb={downProb}
          />
        ) : null}

        <SeriesTimelineStrip
          pastResults={pastResults}
          currentStartTime={startTime}
          currentSlug={event.raw.slug}
          stepSec={stepSec}
          seriesEvents={series?.events ?? null}
        />

        {event.markets.length > 1 ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {event.markets.map((m, i) => (
              <button
                key={m.raw.id}
                onClick={() => setMarketIdx(i)}
                className={cn(
                  "rounded-full border px-3 py-1 text-[12px]",
                  i === marketIdx
                    ? "border-(--pm-text-primary) bg-(--pm-text-primary) text-white"
                    : "border-(--pm-neutral-100) bg-white text-(--pm-text-secondary) hover:border-(--pm-neutral-200)",
                )}
              >
                {m.raw.groupItemTitle || m.raw.question}
              </button>
            ))}
          </div>
        ) : null}

        <BottomTabsSection
          tab={bottomTab}
          onTab={setBottomTab}
          positions={positions}
          holderCount={totalHolderCount}
          outcomes={outcomeLabels}
          activity={activity}
          activityCount={totalActivityCount}
          activityCountByOutcome={[liveStats.countUp, liveStats.countDown]}
          eventId={event.raw.id ?? null}
          conditionId={market.raw.conditionId ?? null}
        />
      </div>
    </div>
  )
}

/* -------------------------------- header -------------------------------- */

function Header({
  event,
  seriesTitle,
}: {
  event: { raw: { title: string; image?: string; startDate?: string; endDate?: string; volume?: number; closed?: boolean } }
  seriesTitle?: string
}) {
  // Polymarket shows the SERIES title as the H1, plus a subtitle with the
  // date + time range. We synthesise that subtitle from event.startDate /
  // endDate so it works for non-recurring events too.
  const titleText = seriesTitle ?? event.raw.title
  const subtitle = formatEventSubtitle(event.raw.startDate, event.raw.endDate)
  return (
    <div className="flex flex-col gap-3">
      <Link
        href="/crypto"
        className="inline-flex items-center gap-1 text-[13px] text-(--pm-text-secondary) hover:text-(--pm-text-primary) w-fit"
      >
        <ArrowLeft className="size-4" />
        返回主页
      </Link>
      <div className="w-full flex justify-between gap-4 relative items-center">
        <div className="flex gap-4 w-full items-center min-w-0">
          {event.raw.image ? (
            <Image
              src={event.raw.image}
              alt=""
              width={56}
              height={56}
              className="rounded-lg shrink-0 size-14 object-cover"
              unoptimized
            />
          ) : null}
          <div className="min-w-0 flex-1">
            <h1 className="!font-semibold text-[24px] leading-[28px] tracking-tight text-pretty">
              {titleText}
            </h1>
            {subtitle ? (
              <p className="text-(--pm-text-secondary) mt-1 text-[13px] font-medium">
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

const ZH_MONTHS = ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"]

function formatEventSubtitle(startISO?: string, endISO?: string): string | null {
  if (!startISO) return null
  const start = new Date(startISO)
  const end = endISO ? new Date(endISO) : null
  // Match polymarket: "四月 29, 上午 1:30-上午 1:45"
  const day = `${ZH_MONTHS[start.getMonth()]} ${start.getDate()}`
  const t = (d: Date) => {
    const h = d.getHours()
    const m = d.getMinutes().toString().padStart(2, "0")
    const meridiem = h < 12 ? "上午" : "下午"
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
    return `${meridiem} ${h12}:${m}`
  }
  if (end) return `${day}, ${t(start)}-${t(end)}`
  return `${day}, ${t(start)}`
}

/* ------------------------------ odds card ------------------------------ */

function OddsCard({
  upLabel,
  downLabel,
  upProb,
  downProb,
}: {
  upLabel: string
  downLabel: string
  upProb: number
  downProb: number
}) {
  return (
    <div className="mt-5 grid grid-cols-2 gap-3">
      <OddsTile label={upLabel} prob={upProb} kind="up" />
      <OddsTile label={downLabel} prob={downProb} kind="down" />
    </div>
  )
}

function OddsTile({ label, prob, kind }: { label: string; prob: number; kind: "up" | "down" }) {
  const pct = Math.round(prob * 100)
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] px-5 py-3.5 flex items-center justify-between gap-4",
        kind === "up"
          ? "border-(--pm-green-500)/25"
          : "border-(--pm-red-500)/25",
      )}
    >
      {/* probability fill bar */}
      <div
        className={cn(
          "absolute inset-y-0 left-0",
          kind === "up" ? "bg-(--pm-green-500)/8" : "bg-(--pm-red-500)/8",
        )}
        style={{ width: `${pct}%` }}
      />
      <div className="relative flex items-center gap-2.5 min-w-0">
        <span
          className={cn(
            "size-2.5 rounded-full shrink-0",
            kind === "up" ? "bg-(--pm-green-500)" : "bg-(--pm-red-500)",
          )}
        />
        <div className="flex flex-col min-w-0">
          <span className="text-[15px] font-semibold text-(--pm-text-primary) truncate">
            {label}
          </span>
          <span className="text-[11px] text-(--pm-text-tertiary) tabular-nums">
            {(prob * 100).toFixed(1)}¢
          </span>
        </div>
      </div>
      <span
        className={cn(
          "relative text-[28px] font-semibold tabular-nums leading-none shrink-0",
          kind === "up" ? "text-(--pm-green-600)" : "text-(--pm-red-600)",
        )}
      >
        {pct}%
      </span>
    </div>
  )
}

/* --------------------------- resolved banner --------------------------- */

function ResolvedBanner({
  winner,
  upLabel,
  downLabel,
  pastResults,
  startTime,
}: {
  winner: 0 | 1
  upLabel: string
  downLabel: string
  pastResults: { startTime: string; openPrice: number; closePrice: number; percentChange: number }[]
  startTime: string | null
}) {
  // Find the past-result entry matching this event's window for spot price.
  const matchedResult = (() => {
    if (!startTime) return null
    const sec = Math.floor(new Date(startTime).getTime() / 1000)
    return pastResults.find(
      (r) => Math.floor(new Date(r.startTime).getTime() / 1000) === sec,
    )
  })()
  const isUp = winner === 0
  const winLabel = isUp ? upLabel : downLabel
  return (
    <div
      className={cn(
        "mt-5 rounded-xl border bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] px-5 py-3.5 flex items-center justify-between gap-4",
        isUp
          ? "border-(--pm-green-500)/40 bg-(--pm-green-500)/10"
          : "border-(--pm-red-500)/40 bg-(--pm-red-500)/10",
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "size-10 rounded-full flex items-center justify-center text-white text-[18px] font-semibold",
            isUp ? "bg-(--pm-green-500)" : "bg-(--pm-red-500)",
          )}
        >
          {isUp ? "▲" : "▼"}
        </span>
        <div>
          <div className="text-[15px] font-semibold text-(--pm-text-primary)">
            {winLabel} 胜出 · 市场已结算
          </div>
          {matchedResult ? (
            <div className="mt-0.5 text-[12px] text-(--pm-text-secondary) font-mono tabular-nums">
              开盘 ${matchedResult.openPrice.toFixed(2)} → 收盘 ${matchedResult.closePrice.toFixed(2)}
              <span
                className={cn(
                  "ml-2",
                  matchedResult.percentChange >= 0 ? "text-(--pm-green-600)" : "text-(--pm-red-600)",
                )}
              >
                {matchedResult.percentChange >= 0 ? "+" : ""}
                {matchedResult.percentChange.toFixed(3)}%
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

/* --------------------------- series timeline ---------------------------- */

function fmtTimeLabel(iso: string) {
  const d = new Date(iso)
  const h = d.getHours()
  const m = d.getMinutes().toString().padStart(2, "0")
  const meridiem = h < 12 ? "上午" : "下午"
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${meridiem} ${h12}:${m}`
}

interface TimelineEntry {
  slug: string
  endSec: number // seconds; we label by the WINDOW END to match Polymarket UX
  label: string
  outcome?: "up" | "down" | null
  isCurrent?: boolean
}

function SeriesTimelineStrip({
  pastResults,
  currentStartTime,
  currentSlug,
  stepSec,
  seriesEvents,
}: {
  pastResults: { outcome: "up" | "down"; startTime: string; endTime: string; openPrice: number; closePrice: number; percentChange: number }[]
  currentStartTime: string | null
  currentSlug: string
  stepSec: number | null
  seriesEvents: SeriesEventRef[] | null
}) {
  const [openDropdown, setOpenDropdown] = useState<"past" | "more" | null>(null)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  // Close dropdown on outside click.
  useEffect(() => {
    if (!openDropdown) return
    const onDoc = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpenDropdown(null)
      }
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [openDropdown])

  // Build the timeline directly from `series.events`, sorted by window end.
  // Earlier code synthesised slugs from `<ticker-prefix>-<unix-sec>`, but
  // that pattern only holds for 5m markets. Hourly / 4h / daily series use
  // human-readable slugs (e.g. `bitcoin-up-or-down-april-30-2026-12am-et`)
  // and the regex would silently fail, hiding the strip entirely.
  const sorted = useMemo<TimelineEntry[]>(() => {
    if (!seriesEvents || !stepSec) return []
    const pastResultBySec = new Map<number, "up" | "down">()
    for (const r of pastResults) {
      pastResultBySec.set(Math.floor(new Date(r.startTime).getTime() / 1000), r.outcome)
    }
    const out: TimelineEntry[] = []
    for (const e of seriesEvents) {
      const endIso = e.endDate
      if (!endIso) continue
      const endSec = Math.floor(new Date(endIso).getTime() / 1000)
      if (!Number.isFinite(endSec)) continue
      const startSec = endSec - stepSec
      out.push({
        slug: e.slug,
        endSec,
        label: fmtTimeLabel(new Date(endSec * 1000).toISOString()),
        outcome: pastResultBySec.get(startSec) ?? null,
      })
    }
    out.sort((a, b) => a.endSec - b.endSec)
    return out
  }, [seriesEvents, stepSec, pastResults])

  if (!currentStartTime || !stepSec || sorted.length === 0) return null

  const currentIdx = sorted.findIndex((e) => e.slug === currentSlug)
  if (currentIdx < 0) return null

  // Build the four pills: prev2, prev1, current, next1.
  const pills = [-2, -1, 0, 1]
    .map((off) => sorted[currentIdx + off])
    .filter((e): e is TimelineEntry => !!e)
    .map((e) => ({ ...e, isCurrent: e.slug === currentSlug }))

  // The 3 most recent past dots that have an outcome; closest to current first
  // in the pastResults order (most recent last) → reverse so newest comes
  // closest to the pills.
  const pastDots = sorted
    .slice(0, currentIdx)
    .filter((e) => e.outcome != null)
    .slice(-3)

  const pastList = sorted.slice(Math.max(0, currentIdx - 24), currentIdx).reverse()
  const moreList = sorted.slice(currentIdx + 2, currentIdx + 2 + 8)

  return (
    <div ref={wrapperRef} className="mt-5 flex flex-wrap gap-2 items-center">
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setOpenDropdown((v) => (v === "past" ? null : "past"))}
          aria-expanded={openDropdown === "past"}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-full bg-(--pm-neutral-50) hover:bg-(--pm-neutral-100) px-3 text-[14px] font-medium text-(--pm-text-primary)",
            openDropdown === "past" && "bg-(--pm-neutral-100)",
          )}
        >
          过去
          <ChevronDown className={cn("size-3 transition-transform", openDropdown === "past" && "rotate-180")} />
        </button>
        {openDropdown === "past" ? (
          <TimelineDropdown
            align="left"
            title="过去 24 个窗口"
            items={pastList.map((p) => ({
              slug: p.slug,
              label: p.label,
              outcome: p.outcome ?? undefined,
            }))}
            onClose={() => setOpenDropdown(null)}
          />
        ) : null}
      </div>
      {pastDots.map((r) => {
        const up = r.outcome === "up"
        return (
          <Link
            key={r.slug}
            href={`/event/${r.slug}`}
            title={r.label}
            className={cn(
              "inline-flex h-5 w-5 items-center justify-center rounded-full text-white shrink-0",
              up ? "bg-(--pm-green-500)" : "bg-(--pm-red-500)",
            )}
          >
            <span className="text-[10px] leading-none">{up ? "▲" : "▼"}</span>
          </Link>
        )
      })}
      {pills.map((p) => (
        <Link
          key={p.slug}
          href={`/event/${p.slug}`}
          className={cn(
            "inline-flex h-8 items-center px-2 text-[14px] tabular-nums shrink-0 transition-colors rounded-full",
            p.isCurrent
              ? "bg-(--pm-text-primary) text-white px-3"
              : "text-(--pm-text-primary) hover:bg-(--pm-neutral-50)",
          )}
        >
          {p.label}
        </Link>
      ))}
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setOpenDropdown((v) => (v === "more" ? null : "more"))}
          aria-expanded={openDropdown === "more"}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-full bg-(--pm-neutral-50) hover:bg-(--pm-neutral-100) px-3 pl-4 text-[14px] font-medium text-(--pm-text-primary)",
            openDropdown === "more" && "bg-(--pm-neutral-100)",
          )}
        >
          More
          <ChevronDown className={cn("size-3 transition-transform", openDropdown === "more" && "rotate-180")} />
        </button>
        {openDropdown === "more" ? (
          <TimelineDropdown
            align="right"
            title="未来 8 个窗口"
            items={moreList.map((p) => ({ slug: p.slug, label: p.label }))}
            onClose={() => setOpenDropdown(null)}
          />
        ) : null}
      </div>
    </div>
  )
}

function TimelineDropdown({
  align,
  title,
  items,
  onClose,
}: {
  align: "left" | "right"
  title: string
  items: { slug: string; label: string; outcome?: "up" | "down" }[]
  onClose: () => void
}) {
  return (
    <div
      className={cn(
        "absolute top-10 z-20 w-56 max-h-72 overflow-y-auto rounded-xl border border-(--pm-neutral-100) bg-white shadow-[0_8px_16px_rgba(0,0,0,0.08)] py-1",
        align === "left" ? "left-0" : "right-0",
      )}
    >
      <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-(--pm-text-tertiary) sticky top-0 bg-white border-b border-(--pm-neutral-100)">
        {title}
      </div>
      {items.map((it) => (
        <Link
          key={it.slug}
          href={`/event/${it.slug}`}
          onClick={onClose}
          className="flex items-center gap-2 px-3 py-1.5 text-[13px] hover:bg-(--pm-neutral-50)"
        >
          {it.outcome ? (
            <span
              className={cn(
                "size-2 rounded-full shrink-0",
                it.outcome === "up" ? "bg-(--pm-green-500)" : "bg-(--pm-red-500)",
              )}
            />
          ) : (
            <span className="size-2 rounded-full shrink-0 bg-(--pm-neutral-200)" />
          )}
          <span className="tabular-nums">{it.label}</span>
        </Link>
      ))}
    </div>
  )
}

/* ------------------------------ bottom tabs ----------------------------- */

const BottomTabsSection = memo(function BottomTabsSection({
  tab,
  onTab,
  positions,
  holderCount,
  outcomes,
  activity,
  activityCount,
  activityCountByOutcome,
  eventId,
  conditionId,
}: {
  tab: BottomTab
  onTab: (t: BottomTab) => void
  positions: MarketPositionsByToken[]
  holderCount: number
  eventId: string | null
  conditionId: string | null
  outcomes: string[]
  activity: ActivityTrade[]
  activityCount: number
  activityCountByOutcome: number[]
}) {
  const [filter, setFilter] = useState("")
  // Split on commas, whitespace, or newlines so users can paste a list of
  // addresses or names. Empty / pure-whitespace tokens are dropped.
  const tokens = useMemo(
    () =>
      filter
        .split(/[\s,，；;]+/)
        .map((s) => s.trim().toLowerCase())
        .filter((s) => s.length > 0),
    [filter],
  )
  const q = tokens.join(" ").trim()
  const hasFilter = tokens.length > 0

  const matchAny = (haystacks: (string | undefined)[]): boolean => {
    for (const t of tokens) {
      for (const h of haystacks) {
        if (h && h.toLowerCase().includes(t)) return true
      }
    }
    return false
  }

  // Address tokens (0x…) drive an upstream lookup so we can match holders /
  // traders that fall outside the unfiltered top-N response.
  const filterAddresses = useMemo(
    () => tokens.filter((t) => /^0x[a-f0-9]{40}$/i.test(t)),
    [tokens],
  )
  const { trades: addressTrades } = useUserActivity(filterAddresses, eventId)
  const { groups: addressPositions } = useUserPositions(filterAddresses, conditionId)

  const matchedPositions = useMemo<MarketPositionsByToken[]>(() => {
    if (!hasFilter) return []
    // Merge the unfiltered top-N response with per-address upstream lookups,
    // dedup by (token, proxyWallet), then apply substring matching so name
    // tokens narrow the result too.
    const byToken = new Map<string, { token: string; positions: typeof positions[number]["positions"] }>()
    for (const g of [...positions, ...addressPositions]) {
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
    return Array.from(byToken.values())
      .map((g) => ({
        ...g,
        positions: g.positions.filter((p) => matchAny([p.proxyWallet, p.name])),
      }))
      .filter((g) => g.positions.length > 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions, addressPositions, q])

  const matchedActivity = useMemo<ActivityTrade[]>(() => {
    if (!hasFilter) return []
    // Merge WS live + per-address history, dedup, then apply name/pseudonym
    // filtering so non-address tokens still narrow the result.
    const seen = new Set<string>()
    const merged: ActivityTrade[] = []
    for (const t of [...addressTrades, ...activity]) {
      const k = t.transactionHash || `${t.timestamp}-${t.proxyWallet}-${t.size}-${t.price}`
      if (seen.has(k)) continue
      seen.add(k)
      merged.push(t)
    }
    merged.sort((a, b) => b.timestamp - a.timestamp)
    return merged.filter((t) => matchAny([t.proxyWallet, t.name, t.pseudonym]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activity, addressTrades, q])

  const positionMatchCount = matchedPositions.reduce((n, g) => n + g.positions.length, 0)
  const activityMatchCount = matchedActivity.length
  // Time window the matched activity covers, surfaced in the focus card so
  // the "总额 / 买卖" stats are interpretable. With an address typed, we have
  // up to /activity's last 500 of that address (broad). With name-only
  // tokens, we only see the WS buffer collected since the page opened.
  const activityWindowLabel =
    filterAddresses.length > 0 ? "上游最近 500 笔成交" : "本次会话期间的成交"

  return (
    <section className="mt-6">
      <div className="flex items-center gap-4 border-b border-(--pm-neutral-100) pb-2">
        <BottomTabBtn active={tab === "positions"} onClick={() => onTab("positions")}>
          持仓
          <span
            className="ml-1.5 text-[12px] font-medium text-(--pm-text-tertiary) tabular-nums"
            title="独立持仓人数（同时持有 YES 和 NO 的钱包只算一次）"
          >
            {holderCount > 0 ? `(${holderCount})` : null}
          </span>
        </BottomTabBtn>
        <BottomTabBtn active={tab === "activity"} onClick={() => onTab("activity")}>
          动态
          <span className="ml-1.5 text-[12px] font-medium text-(--pm-text-tertiary) tabular-nums">
            {activityCount > 0 ? `(${activityCount})` : null}
          </span>
        </BottomTabBtn>
        <div className="ml-auto relative">
          <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-(--pm-text-tertiary) pointer-events-none" />
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="搜索地址或名字..."
            className="h-8 w-56 rounded-full bg-(--pm-neutral-50) pl-8 pr-8 text-[12px] text-(--pm-text-primary) placeholder:text-(--pm-text-tertiary) outline-none focus:bg-white focus:ring-1 focus:ring-(--pm-neutral-200)"
          />
          {filter ? (
            <button
              type="button"
              onClick={() => setFilter("")}
              aria-label="清除"
              className="absolute right-2 top-1/2 -translate-y-1/2 size-4 inline-flex items-center justify-center rounded-full hover:bg-(--pm-neutral-100) text-(--pm-text-tertiary) hover:text-(--pm-text-primary)"
            >
              <X className="size-3" />
            </button>
          ) : null}
        </div>
      </div>

      {q ? (
        <div className="mt-3 text-[12px] text-(--pm-text-secondary)">
          已过滤「{filter}」 · {tab === "positions" ? `${positionMatchCount} 笔持仓` : `${activityMatchCount} 笔成交`}
          <button
            type="button"
            onClick={() => setFilter("")}
            className="ml-2 text-(--pm-brand-500) hover:underline"
          >
            清除
          </button>
        </div>
      ) : null}

      {/* When filter is active, show a full-width focus card ABOVE the main grid. */}
      {q && tab === "positions" && matchedPositions.length > 0 ? (
        <div className="mt-4">
          <FilteredPositionsCard
            groups={matchedPositions}
            outcomes={outcomes}
            label={filter}
          />
        </div>
      ) : null}
      {q && tab === "activity" && matchedActivity.length > 0 ? (
        <div className="mt-4">
          <FilteredActivityCard
            trades={matchedActivity}
            outcomes={outcomes}
            label={filter}
            windowLabel={activityWindowLabel}
          />
        </div>
      ) : null}

      <div className="mt-4">
        {tab === "positions" ? (
          <PositionsPanel positions={positions} outcomes={outcomes} />
        ) : (
          <ActivityFeed
            activity={activity}
            outcomes={outcomes}
            countByOutcome={activityCountByOutcome}
          />
        )}
      </div>
    </section>
  )
})

function BottomTabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "text-[16px] leading-5 font-semibold whitespace-nowrap shrink-0 transition-colors duration-150",
        active
          ? "text-(--pm-text-primary)"
          : "text-(--pm-text-secondary) hover:text-(--pm-text-primary)",
      )}
    >
      {children}
    </button>
  )
}

/* -------------------------- positions panel -------------------------- */

const PositionsPanel = memo(function PositionsPanel({
  positions,
  outcomes,
}: {
  positions: MarketPositionsByToken[]
  outcomes: string[]
}) {
  if (positions.length === 0)
    return <div className="py-12 text-center text-[13px] text-(--pm-text-tertiary)">暂无持仓</div>

  // Upstream `/v1/market-positions?sortBy=TOKENS DESC` returns groups ordered
  // by aggregate share count, so groups[0] is NOT guaranteed to be outcome 0.
  // Read `outcomeIndex` off the rows themselves to label / colour correctly.
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {positions.map((group) => {
        const oi = group.positions[0]?.outcomeIndex ?? 0
        const isYes = oi === 0
        return (
          <div
            key={group.token}
            className="rounded-xl border border-(--pm-neutral-100) bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-(--pm-neutral-100) flex items-center gap-2">
              <span
                className={cn(
                  "size-2 rounded-full shrink-0",
                  isYes ? "bg-(--pm-green-500)" : "bg-(--pm-red-500)",
                )}
              />
              <span className="text-[13px] font-semibold text-(--pm-text-primary)">
                {outcomes[oi] ?? group.positions[0]?.outcome ?? "?"} 持仓
              </span>
              <span className="text-[11px] text-(--pm-text-tertiary) tabular-nums">
                · {group.positions.length}
              </span>
              <span className="ml-auto text-[11px] text-(--pm-text-tertiary)">
                按份额排序
              </span>
            </div>
            <div className="max-h-[600px] overflow-y-auto">
              <PositionTable positions={group.positions} />
            </div>
          </div>
        )
      })}
    </div>
  )
})

function FilteredPositionsCard({
  groups,
  outcomes,
  label,
}: {
  groups: MarketPositionsByToken[]
  outcomes: string[]
  label: string
}) {
  // Aggregate stats across both outcomes for the matched address.
  const allPositions = groups.flatMap((g) => g.positions)
  const totalValue = allPositions.reduce((n, p) => n + p.currentValue, 0)
  const totalPnl = allPositions.reduce((n, p) => n + p.totalPnl, 0)
  const totalBought = allPositions.reduce((n, p) => n + p.totalBought, 0)
  const pnlPct = totalBought > 0 ? (totalPnl / totalBought) * 100 : null
  const pnlPositive = totalPnl >= 0
  return (
    <div className="rounded-xl border border-(--pm-brand-500)/30 bg-(--pm-brand-500)/5 overflow-hidden">
      <div className="px-5 py-3 border-b border-(--pm-brand-500)/30 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2 text-[14px] font-semibold text-(--pm-text-primary)">
          🔎 已筛选「{label}」
        </div>
        <div className="flex items-center gap-4 ml-auto text-[12px] font-mono tabular-nums">
          <Stat k="持仓数" v={`${allPositions.length}`} />
          <Stat k="总市值" v={`$${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
          <Stat
            k="总盈亏"
            v={
              <span className={pnlPositive ? "text-(--pm-green-600)" : "text-(--pm-red-600)"}>
                {pnlPositive ? "+" : "-"}$
                {Math.abs(totalPnl).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                {pnlPct != null ? (
                  <span className="text-(--pm-text-tertiary) ml-1">
                    {pnlPct >= 0 ? "+" : ""}
                    {pnlPct.toFixed(1)}%
                  </span>
                ) : null}
              </span>
            }
          />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-(--pm-brand-500)/20">
        {groups.map((g) => {
          const oi = g.positions[0]?.outcomeIndex ?? 0
          const isYes = oi === 0
          return (
            <div key={g.token}>
              <div className="px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-(--pm-text-secondary) flex items-center gap-1.5">
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    isYes ? "bg-(--pm-green-500)" : "bg-(--pm-red-500)",
                  )}
                />
                {outcomes[oi] ?? g.positions[0]?.outcome ?? "?"} · {g.positions.length} 笔
              </div>
              {/* 5 rows visible; scroll for more. Each position row ~74px. */}
              <div className="max-h-[370px] overflow-y-auto">
                <PositionTable positions={g.positions} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Stat({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wider text-(--pm-text-tertiary)">{k}</span>
      <span className="text-(--pm-text-primary)">{v}</span>
    </div>
  )
}

function PositionTable({
  positions,
}: {
  positions: { proxyWallet: string; name?: string; profileImage?: string; size: number; currentValue: number; avgPrice: number; totalBought: number; totalPnl: number }[]
}) {
  if (positions.length === 0)
    return <div className="px-4 py-6 text-center text-[12px] text-(--pm-text-tertiary)">暂无</div>
  return (
    <div className="divide-y divide-(--pm-neutral-100)">
      {positions.map((p) => (
        <PositionRow key={p.proxyWallet} pos={p} />
      ))}
    </div>
  )
}

function PositionRow({
  pos,
}: {
  pos: { proxyWallet: string; name?: string; profileImage?: string; size: number; currentValue: number; avgPrice: number; totalBought: number; totalPnl: number }
}) {
  const displayName =
    pos.name && pos.name.trim().length > 0
      ? pos.name
      : pos.proxyWallet.slice(0, 6) + "…" + pos.proxyWallet.slice(-4)
  const pnlPositive = pos.totalPnl >= 0
  // ROI %: profit relative to cost basis. If totalBought is 0 (free claim) we
  // cannot compute a meaningful percentage.
  const pnlPct = pos.totalBought > 0 ? (pos.totalPnl / pos.totalBought) * 100 : null
  return (
    <div className="px-4 py-3 flex items-start gap-3 hover:bg-(--pm-neutral-50)/60 transition-colors">
      <Avatar src={pos.profileImage} fallback={displayName} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[14px] truncate text-(--pm-text-primary)">{displayName}</span>
            <CopyAddress address={pos.proxyWallet} />
          </div>
          <span
            className={cn(
              "text-[14px] font-mono tabular-nums shrink-0",
              pnlPositive ? "text-(--pm-green-600)" : "text-(--pm-red-600)",
            )}
          >
            {pos.totalPnl < 0 ? "-" : "+"}$
            {Math.abs(pos.totalPnl).toLocaleString(undefined, {
              maximumFractionDigits: Math.abs(pos.totalPnl) >= 100 ? 0 : 2,
            })}
            {pnlPct != null ? (
              <span className="text-(--pm-text-tertiary) ml-1.5 text-[12px]">
                {pnlPct >= 0 ? "+" : ""}
                {pnlPct.toFixed(2)}%
              </span>
            ) : null}
          </span>
        </div>
        <div className="mt-1.5 flex items-center gap-4 text-[12px] text-(--pm-text-secondary) font-mono tabular-nums">
          <span>
            {pos.size.toLocaleString(undefined, { maximumFractionDigits: 2 })} 份
          </span>
          <span className="text-(--pm-neutral-200)">·</span>
          <span>
            ${pos.currentValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </span>
          {pos.avgPrice > 0 ? (
            <>
              <span className="text-(--pm-neutral-200)">·</span>
              <span>均价 {(pos.avgPrice * 100).toFixed(0)}¢</span>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function CopyAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false)
  if (!address || address === "0x0000000000000000000000000000000000000000") return null
  const onClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    void navigator.clipboard?.writeText(address).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <button
      type="button"
      onClick={onClick}
      title={`复制地址 ${address}`}
      aria-label="复制地址"
      className={cn(
        "inline-flex items-center justify-center size-5 rounded shrink-0 transition-colors",
        copied
          ? "text-(--pm-green-600)"
          : "text-(--pm-text-tertiary) hover:text-(--pm-text-primary) hover:bg-(--pm-neutral-50)",
      )}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </button>
  )
}

function Avatar({ src, fallback }: { src?: string; fallback: string }) {
  if (src && src.length > 0) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className="size-8 rounded-full object-cover bg-(--pm-neutral-50) shrink-0"
      />
    )
  }
  const initial = fallback.replace(/^0x/, "").slice(0, 1).toUpperCase() || "?"
  return (
    <div className="size-8 rounded-full bg-(--pm-neutral-100) flex items-center justify-center text-[11px] font-medium text-(--pm-text-secondary) shrink-0">
      {initial}
    </div>
  )
}

/* --------------------------- activity feed ---------------------------- */

const ActivityFeed = memo(function ActivityFeed({
  activity,
  outcomes,
  countByOutcome,
}: {
  activity: ActivityTrade[]
  outcomes: string[]
  /** Lifetime trade count per outcome (never shrinks on buffer eviction). */
  countByOutcome: number[]
}) {
  // `activity` is already newest-first from the hook; bucket by outcomeIndex
  // without re-sorting, and bucket every outcome (not just 0/1) so
  // multi-outcome events don't silently drop trades. Memoised so we only
  // pay the partition cost when the underlying array changes.
  const buckets = useMemo(() => {
    const out: ActivityTrade[][] = outcomes.map(() => [])
    for (const t of activity) {
      const i = t.outcomeIndex
      if (i >= 0 && i < out.length) out[i].push(t)
    }
    return out
  }, [activity, outcomes.length])

  if (activity.length === 0)
    return <div className="py-12 text-center text-[13px] text-(--pm-text-tertiary)">等待成交…</div>

  const cols = outcomes.length === 2 ? "md:grid-cols-2" : "md:grid-cols-2 lg:grid-cols-3"
  return (
    <div className={cn("grid grid-cols-1 gap-4", cols)}>
      {outcomes.map((label, i) => (
        <ActivityGroup
          key={i}
          label={`${label ?? `Outcome ${i}`} 动态`}
          kind={i === 0 ? "up" : "down"}
          trades={buckets[i] ?? []}
          totalCount={countByOutcome[i] ?? (buckets[i]?.length ?? 0)}
          outcomes={outcomes}
        />
      ))}
    </div>
  )
})

function FilteredActivityCard({
  trades,
  outcomes,
  label,
  windowLabel,
}: {
  trades: ActivityTrade[]
  outcomes: string[]
  label: string
  /** Human-readable description of the time/source window the stats cover. */
  windowLabel: string
}) {
  const now = useNowTick()
  const sorted = useMemo(() => [...trades].sort((a, b) => b.timestamp - a.timestamp), [trades])
  const upTrades = sorted.filter((t) => t.outcomeIndex === 0)
  const downTrades = sorted.filter((t) => t.outcomeIndex === 1)
  const totalCash = sorted.reduce((n, t) => n + tradeCash(t), 0)
  const buys = sorted.filter((t) => t.side === "BUY").length
  const sells = sorted.length - buys

  const renderRow = (t: ActivityTrade, i: number, kind: "up" | "down") => {
    const cash = tradeCash(t)
    return (
      <div key={tradeRowKey(t, i)} className="px-4 py-2 flex items-center gap-3 text-[12px]">
        <span
          className={cn(
            "rounded-md px-1.5 py-0.5 text-[10px] font-medium shrink-0",
            kind === "up"
              ? "bg-(--pm-green-50) text-(--pm-green-600)"
              : "bg-(--pm-red-50) text-(--pm-red-600)",
          )}
        >
          {t.side === "BUY" ? "买" : "卖"} {outcomes[t.outcomeIndex] ?? t.outcome}
        </span>
        <span className="font-mono tabular-nums text-(--pm-text-secondary) w-10 text-right shrink-0">
          {(t.price * 100).toFixed(0)}¢
        </span>
        <span className="font-mono tabular-nums text-(--pm-text-primary) flex-1 text-right shrink-0">
          ${cash.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </span>
        <span className="text-(--pm-text-tertiary) w-14 text-right shrink-0 text-[10px]">
          {fmtAge(now - t.timestamp)}
        </span>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-(--pm-brand-500)/30 bg-(--pm-brand-500)/5 overflow-hidden">
      <div className="px-5 py-3 border-b border-(--pm-brand-500)/30 flex items-start gap-4 flex-wrap">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2 text-[14px] font-semibold text-(--pm-text-primary)">
            🔎 已筛选「{label}」
          </div>
          <div className="text-[11px] text-(--pm-text-tertiary)">统计范围：{windowLabel}</div>
        </div>
        <div className="flex items-center gap-4 ml-auto text-[12px] font-mono tabular-nums">
          <Stat k="成交数" v={`${sorted.length}`} />
          <Stat k="总额" v={`$${totalCash.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
          <Stat k="买/卖" v={`${buys} / ${sells}`} />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-(--pm-brand-500)/20">
        <div>
          <div className="px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-(--pm-text-secondary) flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-(--pm-green-500)" />
            {outcomes[0] ?? "Up"} · {upTrades.length} 笔
          </div>
          <div className="max-h-[200px] overflow-y-auto divide-y divide-(--pm-brand-500)/15">
            {upTrades.length === 0 ? (
              <div className="px-4 py-6 text-center text-[12px] text-(--pm-text-tertiary)">无</div>
            ) : (
              upTrades.map((t, i) => renderRow(t, i, "up"))
            )}
          </div>
        </div>
        <div>
          <div className="px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-(--pm-text-secondary) flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-(--pm-red-500)" />
            {outcomes[1] ?? "Down"} · {downTrades.length} 笔
          </div>
          <div className="max-h-[200px] overflow-y-auto divide-y divide-(--pm-brand-500)/15">
            {downTrades.length === 0 ? (
              <div className="px-4 py-6 text-center text-[12px] text-(--pm-text-tertiary)">无</div>
            ) : (
              downTrades.map((t, i) => renderRow(t, i, "down"))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const ActivityGroup = memo(function ActivityGroup({
  label,
  kind,
  trades,
  totalCount,
  outcomes,
}: {
  label: string
  kind: "up" | "down"
  trades: ActivityTrade[]
  /**
   * Lifetime count of trades seen for this outcome since page load. The
   * `trades` array is capped to the display buffer so its `.length` would
   * cap out and shrink as old entries roll off; `totalCount` is monotonic.
   */
  totalCount: number
  outcomes: string[]
}) {
  const now = useNowTick()
  // Note: a "net flow" badge used to live here, computed as buy-cash minus
  // sell-cash over `trades`. It was removed because `trades` is the WS
  // buffer (only since page load), not a market-wide aggregate, so the
  // figure was misleading. Re-introduce only when backed by a real stat.
  return (
    <div className="rounded-xl border border-(--pm-neutral-100) bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
      <div className="px-4 py-3 border-b border-(--pm-neutral-100) flex items-center gap-2">
        <span
          className={cn(
            "size-2 rounded-full shrink-0",
            kind === "up" ? "bg-(--pm-green-500)" : "bg-(--pm-red-500)",
          )}
        />
        <span className="text-[13px] font-semibold text-(--pm-text-primary)">{label}</span>
        <span
          className="ml-auto text-[11px] text-(--pm-text-tertiary) tabular-nums"
          title={
            totalCount > trades.length
              ? `本次会话共 ${totalCount} 笔，列表仅显示最新 ${trades.length} 笔`
              : undefined
          }
        >
          {totalCount} 笔成交
        </span>
      </div>
      <div className="divide-y divide-(--pm-neutral-100) max-h-[600px] overflow-y-auto">
        {trades.length === 0 ? (
          <div className="px-4 py-6 text-center text-[12px] text-(--pm-text-tertiary)">
            暂无成交
          </div>
        ) : (
          trades.map((t, i) => {
            const displayName =
              t.name && t.name.trim().length > 0
                ? t.name
                : t.pseudonym && t.pseudonym.trim().length > 0
                  ? t.pseudonym
                  : t.proxyWallet.slice(0, 6) + "…" + t.proxyWallet.slice(-4)
            const cash = tradeCash(t)
            return (
              <div key={tradeRowKey(t, i)} className="px-4 py-2.5 flex items-center gap-3 text-[13px] hover:bg-(--pm-neutral-50)/60 transition-colors">
                <Avatar src={t.profileImage} fallback={displayName} />
                <div className="flex-1 min-w-0 flex items-center gap-1.5">
                  <span className="truncate text-(--pm-text-primary)">{displayName}</span>
                  <CopyAddress address={t.proxyWallet} />
                </div>
                <span
                  className={cn(
                    "rounded-md px-2 py-0.5 text-[11px] font-medium shrink-0",
                    kind === "up"
                      ? "bg-(--pm-green-50) text-(--pm-green-600)"
                      : "bg-(--pm-red-50) text-(--pm-red-600)",
                  )}
                >
                  {t.side === "BUY" ? "买入" : "卖出"} {outcomes[t.outcomeIndex] ?? t.outcome}
                </span>
                <span className="font-mono tabular-nums text-(--pm-text-secondary) w-12 text-right shrink-0">
                  {(t.price * 100).toFixed(0)}¢
                </span>
                <span className="font-mono tabular-nums text-(--pm-text-primary) w-16 text-right shrink-0">
                  ${cash.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
                <span className="text-(--pm-text-tertiary) w-16 text-right shrink-0 text-[11px]">
                  {fmtAge(now - t.timestamp)}
                </span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
})
