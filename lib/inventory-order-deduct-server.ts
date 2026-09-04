import { prisma } from "@/lib/db"
import { ensureInventoryStockForModel, findStockByModel } from "@/lib/ensure-model-stock-link"
import {
  decrementManualInventoryByModel,
  resolveManualInventoryForOrderLine,
  restoreManualInventoryByModel,
} from "@/lib/manual-inventory-server"
import type { OrderFulfillmentSerialAllocation } from "@/lib/order-fulfillment-serials"

export type OrderDeductLine = {
  id?: string
  description: string
  qty: number
  unit: string
  isCustom?: boolean
  /** Free/giveaway line — stock was already deducted when the item was added. */
  isFreeItem?: boolean
  model?: string
  inventoryItemId?: string
  branchInventoryId?: string
}

export type OrderDeductInput = {
  id: string
  orderNumber: string
  clientName: string
  /** End-user / company name for warranty — not the CRM client. */
  warrantyHolderName?: string | null
  createdBy?: string
  status?: string
  dispatcher?: string | null
  fulfillmentDispatcher?: string | null
  inventoryDeductedAt?: string | null
  /** When "branch_pos", warehouse stock must not be deducted (branch deducts on deliver). */
  source?: string | null
  branchId?: string | null
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
    if (inventoryItemId.startsWith("man:")) {
      const manualId = inventoryItemId.slice(4).trim()
      if (manualId) keys.add(manualId)
    }
  }

  return [...keys]
}

function orderUnitTag(orderId: string) {
  return `order:${orderId}`
}

function orderWasDispatched(order: OrderDeductInput): boolean {
  return !!(
    order.inventoryDeductedAt ||
    (order.dispatcher || "").trim() ||
    (order.fulfillmentDispatcher || "").trim() ||
    order.status === "processing" ||
    order.status === "shipped" ||
    order.status === "delivered"
  )
}

/** Whether deleting this order should restore inventory. */
export function orderMayNeedInventoryRestore(order: OrderDeductInput): boolean {
  if (order.items.every((item) => item.isCustom)) return false
  if (String(order.source || "").trim().toLowerCase() === "branch_pos") {
    // Only restore if stock was deducted on deliver.
    return !!order.inventoryDeductedAt
  }
  if (order.inventoryDeductedAt) return true
  if ((order.fulfillmentSerialAllocations?.length ?? 0) > 0) return true
  const hasInventoryLines = order.items.some(
    (item) => !item.isCustom && !!item.inventoryItemId?.trim(),
  )
  if (
    hasInventoryLines &&
    ["processing", "shipped", "delivered"].includes(order.status ?? "")
  ) {
    return true
  }
  return orderWasDispatched(order)
}

async function historyItemLabel(
  item: OrderDeductLine,
  fallback?: string,
): Promise<string> {
  const manual = await resolveManualInventoryForOrderLine(item)
  if (manual?.name?.trim()) return manual.name.trim()
  if (fallback?.trim()) return fallback.trim()
  if (item.description?.trim()) return item.description.trim()
  return item.model?.trim() || "Unknown"
}

async function logHistory(
  itemDescription: string,
  quantity: number,
  unit: string,
  order: OrderDeductInput,
  notes: string,
  transactionType: "in" | "out" = "out",
) {
  try {
    await prisma.erpInventoryHistory.create({
      data: {
        itemDescription,
        transactionType,
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
        { status: "delivered", specs: order.orderNumber },
      ],
    },
  })

  return units.filter((u) => lowerKeys.includes(normalizeKey(u.model || ""))).length
}

