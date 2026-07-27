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
