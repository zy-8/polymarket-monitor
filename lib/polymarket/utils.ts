import type { EventView, GammaEvent, GammaMarket, MarketView, ParsedOutcome } from "./types"

function safeParseJsonArray<T = string>(input: unknown): T[] {
  if (!input) return []
  if (Array.isArray(input)) return input as T[]
  if (typeof input !== "string") return []
  try {
    const v = JSON.parse(input)
    return Array.isArray(v) ? (v as T[]) : []
  } catch {
    return []
  }
}

export function parseMarket(raw: GammaMarket): MarketView {
  const labels = safeParseJsonArray<string>(raw.outcomes)
  const prices = safeParseJsonArray<string>(raw.outcomePrices).map((p) => Number(p))
  const tokens = safeParseJsonArray<string>(raw.clobTokenIds)

  const outcomes: ParsedOutcome[] = labels.map((label, i) => ({
    label,
    tokenId: tokens[i] ?? "",
    price: Number.isFinite(prices[i]) ? prices[i] : 0,
  }))

  const yesIdx = outcomes.findIndex((o) => o.label.toLowerCase() === "yes")
  const yesProbability = yesIdx >= 0 ? outcomes[yesIdx].price : null

  return { raw, outcomes, yesProbability }
}

export function parseEvent(raw: GammaEvent): EventView {
  const markets = (raw.markets ?? []).map(parseMarket)
  const primaryTag = (raw.tags ?? []).find((t) => !t.forceHide)
  return { raw, markets, primaryTag }
}

export function formatVolume(n: number | undefined | null): string {
  if (n == null || !Number.isFinite(n)) return "—"
  const abs = Math.abs(n)
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(1)}K`
  return `$${n.toFixed(0)}`
}

export function formatProbability(p: number | null | undefined): string {
  if (p == null || !Number.isFinite(p)) return "—"
  const pct = p * 100
  if (pct < 1) return "<1%"
  if (pct > 99) return ">99%"
  return `${Math.round(pct)}%`
}

export function formatDateRelative(iso: string | undefined): string {
  if (!iso) return ""
  const t = new Date(iso).getTime()
  const now = Date.now()
  const dt = t - now
  const abs = Math.abs(dt)
  const min = 60_000
  const hr = 60 * min
  const day = 24 * hr
  if (abs < hr) return `${Math.round(abs / min)}m`
  if (abs < day) return `${Math.round(abs / hr)}h`
  return `${Math.round(abs / day)}d`
}

export function eventStatus(e: GammaEvent): "live" | "ending_soon" | "new" | "closed" {
  if (e.closed) return "closed"
  if (e.new) return "new"
  if (e.endDate) {
    const remain = new Date(e.endDate).getTime() - Date.now()
    if (remain > 0 && remain < 24 * 60 * 60 * 1000) return "ending_soon"
  }
  return "live"
}
