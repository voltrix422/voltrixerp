import { prisma } from "@/lib/db"
import {
  countInStockSerialsForModel,
  findStockByModel,
} from "@/lib/ensure-model-stock-link"
import { productCanonicalKeyFromText } from "@/lib/order-product-search"

export type FaultySerialUnit = {
  id: string
  serialNumber: string
  status: string
  notes: string
  scannedAt: string
  /** Parsed from replace notes when present */
  orderNumber?: string
  replaceReason?: string
  sourceModel?: string
}

export type FaultyInventoryGroup = {
  modelKey: string
  displayName: string
  unit: string
  faultyQty: number
  serialUnits: FaultySerialUnit[]
  /** Other model codes merged into this product family (e.g. HSLD15KW under 15.6) */
  aliasModelKeys?: string[]
  manualId?: string
  stockId?: string
  isManual: boolean
}

/** Notes format: "Replaced from ORD-00012: reason…\nPhotos: …" */
export function parseFaultyReplaceNote(notes: string | null | undefined): {
  orderNumber?: string
  replaceReason?: string
} {
  const text = (notes || "").trim()
  if (!text) return {}
  const match = text.match(/Replaced from\s+(ORD-\d+)\s*:\s*([\s\S]*?)(?:\nPhotos:|$)/i)
  if (!match) return {}
  const orderNumber = match[1]
  const replaceReason = match[2]
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  return {
    orderNumber,
    replaceReason: replaceReason || undefined,
  }
}

function faultyFamilyKey(modelKey: string, displayName: string): string {
  const fromName = productCanonicalKeyFromText(displayName)
  if (fromName !== "unknown") return fromName
  const fromModel = productCanonicalKeyFromText(modelKey)
  if (fromModel !== "unknown") return fromModel
  return modelKey.trim() || "unknown"
}

async function syncStockAvailableForModel(model: string, stockId?: string | null) {
  const trimmed = model.trim()
  if (!trimmed) return

  const remaining = await countInStockSerialsForModel(trimmed)
  const faultySerialCount = await prisma.erpInventorySerialUnit.count({
    where: { model: trimmed, status: "faulty" },
  })

  const stock =
    (stockId
      ? await prisma.erpInventoryStock.findUnique({ where: { id: stockId } })
      : null) ?? (await findStockByModel(trimmed))

  if (!stock) return

  const manual = await prisma.erpManualInventoryItem.findFirst({
    where: { model: trimmed },
  })

  const manualFaulty = Number(manual?.faultyQty) || 0
  const faultyQty = manualFaulty > 0 ? manualFaulty : Math.max(Number(stock.faultyQty) || 0, faultySerialCount)

  await prisma.erpInventoryStock.update({
    where: { id: stock.id },
    data: {
      availableQty: manual ? Number(manual.availableQty) || 0 : remaining,
      faultyQty,
    },
  })
}

