"use client"

import useSWR from "swr"

const fetcher = (url: string) =>
  fetch(url).then((r) => r.json() as Promise<Record<string, string>>)

export function useCryptoCounts() {
  const { data, error, isLoading } = useSWR("/api/crypto-counts", fetcher, {
    refreshInterval: 60_000,
    revalidateOnFocus: false,
  })
  return {
    counts: data ?? {},
    isLoading,
    error,
  }
}
