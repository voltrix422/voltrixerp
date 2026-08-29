import { prisma } from "@/lib/db"
import type { OrderFulfillmentSerialAllocation } from "@/lib/order-fulfillment-serials"
import { activateWarrantyBySerial } from "@/lib/warranty-activation"
import { normalizeWarrantyHolderName } from "@/lib/warranty-holder-name"
import { parseOrderNumberFromWarrantyNotes } from "@/lib/warranty-order-resolver"

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
}): Promise<OrderWarrantyStartResult> {
  const order = await prisma.erpOrder.findUnique({ where: { id: params.orderId } })
  if (!order) {
    throw new Error("Order not found")
  }
  if (order.status !== "delivered") {
    throw new Error("Warranty can only be started on a delivered order.")
  }

  const warrantyName = normalizeWarrantyHolderName(order.warrantyHolderName || "")
  if (!warrantyName) {
    throw new Error("Save a warranty name on this order first.")
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
