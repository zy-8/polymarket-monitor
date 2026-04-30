import { NextRequest } from "next/server"

export const runtime = "edge"

const UPSTREAM = "https://gamma-api.polymarket.com"

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params
  const search = req.nextUrl.search
  const url = `${UPSTREAM}/${path.join("/")}${search}`

  const upstream = await fetch(url, {
    headers: { accept: "application/json" },
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
