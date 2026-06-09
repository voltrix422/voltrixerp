// DB access via /api/db routes (Prisma)

export type InventoryTransactionType =
  | "in"
  | "out"
  | "assigned_to_branch"
  | "branch_transfer"

export interface InventoryTransaction {
  id: string
  item_description: string
  transaction_type: InventoryTransactionType | string
  quantity: number
  unit: string
  reference_type: string
  reference_id: string
  reference_number: string
  notes?: string
  stock_before?: number | null
  stock_after?: number | null
  location_label?: string | null
  created_at: string
  created_by: string
}

export type InventoryHistoryFilters = {
  from?: string
  to?: string
  type?: "all" | "in" | "out"
  referenceType?: string
  item?: string
  referenceId?: string
}

type RawInventoryTransaction = Record<string, unknown>

function normalizeTransaction(row: RawInventoryTransaction): InventoryTransaction {
  return {
    id: String(row.id || ""),
    item_description: String(row.item_description ?? row.itemDescription ?? ""),
    transaction_type: String(row.transaction_type ?? row.transactionType ?? "in"),
    quantity: Number(row.quantity ?? 0),
    unit: String(row.unit ?? ""),
    reference_type: String(row.reference_type ?? row.referenceType ?? "order"),
    reference_id: String(row.reference_id ?? row.referenceId ?? ""),
    reference_number: String(row.reference_number ?? row.referenceNumber ?? ""),
    notes: row.notes ? String(row.notes) : undefined,
    stock_before:
      row.stock_before != null
        ? Number(row.stock_before)
        : row.stockBefore != null
          ? Number(row.stockBefore)
          : null,
    stock_after:
      row.stock_after != null
        ? Number(row.stock_after)
        : row.stockAfter != null
          ? Number(row.stockAfter)
          : null,
    location_label:
      row.location_label != null
        ? String(row.location_label)
        : row.locationLabel != null
          ? String(row.locationLabel)
          : null,
    created_at: String(row.created_at ?? row.createdAt ?? new Date().toISOString()),
    created_by: String(row.created_by ?? row.createdBy ?? "System"),
  }
}

function buildHistoryQuery(filters?: InventoryHistoryFilters): string {
  const params = new URLSearchParams()
  if (filters?.from) params.set("from", filters.from)
  if (filters?.to) params.set("to", filters.to)
  if (filters?.type && filters.type !== "all") params.set("type", filters.type)
  if (filters?.referenceType) params.set("referenceType", filters.referenceType)
  if (filters?.item) params.set("item", filters.item)
  if (filters?.referenceId) params.set("referenceId", filters.referenceId)
  const qs = params.toString()
  return qs ? `?${qs}` : ""
}

export async function getInventoryHistory(filters?: InventoryHistoryFilters): Promise<InventoryTransaction[]> {
  try {
    const res = await fetch(`/api/db/inventory-history${buildHistoryQuery(filters)}`)
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
  referenceType: string,
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
