import { prisma } from "@/lib/db"

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

export async function restoreManualInventoryByModel(model: string, qty: number) {
  const m = model.trim()
  if (!m || qty <= 0) return

  const item = await prisma.erpManualInventoryItem.findUnique({ where: { model: m } })
  if (!item) return

  const cap = item.qty ?? 0
  const next = Math.min(cap, (item.availableQty ?? 0) + qty)
  await prisma.erpManualInventoryItem.update({
    where: { id: item.id },
    data: { availableQty: next },
  })
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
