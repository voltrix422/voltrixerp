export type AfterSaleMovementType = "in" | "out"
export type AfterSaleItemCondition = "good" | "faulty" | "unknown"
export type AfterSaleInStatus = "held" | "released"
export type AfterSaleDisposition =
  | "returned_to_customer"
  | "replaced"
  | "to_faulty"
  | "scrap"
  | ""

export type AfterSaleItemMovement = {
  id: string
  movementType: AfterSaleMovementType
  ticketId?: string | null
  ticketNumber?: string | null
  serialNumber: string
  productName: string
  model: string
  condition: AfterSaleItemCondition | string
  customerName: string
  customerPhone?: string | null
  notes: string
  status: AfterSaleInStatus | string
  linkedInId?: string | null
  disposition: AfterSaleDisposition | string
  outSerialNumber?: string | null
  photoUrls: string[]
  createdBy: string
  createdAt: string
  updatedAt: string
}

function normalizeMovement(row: Record<string, unknown>): AfterSaleItemMovement {
  const photos = row.photoUrls
  return {
    id: String(row.id || ""),
    movementType: (String(row.movementType || "in") as AfterSaleMovementType),
    ticketId: row.ticketId ? String(row.ticketId) : null,
    ticketNumber: row.ticketNumber ? String(row.ticketNumber) : null,
    serialNumber: String(row.serialNumber || ""),
    productName: String(row.productName || ""),
    model: String(row.model || ""),
    condition: String(row.condition || "unknown"),
    customerName: String(row.customerName || ""),
    customerPhone: row.customerPhone ? String(row.customerPhone) : null,
    notes: String(row.notes || ""),
    status: String(row.status || "held"),
    linkedInId: row.linkedInId ? String(row.linkedInId) : null,
    disposition: String(row.disposition || ""),
    outSerialNumber: row.outSerialNumber ? String(row.outSerialNumber) : null,
    photoUrls: Array.isArray(photos) ? photos.map(String) : [],
    createdBy: String(row.createdBy || ""),
    createdAt: String(row.createdAt || ""),
    updatedAt: String(row.updatedAt || ""),
  }
}

export async function listAfterSaleItemMovements(params?: {
  ticketId?: string
  movementType?: AfterSaleMovementType
  status?: string
}): Promise<AfterSaleItemMovement[]> {
  const qs = new URLSearchParams()
  if (params?.ticketId) qs.set("ticketId", params.ticketId)
  if (params?.movementType) qs.set("movementType", params.movementType)
  if (params?.status) qs.set("status", params.status)
  const res = await fetch(`/api/db/after-sale-items?${qs.toString()}`, { cache: "no-store" })
  if (!res.ok) throw new Error("Failed to load after-sale items")
  const data = await res.json()
  return Array.isArray(data) ? data.map((row) => normalizeMovement(row)) : []
}

export async function createAfterSaleItemIn(input: {
  ticketId?: string
  ticketNumber?: string
  serialNumber: string
  productName?: string
  model?: string
  condition?: AfterSaleItemCondition
  customerName?: string
  customerPhone?: string
  notes?: string
  photoUrls?: string[]
  createdBy?: string
}): Promise<AfterSaleItemMovement> {
  const res = await fetch("/api/db/after-sale-items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "in", ...input }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || "Failed to record item in")
  return normalizeMovement(data)
}

export async function createAfterSaleItemOut(input: {
  linkedInId: string
  disposition: Exclude<AfterSaleDisposition, "">
  outSerialNumber?: string
  notes?: string
  photoUrls?: string[]
  createdBy?: string
}): Promise<AfterSaleItemMovement> {
  const res = await fetch("/api/db/after-sale-items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "out", ...input }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || "Failed to record item out")
  return normalizeMovement(data)
}
