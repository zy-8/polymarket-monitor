import { NextRequest } from "next/server"

export const runtime = "edge"

const UPSTREAM = "https://clob.polymarket.com"

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
      "cache-control": "no-store",
    },
  })
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params
  const search = req.nextUrl.search
  const url = `${UPSTREAM}/${path.join("/")}${search}`
  const body = await req.text()

  const upstream = await fetch(url, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "user-agent": "Mozilla/5.0 (compatible; polymarket-monitor/1.0)",
    },
    body,
    cache: "no-store",
  })

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/json",
    },
  })
}
