import { prisma } from "@/lib/db"
import { normalizeProductText } from "@/lib/order-product-search"
import {
  collectManualProductMatchTerms,
  textMatchesAnyProductTerm,
} from "@/lib/inventory-model-aliases"

export type BranchProductSearchResult = {
  branchId: string
  branchName: string
  branchCode: string
  branchType: string
  itemName: string
  model: string
  quantity: number
  unit: string
  assignedAt: string | null
}

function valueMatchesTerm(value: string, term: string): boolean {
  const v = normalizeProductText(value)
  const t = normalizeProductText(term)
  if (!v || !t) return false
  return v === t || v.includes(t) || t.includes(v)
}

function matchesAnyTerm(terms: string[], values: Array<string | null | undefined>): boolean {
  const cleanedTerms = terms.map((t) => t.trim()).filter(Boolean)
  if (!cleanedTerms.length) return false
  return cleanedTerms.some((term) =>
    values.some((value) => value && valueMatchesTerm(String(value), term)),
  )
}

export async function searchProductAcrossBranches(
  queryOrTerms: string | string[],
): Promise<BranchProductSearchResult[]> {
  const terms = (Array.isArray(queryOrTerms) ? queryOrTerms : [queryOrTerms])
    .map((t) => t.trim())
    .filter(Boolean)

  if (!terms.length) return []
  if (!Array.isArray(queryOrTerms) && terms[0].length < 2) return []

  const [branches, inventoryRows, manualItems, labels, stockRows, serialCounts] =
    await Promise.all([
      prisma.erpBranch.findMany({ orderBy: { name: "asc" } }),
      prisma.erpBranchInventory.findMany({ orderBy: { assignedAt: "desc" } }),
      prisma.erpManualInventoryItem.findMany(),
      prisma.erpInventoryModelLabel.findMany(),
      prisma.erpInventoryStock.findMany(),
      prisma.erpInventorySerialUnit.groupBy({
        by: ["model", "status"],
        _count: { id: true },
        where: { status: { in: ["in_stock", "at_branch"] } },
      }),
    ])

  const branchById = new Map(branches.map((b) => [b.id, b]))
  const stockById = new Map(stockRows.map((s) => [s.id, s]))
  const labelByModel = new Map(
    labels.map((l) => [l.model.trim().toLowerCase(), l.displayName.trim()]),
  )
  const manualByModel = new Map(
    manualItems.map((m) => [m.model.trim().toLowerCase(), m]),
  )
  const manualMatchTerms = new Map<string, string[]>()
  for (const manual of manualItems) {
    manualMatchTerms.set(
      manual.model.trim().toLowerCase(),
      await collectManualProductMatchTerms(manual),
    )
  }

  function manualForRow(values: Array<string | null | undefined>) {
    for (const manual of manualItems) {
      const terms = manualMatchTerms.get(manual.model.trim().toLowerCase()) || []
      if (values.some((value) => value && textMatchesAnyProductTerm(String(value), terms))) {
        return manual
      }
    }
    return null
  }

  const serialInStockByModel = new Map<string, number>()
  for (const row of serialCounts) {
    const key = row.model.trim().toLowerCase()
    if (!key) continue
    serialInStockByModel.set(key, (serialInStockByModel.get(key) ?? 0) + row._count.id)
  }

  const results: BranchProductSearchResult[] = []

  function pushResult(entry: BranchProductSearchResult) {
    results.push(entry)
  }

  for (const row of inventoryRows) {
    const branch = branchById.get(row.branchId)
    if (!branch || row.quantity <= 0) continue

    const stock = stockById.get(row.inventoryId)
    const model = (stock?.description || row.productDescription || "").trim()
    const manual = manualForRow([
      row.productDescription,
      model,
      stock?.name,
      stock?.description,
    ])
    const labelName = manual
      ? labelByModel.get(manual.model.toLowerCase())
      : labelByModel.get(model.toLowerCase())
    const itemName =
      manual?.name ||
      labelName ||
      stock?.name ||
      row.productDescription ||
      model

    if (
      !matchesAnyTerm(terms, [
        row.productDescription,
        itemName,
        model,
        stock?.name,
        stock?.description,
        manual?.name,
        manual?.model,
        labelName,
        ...(manual ? manualMatchTerms.get(manual.model.toLowerCase()) || [] : []),
      ])
    ) {
      continue
    }

    pushResult({
      branchId: branch.id,
      branchName: branch.name,
      branchCode: branch.code,
      branchType: branch.type,
      itemName,
      model: manual?.model || model || row.productDescription,
      quantity: row.quantity,
      unit: row.unit || stock?.unit || "pcs",
      assignedAt: row.assignedAt?.toISOString() ?? null,
    })
  }

  const mainBranch = branches.find((b) => b.type === "main_warehouse")
  if (mainBranch) {
    for (const manual of manualItems) {
      const qty = manual.availableQty ?? manual.qty ?? 0
      if (qty <= 0) continue
      const model = manual.model.trim()
      const labelName = labelByModel.get(model.toLowerCase())
      const itemName = manual.name.trim() || labelName || model
      const aliasTerms = manualMatchTerms.get(model.toLowerCase()) || []
      if (!matchesAnyTerm(terms, [itemName, model, manual.name, labelName, ...aliasTerms])) continue

      const already = results.some(
        (r) =>
          r.branchId === mainBranch.id &&
          (r.model.toLowerCase() === model.toLowerCase() ||
            textMatchesAnyProductTerm(r.model, aliasTerms)),
      )
      if (already) continue

      pushResult({
        branchId: mainBranch.id,
        branchName: mainBranch.name,
        branchCode: mainBranch.code,
        branchType: mainBranch.type,
        itemName,
        model,
        quantity: qty,
        unit: manual.unit || "pcs",
        assignedAt: manual.updatedAt?.toISOString() ?? null,
      })
    }

    for (const stock of stockRows) {
      const model = (stock.description || stock.name || "").trim()
      if (!model) continue
      const serialQty = serialInStockByModel.get(model.toLowerCase()) ?? 0
      const qty = serialQty > 0 ? serialQty : Math.max(0, stock.availableQty ?? 0)
      if (qty <= 0) continue

      const manual = manualForRow([model, stock.name, stock.description])
      const labelName = manual
        ? labelByModel.get(manual.model.toLowerCase())
        : labelByModel.get(model.toLowerCase())
      const itemName =
        manual?.name || labelName || stock.name || model
      const aliasTerms = manual
        ? manualMatchTerms.get(manual.model.toLowerCase()) || []
        : []

      if (!matchesAnyTerm(terms, [itemName, model, stock.name, stock.description, labelName, ...aliasTerms])) continue

      const alreadyFromManual = results.some(
        (r) =>
          r.branchId === mainBranch.id &&
          (r.model.toLowerCase() === (manual?.model || model).toLowerCase() ||
            textMatchesAnyProductTerm(r.model, aliasTerms)),
      )
      if (alreadyFromManual) continue

      pushResult({
        branchId: mainBranch.id,
        branchName: mainBranch.name,
        branchCode: mainBranch.code,
        branchType: mainBranch.type,
        itemName,
        model: manual?.model || model,
        quantity: qty,
        unit: stock.unit || "pcs",
        assignedAt: null,
      })
    }

    for (const [modelKey, qty] of serialInStockByModel) {
      if (qty <= 0) continue
      const manual = manualForRow([modelKey])
      const labelName = manual
        ? labelByModel.get(manual.model.toLowerCase())
        : labelByModel.get(modelKey)
      const itemName = manual?.name || labelName || modelKey
      const aliasTerms = manual
        ? manualMatchTerms.get(manual.model.toLowerCase()) || []
        : []
      if (!matchesAnyTerm(terms, [modelKey, itemName, manual?.name, manual?.model, labelName, ...aliasTerms])) continue

      const already = results.some(
        (r) =>
          r.branchId === mainBranch.id &&
          (r.model.toLowerCase() === (manual?.model || modelKey).toLowerCase() ||
            textMatchesAnyProductTerm(r.model, aliasTerms) ||
            normalizeProductText(r.itemName) === normalizeProductText(itemName)),
      )
      if (already) continue

      pushResult({
        branchId: mainBranch.id,
        branchName: mainBranch.name,
        branchCode: mainBranch.code,
        branchType: mainBranch.type,
        itemName,
        model: manual?.model || modelKey,
        quantity: qty,
        unit: manual?.unit || "pcs",
        assignedAt: null,
      })
    }
  }

  const consolidated = consolidateBranchProductResults(results, manualForRow)

  return consolidated.sort((a, b) => {
    const byBranch = a.branchName.localeCompare(b.branchName)
    if (byBranch !== 0) return byBranch
    return a.itemName.localeCompare(b.itemName)
  })
}

