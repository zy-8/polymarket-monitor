"use client"

import useSWR from "swr"
import { fetchEventBySlug } from "@/lib/polymarket/gamma"
import { parseEvent } from "@/lib/polymarket/utils"

export function useEvent(slug: string | null) {
  const { data, error, isLoading, mutate } = useSWR(
    slug ? ["event", slug] : null,
    async () => {
      const e = await fetchEventBySlug(slug!)
      return e ? parseEvent(e) : null
    },
    // Event metadata (title, tags, image, conditionId, …) rarely changes;
    // refresh modestly. Live prices come from the `useActivity` WS stream,
    // not from this snapshot.
    {
      refreshInterval: 30_000,
      revalidateOnFocus: false,
      keepPreviousData: true,
    },
  )
  return { event: data ?? null, error, isLoading, refresh: mutate }
}
