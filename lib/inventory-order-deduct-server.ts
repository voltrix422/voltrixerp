import { prisma } from "@/lib/db"
import { ensureInventoryStockForModel, findStockByModel } from "@/lib/ensure-model-stock-link"
import type { OrderFulfillmentSerialAllocation } from "@/lib/order-fulfillment-serials"

export type OrderDeductLine = {
  id?: string
  description: string
  qty: number
  unit: string
  isCustom?: boolean
  model?: string
  inventoryItemId?: string
}

export type OrderDeductInput = {
  id: string
  orderNumber: string
  clientName: string
  createdBy?: string
  inventoryDeductedAt?: string | null
  fulfillmentSerialAllocations?: OrderFulfillmentSerialAllocation[]
  items: OrderDeductLine[]
}

export type OrderDeductResult = {
  success: boolean
  alreadyDeducted: boolean
  deductedLines: number
  failedLines: string[]
  serialUnitsDeducted: number
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase()
}

export function getOrderLineMatchKeys(item: OrderDeductLine): string[] {
  const keys = new Set<string>()
  const description = item.description?.trim()
  if (description) keys.add(description)

  if (item.model?.trim()) keys.add(item.model.trim())

  const inventoryItemId = item.inventoryItemId?.trim()
  if (inventoryItemId) {
    keys.add(inventoryItemId)
    if (inventoryItemId.startsWith("wh:")) {
      const modelFromId = inventoryItemId.slice(3).trim()
      if (modelFromId) keys.add(modelFromId)
    }
  }

  return [...keys]
}

function orderUnitTag(orderId: string) {
  return `order:${orderId}`
}

async function logHistory(
  itemDescription: string,
  quantity: number,
  unit: string,
  order: OrderDeductInput,
  notes: string,
) {
  try {
    await prisma.erpInventoryHistory.create({
      data: {
        itemDescription,
        transactionType: "out",
        quantity,
        unit,
        referenceType: "order",
        referenceId: order.id,
        referenceNumber: order.orderNumber,
        notes,
        createdBy: order.createdBy || "System",
      },
    })
  } catch {
    // non-blocking
  }
}

async function unitsAllocatedForLine(order: OrderDeductInput, keys: string[]) {
  const tag = orderUnitTag(order.id)
  const lowerKeys = keys.map(normalizeKey).filter(Boolean)
  if (lowerKeys.length === 0) return 0

  const units = await prisma.erpInventorySerialUnit.findMany({
    where: {
      OR: [
        { notes: { contains: tag } },
        { status: "delivered", notes: { contains: order.orderNumber } },
      ],
    },
  })

  return units.filter((u) => lowerKeys.includes(normalizeKey(u.model || ""))).length
}

async function findInStockSerials(keys: string[], qty: number) {
  for (const key of keys) {
    const trimmed = key.trim()
    if (!trimmed) continue

    const exact = await prisma.erpInventorySerialUnit.findMany({
      where: { model: trimmed, status: "in_stock" },
      orderBy: { scannedAt: "asc" },
      take: qty,
    })
    if (exact.length >= qty) {
      return { model: trimmed, units: exact.slice(0, qty) }
    }
  }

  const lowerKeys = keys.map(normalizeKey).filter(Boolean)
  if (lowerKeys.length === 0) return null

  const pool = await prisma.erpInventorySerialUnit.findMany({
    where: { status: "in_stock" },
    orderBy: { scannedAt: "asc" },
  })

  for (const key of lowerKeys) {
    const matched = pool.filter((u) => normalizeKey(u.model || "") === key)
    if (matched.length >= qty) {
      return { model: matched[0].model, units: matched.slice(0, qty) }
    }
  }

  return null
}

function addYears(date: Date, years: number) {
  const next = new Date(date)
  next.setFullYear(next.getFullYear() + years)
  return next
}

