/** Shared helpers for public-website analytics (excludes ERP). */

export const PUBLIC_ANALYTICS_PREFIXES = [
  "/quote",
  "/products",
  "/services",
  "/vision",
  "/rd",
  "/about",
  "/contact",
  "/outlets",
  "/dealerships",
  "/technology",
  "/warranty",
  "/blog",
  "/careers",
  "/privacy",
  "/terms",
  "/cookies",
  "/documentation",
  "/solar-calculator",
] as const

export const FEATURE_LABELS: Record<string, string> = {
  home: "Hero / Home",
  "featured-product": "Featured product",
  products: "Products",
  testimonials: "Testimonials",
  stats: "Stats",
  mission: "Mission",
  services: "Services",
  vision: "Vision & Mission",
  rd: "R&D & Manufacturing",
  about: "About Us",
  faq: "FAQ",
  contact: "Contact",
  quote: "Get a Quote",
  "solar-calculator": "Solar Calculator",
  warranty: "Warranty",
  dealerships: "Dealerships",
  outlets: "Outlets",
  blog: "Blog",
  careers: "Careers",
  technology: "Technology",
}

export function isPublicAnalyticsPath(pathname: string): boolean {
  if (!pathname) return false
  const path = pathname.split("?")[0] || "/"
  if (path === "/") return true
  // Never track ERP, POS, APIs, auth
  if (
    path.startsWith("/api") ||
    path.startsWith("/dashboard") ||
    path.startsWith("/pos") ||
    path.startsWith("/login") ||
    path.startsWith("/_next") ||
    path.startsWith("/uploads")
  ) {
    return false
  }
  return PUBLIC_ANALYTICS_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))
}

export function normalizeAnalyticsPath(pathname: string): string {
  const raw = (pathname || "/").split("?")[0] || "/"
  if (raw.length > 1 && raw.endsWith("/")) return raw.slice(0, -1)
  // Collapse product detail URLs for cleaner grouping option — keep full path for detail stats
  return raw || "/"
}

export function pathDisplayLabel(path: string): string {
  if (path === "/") return "Home"
  if (path.startsWith("/products/")) return "Product detail"
  if (path.startsWith("/blog/")) return "Blog post"
  const base = "/" + path.split("/").filter(Boolean)[0]
  return FEATURE_LABELS[base.slice(1)] || path
}

export function featureDisplayLabel(key: string): string {
  return FEATURE_LABELS[key] || key.replace(/-/g, " ")
}

export function formatDuration(ms: number): string {
  if (!ms || ms < 1000) return "0s"
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  if (m < 60) return rem ? `${m}m ${rem}s` : `${m}m`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

/** Business timezone for website analytics (Pakistan, no DST). */
export const ANALYTICS_TZ = "Asia/Karachi"
export const ANALYTICS_TZ_OFFSET = "+05:00"

/** Local calendar date YYYY-MM-DD (browser local). */
export function localDateISO(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function localDaysAgoISO(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return localDateISO(d)
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

/** Start/end of a calendar day in Asia/Karachi as UTC Date objects. */
export function analyticsDayBounds(fromDate: string, toDate: string): { from: Date; to: Date } {
  const fromStr = DATE_ONLY.test(fromDate) ? fromDate : fromDate.slice(0, 10)
  const toStr = DATE_ONLY.test(toDate) ? toDate : toDate.slice(0, 10)
  return {
    from: new Date(`${fromStr}T00:00:00${ANALYTICS_TZ_OFFSET}`),
    to: new Date(`${toStr}T23:59:59.999${ANALYTICS_TZ_OFFSET}`),
  }
}

/** Bucket a timestamp into YYYY-MM-DD in Asia/Karachi. */
export function analyticsDayKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ANALYTICS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d)
}

/** Inclusive list of YYYY-MM-DD days from → to. */
export function eachAnalyticsDay(fromDate: string, toDate: string): string[] {
  const days: string[] = []
  const [fy, fm, fd] = fromDate.split("-").map(Number)
  const [ty, tm, td] = toDate.split("-").map(Number)
  const cur = new Date(Date.UTC(fy, fm - 1, fd))
  const end = new Date(Date.UTC(ty, tm - 1, td))
  while (cur <= end) {
    const y = cur.getUTCFullYear()
    const m = String(cur.getUTCMonth() + 1).padStart(2, "0")
    const day = String(cur.getUTCDate()).padStart(2, "0")
    days.push(`${y}-${m}-${day}`)
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return days
}

export function hashIp(ip: string): string {
  // Lightweight non-crypto fingerprint (privacy-friendly enough for analytics)
  let h = 2166136261
  const s = String(ip || "unknown")
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(16)
}
