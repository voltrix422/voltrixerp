import { prisma } from "@/lib/db"
import { productKeysMatch } from "@/lib/branch-product-trail"
import {
  normalizeProductText,
  productCanonicalKeyFromText,
} from "@/lib/order-product-search"

/**
 * Match product text to a search/alias term.
 * Exact and safe alias matches only — never treat MAN-…-B and MAN-…-B-1 as the same SKU
 * (substring includes used to merge the 12V B-1 into the 5 kWh B).
 */
export function textMatchesProductTerm(text: string, term: string): boolean {
  const value = normalizeProductText(text)
  const needle = normalizeProductText(term)
  if (!value || !needle) return false
  if (value === needle) return true

  const valueKey = productCanonicalKeyFromText(text)
  const termKey = productCanonicalKeyFromText(term)

  // Both sides resolve to MAN codes → only equal / truncated-same-SKU (never …-B vs …-B-1).
  if (valueKey.startsWith("man-") && termKey.startsWith("man-")) {
    return productKeysMatch(valueKey, termKey)
  }

  // One side is a MAN code vs free text / display name.
  if (valueKey.startsWith("man-") || termKey.startsWith("man-")) {
    const manKey = valueKey.startsWith("man-") ? valueKey : termKey
    const otherText = valueKey.startsWith("man-") ? needle : value
    const embedded = otherText.match(/\b(man-[a-z0-9-]+)\b/)
    if (embedded) return productKeysMatch(embedded[1], manKey)
    // Name-only match (e.g. HS-BG5000W label) — substring OK when no conflicting MAN token.
    return otherText.includes(manKey) || manKey.includes(otherText)
  }

  return value.includes(needle) || needle.includes(value)
}

export function textMatchesAnyProductTerm(text: string, terms: string[]): boolean {
  return terms.some((term) => textMatchesProductTerm(text, term))
}

/** Collect model codes, names, and label aliases for one manual inventory product. */
export async function collectManualProductMatchTerms(manual: {
  model: string
  name: string
}): Promise<string[]> {
  const terms = new Set<string>()
  const add = (value?: string | null) => {
    const trimmed = value?.trim()
    if (trimmed) terms.add(trimmed)
  }

  add(manual.model)
  add(manual.name)

  const label = await prisma.erpInventoryModelLabel.findUnique({
    where: { model: manual.model.trim() },
  })
  add(label?.displayName)

  const sharedLabels = await prisma.erpInventoryModelLabel.findMany({
    where: {
      OR: [
        { displayName: { equals: manual.name, mode: "insensitive" } },
        label?.displayName
          ? { displayName: { equals: label.displayName, mode: "insensitive" } }
          : undefined,
      ].filter(Boolean) as Array<{ displayName: { equals: string; mode: "insensitive" } }>,
    },
  })
  const selfKey = productCanonicalKeyFromText(manual.model)
  for (const row of sharedLabels) {
    const siblingKey = productCanonicalKeyFromText(row.model)
    // Do not pull MAN-…-B-1 in as an alias of MAN-…-B (or any other distinct MAN SKU).
    if (
      selfKey.startsWith("man-") &&
      siblingKey.startsWith("man-") &&
      !productKeysMatch(selfKey, siblingKey)
    ) {
      continue
    }
    add(row.model)
    add(row.displayName)
  }

  const serialModels = await prisma.erpInventorySerialUnit.findMany({
    where: {
      OR: [
        { model: { equals: manual.model, mode: "insensitive" } },
        { productName: { equals: manual.name, mode: "insensitive" } },
        label?.displayName
          ? { productName: { equals: label.displayName, mode: "insensitive" } }
          : undefined,
      ].filter(Boolean) as Array<
        | { model: { equals: string; mode: "insensitive" } }
        | { productName: { equals: string; mode: "insensitive" } }
      >,
    },
    select: { model: true, productName: true },
    distinct: ["model"],
    take: 30,
  })
  for (const row of serialModels) {
    add(row.model)
    add(row.productName)
  }

  return [...terms]
}

export async function findManualInventoryByAnyModelOrAlias(term: string) {
  const trimmed = term.trim()
  if (!trimmed) return null

  const direct = await prisma.erpManualInventoryItem.findUnique({
    where: { model: trimmed },
  })
  if (direct) return direct

  const byName = await prisma.erpManualInventoryItem.findFirst({
    where: { name: { equals: trimmed, mode: "insensitive" } },
  })
  if (byName) return byName

  const label = await prisma.erpInventoryModelLabel.findUnique({
    where: { model: trimmed },
  })
  if (label?.displayName) {
    const fromLabelName = await prisma.erpManualInventoryItem.findFirst({
      where: { name: { equals: label.displayName, mode: "insensitive" } },
    })
    if (fromLabelName) return fromLabelName

    const siblingLabels = await prisma.erpInventoryModelLabel.findMany({
      where: { displayName: { equals: label.displayName, mode: "insensitive" } },
    })
    for (const sibling of siblingLabels) {
      const bySibling = await prisma.erpManualInventoryItem.findUnique({
        where: { model: sibling.model },
      })
      if (bySibling) return bySibling
    }
  }

  // Name contains only — never model substring (MAN-…-B must not resolve to MAN-…-B-1).
  return prisma.erpManualInventoryItem.findFirst({
    where: { name: { contains: trimmed, mode: "insensitive" } },
  })
}

export async function findBranchInventoryForManualProduct(manual: {
  model: string
  name: string
}) {
  const terms = await collectManualProductMatchTerms(manual)
  const rows = await prisma.erpBranchInventory.findMany({
    orderBy: { assignedAt: "desc" },
  })

  return rows.filter((row) =>
    textMatchesAnyProductTerm(row.productDescription || "", terms),
  )
}