/** Merge duplicate rows for the same product at the same branch (e.g. HSLD15KW vs MAN-…). */
function consolidateBranchProductResults(
  results: BranchProductSearchResult[],
  resolveManual: (values: Array<string | null | undefined>) => { model: string; name: string } | null | undefined,
) {
  const map = new Map<string, BranchProductSearchResult>()

  for (const row of results) {
    const manual = resolveManual([row.model, row.itemName])
    const canonical = (manual?.model || row.model).trim().toLowerCase()
    const key = `${row.branchId}:${canonical}`
    const existing = map.get(key)
    if (!existing) {
      map.set(key, {
        ...row,
        model: manual?.model || row.model,
        itemName: manual?.name || row.itemName,
      })
      continue
    }
    existing.quantity += row.quantity
  }

  return [...map.values()]
}

export function summarizeBranchProductResults(results: BranchProductSearchResult[]) {
  const unit = results[0]?.unit || "pcs"
  let mainWarehouseQty = 0
  let branchQty = 0
  const outletBranchIds = new Set<string>()

  for (const row of results) {
    if (row.branchType === "main_warehouse") {
      mainWarehouseQty += row.quantity
    } else {
      branchQty += row.quantity
      outletBranchIds.add(row.branchId)
    }
  }

  return {
    branchQty,
    mainWarehouseQty,
    totalQty: branchQty + mainWarehouseQty,
    branchCount: outletBranchIds.size,
    locationCount: results.length,
    unit,
    /** @deprecated use branchQty / mainWarehouseQty / totalQty */
    resultCount: results.length,
  }
}
