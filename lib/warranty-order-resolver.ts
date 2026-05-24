import { prisma } from "@/lib/db"

export function parseOrderNumberFromWarrantyNotes(notes: string | null | undefined): string | null {
  const n = notes || ""
  const dispatched = n.match(/dispatched on order\s+([^\s.]+)/i)
  if (dispatched?.[1]?.trim()) return dispatched[1].trim()

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