/** Serials scanned for this order at dispatch but still marked in_stock. */
async function findSerialsReservedForOrder(
  order: OrderDeductInput,
  keys: string[],
  limit: number,
) {
  if (limit <= 0) return []

  const tag = orderUnitTag(order.id)
  const orderNum = order.orderNumber.trim()
  const lowerKeys = keys.map(normalizeKey).filter(Boolean)
  if (lowerKeys.length === 0 || !orderNum) return []

  const units = await prisma.erpInventorySerialUnit.findMany({
    where: {
      status: "in_stock",
      OR: [
        { notes: { contains: tag } },
        { notes: { contains: `pending:${orderNum}` } },
        { specs: orderNum },
        { notes: { contains: orderNum } },
      ],
    },
    orderBy: { scannedAt: "asc" },
  })

  return units
    .filter((u) => lowerKeys.includes(normalizeKey(u.model || "")))
    .slice(0, limit)
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

export async function ensureWarrantyForDispatchBySerial(
  serialNumber: string,
  model: string,
  productName: string,
  order: OrderDeductInput,
) {
  const sn = serialNumber.trim()
  if (!sn) return null

  const soldDate = order.inventoryDeductedAt
    ? new Date(order.inventoryDeductedAt)
    : new Date()
  const placeholderEnd = addYears(soldDate, 5)
  const dispatchNote = `Dispatched on order ${order.orderNumber}. Pending: scan QR at branch or voltrixbatteries.com/warranty to start warranty.`
  const holderName = (order.warrantyHolderName || "").trim() || null

  try {
    const bySerial = await prisma.erpWarranty.findFirst({
      where: { serialNumber: { equals: sn, mode: "insensitive" } },
    })
    if (bySerial) {
      await prisma.erpWarranty.update({
        where: { id: bySerial.id },
        data: {
          customerName: holderName,
          soldDate,
          warrantyStartDate: soldDate,
          warrantyEndDate: placeholderEnd,
          activatedAt: null,
          notes: dispatchNote,
          productName: model || productName || bySerial.productName,
          serialNumber: sn,
        },
      })
      return bySerial.warrantyId
    }

    const created = await prisma.erpWarranty.create({
      data: {
        serialNumber: sn,
        productName: model || productName || sn,
        soldDate,
        warrantyStartDate: soldDate,
        warrantyEndDate: placeholderEnd,
        activatedAt: null,
        customerName: holderName,
        notes: dispatchNote,
        createdBy: order.createdBy || "system",
      },
    })
    return null
  } catch {
    return null
  }
}

export async function registerPendingWarrantiesFromAllocations(order: OrderDeductInput) {
  const allocations = order.fulfillmentSerialAllocations || []
  for (const allocation of allocations) {
    const serial = String(allocation.serialNumber || "").trim()
    if (!serial) continue
    const item = order.items.find((i) => i.id === allocation.orderItemId)
    await ensureWarrantyForDispatchBySerial(
      serial,
      allocation.model || item?.model || "",
      item?.description || allocation.model || serial,
      order,
    )
  }
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
  const warrantyId = await ensureWarrantyForDispatchBySerial(
    unit.serialNumber,
    unit.model,
    unit.productName || unit.model,
    order,
  )
  if (warrantyId && !unit.warrantyId?.trim()) {
    try {
      await prisma.erpInventorySerialUnit.update({
        where: { id: unit.id },
        data: { warrantyId },
      })
    } catch {
      // non-blocking
    }
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
      specs: order.orderNumber,
    },
  })

  await ensureInventoryStockForModel(units[0].model, item.description, item.unit || "pcs")

  await logHistory(
    await historyItemLabel(item, units[0].model),
    units.length,
    item.unit || "pcs",
    order,
    `Serial units delivered to ${order.clientName}`,
  )

  for (const unit of units) {
    await ensureWarrantyForDispatch(unit, order)
  }
}

