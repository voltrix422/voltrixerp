/** True when warranty was auto-created from warehouse QR scan (not yet sold). */
export function isInventoryScanWarranty(notes: string | null | undefined): boolean {
  return (notes || "").includes("Registered from inventory QR scan")
}

/** Warranties visible on the website / warranty manager (sold or manually registered). */
export function isWarrantyRegistryVisible(row: {
  customerName?: string | null
  notes?: string | null
}): boolean {
  const customer = (row.customerName || "").trim()
  if (customer) return true

  const notes = (row.notes || "").toLowerCase()
  if (notes.includes("dispatched on order")) return true

  // Manual "Add Warranty" entries (not from inventory scan)
  if (!isInventoryScanWarranty(row.notes)) return true

  return false
}
