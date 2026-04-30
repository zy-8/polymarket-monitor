// Single source of truth for the /crypto sidebar.
// `routeSlug`: URL segment (null = root /crypto)
// `tagSlug`: passed to gamma /events/pagination?tag_slug=...
// `countKey`: field returned by /api/crypto-counts
// `group`: visual section divider in the sidebar
// `iconKey`: handled by the sidebar Icon switch (avoids icon-import cycles)

export type SidebarGroup = "overview" | "timeframe" | "category" | "token"

export interface CryptoSidebarItem {
  routeSlug: string | null
  tagSlug: string
  countKey: string
  labelEn: string
  labelZh: string
  iconKey: string
  group: SidebarGroup
}

export const CRYPTO_SIDEBAR: CryptoSidebarItem[] = [
  { routeSlug: null,             tagSlug: "crypto",        countKey: "all",           labelEn: "All",            labelZh: "全部",   iconKey: "grid",     group: "overview"  },
  { routeSlug: "5M",             tagSlug: "5M",            countKey: "fiveM",         labelEn: "5 Min",          labelZh: "5 分钟", iconKey: "clock",    group: "timeframe" },
  { routeSlug: "15M",            tagSlug: "15M",           countKey: "fifteenM",      labelEn: "15 Min",         labelZh: "15 分钟",iconKey: "clock",    group: "timeframe" },
  { routeSlug: "hourly",         tagSlug: "1H",            countKey: "hourly",        labelEn: "Hourly",         labelZh: "1 小时", iconKey: "clock",    group: "timeframe" },
  { routeSlug: "4hour",          tagSlug: "4H",            countKey: "fourHour",      labelEn: "4 Hour",         labelZh: "4 小时", iconKey: "clock",    group: "timeframe" },
  { routeSlug: "daily",          tagSlug: "daily",         countKey: "daily",         labelEn: "Daily",          labelZh: "每天",   iconKey: "calendar", group: "timeframe" },
  { routeSlug: "weekly",         tagSlug: "weekly",        countKey: "weekly",        labelEn: "Weekly",         labelZh: "每周",   iconKey: "calendar", group: "timeframe" },
  { routeSlug: "monthly",        tagSlug: "monthly",       countKey: "monthly",       labelEn: "Monthly",        labelZh: "每月",   iconKey: "calendar", group: "timeframe" },
  { routeSlug: "yearly",         tagSlug: "yearly",        countKey: "yearly",        labelEn: "Yearly",         labelZh: "每年",   iconKey: "calendar", group: "timeframe" },
  { routeSlug: "pre-market",     tagSlug: "pre-market",    countKey: "preMarket",     labelEn: "Pre-Market",     labelZh: "盘前",   iconKey: "flag",     group: "category"  },
  { routeSlug: "etf",            tagSlug: "etf",           countKey: "etf",           labelEn: "ETF",            labelZh: "ETF",    iconKey: "flag",     group: "category"  },
  { routeSlug: "bitcoin",        tagSlug: "bitcoin",       countKey: "bitcoin",       labelEn: "Bitcoin",        labelZh: "比特币", iconKey: "btc",      group: "token"     },
  { routeSlug: "ethereum",       tagSlug: "ethereum",      countKey: "ethereum",      labelEn: "Ethereum",       labelZh: "以太坊", iconKey: "eth",      group: "token"     },
  { routeSlug: "solana",         tagSlug: "solana",        countKey: "solana",        labelEn: "Solana",         labelZh: "索拉纳", iconKey: "sol",      group: "token"     },
  { routeSlug: "xrp",            tagSlug: "xrp",           countKey: "xrp",           labelEn: "XRP",            labelZh: "瑞波币", iconKey: "xrp",      group: "token"     },
  { routeSlug: "dogecoin",       tagSlug: "dogecoin",      countKey: "dogecoin",      labelEn: "Dogecoin",       labelZh: "狗狗币", iconKey: "doge",     group: "token"     },
  { routeSlug: "bnb",            tagSlug: "bnb",           countKey: "bnb",           labelEn: "BNB",            labelZh: "BNB",    iconKey: "bnb",      group: "token"     },
  { routeSlug: "microstrategy",  tagSlug: "microstrategy", countKey: "microstrategy", labelEn: "MicroStrategy",  labelZh: "微策略", iconKey: "mstr",     group: "token"     },
]

export const CRYPTO_GROUP_ORDER: SidebarGroup[] = ["overview", "timeframe", "category", "token"]

export const VALID_CRYPTO_FILTERS = new Set(
  CRYPTO_SIDEBAR.filter((i) => i.routeSlug).map((i) => i.routeSlug as string),
)

export function findCryptoFilter(routeSlug: string | null | undefined): CryptoSidebarItem {
  if (!routeSlug) return CRYPTO_SIDEBAR[0]
  return (
    CRYPTO_SIDEBAR.find((i) => i.routeSlug === routeSlug) ?? CRYPTO_SIDEBAR[0]
  )
}
