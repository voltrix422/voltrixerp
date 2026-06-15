import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { findStockByModel } from "@/lib/ensure-model-stock-link"

type PrismaClientOrTx = Prisma.TransactionClient | typeof prisma

export function slugifyManualModelBase(name: string): string {
  const base = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24)
  return base || "ITEM"
}

export async function generateUniqueManualModel(name: string): Promise<string> {
  const base = slugifyManualModelBase(name)
  for (let attempt = 0; attempt < 20; attempt++) {
    const suffix = attempt === 0 ? "" : `-${attempt}`
    const candidate = `MAN-${base}${suffix}`.slice(0, 48)
    const exists = await prisma.erpManualInventoryItem.findUnique({
      where: { model: candidate },
    })
    if (!exists) return candidate
  }
  return `MAN-${base}-${Date.now().toString(36).slice(-5)}`.slice(0, 48)
}

export async function syncManualInventoryStock(
  manualId: string,
  name: string,
  model: string,
  qty: number,
  unit: string,
  existingStockId?: string | null,
) {
  const safeItemId = model.replace(/[^\w.-]+/g, "-").slice(0, 80) || manualId

  if (existingStockId) {
    const stock = await prisma.erpInventoryStock.update({
      where: { id: existingStockId },
      data: {
        name,
        description: model,
        unit,
        receivedQty: qty,
        availableQty: qty,
        poType: "manual",
        poNumber: "MANUAL",
      },
    })
    return stock.id
  }

  const stock = await prisma.erpInventoryStock.create({
    data: {
      poNumber: "MANUAL",
      itemId: safeItemId,
      name,
      description: model,
      unit,
      receivedQty: qty,
      availableQty: qty,
      allocatedQty: 0,
      poType: "manual",
      supplierName: "Manual entry",
    },
  })

  await prisma.erpManualInventoryItem.update({
    where: { id: manualId },
    data: { inventoryStockId: stock.id },
  })

  await prisma.erpInventoryModelLabel.upsert({
    where: { model },
    create: { model, displayName: name },
    update: { displayName: name },
  })

  return stock.id
}

export async function decrementManualInventoryByModel(model: string, qty: number) {
  const m = model.trim()
  if (!m || qty <= 0) return

  const item = await prisma.erpManualInventoryItem.findUnique({ where: { model: m } })
  if (!item) return

  const next = Math.max(0, (item.availableQty ?? 0) - qty)
  await prisma.erpManualInventoryItem.update({
    where: { id: item.id },
    data: { availableQty: next },
  })

  if (item.inventoryStockId) {
    await prisma.erpInventoryStock.update({
      where: { id: item.inventoryStockId },
      data: { availableQty: next },
    }).catch(() => {})
  }
}

export async function restoreManualInventoryByModel(
  model: string,
  qty: number,
  db: PrismaClientOrTx = prisma,
) {
  const m = model.trim()
  if (!m || qty <= 0) return false

  const item = await db.erpManualInventoryItem.findUnique({ where: { model: m } })
  if (!item) return false

  const cap = item.qty ?? 0
  const next = Math.min(cap, (item.availableQty ?? 0) + qty)
  await db.erpManualInventoryItem.update({
    where: { id: item.id },
    data: { availableQty: next },
  })

  if (item.inventoryStockId) {
    await db.erpInventoryStock.update({
      where: { id: item.inventoryStockId },
      data: { availableQty: next },
    }).catch(() => {})
  }

  return true
}

/** Restore manual stock when branch inventory returns to the main warehouse. */
export async function restoreManualInventoryByStockId(
  inventoryStockId: string,
  qty: number,
  db: PrismaClientOrTx = prisma,
) {
  const stockId = inventoryStockId.trim()
  if (!stockId || qty <= 0) return false

  const item = await db.erpManualInventoryItem.findFirst({
    where: { inventoryStockId: stockId },
  })
  if (!item) return false

  return restoreManualInventoryByModel(item.model, qty, db)
}

export function manualInventoryItemId(manualId: string) {
  return `man:${manualId}`
}

export function parseManualInventoryItemId(inventoryItemId?: string | null): string | null {
  const id = inventoryItemId?.trim()
  if (!id?.startsWith("man:")) return null
  const manualId = id.slice(4).trim()
  return manualId || null
}

/** Match an order line to manual inventory even when model codes differ (e.g. HSLD15KW vs MAN-…). */
export async function resolveManualInventoryForOrderLine(item: {
  description?: string
  model?: string
  inventoryItemId?: string
}) {
  const manualId = parseManualInventoryItemId(item.inventoryItemId)
  if (manualId) {
    const byId = await prisma.erpManualInventoryItem.findUnique({ where: { id: manualId } })
    if (byId) return byId
  }

  const model = item.model?.trim()
  if (model) {
    const byModel = await prisma.erpManualInventoryItem.findUnique({ where: { model } })
    if (byModel) return byModel
  }

  const desc = item.description?.trim()
  if (desc) {
    const byName = await prisma.erpManualInventoryItem.findFirst({
      where: { name: { equals: desc, mode: "insensitive" } },
    })
    if (byName) return byName
  }

  const keys = [item.description, item.model].filter(Boolean) as string[]
  for (const key of keys) {
    const stock = await findStockByModel(key)
    if (!stock) continue

    const byStockId = await prisma.erpManualInventoryItem.findFirst({
      where: { inventoryStockId: stock.id },
    })
    if (byStockId) return byStockId

    const stockModel = stock.description?.trim()
    if (stock.poType === "manual" && stockModel) {
      const byStockModel = await prisma.erpManualInventoryItem.findUnique({
        where: { model: stockModel },
      })
      if (byStockModel) return byStockModel
    }
  }

  return null
}
