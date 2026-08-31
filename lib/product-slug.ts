export type ProductSlugSource = {
  id?: string | null
  name?: string | null
  model?: string | null
  slug?: string | null
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isUuidParam(value: string): boolean {
  return UUID_RE.test(value.trim())
}

export function slugifySegment(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[°]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80)
}

function preferredSlug(product: ProductSlugSource): string {
  const explicit = slugifySegment(String(product.slug || "").trim())
  if (explicit) return explicit
  const { name, model } = product
  const fromName = slugifySegment(String(name || ""))
  const fromModel = slugifySegment(String(model || ""))
  if (fromName && fromModel && !fromName.includes(fromModel)) {
    return slugifySegment(`${fromName}-${fromModel}`)
  }
  return fromName || fromModel || slugifySegment(String(product.id || "product"))
}

function uniqueSlug(base: string, used: Set<string>, id: string): string {
  let candidate = base || slugifySegment(id)
  if (!used.has(candidate)) {
    used.add(candidate)
    return candidate
  }
  const withId = slugifySegment(`${candidate}-${id.slice(0, 8)}`)
  if (!used.has(withId)) {
    used.add(withId)
    return withId
  }
  let i = 2
  while (used.has(`${candidate}-${i}`)) i += 1
  const next = `${candidate}-${i}`
  used.add(next)
  return next
}

/** Deterministic slug map from the full website catalog. Does not write any files. */
export function assignProductSlugs(products: ProductSlugSource[]): Map<string, string> {
  const map = new Map<string, string>()
  const used = new Set<string>()
  const sorted = [...products].sort((a, b) =>
    String(a.id || "").localeCompare(String(b.id || "")),
  )
  for (const product of sorted) {
    const id = String(product.id || "").trim()
    if (!id) continue
    map.set(id, uniqueSlug(preferredSlug(product), used, id))
  }
  return map
}

export function productPublicPath(
  product: ProductSlugSource,
  catalog: ProductSlugSource[],
): string {
  const id = String(product.id || "").trim()
  if (!id) return "/products"
  const slugs = assignProductSlugs(catalog)
  return `/products/${slugs.get(id) || id}`
}

export function findProductByParam<T extends ProductSlugSource>(
  products: T[],
  param: string,
): T | null {
  const key = param.trim()
  if (!key) return null
  const byId = products.find((p) => String(p.id) === key)
  if (byId) return byId
  const slugs = assignProductSlugs(products)
  const id = [...slugs.entries()].find(([, slug]) => slug === key)?.[0]
  if (!id) return null
  return products.find((p) => String(p.id) === id) || null
}