async function ensureWarrantyForDispatch(
  unit: {
    id: string
    warrantyId: string | null
    serialNumber: string
    model: string
    productName?: string
  },
  order: OrderDeductInput,
) {
  const soldDate = order.inventoryDeductedAt
    ? new Date(order.inventoryDeductedAt)
    : new Date()
  const warrantyStartDate = soldDate
  const warrantyEndDate = addYears(soldDate, 5)
  const dispatchNote = `Dispatched on order ${order.orderNumber}`

  try {
    if (unit.warrantyId?.trim()) {
      await prisma.erpWarranty.updateMany({
        where: { warrantyId: unit.warrantyId },
        data: {
          customerName: order.clientName,
          soldDate,
          warrantyStartDate,
          warrantyEndDate,
          notes: dispatchNote,
        },
      })
      return
    }

    const bySerial = await prisma.erpWarranty.findFirst({
      where: { serialNumber: unit.serialNumber },
    })
    if (bySerial) {
      await prisma.erpWarranty.update({
        where: { id: bySerial.id },
        data: {
          customerName: order.clientName,
          soldDate,
          warrantyStartDate,
          warrantyEndDate,
          notes: dispatchNote,
        },
      })
      if (bySerial.warrantyId) {
        await prisma.erpInventorySerialUnit.update({
          where: { id: unit.id },
          data: {
            warrantyId: bySerial.warrantyId,
            warrantyStartDate,
            warrantyEndDate,
          },
        })
      }
      return
    }

    const generatedWarrantyId = `vol-${Math.floor(10000 + Math.random() * 90000)}`
    const created = await prisma.erpWarranty.create({
      data: {
        warrantyId: generatedWarrantyId,
        serialNumber: unit.serialNumber,
        productName: unit.model || unit.productName || unit.serialNumber,
        soldDate,
        warrantyStartDate,
        warrantyEndDate,
        customerName: order.clientName,
        notes: dispatchNote,
        createdBy: order.createdBy || "system",
      },
    })
    await prisma.erpInventorySerialUnit.update({
      where: { id: unit.id },
      data: {
        warrantyId: created.warrantyId,
        warrantyStartDate,
        warrantyEndDate,
      },
    })
  } catch {
    // non-blocking
  }
}

async function markSerialUnitsDelivered(
  order: OrderDeductInput,
  units: Array<{ id: string; model: string; serialNumber: string; warrantyId: string | null }>,
  item: OrderDeductLine,
) {
  if (units.length === 0) return

  const tag = orderUnitTag(order.id)
  const note = `${tag} ${order.orderNumber} → ${order.clientName}`
  await prisma.erpInventorySerialUnit.updateMany({
    where: { id: { in: units.map((u) => u.id) } },
    data: {
      status: "delivered",
      notes: note,
    },
  })

  await ensureInventoryStockForModel(units[0].model, item.description, item.unit || "pcs")

  await logHistory(
    units[0].model,
    units.length,
    item.unit || "pcs",
    order,
    `Serial units delivered to ${order.clientName}`,
  )

  for (const unit of units) {
    await ensureWarrantyForDispatch(unit, order)
  }
}

async function deductExplicitSerialsForLine(
  order: OrderDeductInput,
  item: OrderDeductLine & { id?: string },
): Promise<{ ok: boolean; count: number; error?: string }> {
  const lineId = item.id
  if (!lineId) return { ok: false, count: 0, error: "missing order line id" }

  const explicit = (order.fulfillmentSerialAllocations ?? []).filter(
    (a) => a.orderItemId === lineId,
  )
  if (explicit.length === 0) return { ok: false, count: 0, error: "no explicit serials" }

  const qty = Math.max(0, Math.floor(Number(item.qty) || 0))
  if (explicit.length !== qty) {
    return {
      ok: false,
      count: 0,
      error: `expected ${qty} serial(s), got ${explicit.length}`,
    }
  }

  const units = await prisma.erpInventorySerialUnit.findMany({
    where: { id: { in: explicit.map((a) => a.unitId) } },
  })
  if (units.length !== explicit.length) {
    return { ok: false, count: 0, error: "one or more serial units not found" }
  }

  const notInStock = units.filter((u) => u.status !== "in_stock")
  if (notInStock.length > 0) {
    return {
      ok: false,
      count: 0,
      error: `${notInStock.map((u) => u.serialNumber).join(", ")} not in stock`,
    }
  }

  const keys = getOrderLineMatchKeys(item).map(normalizeKey)
  const badModel = units.filter(
    (u) => !keys.includes(normalizeKey(u.model || "")),
  )
  if (badModel.length > 0) {
    return { ok: false, count: 0, error: "serial model does not match order line" }
  }

  await markSerialUnitsDelivered(order, units, item)
  return { ok: true, count: units.length }
}

