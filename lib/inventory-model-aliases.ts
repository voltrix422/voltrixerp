import { prisma } from "@/lib/db"
import { normalizeProductText } from "@/lib/order-product-search"

export function textMatchesProductTerm(text: string, term: string): boolean {
  const value = normalizeProductText(text)
  const needle = normalizeProductText(term)
  if (!value || !needle) return false
  return value === needle || value.includes(needle) || needle.includes(value)
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
  for (const row of sharedLabels) {
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

  return prisma.erpManualInventoryItem.findFirst({
    where: {
      OR: [
        { name: { contains: trimmed, mode: "insensitive" } },
        { model: { contains: trimmed, mode: "insensitive" } },
      ],
    },
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
