import { prisma } from "@/lib/db"
import type { OrderFulfillmentSerialAllocation } from "@/lib/order-fulfillment-serials"
import { activateWarrantyBySerial } from "@/lib/warranty-activation"
import { normalizeWarrantyHolderName } from "@/lib/warranty-holder-name"
import { parseOrderNumberFromWarrantyNotes } from "@/lib/warranty-order-resolver"
import { filterDeliveredPendingWarranties } from "@/lib/warranty-registry"

export type OrderWarrantyStartFailure = {
  serialNumber: string
  error: string
}

export type OrderWarrantyStartResult = {
  orderNumber: string
  warrantyName: string
  serialCount: number
  started: number
  alreadyActive: number
  failed: OrderWarrantyStartFailure[]
}

function uniqueSerialsFromAllocations(raw: unknown): { serialNumber: string; model: string }[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: { serialNumber: string; model: string }[] = []
  for (const row of raw as OrderFulfillmentSerialAllocation[]) {
    const serialNumber = String(row?.serialNumber || "").trim()
    if (!serialNumber) continue
    const key = serialNumber.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      serialNumber,
      model: String(row?.model || "").trim(),
    })
  }
  return out
}

async function extraSerialsFromWarranties(
  orderNumber: string,
  already: Set<string>,
): Promise<{ serialNumber: string; model: string }[]> {
  const rows = await prisma.erpWarranty.findMany({
    where: { notes: { contains: orderNumber } },
    select: { serialNumber: true, productName: true, notes: true },
  })
  const extra: { serialNumber: string; model: string }[] = []
  for (const row of rows) {
    const parsed = parseOrderNumberFromWarrantyNotes(row.notes)
    if (parsed && parsed.toLowerCase() !== orderNumber.toLowerCase()) continue
    const serialNumber = String(row.serialNumber || "").trim()
    if (!serialNumber) continue
    const key = serialNumber.toLowerCase()
    if (already.has(key)) continue
    already.add(key)
    extra.push({
      serialNumber,
      model: String(row.productName || "").trim(),
    })
  }
  return extra
}

async function runPool<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
) {
  const limit = Math.max(1, Math.min(concurrency, items.length))
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next++
      await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: limit }, () => worker()))
}

export async function startWarrantiesForOrder(params: {
  orderId: string
  activatedBy: string
  /** When set, written onto the order before starting (e.g. client name fallback). */
  warrantyHolderName?: string
}): Promise<OrderWarrantyStartResult> {
  const order = await prisma.erpOrder.findUnique({ where: { id: params.orderId } })
  if (!order) {
    throw new Error("Order not found")
  }
  if (order.status !== "delivered") {
    throw new Error("Warranty can only be started on a delivered order.")
  }

  let warrantyName = normalizeWarrantyHolderName(
    params.warrantyHolderName || order.warrantyHolderName || order.clientName || "",
  )
  if (!warrantyName) {
    throw new Error("Save a warranty name on this order first.")
  }

  if (
    normalizeWarrantyHolderName(order.warrantyHolderName || "") !== warrantyName
  ) {
    await prisma.erpOrder.update({
      where: { id: order.id },
      data: { warrantyHolderName: warrantyName },
    })
  }

  const fromAlloc = uniqueSerialsFromAllocations(order.fulfillmentSerialAllocations)
  const seen = new Set(fromAlloc.map((s) => s.serialNumber.toLowerCase()))
  const extras = await extraSerialsFromWarranties(order.orderNumber, seen)
  const serials = [...fromAlloc, ...extras]

  if (serials.length === 0) {
    throw new Error("No scanned serials found on this order.")
  }

  const activatedBy = params.activatedBy.trim() || "ERP admin"
  let started = 0
  let alreadyActive = 0
  const failed: OrderWarrantyStartFailure[] = []

  await runPool(serials, 6, async (item) => {
    const result = await activateWarrantyBySerial(item.serialNumber, {
      allowUnregistered: true,
      useAssignedHolderName: true,
      activatedBy,
      customerName: warrantyName,
      productName: item.model || undefined,
    })
    if (!result.ok) {
      failed.push({ serialNumber: item.serialNumber, error: result.error })
      return
    }
    if (result.alreadyActive) alreadyActive += 1
    else started += 1
  })

  return {
    orderNumber: order.orderNumber,
    warrantyName,
    serialCount: serials.length,
    started,
    alreadyActive,
    failed,
  }
}