async function deductSerialsForLine(
  order: OrderDeductInput,
  item: OrderDeductLine & { id?: string },
): Promise<{ ok: boolean; count: number; error?: string }> {
  const keys = getOrderLineMatchKeys(item)
  const qty = Math.max(0, Math.floor(Number(item.qty) || 0))
  if (qty === 0) return { ok: true, count: 0 }

  const allocated = await unitsAllocatedForLine(order, keys)
  if (allocated >= qty) {
    return { ok: true, count: 0 }
  }

  if (item.id && (order.fulfillmentSerialAllocations?.length ?? 0) > 0) {
    const explicit = await deductExplicitSerialsForLine(order, item)
    if (explicit.ok || explicit.error !== "no explicit serials") {
      return explicit
    }
  }

  const need = qty - allocated
  const found = await findInStockSerials(keys, need)
  if (!found) {
    return { ok: false, count: 0, error: "no in-stock serial units" }
  }

  if (found.units.length < need) {
    return {
      ok: false,
      count: found.units.length,
      error: `only ${found.units.length} serial unit(s) in stock`,
    }
  }

  await markSerialUnitsDelivered(order, found.units, item)
  return { ok: true, count: found.units.length }
}

async function deductStockForLine(
  order: OrderDeductInput,
  item: OrderDeductLine,
): Promise<{ ok: boolean; error?: string }> {
  const keys = getOrderLineMatchKeys(item)
  const qty = Math.max(0, Number(item.qty) || 0)
  if (qty === 0) return { ok: true }

  let remaining = qty
  let deducted = 0

  for (const key of keys) {
    if (remaining <= 0) break
    const stock = await findStockByModel(key)
    if (!stock) continue

    const currentQty = stock.availableQty ?? 0
    if (currentQty <= 0) continue

    const deductQty = Math.min(remaining, currentQty)
    const newQty = Math.max(0, currentQty - deductQty)

    await prisma.erpInventoryStock.update({
      where: { id: stock.id },
      data: { availableQty: newQty },
    })

    remaining -= deductQty
    deducted += deductQty

    await logHistory(
      stock.description || item.description,
      deductQty,
      item.unit || stock.unit || "pcs",
      order,
      `Delivered to ${order.clientName}`,
    )
  }

  if (deducted > 0 && remaining <= 0) return { ok: true }
  if (deducted > 0) return { ok: false, error: `short by ${remaining} ${item.unit}` }
  return { ok: false, error: "no matching stock row" }
}

export async function deductInventoryForOrderServer(
  order: OrderDeductInput,
): Promise<OrderDeductResult> {
  const failedLines: string[] = []
  let deductedLines = 0
  let serialUnitsDeducted = 0

  const nonCustom = order.items.filter((i) => !i.isCustom)
  if (nonCustom.length === 0) {
    return { success: true, alreadyDeducted: true, deductedLines: 0, failedLines: [], serialUnitsDeducted: 0 }
  }

  let allLinesAllocated = true
  for (const item of nonCustom) {
    const keys = getOrderLineMatchKeys(item)
    const needQty = Math.max(0, Math.floor(Number(item.qty) || 0))
    const allocated = await unitsAllocatedForLine(order, keys)
    if (allocated < needQty) {
      allLinesAllocated = false
      break
    }
  }

  if (order.inventoryDeductedAt && allLinesAllocated) {
    return {
      success: true,
      alreadyDeducted: true,
      deductedLines: 0,
      failedLines: [],
      serialUnitsDeducted: 0,
    }
  }

  for (const item of nonCustom) {
    const label =
      item.model?.trim() || item.description?.trim() || item.inventoryItemId || "item"

    const serial = await deductSerialsForLine(order, item)
    serialUnitsDeducted += serial.count

    if (serial.ok) {
      deductedLines += 1
      continue
    }

    const stock = await deductStockForLine(order, item)
    if (stock.ok) {
      deductedLines += 1
      continue
    }

    const parts = [serial.error, stock.error].filter(Boolean)
    failedLines.push(`${label} (${parts.join("; ") || "not in stock"})`)
  }

  const success = deductedLines > 0 && failedLines.length === 0

  return {
    success,
    alreadyDeducted: false,
    deductedLines,
    failedLines,
    serialUnitsDeducted,
  }
}

