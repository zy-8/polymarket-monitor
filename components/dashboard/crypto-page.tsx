"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  Bookmark,
  Calendar,
  Clock,
  Flag,
  LayoutGrid,
  Menu,
  Search,
  TrendingUp,
} from "lucide-react"
import { useCryptoCounts } from "@/hooks/use-crypto-counts"
import { useCryptoEvents } from "@/hooks/use-crypto-events"
import {
  CRYPTO_GROUP_ORDER,
  CRYPTO_SIDEBAR,
  findCryptoFilter,
  type CryptoSidebarItem,
} from "@/lib/crypto-nav"
import type { CryptoEvent, CryptoEventMarket } from "@/lib/pm-crypto"
import { formatCompactUsd } from "@/lib/format"
import { cn } from "@/lib/utils"

interface Props {
  filter: string | null
  locale?: "en" | "zh"
}

export default function CryptoPage({ filter, locale = "en" }: Props) {
  const item = findCryptoFilter(filter)
  const [showMobileNav, setShowMobileNav] = useState(false)
  const [query, setQuery] = useState("")

  useEffect(() => {
    setShowMobileNav(false)
  }, [item.routeSlug])

  const { counts } = useCryptoCounts()
  const { events, totalCount, hasMore, isLoading, isLoadingMore, loadMore } =
    useCryptoEvents({ tagSlug: item.tagSlug })

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return events
    return events.filter((e) => e.title.toLowerCase().includes(q))
  }, [events, query])

  const sentinelRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && hasMore && !isLoadingMore) {
          loadMore()
        }
      },
      { rootMargin: "400px" },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [hasMore, isLoadingMore, loadMore])

  const headerLabel = locale === "zh" ? item.labelZh : item.labelEn

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <div className="mx-auto w-full max-w-[1280px] px-4 py-6 lg:py-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[228px_1fr]">
          <Sidebar activeRouteSlug={item.routeSlug} counts={counts} locale={locale} />

          <main className="min-w-0">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-baseline gap-3">
                <button
                  type="button"
                  aria-label={locale === "zh" ? "分类" : "Categories"}
                  onClick={() => setShowMobileNav((v) => !v)}
                  className="inline-flex size-8 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 lg:hidden"
                >
                  <Menu className="size-4" />
                </button>
                <h1 className="text-[22px] font-semibold tracking-tight">
                  {headerLabel}
                  {item.routeSlug ? (
                    <span className="ml-2 text-[14px] font-normal text-neutral-500">
                      {locale === "zh" ? "加密货币" : "Crypto"}
                    </span>
                  ) : null}
                </h1>
                <span className="text-[12px] text-neutral-500 tabular-nums">
                  {totalCount ? `${totalCount}` : "—"}
                </span>
              </div>
              <SearchBox
                value={query}
                onChange={setQuery}
                placeholder={locale === "zh" ? "搜索" : "Search"}
              />
            </div>

            {showMobileNav ? (
              <MobileNav
                activeRouteSlug={item.routeSlug}
                counts={counts}
                locale={locale}
                onClose={() => setShowMobileNav(false)}
              />
            ) : null}

            {isLoading && events.length === 0 ? (
              <Skeletons />
            ) : null}

            {!isLoading && filtered.length === 0 ? (
              <EmptyState routeSlug={item.routeSlug} locale={locale} />
            ) : null}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((event) => (
                <EventCard key={event.id} event={event} locale={locale} />
              ))}
            </div>

            {hasMore ? (
              <div ref={sentinelRef} className="mt-6 flex items-center justify-center py-6">
                <span className="text-[12px] text-neutral-500">
                  {isLoadingMore
                    ? locale === "zh"
                      ? "加载中…"
                      : "Loading…"
                    : locale === "zh"
                      ? "下滑加载更多"
                      : "Scroll to load more"}
                </span>
              </div>
            ) : (
              <div className="mt-6 text-center text-[11px] text-neutral-400">
                {locale === "zh" ? "已加载全部" : "All caught up"}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}

function Sidebar({
  activeRouteSlug,
  counts,
  locale,
}: {
  activeRouteSlug: string | null
  counts: Record<string, string>
  locale: "en" | "zh"
}) {
  return (
    <aside className="hidden lg:block">
      <nav className="sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto rounded-xl border border-neutral-200 bg-white p-2">
        {CRYPTO_GROUP_ORDER.map((group, gi) => {
          const items = CRYPTO_SIDEBAR.filter((i) => i.group === group)
          if (items.length === 0) return null
          return (
            <div key={group} className={cn("flex flex-col gap-0.5", gi > 0 && "mt-2 border-t border-neutral-100 pt-2")}
            >
              {items.map((item) => (
                <SidebarRow
                  key={item.routeSlug ?? "all"}
                  item={item}
                  active={item.routeSlug === activeRouteSlug}
                  count={counts[item.countKey]}
                  locale={locale}
                />
              ))}
            </div>
          )
        })}
      </nav>
    </aside>
  )
}

function MobileNav({
  activeRouteSlug,
  counts,
  locale,
  onClose,
}: {
  activeRouteSlug: string | null
  counts: Record<string, string>
  locale: "en" | "zh"
  onClose: () => void
}) {
  return (
    <div className="mb-4 lg:hidden">
      <nav className="rounded-xl border border-neutral-200 bg-white p-2">
        {CRYPTO_GROUP_ORDER.map((group, gi) => {
          const items = CRYPTO_SIDEBAR.filter((i) => i.group === group)
          if (items.length === 0) return null
          return (
            <div
              key={group}
              className={cn("flex flex-col gap-0.5", gi > 0 && "mt-2 border-t border-neutral-100 pt-2")}
            >
              {items.map((it) => (
                <SidebarRow
                  key={it.routeSlug ?? "all"}
                  item={it}
                  active={it.routeSlug === activeRouteSlug}
                  count={counts[it.countKey]}
                  locale={locale}
                  onClick={onClose}
                />
              ))}
            </div>
          )
        })}
      </nav>
    </div>
  )
}

function SidebarRow({
  item,
  active,
  count,
  locale,
  onClick,
}: {
  item: CryptoSidebarItem
  active: boolean
  count?: string
  locale: "en" | "zh"
  onClick?: () => void
}) {
  const href = item.routeSlug ? `/crypto/${item.routeSlug}` : `/crypto`
  const label = locale === "zh" ? item.labelZh : item.labelEn
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center justify-between gap-2 rounded-md px-3 py-2 text-[13px] transition",
        active
          ? "bg-neutral-100 font-semibold text-neutral-900"
          : "text-neutral-700 hover:bg-neutral-50",
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        <SidebarIcon iconKey={item.iconKey} />
        <span className="truncate">{label}</span>
      </span>
      <span className="text-[11px] tabular-nums text-neutral-500">{count ?? "—"}</span>
    </Link>
  )
}