export async function listFaultyInventoryGroups(
  labelMap: Record<string, string> = {},
): Promise<FaultyInventoryGroup[]> {
  const [faultySerials, manualItems, stockRows] = await Promise.all([
    prisma.erpInventorySerialUnit.findMany({
      where: { status: "faulty" },
      orderBy: { scannedAt: "desc" },
    }),
    prisma.erpManualInventoryItem.findMany({
      where: { faultyQty: { gt: 0 } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.erpInventoryStock.findMany({
      where: { faultyQty: { gt: 0 }, poType: { not: "manual" } },
      orderBy: { updatedAt: "desc" },
    }),
  ])

  const groups = new Map<string, FaultyInventoryGroup>()

  for (const unit of faultySerials) {
    const key = unit.model?.trim() || "Unknown model"
    const existing = groups.get(key)
    const parsed = parseFaultyReplaceNote(unit.notes)
    const serial: FaultySerialUnit = {
      id: unit.id,
      serialNumber: unit.serialNumber,
      status: unit.status,
      notes: unit.notes || "",
      scannedAt: unit.scannedAt.toISOString(),
      orderNumber: parsed.orderNumber,
      replaceReason: parsed.replaceReason,
      sourceModel: key,
    }
    if (existing) {
      existing.serialUnits.push(serial)
      existing.faultyQty += 1
    } else {
      groups.set(key, {
        modelKey: key,
        displayName: labelMap[key] || unit.productName?.trim() || key,
        unit: "pcs",
        faultyQty: 1,
        serialUnits: [serial],
        isManual: false,
      })
    }
  }

  for (const manual of manualItems) {
    const key = manual.model.trim()
    const faultyQty = Number(manual.faultyQty) || 0
    if (faultyQty <= 0) continue
    const existing = groups.get(key)
    if (existing) {
      // Prefer serial count when units are tracked; keep manual only as ceiling for qty-only leftovers.
      existing.faultyQty = Math.max(existing.serialUnits.length, faultyQty)
      existing.manualId = manual.id
      existing.isManual = true
      existing.unit = manual.unit || existing.unit
      existing.displayName = manual.name?.trim() || existing.displayName
      if (manual.inventoryStockId) existing.stockId = manual.inventoryStockId
      continue
    }
    groups.set(key, {
      modelKey: key,
      displayName: manual.name?.trim() || labelMap[key] || key,
      unit: manual.unit || "pcs",
      faultyQty,
      serialUnits: [],
      manualId: manual.id,
      stockId: manual.inventoryStockId ?? undefined,
      isManual: true,
    })
  }

  for (const stock of stockRows) {
    const key = stock.description?.trim() || stock.name?.trim() || "Unknown model"
    if (groups.has(key)) continue
    const faultyQty = Number(stock.faultyQty) || 0
    if (faultyQty <= 0) continue
    groups.set(key, {
      modelKey: key,
      displayName: labelMap[key] || stock.name?.trim() || key,
      unit: stock.unit || "pcs",
      faultyQty,
      serialUnits: [],
      stockId: stock.id,
      isManual: false,
    })
  }

  // Merge aliases of the same product (HSLD15KW + MAN-15-6… → one 15.6 row)
  const merged = new Map<string, FaultyInventoryGroup>()
  for (const group of groups.values()) {
    const family = faultyFamilyKey(group.modelKey, group.displayName)
    const existing = merged.get(family)
    if (!existing) {
      merged.set(family, {
        ...group,
        aliasModelKeys: [group.modelKey],
      })
      continue
    }

    const aliases = new Set([...(existing.aliasModelKeys || [existing.modelKey]), group.modelKey])
    existing.aliasModelKeys = [...aliases]
    existing.serialUnits = [...existing.serialUnits, ...group.serialUnits].sort(
      (a, b) => new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime(),
    )

    const existingQtyOnly = Math.max(0, existing.faultyQty - (existing.serialUnits.length - group.serialUnits.length))
    const groupQtyOnly = Math.max(0, group.faultyQty - group.serialUnits.length)
    if (existing.serialUnits.length > 0) {
      existing.faultyQty = existing.serialUnits.length + existingQtyOnly + groupQtyOnly
    } else {
      existing.faultyQty = existing.faultyQty + group.faultyQty
    }

    if (group.displayName.length > existing.displayName.length) {
      existing.displayName = group.displayName
    }
    // Prefer a real MAN- code as the restore target when family key is synthetic
    if (family.startsWith("product:") && group.modelKey.startsWith("MAN-") && !existing.modelKey.startsWith("MAN-")) {
      existing.modelKey = group.modelKey
      if (group.manualId) existing.manualId = group.manualId
      if (group.stockId) existing.stockId = group.stockId
    } else {
      if (!existing.manualId && group.manualId) existing.manualId = group.manualId
      if (!existing.stockId && group.stockId) existing.stockId = group.stockId
    }
    existing.isManual = existing.isManual || group.isManual
    existing.unit = existing.unit || group.unit
  }

  for (const group of merged.values()) {
    // Replace path always creates serial rows — show exact unit count
    if (group.serialUnits.length > 0) {
      group.faultyQty = group.serialUnits.length
    }
  }

  return Array.from(merged.values()).sort((a, b) =>
    a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" }),
  )
}

export async function markSerialUnitFaulty(params: {
  unitId: string
  movedBy: string
  notes?: string
}) {
  const unit = await prisma.erpInventorySerialUnit.findUnique({ where: { id: params.unitId } })
  if (!unit) throw new Error("Serial unit not found")
  if (unit.status !== "in_stock") {
    throw new Error("Only in-stock units can be marked faulty/damaged")
  }

  const noteSuffix = params.notes?.trim()
    ? `Faulty: ${params.notes.trim()}`
    : "Marked faulty/damaged"
  const nextNotes = unit.notes?.trim() ? `${unit.notes.trim()}\n${noteSuffix}` : noteSuffix

  await prisma.erpInventorySerialUnit.update({
    where: { id: unit.id },
    data: { status: "faulty", notes: nextNotes },
  })

  if (unit.model?.trim()) {
    await syncStockAvailableForModel(unit.model, unit.inventoryStockId)
  }

  await prisma.erpInventoryHistory.create({
    data: {
      itemDescription: unit.model?.trim()
        ? `${unit.productName || unit.model} · ${unit.model}`
        : unit.productName || unit.serialNumber,
      transactionType: "out",
      quantity: 1,
      unit: "pcs",
      referenceType: "faulty_move",
      referenceId: unit.id,
      referenceNumber: unit.serialNumber,
      notes: noteSuffix,
      createdBy: params.movedBy,
    },
  })

  return unit
}

export async function restoreSerialUnitFromFaulty(params: {
  unitId: string
  restoredBy: string
}) {
  const unit = await prisma.erpInventorySerialUnit.findUnique({ where: { id: params.unitId } })
  if (!unit) throw new Error("Serial unit not found")
  if (unit.status !== "faulty") throw new Error("Unit is not in faulty/damaged inventory")

  await prisma.erpInventorySerialUnit.update({
    where: { id: unit.id },
    data: { status: "in_stock" },
  })

  if (unit.model?.trim()) {
    await syncStockAvailableForModel(unit.model, unit.inventoryStockId)
  }

  await prisma.erpInventoryHistory.create({
    data: {
      itemDescription: unit.model?.trim()
        ? `${unit.productName || unit.model} · ${unit.model}`
        : unit.productName || unit.serialNumber,
      transactionType: "in",
      quantity: 1,
      unit: "pcs",
      referenceType: "faulty_restore",
      referenceId: unit.id,
      referenceNumber: unit.serialNumber,
      notes: "Restored from faulty/damaged to main stock",
      createdBy: params.restoredBy,
    },
  })

  return unit
}

export async function moveManualQtyToFaulty(params: {
  manualId: string
  qty: number
  movedBy: string
  notes?: string
}) {
  const item = await prisma.erpManualInventoryItem.findUnique({ where: { id: params.manualId } })
  if (!item) throw new Error("Manual item not found")
  if ((item.availableQty ?? 0) < params.qty) {
    throw new Error(`Not enough available stock (have ${item.availableQty})`)
  }

  const nextAvailable = (item.availableQty ?? 0) - params.qty
  const nextFaulty = (Number(item.faultyQty) || 0) + params.qty

  await prisma.erpManualInventoryItem.update({
    where: { id: item.id },
    data: { availableQty: nextAvailable, faultyQty: nextFaulty },
  })

  if (item.inventoryStockId) {
    await prisma.erpInventoryStock.update({
      where: { id: item.inventoryStockId },
      data: { availableQty: nextAvailable, faultyQty: nextFaulty },
    })
  }

  await prisma.erpInventoryHistory.create({
    data: {
      itemDescription: item.name,
      transactionType: "out",
      quantity: params.qty,
      unit: item.unit || "pcs",
      referenceType: "faulty_move",
      referenceId: item.id,
      referenceNumber: item.model,
      notes: params.notes || "Moved to faulty/damaged inventory",
      createdBy: params.movedBy,
    },
  })

  return { availableQty: nextAvailable, faultyQty: nextFaulty }
}

export async function restoreManualQtyFromFaulty(params: {
  manualId: string
  qty: number
  restoredBy: string
  notes?: string
}) {
  const item = await prisma.erpManualInventoryItem.findUnique({ where: { id: params.manualId } })
  if (!item) throw new Error("Manual item not found")
  const currentFaulty = Number(item.faultyQty) || 0
  if (currentFaulty < params.qty) {
    throw new Error(`Not enough faulty qty (have ${currentFaulty})`)
  }

  const nextFaulty = currentFaulty - params.qty
  const nextAvailable = (item.availableQty ?? 0) + params.qty

  await prisma.erpManualInventoryItem.update({
    where: { id: item.id },
    data: { availableQty: nextAvailable, faultyQty: nextFaulty },
  })

  if (item.inventoryStockId) {
    await prisma.erpInventoryStock.update({
      where: { id: item.inventoryStockId },
      data: { availableQty: nextAvailable, faultyQty: nextFaulty },
    })
  }

  await prisma.erpInventoryHistory.create({
    data: {
      itemDescription: item.name,
      transactionType: "in",
      quantity: params.qty,
      unit: item.unit || "pcs",
      referenceType: "faulty_restore",
      referenceId: item.id,
      referenceNumber: item.model,
      notes: params.notes || "Restored from faulty/damaged to main stock",
      createdBy: params.restoredBy,
    },
  })

  return { availableQty: nextAvailable, faultyQty: nextFaulty }
}

export async function moveStockQtyToFaulty(params: {
  stockId: string
  qty: number
  movedBy: string
  notes?: string
}) {
  const stock = await prisma.erpInventoryStock.findUnique({ where: { id: params.stockId } })
  if (!stock) throw new Error("Stock row not found")
  if ((stock.availableQty ?? 0) < params.qty) {
    throw new Error(`Not enough available stock (have ${stock.availableQty})`)
  }

  const nextAvailable = (stock.availableQty ?? 0) - params.qty
  const nextFaulty = (Number(stock.faultyQty) || 0) + params.qty

  await prisma.erpInventoryStock.update({
    where: { id: stock.id },
    data: { availableQty: nextAvailable, faultyQty: nextFaulty },
  })

  await prisma.erpInventoryHistory.create({
    data: {
      itemDescription: stock.description || stock.name,
      transactionType: "out",
      quantity: params.qty,
      unit: stock.unit || "pcs",
      referenceType: "faulty_move",
      referenceId: stock.id,
      referenceNumber: stock.poNumber,
      notes: params.notes || "Moved to faulty/damaged inventory",
      createdBy: params.movedBy,
    },
  })

  return { availableQty: nextAvailable, faultyQty: nextFaulty }
}

export async function restoreStockQtyFromFaulty(params: {
  stockId: string
  qty: number
  restoredBy: string
  notes?: string
}) {
  const stock = await prisma.erpInventoryStock.findUnique({ where: { id: params.stockId } })
  if (!stock) throw new Error("Stock row not found")
  const currentFaulty = Number(stock.faultyQty) || 0
  if (currentFaulty < params.qty) {
    throw new Error(`Not enough faulty qty (have ${currentFaulty})`)
  }

  const nextFaulty = currentFaulty - params.qty
  const nextAvailable = (stock.availableQty ?? 0) + params.qty

  await prisma.erpInventoryStock.update({
    where: { id: stock.id },
    data: { availableQty: nextAvailable, faultyQty: nextFaulty },
  })

  await prisma.erpInventoryHistory.create({
    data: {
      itemDescription: stock.description || stock.name,
      transactionType: "in",
      quantity: params.qty,
      unit: stock.unit || "pcs",
      referenceType: "faulty_restore",
      referenceId: stock.id,
      referenceNumber: stock.poNumber,
      notes: params.notes || "Restored from faulty/damaged to main stock",
      createdBy: params.restoredBy,
    },
  })

  return { availableQty: nextAvailable, faultyQty: nextFaulty }
}
