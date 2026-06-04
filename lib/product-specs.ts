export type ProductSpecRow = {
  label: string
  value: string
  imageUrl?: string
}

export type ProductSpecsPayload = {
  name: string
  category?: string
  description?: string
  full_desc?: string
  warranty?: string
  specification?: string
  specSheetUrl?: string
  specs?: unknown
  images?: string[]
}

export function normalizeSpecRows(raw: unknown): ProductSpecRow[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((x): x is Record<string, unknown> => x && typeof x === "object")
    .map(x => ({
      label: String(x.label ?? "").trim(),
      value: String(x.value ?? "").trim(),
      imageUrl: x.imageUrl ? String(x.imageUrl) : undefined,
    }))
    .filter(s => s.label || s.value || s.imageUrl)
}

export function hasProductSpecs(product: {
  specs?: unknown
  specSheetUrl?: string | null
}): boolean {
  const rows = normalizeSpecRows(product.specs)
  const sheet = product.specSheetUrl != null ? String(product.specSheetUrl).trim() : ""
  return rows.length > 0 || Boolean(sheet)
}

export function absoluteAssetUrl(path: string): string {
  if (!path) return ""
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:")) {
    return path
  }
  if (typeof window !== "undefined") {
    return `${window.location.origin}${path.startsWith("/") ? path : `/${path}`}`
  }
  return path
}