function SidebarIcon({ iconKey }: { iconKey: string }) {
  const cls = "size-3.5 shrink-0"
  switch (iconKey) {
    case "grid":
      return <LayoutGrid className={cls} />
    case "clock":
      return <Clock className={cls} />
    case "calendar":
      return <Calendar className={cls} />
    case "flag":
      return <Flag className={cls} />
    case "btc":
    case "eth":
    case "sol":
    case "xrp":
    case "doge":
    case "bnb":
      return <TokenDot iconKey={iconKey} />
    case "mstr":
      return <TrendingUp className={cls} />
    default:
      return <Flag className={cls} />
  }
}

function TokenDot({ iconKey }: { iconKey: string }) {
  const colors: Record<string, string> = {
    btc: "bg-orange-500",
    eth: "bg-indigo-500",
    sol: "bg-violet-500",
    xrp: "bg-sky-500",
    doge: "bg-amber-400",
    bnb: "bg-yellow-500",
  }
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2.5 shrink-0 rounded-full", colors[iconKey] ?? "bg-neutral-400")}
    />
  )
}

function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-8 w-44 rounded-full border border-neutral-200 bg-white pl-7 pr-3 text-[13px] outline-none placeholder:text-neutral-400 focus:border-neutral-400"
      />
    </div>
  )
}

function Skeletons() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-44 animate-pulse rounded-xl border border-neutral-200 bg-neutral-50"
        />
      ))}
    </div>
  )
}

function EmptyState({
  routeSlug,
  locale,
}: {
  routeSlug: string | null
  locale: "en" | "zh"
}) {
  const text =
    locale === "zh"
      ? routeSlug
        ? "目前暂无该分类的预测盘口"
        : "暂无预测盘口"
      : routeSlug
        ? "No active markets in this category right now."
        : "No markets to show."
  return (
    <div className="rounded-xl border border-dashed border-neutral-200 py-12 text-center text-sm text-neutral-500">
      {text}
    </div>
  )
}

function asStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x))
  if (typeof v === "string" && v.trim()) {
    try {
      const parsed = JSON.parse(v)
      return Array.isArray(parsed) ? parsed.map((x) => String(x)) : []
    } catch {
      return []
    }
  }
  return []
}

function marketOutcomes(m: CryptoEventMarket): string[] {
  return asStringArray(m.outcomes)
}

function marketPrices(m: CryptoEventMarket): string[] {
  return asStringArray(m.outcomePrices)
}

function isUpDown(event: CryptoEvent): boolean {
  if (event.markets.length !== 1) return false
  const outcomes = marketOutcomes(event.markets[0]).map((o) => o.toLowerCase())
  return outcomes.length === 2 && outcomes.includes("up") && outcomes.includes("down")
}

