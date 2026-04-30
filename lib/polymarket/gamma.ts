import type { GammaEvent, GammaTag, TrendingQuery } from "./types"

const BASE = "/api/gamma"

function buildQuery(params: Record<string, unknown>): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue
    if (Array.isArray(v)) v.forEach((x) => sp.append(k, String(x)))
    else sp.append(k, String(v))
  }
  const s = sp.toString()
  return s ? `?${s}` : ""
}

async function get<T>(path: string, query?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${BASE}${path}${buildQuery(query ?? {})}`)
  if (!res.ok) throw new Error(`gamma ${path} ${res.status}`)
  return res.json() as Promise<T>
}

export async function fetchEvents(q: TrendingQuery = {}): Promise<GammaEvent[]> {
  const params: Record<string, unknown> = {
    active: q.active ?? true,
    closed: q.closed ?? false,
    archived: false,
    limit: q.limit ?? 50,
    offset: q.offset,
    order: q.order ?? "volume24hr",
    ascending: q.ascending ?? false,
  }
  if (q.tagSlug) params.tag_slug = q.tagSlug
  if (q.tagId) params.tag_id = q.tagId
  return get<GammaEvent[]>("/events", params)
}

export async function fetchEventBySlug(slug: string): Promise<GammaEvent | null> {
  const list = await get<GammaEvent[]>("/events", { slug })
  return list[0] ?? null
}

export async function fetchTags(limit = 200): Promise<GammaTag[]> {
  return get<GammaTag[]>("/tags", { limit })
}

export async function searchPublic(q: string, limit = 20): Promise<unknown> {
  return get("/public-search", { q, limit })
}
