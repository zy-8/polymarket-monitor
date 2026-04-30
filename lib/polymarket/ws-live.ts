// Polymarket "ws-live-data" stream. Used for the event activity feed (live
// trades), comments, and Chainlink price ticks.
//
//   wss://ws-live-data.polymarket.com/
//
// Subscribe shape (multiple topics in one connection):
//   {"action":"subscribe","subscriptions":[
//     {"topic":"activity","type":"trades","filters":"{\"event_slug\":\"...\"}"},
//     {"topic":"crypto_prices_chainlink","type":"update","filters":"{\"symbol\":\"btc/usd\"}"}
//   ]}

const WS_URL = "wss://ws-live-data.polymarket.com/"

export interface LiveSubscription {
  topic: string
  type: string
  filters: Record<string, unknown>
}

export interface LiveMessage<T = unknown> {
  topic: string
  type: string
  timestamp: number
  payload: T
  connection_id?: string
}

/**
 * `payload` shape for `topic=activity, type=trades`. Mirrors the REST
 * `/trades` row, with at least the fields we need for rendering. Empty/optional
 * fields are tolerated.
 */
export interface LiveActivityTrade {
  proxyWallet: string
  side: "BUY" | "SELL"
  asset: string
  conditionId: string
  size: number
  price: number
  usdcSize?: number
  timestamp: number
  title?: string
  slug?: string
  icon?: string
  eventSlug?: string
  outcome: string
  outcomeIndex: number
  name?: string
  pseudonym?: string
  bio?: string
  profileImage?: string
  profileImageOptimized?: string
  transactionHash?: string
}

export interface LiveStreamHandle {
  close(): void
  ready: Promise<void>
}

export function subscribeLive(
  subscriptions: LiveSubscription[],
  onMessage: (msg: LiveMessage) => void,
  onError?: (e: Event) => void,
): LiveStreamHandle {
  const ws = new WebSocket(WS_URL)
  let pingTimer: ReturnType<typeof setInterval> | null = null
  let closed = false

  const ready = new Promise<void>((resolve) => {
    ws.addEventListener("open", () => {
      ws.send(
        JSON.stringify({
          action: "subscribe",
          subscriptions: subscriptions.map((s) => ({
            topic: s.topic,
            type: s.type,
            filters: JSON.stringify(s.filters),
          })),
        }),
      )
      pingTimer = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send("PING")
      }, 20_000)
      resolve()
    })
  })

  ws.addEventListener("message", (e) => {
    if (typeof e.data !== "string") return
    if (e.data === "PONG") return
    try {
      const data = JSON.parse(e.data) as LiveMessage | LiveMessage[]
      if (Array.isArray(data)) data.forEach(onMessage)
      else onMessage(data)
    } catch {
      // ignore non-JSON heartbeats / control frames
    }
  })

  if (onError) ws.addEventListener("error", onError)

  return {
    ready,
    close() {
      if (closed) return
      closed = true
      if (pingTimer) clearInterval(pingTimer)
      try {
        ws.close()
      } catch {
        // ignore
      }
    },
  }
}
