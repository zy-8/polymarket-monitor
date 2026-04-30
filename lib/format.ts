import { formatDistanceToNowStrict } from "date-fns"

export function formatUsd(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: digits,
    minimumFractionDigits: value >= 100 ? 0 : Math.min(digits, 2),
  }).format(value)
}

export function formatCompactUsd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value)
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—"
  const rounded = Math.abs(value) >= 100 ? value.toFixed(0) : value.toFixed(1)
  return `${value > 0 ? "+" : ""}${rounded}%`
}

export function formatShares(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("en-US", {
    notation: Math.abs(value) >= 1000 ? "compact" : "standard",
    maximumFractionDigits: Math.abs(value) >= 1000 ? 1 : 2,
  }).format(value)
}

export function formatAddress(address: string | null | undefined): string {
  if (!address) return "Unknown"
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

export function formatRelativeTime(timestamp: number | string | null | undefined): string {
  if (timestamp == null) return "—"
  const numeric =
    typeof timestamp === "string"
      ? Number.isFinite(Number(timestamp))
        ? Number(timestamp)
        : Date.parse(timestamp)
      : timestamp
  if (!Number.isFinite(numeric)) return "—"
  const millis = numeric > 1e12 ? numeric : numeric * 1000
  return formatDistanceToNowStrict(millis, { addSuffix: true })
}

export function formatPrice(price: number | null | undefined): string {
  if (price == null || !Number.isFinite(price)) return "—"
  return price >= 1 ? price.toFixed(2) : price.toFixed(3)
}

export function formatSignedUsd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—"
  return `${value > 0 ? "+" : ""}${formatUsd(value)}`
}