/** Dispatch scans: warranty + qty deduction only — do not create inventory serial rows. */
async function processDispatchAllocationsForLine(
  order: OrderDeductInput,
  item: OrderDeductLine & { id?: string },
): Promise<{ ok: boolean; count: number; error?: string }> {
  const lineId = item.id
  if (!lineId) return { ok: false, count: 0, error: "missing order line id" }

  const explicit = (order.fulfillmentSerialAllocations ?? []).filter(
    (a) => a.orderItemId === lineId,
  )
  if (explicit.length === 0) return { ok: false, count: 0, error: "no dispatch scans" }

  const orderQty = Math.max(0, Math.floor(Number(item.qty) || 0))
  const scannedQty = explicit.length
  if (scannedQty > orderQty) {
    return {
      ok: false,
      count: 0,
      error: `expected at most ${orderQty} serial(s), got ${scannedQty}`,
    }
  }

  const alreadyProcessed = await Promise.all(
    explicit.map(async (alloc) => {
      const w = await prisma.erpWarranty.findFirst({
        where: {
          serialNumber: { equals: alloc.serialNumber.trim(), mode: "insensitive" },
          notes: { contains: order.orderNumber },
        },
      })
      return !!w
    }),
  )
  if (alreadyProcessed.every(Boolean)) {
    return { ok: true, count: explicit.length }
  }

  const keys = getOrderLineMatchKeys(item).map(normalizeKey)
  const tag = orderUnitTag(order.id)
  const note = `${tag} ${order.orderNumber} → ${order.clientName}`

  for (const alloc of explicit) {
    const sn = alloc.serialNumber.trim()
    if (!sn) {
      return { ok: false, count: 0, error: "empty serial in dispatch scan" }
    }
    if (!keys.includes(normalizeKey(alloc.model || ""))) {
      return { ok: false, count: 0, error: "serial model does not match order line" }
    }

    await ensureWarrantyForDispatchBySerial(
      sn,
      alloc.model,
      item.description,
      order,
    )

    const existingUnit = await prisma.erpInventorySerialUnit.findFirst({
      where: {
        serialNumber: { equals: sn, mode: "insensitive" },
        status: "in_stock",
      },
    })
    if (existingUnit) {
      await prisma.erpInventorySerialUnit.update({
        where: { id: existingUnit.id },
        data: {
          status: "delivered",
          notes: note,
          specs: order.orderNumber,
        },
      })
    }
  }

  const manualItem = await resolveManualInventoryForOrderLine(item)
  if (manualItem) {
    const alreadyOut = await manualQtyAlreadyDeductedForOrder(order, manualItem, item)
    const need = scannedQty - alreadyOut
    if (need > 0) {
      await decrementManualInventoryByModel(manualItem.model, need)
    }
  } else {
    const stock = await deductStockForLine(order, item, scannedQty)
    if (!stock.ok) {
      return { ok: false, count: 0, error: stock.error || "stock deduction failed" }
    }
  }

  await logHistory(
    await historyItemLabel(item),
    scannedQty,
    item.unit || "pcs",
    order,
    `Dispatch scan: ${explicit.map((a) => a.serialNumber).join(", ")} → ${order.clientName}`,
  )

  return { ok: true, count: explicit.length }
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

  const hasDispatchScans = explicit.some((a) => a.serialNumber?.trim())
  if (hasDispatchScans) {
    return processDispatchAllocationsForLine(order, item)
  }

  const unitIds = explicit.map((a) => a.unitId).filter(Boolean) as string[]
  if (unitIds.length !== explicit.length) {
    return { ok: false, count: 0, error: "invalid serial allocation" }
  }

  const qty = Math.max(0, Math.floor(Number(item.qty) || 0))
  if (explicit.length !== qty) {
    return {
      ok: false,
      count: 0,
      error: `expected ${qty} serial(s), got ${explicit.length}`,
    }
  }

  const units = await prisma.erpInventorySerialUnit.findMany({
    where: { id: { in: unitIds } },
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
  const reserved = await findSerialsReservedForOrder(order, keys, need)
  if (reserved.length > 0) {
    await markSerialUnitsDelivered(order, reserved, item)
    if (reserved.length >= need) {
      return { ok: true, count: reserved.length }
    }
  }

  const stillNeed = need - reserved.length
  const found = await findInStockSerials(keys, stillNeed)
  if (!found) {
    return {
      ok: false,
      count: reserved.length,
      error: reserved.length > 0 ? `only ${reserved.length} reserved serial(s) finalized` : "no in-stock serial units",
    }
  }

  if (found.units.length < stillNeed) {
    return {
      ok: false,
      count: reserved.length + found.units.length,
      error: `only ${reserved.length + found.units.length} serial unit(s) available`,
    }
  }

  await markSerialUnitsDelivered(order, found.units, item)
  return { ok: true, count: reserved.length + found.units.length }
}

async function deductStockForLine(
  order: OrderDeductInput,
  item: OrderDeductLine,
  deductQty?: number,
): Promise<{ ok: boolean; error?: string }> {
  const keys = getOrderLineMatchKeys(item)
  const qty = deductQty ?? Math.max(0, Number(item.qty) || 0)
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
      await historyItemLabel(item, stock.description || undefined),
      deductQty,
      item.unit || stock.unit || "pcs",
      order,
      `Delivered to ${order.clientName}`,
    )
  }

  if (deducted > 0) {
    for (const key of keys) {
      const stock = await findStockByModel(key)
      if (!stock) continue
      const manual = await prisma.erpManualInventoryItem.findFirst({
        where: { inventoryStockId: stock.id },
      })
      if (manual) {
        await decrementManualInventoryByModel(manual.model, deducted)
        break
      }
    }
  }

  if (deducted > 0 && remaining <= 0) return { ok: true }
  if (deducted > 0) return { ok: false, error: `short by ${remaining} ${item.unit}` }
  return { ok: false, error: "no matching stock row" }
}