function parsePrice(p?: string): number {
  if (!p) return 0
  const n = Number(p)
  return Number.isFinite(n) ? n : 0
}

function topMarketsByYes(event: CryptoEvent, n = 4): CryptoEventMarket[] {
  return [...event.markets]
    .map((m) => ({ m, yes: parsePrice(marketPrices(m)[0]) }))
    .sort((a, b) => b.yes - a.yes)
    .slice(0, n)
    .map((x) => x.m)
}

function EventCard({
  event,
  locale,
}: {
  event: CryptoEvent
  locale: "en" | "zh"
}) {
  const upDown = isUpDown(event)
  return (
    <Link
      href={`/event/${event.slug}`}
      className="group flex flex-col rounded-xl border border-neutral-200 bg-white p-3 transition hover:border-neutral-300 hover:shadow-sm"
    >
      <div className="flex items-start gap-3">
        <EventIcon icon={event.icon ?? event.image} alt="" />
        <div className="min-w-0 flex-1">
          <div className="line-clamp-2 text-[14px] font-medium text-neutral-900 group-hover:underline">
            {event.title}
          </div>
        </div>
        {upDown ? <UpDownRing market={event.markets[0]} /> : null}
      </div>

      {!upDown ? (
        <ul className="mt-3 flex-1 space-y-1.5">
          {topMarketsByYes(event, 4).map((m) => (
            <OutcomeRow key={m.id ?? m.conditionId} market={m} locale={locale} />
          ))}
        </ul>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <SideButton tone="up" label={locale === "zh" ? "Up" : "Up"} />
          <SideButton tone="down" label={locale === "zh" ? "Down" : "Down"} />
        </div>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-2 text-[11px] text-neutral-500">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-rose-500" />
            {locale === "zh" ? "实时" : "LIVE"}
          </span>
          <span className="text-neutral-400">·</span>
          <span>
            {formatCompactUsd(event.volume24hr ?? event.volume ?? 0)}{" "}
            {locale === "zh" ? "24h" : "24h"}
          </span>
        </div>
        <Bookmark className="size-3.5 text-neutral-400 hover:text-neutral-700" />
      </div>
    </Link>
  )
}

function SideButton({ tone, label }: { tone: "up" | "down"; label: string }) {
  return (
    <span
      className={cn(
        "rounded-md py-1.5 text-center text-[12px] font-medium",
        tone === "up"
          ? "bg-emerald-50 text-emerald-700"
          : "bg-rose-50 text-rose-700",
      )}
    >
      {label}
    </span>
  )
}

function EventIcon({ icon, alt }: { icon?: string; alt: string }) {
  if (!icon) {
    return (
      <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-neutral-100 text-[10px] text-neutral-500">
        PM
      </div>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={icon} alt={alt} className="size-10 shrink-0 rounded-md object-cover" />
  )
}

function UpDownRing({ market }: { market: CryptoEventMarket }) {
  const outcomes = marketOutcomes(market).map((o) => o.toLowerCase())
  const prices = marketPrices(market)
  const upIdx = outcomes.indexOf("up")
  const upPrice = upIdx >= 0 ? parsePrice(prices[upIdx]) : 0
  const pct = Math.round(upPrice * 100)
  const tone = pct >= 50 ? "stroke-emerald-500" : "stroke-rose-500"
  return (
    <div className="relative size-12 shrink-0">
      <svg viewBox="0 0 36 36" className="size-12 -rotate-90">
        <circle cx="18" cy="18" r="15" className="fill-none stroke-neutral-100" strokeWidth="3" />
        <circle
          cx="18"
          cy="18"
          r="15"
          className={cn("fill-none", tone)}
          strokeWidth="3"
          strokeDasharray={`${(pct / 100) * 94.2} 94.2`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-[10px] leading-none">
        <span className="text-[12px] font-semibold tabular-nums">{pct}%</span>
        <span className="text-[9px] text-neutral-500">{pct >= 50 ? "Up" : "Down"}</span>
      </div>
    </div>
  )
}

function OutcomeRow({
  market,
  locale,
}: {
  market: CryptoEventMarket
  locale: "en" | "zh"
}) {
  const yes = parsePrice(marketPrices(market)[0])
  const pct = Math.round(yes * 100)
  return (
    <li className="flex items-center justify-between gap-2 text-[12px]">
      <span className="truncate text-neutral-700">
        {market.groupItemTitle ?? market.question ?? "—"}
      </span>
      <div className="flex shrink-0 items-center gap-1.5">
        <span className="w-8 text-right tabular-nums text-neutral-900">{pct}%</span>
        <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
          {locale === "zh" ? "买入" : "Yes"}
        </span>
        <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-medium text-rose-700">
          {locale === "zh" ? "卖出" : "No"}
        </span>
      </div>
    </li>
  )
}