export type StartAllPendingResult = {
  pendingFound: number
  started: number
  alreadyActive: number
  failed: OrderWarrantyStartFailure[]
  ordersTouched: number
}

/**
 * Start warranty for every delivered unit that is still pending
 * (Website → Warranty → Delivered tab).
 */
export async function startAllPendingDispatchedWarranties(params: {
  activatedBy: string
}): Promise<StartAllPendingResult> {
  const activatedBy = params.activatedBy.trim() || "ERP admin — bulk start pending"

  const [warranties, units] = await Promise.all([
    prisma.erpWarranty.findMany({
      where: { activatedAt: null },
      select: {
        id: true,
        warrantyId: true,
        serialNumber: true,
        productName: true,
        customerName: true,
        notes: true,
        activatedAt: true,
      },
    }),
    prisma.erpInventorySerialUnit.findMany({
      select: { warrantyId: true, serialNumber: true, status: true },
    }),
  ])

  const pending = filterDeliveredPendingWarranties(warranties, units)
  const byOrder = new Map<string, typeof pending>()
  const orphans: typeof pending = []

  for (const row of pending) {
    const orderNumber = parseOrderNumberFromWarrantyNotes(row.notes)
    if (orderNumber) {
      const list = byOrder.get(orderNumber) || []
      list.push(row)
      byOrder.set(orderNumber, list)
    } else {
      orphans.push(row)
    }
  }

  let started = 0
  let alreadyActive = 0
  const failed: OrderWarrantyStartFailure[] = []
  let ordersTouched = 0

  for (const [orderNumber, rows] of byOrder) {
    const order = await prisma.erpOrder.findFirst({
      where: { orderNumber: { equals: orderNumber, mode: "insensitive" } },
      select: {
        id: true,
        status: true,
        clientName: true,
        warrantyHolderName: true,
        fulfillmentSerialAllocations: true,
      },
    })

    const holder =
      normalizeWarrantyHolderName(order?.warrantyHolderName || "") ||
      normalizeWarrantyHolderName(rows.find((r) => r.customerName)?.customerName || "") ||
      normalizeWarrantyHolderName(order?.clientName || "") ||
      "Customer"

    if (order && order.status === "delivered") {
      try {
        const result = await startWarrantiesForOrder({
          orderId: order.id,
          activatedBy,
          warrantyHolderName: holder,
        })
        ordersTouched += 1
        started += result.started
        alreadyActive += result.alreadyActive
        failed.push(...result.failed)
        continue
      } catch (err) {
        // Fall through to per-serial activation for this order's rows.
        console.error(`[start-all-pending] order ${orderNumber} failed, using serials`, err)
      }
    }

    await runPool(rows, 6, async (row) => {
      const serial = String(row.serialNumber || "").trim()
      if (!serial) {
        failed.push({ serialNumber: "(missing)", error: `No serial on warranty ${row.warrantyId}` })
        return
      }
      const name =
        normalizeWarrantyHolderName(row.customerName || "") || holder
      const result = await activateWarrantyBySerial(serial, {
        allowUnregistered: true,
        useAssignedHolderName: true,
        activatedBy,
        customerName: name,
        productName: row.productName || undefined,
      })
      if (!result.ok) {
        failed.push({ serialNumber: serial, error: result.error })
        return
      }
      if (result.alreadyActive) alreadyActive += 1
      else started += 1
    })
    ordersTouched += 1
  }

  await runPool(orphans, 6, async (row) => {
    const serial = String(row.serialNumber || "").trim()
    if (!serial) {
      failed.push({ serialNumber: "(missing)", error: `No serial on warranty ${row.warrantyId}` })
      return
    }
    const name =
      normalizeWarrantyHolderName(row.customerName || "") || "Customer"
    const result = await activateWarrantyBySerial(serial, {
      allowUnregistered: true,
      useAssignedHolderName: true,
      activatedBy,
      customerName: name,
      productName: row.productName || undefined,
    })
    if (!result.ok) {
      failed.push({ serialNumber: serial, error: result.error })
      return
    }
    if (result.alreadyActive) alreadyActive += 1
    else started += 1
  })

  return {
    pendingFound: pending.length,
    started,
    alreadyActive,
    failed,
    ordersTouched,
  }
}