async function manualQtyAlreadyDeductedForOrder(
  order: OrderDeductInput,
  manualItem: { name: string; model: string },
  item: OrderDeductLine,
): Promise<number> {
  const priorRows = await prisma.erpInventoryHistory.findMany({
    where: {
      referenceType: "order",
      referenceId: order.id,
      transactionType: "out",
    },
  })
  const labels = new Set(
    [manualItem.name, manualItem.model, item.description, item.model]
      .map((value) => normalizeKey(value || ""))
      .filter(Boolean),
  )

  return priorRows
    .filter((row) => labels.has(normalizeKey(row.itemDescription || "")))
    .reduce((sum, row) => sum + (row.quantity || 0), 0)
}

async function deductManualQtyForLine(
  order: OrderDeductInput,
  item: OrderDeductLine,
): Promise<{ ok: boolean; error?: string }> {
  const manualItem = await resolveManualInventoryForOrderLine(item)
  if (!manualItem) return { ok: false, error: "not manual inventory" }

  const qty = Math.max(0, Math.floor(Number(item.qty) || 0))
  if (qty === 0) return { ok: true }

  const alreadyOut = await manualQtyAlreadyDeductedForOrder(order, manualItem, item)
  if (alreadyOut >= qty) return { ok: true }

  const keys = getOrderLineMatchKeys(item)
  if (manualItem.model?.trim()) keys.push(manualItem.model.trim())
  const allocated = await unitsAllocatedForLine(order, keys)
  if (allocated >= qty) return { ok: true }

  const need = qty - Math.max(allocated, alreadyOut)
  if (need <= 0) return { ok: true }

  const available = manualItem.availableQty ?? 0
  if (available < need) {
    return {
      ok: false,
      error: `only ${available} available in manual stock (need ${need})`,
    }
  }

  await decrementManualInventoryByModel(manualItem.model, need)
  await logHistory(
    manualItem.name || item.description,
    need,
    item.unit || manualItem.unit || "pcs",
    order,
    `Delivered to ${order.clientName}`,
  )
  return { ok: true }
}

