"use client"

import useSWRInfinite from "swr/infinite"
import {
  fetchCryptoEvents,
  type CryptoEvent,
  type CryptoEventsPage,
} from "@/lib/pm-crypto"

const PAGE_SIZE = 20

export interface UseCryptoEventsOptions {
  tagSlug: string
  order?: string
}

export function useCryptoEvents({ tagSlug, order = "volume24hr" }: UseCryptoEventsOptions) {
  const swr = useSWRInfinite<CryptoEventsPage>(
    (pageIndex, prev) => {
      if (prev && !prev.pagination?.hasMore) return null
      return ["crypto-events", tagSlug, order, pageIndex] as const
    },
    async (key) => {
      const [, slug, ord, pageIndex] = key as [string, string, string, number]
      return fetchCryptoEvents({
        tagSlug: slug,
        order: ord,
        limit: PAGE_SIZE,
        offset: pageIndex * PAGE_SIZE,
      })
    },
    {
      revalidateOnFocus: false,
      revalidateFirstPage: false,
      keepPreviousData: true,
      refreshInterval: 30_000,
    },
  )

  const events: CryptoEvent[] = []
  const seen = new Set<string>()
  for (const page of swr.data ?? []) {
    for (const ev of page?.data ?? []) {
      if (!ev.id || seen.has(ev.id)) continue
      seen.add(ev.id)
      events.push(ev)
    }
  }

  const last = swr.data?.[swr.data.length - 1]
  const hasMore = !!last?.pagination?.hasMore
  const totalCount = last?.pagination?.totalResults ?? 0
  const isLoadingMore =
    swr.isValidating && swr.data && swr.data.length > 0 && swr.data[swr.size - 1] === undefined

  return {
    events,
    totalCount,
    hasMore,
    isLoading: swr.isLoading,
    isLoadingMore: !!isLoadingMore,
    loadMore: () => swr.setSize(swr.size + 1),
    refresh: () => swr.mutate(),
  }
}