/** True if delivery still needs serial/stock deduction (read-only). */
export async function orderNeedsInventoryDeductionServer(order: OrderDeductInput): Promise<boolean> {
  if (order.items.every((i) => i.isCustom)) return false

  const nonCustom = order.items.filter((i) => !i.isCustom)

  for (const item of nonCustom) {
    const needQty = Math.max(0, Math.floor(Number(item.qty) || 0))
    if (needQty === 0) continue

    const keys = getOrderLineMatchKeys(item)
    const allocated = await unitsAllocatedForLine(order, keys)

    if (allocated < needQty) {
      const found = await findInStockSerials(keys, needQty - allocated)
      if (found) return true
      for (const key of keys) {
        const stock = await findStockByModel(key)
        if (stock && (stock.availableQty ?? 0) > 0) return true
      }
      if (!order.inventoryDeductedAt) return true
    }
  }

  return !order.inventoryDeductedAt
}

async function findDeliveredSerialsForKeys(keys: string[], limit: number) {
  if (limit <= 0) return []
  const lowerKeys = keys.map(normalizeKey).filter(Boolean)
  if (lowerKeys.length === 0) return []

  const pool = await prisma.erpInventorySerialUnit.findMany({
    where: { status: "delivered" },
    orderBy: { scannedAt: "desc" },
    take: Math.max(limit * 3, 20),
  })

  return pool
    .filter((u) => lowerKeys.includes(normalizeKey(u.model || "")))
    .slice(0, limit)
}

export async function restoreInventoryForOrderServer(order: OrderDeductInput): Promise<void> {
  const tag = orderUnitTag(order.id)
  const restoredIds = new Set<string>()
  const models = new Set<string>()

  const allocationIds = (order.fulfillmentSerialAllocations ?? []).map((a) => a.unitId)
  if (allocationIds.length > 0) {
    const allocatedUnits = await prisma.erpInventorySerialUnit.findMany({
      where: { id: { in: allocationIds } },
    })
    for (const unit of allocatedUnits) {
      if (restoredIds.has(unit.id)) continue
      restoredIds.add(unit.id)
      models.add(unit.model)
      let notes = (unit.notes || "")
        .replace(tag, "")
        .replace(order.orderNumber, "")
        .replace(/→/g, "")
        .trim()
      await prisma.erpInventorySerialUnit.update({
        where: { id: unit.id },
        data: { status: "in_stock", notes },
      })
    }
  }

  async function restoreUnit(unit: { id: string; model: string; notes: string | null }) {
    if (restoredIds.has(unit.id)) return
    restoredIds.add(unit.id)
    models.add(unit.model)
    let notes = (unit.notes || "")
      .replace(tag, "")
      .replace(order.orderNumber, "")
      .replace(/→/g, "")
      .trim()
    await prisma.erpInventorySerialUnit.update({
      where: { id: unit.id },
      data: {
        status: "in_stock",
        notes,
      },
    })
  }

  const byNotes = await prisma.erpInventorySerialUnit.findMany({
    where: {
      OR: [
        { notes: { contains: tag } },
        { status: "delivered", notes: { contains: order.orderNumber } },
      ],
    },
  })
  for (const unit of byNotes) {
    await restoreUnit(unit)
  }

  // Fallback when units were marked delivered without order notes (legacy rows).
  if (order.inventoryDeductedAt) {
    for (const item of order.items) {
      if (item.isCustom) continue
      const keys = getOrderLineMatchKeys(item)
      const needQty = Math.max(0, Math.floor(Number(item.qty) || 0))
      const lowerKeys = keys.map(normalizeKey)
      const alreadyForLine = byNotes.filter((u) =>
        lowerKeys.includes(normalizeKey(u.model || "")),
      ).length
      const stillNeed = needQty - alreadyForLine
      if (stillNeed <= 0) continue

      const extra = await findDeliveredSerialsForKeys(keys, stillNeed)
      for (const unit of extra) {
        await restoreUnit(unit)
      }
    }
  }

  for (const model of models) {
    if (model?.trim()) {
      await ensureInventoryStockForModel(model)
    }
  }

  for (const item of order.items) {
    if (item.isCustom) continue
    for (const key of getOrderLineMatchKeys(item)) {
      const stock = await findStockByModel(key)
      if (!stock) continue
      await prisma.erpInventoryStock.update({
        where: { id: stock.id },
        data: { availableQty: (stock.availableQty ?? 0) + item.qty },
      })
      break
    }
  }
}
