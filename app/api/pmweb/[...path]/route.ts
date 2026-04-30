import { NextRequest } from "next/server"

export const runtime = "edge"

const UPSTREAM = "https://polymarket.com/api"

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params
  const search = req.nextUrl.search
  const url = `${UPSTREAM}/${path.join("/")}${search}`

  const upstream = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "Mozilla/5.0 (compatible; polymarket-monitor/1.0)",
    },
    cache: "no-store",
  })

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/json",
      "cache-control": "public, max-age=20, s-maxage=30, stale-while-revalidate=60",
    },
  })
}