export async function deductInventoryForOrderServer(
  order: OrderDeductInput,
): Promise<OrderDeductResult> {
  const failedLines: string[] = []
  let deductedLines = 0
  let serialUnitsDeducted = 0

  // Branch POS orders deduct from branch inventory on deliver — never touch main warehouse.
  if (String(order.source || "").trim().toLowerCase() === "branch_pos") {
    return {
      success: true,
      alreadyDeducted: true,
      deductedLines: 0,
      failedLines: [],
      serialUnitsDeducted: 0,
    }
  }

  // Free items were deducted the moment they were added — never re-deduct.
  const nonCustom = order.items.filter((i) => !i.isCustom && !i.isFreeItem)
  if (nonCustom.length === 0) {
    return { success: true, alreadyDeducted: true, deductedLines: 0, failedLines: [], serialUnitsDeducted: 0 }
  }

  // Delivered orders: finalize dispatch-scanned serials still stuck as in_stock.
  if (order.status === "delivered") {
    for (const item of nonCustom) {
      const keys = getOrderLineMatchKeys(item)
      const needQty = Math.max(0, Math.floor(Number(item.qty) || 0))
      const allocated = await unitsAllocatedForLine(order, keys)
      const pending = await findSerialsReservedForOrder(order, keys, needQty - allocated)
      if (pending.length > 0) {
        await markSerialUnitsDelivered(order, pending, item)
        serialUnitsDeducted += pending.length
      }
    }
  }

  if (order.inventoryDeductedAt) {
    return {
      success: true,
      alreadyDeducted: true,
      deductedLines: 0,
      failedLines: [],
      serialUnitsDeducted,
    }
  }

  const scanDispatch = (order.fulfillmentSerialAllocations?.length ?? 0) > 0

  for (const item of nonCustom) {
    const label =
      item.model?.trim() || item.description?.trim() || item.inventoryItemId || "item"

    const lineAllocations = (order.fulfillmentSerialAllocations ?? []).filter(
      (a) => item.id && a.orderItemId === item.id,
    )

    if (scanDispatch) {
      if (lineAllocations.length === 0) continue
      const dispatch = await processDispatchAllocationsForLine(order, item)
      serialUnitsDeducted += dispatch.count
      if (dispatch.ok) {
        deductedLines += 1
        continue
      }
      failedLines.push(`${label} (${dispatch.error || "dispatch scan failed"})`)
      continue
    }

    if (lineAllocations.length === 0) {
      const manualOnly = await deductManualQtyForLine(order, item)
      if (manualOnly.ok) {
        deductedLines += 1
        continue
      }
      if (manualOnly.error && manualOnly.error !== "not manual inventory") {
        failedLines.push(`${label} (${manualOnly.error})`)
        continue
      }
    }

    const serial = await deductSerialsForLine(order, item)
    serialUnitsDeducted += serial.count

    if (serial.ok) {
      if (serial.count > 0) {
        const manualItem = await resolveManualInventoryForOrderLine(item)
        if (manualItem) {
          await decrementManualInventoryByModel(manualItem.model, serial.count)
        }
      }
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
  if (String(order.source || "").trim().toLowerCase() === "branch_pos") return false
  if (order.items.every((i) => i.isCustom || i.isFreeItem)) return false

  const nonCustom = order.items.filter((i) => !i.isCustom && !i.isFreeItem)

  if (order.status === "delivered") {
    for (const item of nonCustom) {
      const needQty = Math.max(0, Math.floor(Number(item.qty) || 0))
      if (needQty === 0) continue
      const keys = getOrderLineMatchKeys(item)
      const allocated = await unitsAllocatedForLine(order, keys)
      const pending = await findSerialsReservedForOrder(order, keys, needQty - allocated)
      if (pending.length > 0) return true
    }
  }

  if (order.inventoryDeductedAt) return false

  for (const item of nonCustom) {
    const needQty = Math.max(0, Math.floor(Number(item.qty) || 0))
    if (needQty === 0) continue

    const keys = getOrderLineMatchKeys(item)
    const allocated = await unitsAllocatedForLine(order, keys)

    if (allocated < needQty) {
      const manualItem = await resolveManualInventoryForOrderLine(item)
      if (manualItem) {
        const alreadyOut = await manualQtyAlreadyDeductedForOrder(order, manualItem, item)
        if (alreadyOut < needQty && (manualItem.availableQty ?? 0) > 0) return true
        continue
      }

      const found = await findInStockSerials(keys, needQty - allocated)
      if (found) return true
      for (const key of keys) {
        const stock = await findStockByModel(key)
        if (stock && (stock.availableQty ?? 0) > 0) return true
      }
      return true
    }
  }

  return false
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

export type OrderRestoreLineQty = {
  orderItemId: string
  qty: number
}

export async function restoreInventoryForOrderServer(
  order: OrderDeductInput,
  options?: { historyNotes?: string; restoreLines?: OrderRestoreLineQty[] },
): Promise<void> {
  // Branch POS stock is restored separately via restoreBranchStockForPosOrder.
  if (String(order.source || "").trim().toLowerCase() === "branch_pos") return
  // Free/giveaway lines stay given — never restock them on return/cancel.
  order = { ...order, items: order.items.filter((i) => !i.isFreeItem) }
  const historyNotes =
    options?.historyNotes?.trim() ||
    `Stock restored · ${order.clientName}`

  /** When set, only restore these quantities (partial return). Undefined = full restore. */
  const restoreCap = new Map<string, number>()
  if (options?.restoreLines && options.restoreLines.length > 0) {
    for (const line of options.restoreLines) {
      const itemId = String(line.orderItemId || "").trim()
      const qty = Math.max(0, Math.floor(Number(line.qty) || 0))
      if (!itemId || qty <= 0) continue
      restoreCap.set(itemId, (restoreCap.get(itemId) || 0) + qty)
    }
    if (restoreCap.size === 0) return
  }
  const isPartial = restoreCap.size > 0

  function remainingCap(itemId: string): number {
    if (!isPartial) return Number.POSITIVE_INFINITY
    return Math.max(0, restoreCap.get(itemId) || 0)
  }

  function consumeCap(itemId: string, n = 1): boolean {
    if (!isPartial) return true
    const left = remainingCap(itemId)
    if (left < n) return false
    restoreCap.set(itemId, left - n)
    return true
  }

  // Snapshot of requested qty per line (before consume) for stock-only / manual fallback
  const requestedByItem = new Map<string, number>()
  if (isPartial) {
    for (const [itemId, qty] of restoreCap) requestedByItem.set(itemId, qty)
  } else {
    for (const item of order.items) {
      if (!item.id || item.isCustom) continue
      requestedByItem.set(item.id, Math.max(0, Math.floor(Number(item.qty) || 0)))
    }
  }

  const tag = orderUnitTag(order.id)
  const restoredIds = new Set<string>()
  const models = new Set<string>()
  const restoredCountByLine = new Map<string, number>()

  async function restoreUnit(
    unit: { id: string; model: string; notes: string | null; status?: string },
    orderItemId?: string,
  ): Promise<boolean> {
    if (restoredIds.has(unit.id)) return false
    if (orderItemId && !consumeCap(orderItemId, 1)) return false
    if (!orderItemId && isPartial) {
      // Assign to first matching line that still has cap
      const unitModelKey = normalizeKey(unit.model || "")
      let matchedId: string | undefined
      for (const item of order.items) {
        if (item.isCustom || !item.id) continue
        if (remainingCap(item.id) <= 0) continue
        const keys = getOrderLineMatchKeys(item).map(normalizeKey)
        if (!keys.includes(unitModelKey)) continue
        matchedId = item.id
        break
      }
      if (!matchedId || !consumeCap(matchedId, 1)) return false
      orderItemId = matchedId
    }

    const unitNotes = unit.notes || ""
    const linkedToOrder =
      unitNotes.includes(tag) ||
      (unit.status === "delivered" && unitNotes.includes(order.orderNumber))
    if (unit.status === "in_stock" && !linkedToOrder) {
      // Undo cap consume if we skip
      if (isPartial && orderItemId) {
        restoreCap.set(orderItemId, remainingCap(orderItemId) + 1)
      }
      return false
    }
    restoredIds.add(unit.id)
    models.add(unit.model)
    if (orderItemId) {
      restoredCountByLine.set(
        orderItemId,
        (restoredCountByLine.get(orderItemId) ?? 0) + 1,
      )
    }
    let notes = unitNotes
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
    return true
  }

  // 1) Prefer fulfillment allocations (exact unit ↔ order line)
  const allocations = order.fulfillmentSerialAllocations ?? []
  const allocationIds = allocations
    .map((a) => a.unitId?.trim())
    .filter((id): id is string => !!id)
  if (allocationIds.length > 0) {
    const allocatedUnits = await prisma.erpInventorySerialUnit.findMany({
      where: { id: { in: allocationIds } },
    })
    const unitById = new Map(allocatedUnits.map((u) => [u.id, u]))
    for (const alloc of allocations) {
      const unitId = alloc.unitId?.trim()
      if (!unitId) continue
      const itemId = String(alloc.orderItemId || "").trim()
      if (isPartial && itemId && remainingCap(itemId) <= 0) continue
      if (isPartial && itemId && !requestedByItem.has(itemId)) continue
      const unit = unitById.get(unitId)
      if (!unit) continue
      await restoreUnit(unit, itemId || undefined)
    }
  }

  // 2) Units tagged with this order in notes
  const byNotes = await prisma.erpInventorySerialUnit.findMany({
    where: {
      OR: [
        { notes: { contains: tag } },
        { status: "delivered", notes: { contains: order.orderNumber } },
      ],
    },
  })
  for (const unit of byNotes) {
    if (restoredIds.has(unit.id)) continue
    if (isPartial) {
      // Only restore if some requested line still needs units of this model
      const unitModelKey = normalizeKey(unit.model || "")
      const needs = order.items.some((item) => {
        if (!item.id || item.isCustom) return false
        if (remainingCap(item.id) <= 0) return false
        return getOrderLineMatchKeys(item)
          .map(normalizeKey)
          .includes(unitModelKey)
      })
      if (!needs) continue
    }
    await restoreUnit(unit)
  }

  // 3) Fallback when units were marked delivered without order notes (legacy rows).
  if (order.inventoryDeductedAt) {
    for (const item of order.items) {
      if (item.isCustom || !item.id) continue
      const needQty = isPartial
        ? remainingCap(item.id)
        : Math.max(0, Math.floor(Number(item.qty) || 0))
      if (needQty <= 0) continue
      const keys = getOrderLineMatchKeys(item)
      const extra = await findDeliveredSerialsForKeys(keys, needQty)
      for (const unit of extra) {
        await restoreUnit(unit, item.id)
      }
    }
  }

  for (const model of models) {
    if (model?.trim()) {
      await ensureInventoryStockForModel(model)
    }
  }

  // Match any restored serials still unassigned to a line (full restore path)
  if (!isPartial && restoredIds.size > 0) {
    const restoredUnits = await prisma.erpInventorySerialUnit.findMany({
      where: { id: { in: [...restoredIds] } },
    })
    for (const unit of restoredUnits) {
      const fromAlloc = allocations.some((a) => a.unitId === unit.id)
      if (fromAlloc) continue
      // Already counted during restoreUnit when orderItemId was resolved
      const alreadyCounted = [...restoredCountByLine.values()].reduce((a, b) => a + b, 0)
      if (alreadyCounted >= restoredIds.size) break
      const unitModelKey = normalizeKey(unit.model || "")
      for (const item of order.items) {
        if (item.isCustom || !item.id) continue
        const keys = getOrderLineMatchKeys(item).map(normalizeKey)
        if (!keys.includes(unitModelKey)) continue
        // Avoid double-count if restoreUnit already assigned
        const current = restoredCountByLine.get(item.id) ?? 0
        const lineQty = Math.max(0, Math.floor(Number(item.qty) || 0))
        if (current >= lineQty) continue
        restoredCountByLine.set(item.id, current + 1)
        break
      }
    }
  }

  for (const item of order.items) {
    if (item.isCustom || !item.id) continue

    const requestedQty = requestedByItem.get(item.id) ?? 0
    if (isPartial && requestedQty <= 0) continue

    const restoredQty = restoredCountByLine.get(item.id) ?? 0
    const lineQty = isPartial ? requestedQty : Math.max(0, Math.floor(Number(item.qty) || 0))
    let loggedQty = 0

    const manualItem = await resolveManualInventoryForOrderLine(item)
    if (manualItem) {
      const qtyToRestore =
        restoredQty > 0
          ? restoredQty
          : orderWasDispatched(order)
            ? lineQty
            : 0
      if (qtyToRestore > 0) {
        await restoreManualInventoryByModel(manualItem.model, qtyToRestore)
        loggedQty = qtyToRestore
      }
    } else if (restoredQty > 0) {
      // Warehouse lines with serials restored — stock synced via ensureInventoryStockForModel
      loggedQty = restoredQty
    } else if (orderWasDispatched(order) && lineQty > 0) {
      // Stock-only deduction (no serial units) — put qty back on stock row
      for (const key of getOrderLineMatchKeys(item)) {
        const stock = await findStockByModel(key)
        if (!stock) continue
        await prisma.erpInventoryStock.update({
          where: { id: stock.id },
          data: { availableQty: (stock.availableQty ?? 0) + lineQty },
        })
        loggedQty = lineQty
        break
      }
    }

    if (loggedQty > 0) {
      const label = await historyItemLabel(item)
      await logHistory(
        label,
        loggedQty,
        item.unit || "pcs",
        order,
        historyNotes,
        "in",
      )
    }
  }
}
