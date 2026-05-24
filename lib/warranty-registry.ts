import type { ErpInventorySerialUnit, ErpWarranty } from "@prisma/client"
import { isWarrantyActivated, isWarrantyPendingActivation } from "@/lib/warranty-activation"

/** True when warranty was auto-created from warehouse QR scan (not yet sold). */
export function isInventoryScanWarranty(notes: string | null | undefined): boolean {
  const n = (notes || "").toLowerCase()
  return (
    n.includes("registered from inventory") ||
    n.includes("inventory qr scan") ||
    n.includes("qr scan")
  )
}

function hasRealCustomer(customerName: string | null | undefined): boolean {
  const customer = (customerName || "").trim()
  return customer.length > 0 && customer !== "-"
}

/**
 * Warranties visible on /website warranty tab: sold/dispatched only, not warehouse stock.
 */
export function isWarrantyRegistryVisible(
  row: {
    customerName?: string | null
    notes?: string | null
    serialNumber?: string | null
    productName?: string | null
    warrantyId?: string | null
    activatedAt?: Date | string | null
  },
  unitStatus?: string | null,
): boolean {
  if (isWarrantyPendingActivation(row.notes)) return false
  if (!isWarrantyActivated(row)) return false

  if (hasRealCustomer(row.customerName)) return true

  const notes = (row.notes || "").toLowerCase()
  if (notes.includes("dispatched on order")) return true

  if (unitStatus === "delivered") return true
  if (unitStatus === "in_stock") return false

  if (isInventoryScanWarranty(row.notes)) return false

  const serialKey = (row.serialNumber || row.productName || "").trim()
  if (serialKey && !hasRealCustomer(row.customerName)) {
    if (/^[A-Z]{2,}[-\dA-Z]+$/i.test(serialKey)) return false
    if (serialKey.startsWith("AEP-") || serialKey.startsWith("HSLD")) return false
  }

  return true
}

export function resolveUnitStatusForWarranty(
  warranty: Pick<ErpWarranty, "warrantyId" | "serialNumber" | "productName">,
  byWarrantyId: Map<string, string>,
  bySerial: Map<string, string>,
): string | null {
  if (warranty.warrantyId) {
    const s = byWarrantyId.get(warranty.warrantyId)
    if (s) return s
  }
  const sn = (warranty.serialNumber || "").trim()
  if (sn) {
    const s = bySerial.get(sn.toLowerCase())
    if (s) return s
  }
  const pn = (warranty.productName || "").trim()
  if (pn) {
    const s = bySerial.get(pn.toLowerCase())
    if (s) return s
  }
  return null
}

export function filterWarrantiesForRegistry<
  T extends Pick<
    ErpWarranty,
    "customerName" | "notes" | "serialNumber" | "productName" | "warrantyId" | "activatedAt"
  >,
>(warranties: T[], units: Pick<ErpInventorySerialUnit, "warrantyId" | "serialNumber" | "status">[]): T[] {
  const byWarrantyId = new Map<string, string>()
  const bySerial = new Map<string, string>()
  for (const u of units) {
    if (u.warrantyId) byWarrantyId.set(u.warrantyId, u.status)
    if (u.serialNumber) bySerial.set(u.serialNumber.toLowerCase(), u.status)
  }

  return warranties.filter((w) =>
    isWarrantyRegistryVisible(w, resolveUnitStatusForWarranty(w, byWarrantyId, bySerial)),
  )
}

/** Delivered/dispatched units whose warranty has not been started yet. */
export function isDeliveredPendingWarranty(
  row: Pick<
    ErpWarranty,
    "customerName" | "notes" | "serialNumber" | "productName" | "warrantyId" | "activatedAt"
  >,
  unitStatus?: string | null,
): boolean {
  if (isWarrantyActivated(row)) return false
  if (unitStatus === "in_stock") return false
  if (isInventoryScanWarranty(row.notes) && !hasRealCustomer(row.customerName)) return false

  if (unitStatus === "delivered") return true

  const notes = (row.notes || "").toLowerCase()
  if (notes.includes("dispatched on order")) return true

  if (hasRealCustomer(row.customerName) && isWarrantyPendingActivation(row.notes)) return true

  return false
}

export function filterDeliveredPendingWarranties<
  T extends Pick<
    ErpWarranty,
    "customerName" | "notes" | "serialNumber" | "productName" | "warrantyId" | "activatedAt"
  >,
>(warranties: T[], units: Pick<ErpInventorySerialUnit, "warrantyId" | "serialNumber" | "status">[]): T[] {
  const byWarrantyId = new Map<string, string>()
  const bySerial = new Map<string, string>()
  for (const u of units) {
    if (u.warrantyId) byWarrantyId.set(u.warrantyId, u.status)
    if (u.serialNumber) bySerial.set(u.serialNumber.toLowerCase(), u.status)
  }

  return warranties.filter((w) =>
    isDeliveredPendingWarranty(w, resolveUnitStatusForWarranty(w, byWarrantyId, bySerial)),
  )
}
