export interface InventorySerialUnit {
  id: string
  serialNumber: string
  assignedName: string
  productName: string
  model: string
  specs: string
  rawPayload: string
  inventoryStockId?: string | null
  warrantyId?: string | null
  warrantyStartDate?: string | null
  warrantyEndDate?: string | null
  status: string
  notes: string
  scannedBy: string
  scannedAt: string
  createdAt: string
  updatedAt: string
}

export interface WarrantyClaim {
  id: string
  unitId: string
  serialNumber: string
  claimReason: string
  status: string
  notes: string
  claimedBy: string
  reviewedBy?: string | null
  reviewedAt?: string | null
  createdAt: string
}

function mapSerialUnit(row: Record<string, unknown>): InventorySerialUnit {
  return {
    id: String(row.id),
    serialNumber: String(row.serialNumber ?? ""),
    assignedName: String(row.assignedName ?? ""),
    productName: String(row.productName ?? ""),
    model: String(row.model ?? ""),
    specs: String(row.specs ?? ""),
    rawPayload: String(row.rawPayload ?? ""),
    inventoryStockId: (row.inventoryStockId as string | null | undefined) ?? null,
    warrantyId: (row.warrantyId as string | null | undefined) ?? null,
    warrantyStartDate: row.warrantyStartDate ? String(row.warrantyStartDate) : null,
    warrantyEndDate: row.warrantyEndDate ? String(row.warrantyEndDate) : null,
    status: String(row.status ?? "in_stock"),
    notes: String(row.notes ?? ""),
    scannedBy: String(row.scannedBy ?? "system"),
    scannedAt: String(row.scannedAt ?? new Date().toISOString()),
    createdAt: String(row.createdAt ?? new Date().toISOString()),
    updatedAt: String(row.updatedAt ?? new Date().toISOString()),
  }
}

function mapWarrantyClaim(row: Record<string, unknown>): WarrantyClaim {
  return {
    id: String(row.id),
    unitId: String(row.unitId ?? ""),
    serialNumber: String(row.serialNumber ?? ""),
    claimReason: String(row.claimReason ?? ""),
    status: String(row.status ?? "pending"),
    notes: String(row.notes ?? ""),
    claimedBy: String(row.claimedBy ?? "system"),
    reviewedBy: (row.reviewedBy as string | null | undefined) ?? null,
    reviewedAt: row.reviewedAt ? String(row.reviewedAt) : null,
    createdAt: String(row.createdAt ?? new Date().toISOString()),
  }
}

export async function getInventorySerialUnits(inventoryStockId?: string): Promise<InventorySerialUnit[]> {
  const url = inventoryStockId
    ? `/api/db/inventory-serial-units?inventoryStockId=${encodeURIComponent(inventoryStockId)}`
    : "/api/db/inventory-serial-units"
  const res = await fetch(url)
  if (!res.ok) throw new Error("Failed to fetch scanned units")
  const data = await res.json()
  return (data ?? []).map(mapSerialUnit)
}

export async function saveInventorySerialUnit(data: {
  serialNumber: string
  assignedName?: string
  productName?: string
  model?: string
  specs?: string
  rawPayload?: string
  inventoryStockId?: string
  notes?: string
  scannedBy: string
  createWarranty?: boolean
}): Promise<InventorySerialUnit> {
  const res = await fetch("/api/db/inventory-serial-units", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}))
    throw new Error(payload?.error || "Failed to save scanned unit")
  }
  return mapSerialUnit(await res.json())
}

export async function updateInventorySerialUnit(data: {
  id: string
  assignedName?: string
  inventoryStockId?: string | null
  notes?: string
  status?: string
}): Promise<InventorySerialUnit> {
  const res = await fetch("/api/db/inventory-serial-units", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to update scanned unit")
  return mapSerialUnit(await res.json())
}

export async function getWarrantyClaims(serialNumber?: string): Promise<WarrantyClaim[]> {
  const url = serialNumber
    ? `/api/db/warranty-claims?serialNumber=${encodeURIComponent(serialNumber)}`
    : "/api/db/warranty-claims"
  const res = await fetch(url)
  if (!res.ok) throw new Error("Failed to fetch warranty claims")
  const data = await res.json()
  return (data ?? []).map(mapWarrantyClaim)
}

export async function createWarrantyClaim(data: {
  unitId: string
  serialNumber: string
  claimReason: string
  notes?: string
  claimedBy: string
}): Promise<WarrantyClaim> {
  const res = await fetch("/api/db/warranty-claims", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to create warranty claim")
  return mapWarrantyClaim(await res.json())
}

export async function reviewWarrantyClaim(data: {
  id: string
  status: "approved" | "rejected" | "closed"
  reviewedBy: string
  notes?: string
}): Promise<WarrantyClaim> {
  const res = await fetch("/api/db/warranty-claims", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to update warranty claim")
  return mapWarrantyClaim(await res.json())
}
