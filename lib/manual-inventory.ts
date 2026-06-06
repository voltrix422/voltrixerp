export type ManualInventorySerialUnit = {
  id: string
  serialNumber: string
  status: string
  notes: string
  specs: string
  scannedAt: string
}

export type ManualInventoryItem = {
  id: string
  name: string
  model: string
  qty: number
  availableQty: number
  unit: string
  notes: string
  inventoryStockId: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
  lastAddedAt?: string | null
  serialUnits?: ManualInventorySerialUnit[]
}

export function manualInventoryItemId(manualId: string) {
  return `man:${manualId}`
}

export async function getManualInventoryItems(): Promise<ManualInventoryItem[]> {
  const res = await fetch("/api/db/manual-inventory", { cache: "no-store" })
  if (!res.ok) throw new Error("Failed to load manual inventory")
  return res.json()
}

export async function createManualInventoryItem(input: {
  name: string
  qty: number
  unit?: string
  notes?: string
  createdBy?: string
  serialNumbers?: string[]
}): Promise<ManualInventoryItem> {
  const res = await fetch("/api/db/manual-inventory", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || "Failed to add item")
  return data
}

export async function updateManualInventoryItem(
  id: string,
  patch: Partial<Pick<ManualInventoryItem, "name" | "qty" | "availableQty" | "unit" | "notes">>,
): Promise<ManualInventoryItem> {
  const res = await fetch("/api/db/manual-inventory", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, ...patch }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || "Failed to update item")
  return data
}

export async function deleteManualInventoryItem(id: string): Promise<void> {
  const res = await fetch("/api/db/manual-inventory", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || "Failed to delete item")
  }
}

export async function reserveManualInventoryQty(
  items: Array<{ manualId: string; qty: number }>,
): Promise<void> {
  const res = await fetch("/api/db/manual-inventory", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "reserve", items }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || "Could not reserve stock")
}

export async function addManualInventoryQty(input: {
  manualId: string
  qty: number
  addedBy?: string
  notes?: string
}): Promise<ManualInventoryItem> {
  const res = await fetch("/api/db/manual-inventory", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "add_qty",
      manualId: input.manualId,
      qty: input.qty,
      addedBy: input.addedBy,
      notes: input.notes,
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || "Could not add quantity")
  return data
}

export async function subtractManualInventoryStock(input: {
  manualId: string
  qty: number
  subtractedBy?: string
  notes?: string
}): Promise<ManualInventoryItem> {
  const res = await fetch("/api/db/manual-inventory", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "subtract_stock",
      manualId: input.manualId,
      qty: input.qty,
      subtractedBy: input.subtractedBy,
      notes: input.notes,
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || "Could not subtract stock")
  return data
}

export async function subtractManualInventoryUnits(input: {
  manualId: string
  qty: number
  subtractedBy?: string
  notes?: string
}): Promise<ManualInventoryItem> {
  const res = await fetch("/api/db/manual-inventory", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "subtract_units",
      manualId: input.manualId,
      qty: input.qty,
      subtractedBy: input.subtractedBy,
      notes: input.notes,
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || "Could not subtract units")
  return data
}
