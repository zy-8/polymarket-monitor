export interface GammaTag {
  id: string
  label: string
  slug: string
  forceShow?: boolean
  forceHide?: boolean
}

export interface GammaMarket {
  id: string
  conditionId: string
  question: string
  slug: string
  endDate?: string
  endDateIso?: string
  startDate?: string
  image?: string
  icon?: string
  description?: string
  outcomes: string
  outcomePrices: string
  clobTokenIds: string
  volume?: string
  volumeNum?: number
  volume24hr?: number
  volume1wk?: number
  liquidityNum?: number
  liquidityClob?: number
  active?: boolean
  closed?: boolean
  acceptingOrders?: boolean
  spread?: number
  bestBid?: number
  bestAsk?: number
  lastTradePrice?: number
  oneDayPriceChange?: number
  oneHourPriceChange?: number
  oneWeekPriceChange?: number
  groupItemTitle?: string
  negRisk?: boolean
  rfqEnabled?: boolean
}

export interface GammaEvent {
  id: string
  ticker: string
  slug: string
  title: string
  description?: string
  startDate?: string
  endDate?: string
  image?: string
  icon?: string
  active: boolean
  closed: boolean
  archived: boolean
  featured?: boolean
  new?: boolean
  liquidity?: number
  volume?: number
  volume24hr?: number
  volume1wk?: number
  volume1mo?: number
  openInterest?: number
  competitive?: number
  commentCount?: number
  markets: GammaMarket[]
  tags?: GammaTag[]
  negRisk?: boolean
  enableNegRisk?: boolean
}

export interface ParsedOutcome {
  label: string
  tokenId: string
  price: number
}

export interface MarketView {
  raw: GammaMarket
  outcomes: ParsedOutcome[]
  yesProbability: number | null
}

export interface EventView {
  raw: GammaEvent
  markets: MarketView[]
  primaryTag?: GammaTag
}

// Gamma /events sort keys (camelCase — empirically required, agent-skills doc has snake_case which is wrong)
export type SortKey =
  | "volume24hr"
  | "volume"
  | "liquidity"
  | "competitive"
  | "endDate"
  | "startDate"

export interface TrendingQuery {
  limit?: number
  offset?: number
  order?: SortKey
  ascending?: boolean
  active?: boolean
  closed?: boolean
  tagSlug?: string
  tagId?: string
}

export interface ClobOrderBookLevel {
  price: string
  size: string
}

export interface ClobOrderBook {
  market: string
  asset_id: string
  hash: string
  bids: ClobOrderBookLevel[]
  asks: ClobOrderBookLevel[]
  timestamp?: string
}

export interface ClobMidpoint {
  mid: string
}
