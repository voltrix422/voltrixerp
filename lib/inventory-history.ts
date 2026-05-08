// DB access via /api/db routes (Prisma)

export interface InventoryTransaction {
  id: string
  item_description: string
  transaction_type: "in" | "out"
  quantity: number
  unit: string
  reference_type: "po" | "order"
  reference_id: string
  reference_number: string
  notes?: string
  created_at: string
  created_by: string
}

type RawInventoryTransaction = Record<string, unknown>

function normalizeTransaction(row: RawInventoryTransaction): InventoryTransaction {
  return {
    id: String(row.id || ""),
    item_description: String(row.item_description ?? row.itemDescription ?? ""),
    transaction_type: String(row.transaction_type ?? row.transactionType ?? "in") as "in" | "out",
    quantity: Number(row.quantity ?? 0),
    unit: String(row.unit ?? ""),
    reference_type: String(row.reference_type ?? row.referenceType ?? "order") as "po" | "order",
    reference_id: String(row.reference_id ?? row.referenceId ?? ""),
    reference_number: String(row.reference_number ?? row.referenceNumber ?? ""),
    notes: row.notes ? String(row.notes) : undefined,
    created_at: String(row.created_at ?? row.createdAt ?? new Date().toISOString()),
    created_by: String(row.created_by ?? row.createdBy ?? "System"),
  }
}

export async function getInventoryHistory(): Promise<InventoryTransaction[]> {
  try {
    const res = await fetch("/api/db/inventory-history")
    if (!res.ok) return []
    const data = await res.json()
    if (!Array.isArray(data)) return []
    return data.map(normalizeTransaction)
  } catch { return [] }
}

export async function getInventoryHistoryByItem(itemDescription: string): Promise<InventoryTransaction[]> {
  try {
    const res = await fetch(`/api/db/inventory-history?item=${encodeURIComponent(itemDescription)}`)
    if (!res.ok) return []
    const data = await res.json()
    if (!Array.isArray(data)) return []
    return data.map(normalizeTransaction)
  } catch { return [] }
}

export async function logInventoryTransaction(
  itemDescription: string,
  transactionType: "in" | "out",
  quantity: number,
  unit: string,
  referenceType: "po" | "order",
  referenceId: string,
  referenceNumber: string,
  createdBy: string,
  notes?: string
): Promise<void> {
  try {
    const transaction: InventoryTransaction = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      item_description: itemDescription,
      transaction_type: transactionType,
      quantity,
      unit,
      reference_type: referenceType,
      reference_id: referenceId,
      reference_number: referenceNumber,
      notes,
      created_at: new Date().toISOString(),
      created_by: createdBy,
    }
    
    const res = await fetch("/api/db/inventory-history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(transaction),
    })
    if (!res.ok) return
  } catch (err) {
    // Silently ignore all errors
    return
  }
}
