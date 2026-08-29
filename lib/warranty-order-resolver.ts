import { prisma } from "@/lib/db"
import { normalizeWarrantyHolderName } from "@/lib/warranty-holder-name"
import type { OrderFulfillmentSerialAllocation } from "@/lib/order-fulfillment-serials"

export function parseOrderNumberFromWarrantyNotes(notes: string | null | undefined): string | null {
  const n = notes || ""
  const dispatched = n.match(/dispatched on order\s+([^\s.]+)/i)
  if (dispatched?.[1]?.trim()) return dispatched[1].trim()

  const replacement = n.match(/replacement on order\s+([^\s.]+)/i)
  if (replacement?.[1]?.trim()) return replacement[1].trim()

  const orderLine = n.match(/order:[^\s]+\s+([^\s→]+)/i)
  if (orderLine?.[1]?.trim()) return orderLine[1].trim()

  return null
}

export function parseOrderNumberFromUnitNotes(notes: string | null | undefined): string | null {
  const n = notes || ""
  const match = n.match(/order:[^\s]+\s+([^\s→]+)/i)
  return match?.[1]?.trim() || null
}

export function buildPendingDispatchNote(orderNumber: string): string {
  return `Dispatched on order ${orderNumber}. Pending: scan QR at branch or voltrixbatteries.com/warranty to start warranty.`
}

export async function resolveInvoiceNumberForWarranty(input: {
  serialNumber?: string | null
  warrantyId?: string | null
  notes?: string | null
}): Promise<string | null> {
  let orderNumber = parseOrderNumberFromWarrantyNotes(input.notes)

  const serial = (input.serialNumber || "").trim()
  if (!orderNumber && serial) {
    const unit = await prisma.erpInventorySerialUnit.findFirst({
      where: { serialNumber: { equals: serial, mode: "insensitive" } },
      select: { notes: true },
    })
    orderNumber = parseOrderNumberFromUnitNotes(unit?.notes)
  }

  if (!orderNumber && input.warrantyId?.trim()) {
    const unit = await prisma.erpInventorySerialUnit.findFirst({
      where: { warrantyId: input.warrantyId.trim() },
      select: { notes: true },
    })
    orderNumber = parseOrderNumberFromUnitNotes(unit?.notes)
  }

  if (!orderNumber) return null

  const order = await prisma.erpOrder.findFirst({
    where: { orderNumber },
    select: { orderNumber: true },
  })

  return order?.orderNumber || orderNumber
}

export async function resolveWarrantyHolderName(input: {
  serialNumber?: string | null
  warrantyId?: string | null
  notes?: string | null
}): Promise<string> {
  const orderNumber = await resolveInvoiceNumberForWarranty(input)
  if (!orderNumber) return ""

  const order = await prisma.erpOrder.findFirst({
    where: { orderNumber },
    select: { warrantyHolderName: true },
  })
  return normalizeWarrantyHolderName(order?.warrantyHolderName || "")
}

function serialsFromAllocations(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const serials: string[] = []
  for (const row of raw as OrderFulfillmentSerialAllocation[]) {
    const sn = String(row?.serialNumber || "").trim()
    if (sn) serials.push(sn)
  }
  return serials
}

function isPendingWarrantyRow(row: { activatedAt: Date | null; notes: string | null }) {
  if (row.activatedAt) return false
  const n = (row.notes || "").toLowerCase()
  if (n.includes("warranty activated")) return false
  return true
}

/** Push the order's warranty name onto pending (not-yet-started) warranties for that order. */
export async function syncPendingWarrantiesHolderName(input: {
  orderNumber: string
  warrantyHolderName?: string | null
  fulfillmentSerialAllocations?: unknown
}) {
  const holder = normalizeWarrantyHolderName(input.warrantyHolderName || "") || null
  const serials = serialsFromAllocations(input.fulfillmentSerialAllocations)
  const orderNumber = input.orderNumber.trim()
  if (!orderNumber) return

  const rows = await prisma.erpWarranty.findMany({
    where: {
      OR: [
        { notes: { contains: orderNumber } },
        ...(serials.length > 0
          ? serials.map((sn) => ({ serialNumber: { equals: sn, mode: "insensitive" as const } }))
          : []),
      ],
    },
    select: { id: true, notes: true, activatedAt: true, customerName: true, serialNumber: true },
  })

  const serialKeys = new Set(serials.map((s) => s.toLowerCase()))

  for (const row of rows) {
    if (!isPendingWarrantyRow(row)) continue
    const notesMatch = (row.notes || "").includes(orderNumber)
    const serialMatch = row.serialNumber && serialKeys.has(row.serialNumber.toLowerCase())
    if (!notesMatch && !serialMatch) continue
    if ((row.customerName || "") === (holder || "")) continue
    await prisma.erpWarranty.update({
      where: { id: row.id },
      data: { customerName: holder },
    })
  }
}
