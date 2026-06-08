import type { InventoryTransaction } from "@/lib/inventory-history"

export type InventoryReferenceType =
  | "po"
  | "order"
  | "manual_add"
  | "manual_add_units"
  | "manual_add_stock"
  | "manual_subtract_stock"
  | "manual_subtract_units"
  | "branch"
  | "pos_receive"
  | "pos_sale"
  | "pos_remove"
  | string

export type InventoryMovementRow = InventoryTransaction & {
  movement_label: string
  source: string
  destination: string
  client_name: string
  order_number: string
  is_inbound: boolean
  abs_quantity: number
}

const REFERENCE_LABELS: Record<string, string> = {
  po: "Purchase Order",
  order: "Client Order",
  manual_add: "Manual Entry",
  manual_add_units: "Manual Units Added",
  manual_add_stock: "Manual Stock Added",
  manual_subtract_stock: "Manual Stock Removed",
  manual_subtract_units: "Manual Units Removed",
  branch: "Branch Transfer",
  pos_receive: "POS Receive",
  pos_sale: "POS Sale",
  pos_remove: "POS Product Removed",
}

export function getReferenceTypeLabel(referenceType: string): string {
  return REFERENCE_LABELS[referenceType] || referenceType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

export function isInboundMovement(tx: Pick<InventoryTransaction, "transaction_type">): boolean {
  return tx.transaction_type === "in"
}

export function isOutboundMovement(tx: Pick<InventoryTransaction, "transaction_type">): boolean {
  return (
    tx.transaction_type === "out" ||
    tx.transaction_type === "assigned_to_branch" ||
    tx.transaction_type === "branch_transfer"
  )
}

function resolveSourceDestination(
  tx: InventoryTransaction,
  clientName: string,
): { source: string; destination: string } {
  const ref = tx.reference_type
  const refNum = tx.reference_number || "—"

  if (ref === "po") {
    return { source: `PO ${refNum}`, destination: "Main Warehouse" }
  }
  if (ref === "order") {
    return {
      source: "Main Warehouse",
      destination: clientName ? `Client: ${clientName}` : "Client",
    }
  }
  if (ref.startsWith("manual_add")) {
    return { source: "Manual Entry", destination: "Main Warehouse" }
  }
  if (ref.startsWith("manual_subtract")) {
    return { source: "Main Warehouse", destination: "Adjustment / Removed" }
  }
  if (ref === "pos_receive") {
    return { source: "POS", destination: "Main Warehouse" }
  }
  if (ref === "pos_sale") {
    return { source: "Main Warehouse", destination: "POS Customer" }
  }
  if (ref === "pos_remove") {
    return { source: "Main Warehouse", destination: "POS Removed" }
  }
  if (ref === "branch") {
    if (tx.transaction_type === "assigned_to_branch" || tx.transaction_type === "branch_transfer") {
      return {
        source: tx.transaction_type === "branch_transfer" ? `Branch ${refNum}` : "Main Warehouse",
        destination: `Branch ${refNum}`,
      }
    }
    return { source: "Main Warehouse", destination: `Branch ${refNum}` }
  }

  if (isInboundMovement(tx)) {
    return { source: refNum, destination: "Main Warehouse" }
  }
  return { source: "Main Warehouse", destination: refNum }
}

export function enrichMovement(
  tx: InventoryTransaction,
  orderClientMap: Map<string, string>,
): InventoryMovementRow {
  const clientName =
    tx.reference_type === "order" ? orderClientMap.get(tx.reference_id) || "" : ""
  const { source, destination } = resolveSourceDestination(tx, clientName)
  const inbound = isInboundMovement(tx)

  return {
    ...tx,
    movement_label: inbound ? "IN" : "OUT",
    source,
    destination,
    client_name: clientName,
    order_number: tx.reference_type === "order" ? tx.reference_number : "",
    is_inbound: inbound,
    abs_quantity: Math.abs(tx.quantity),
  }
}

export function enrichMovements(
  transactions: InventoryTransaction[],
  orderClientMap: Map<string, string>,
): InventoryMovementRow[] {
  return transactions.map((tx) => enrichMovement(tx, orderClientMap))
}

export type DateRangePreset = "last_3_days" | "last_week" | "this_month" | "custom"

export function getDateRangeForPreset(
  preset: DateRangePreset,
  customFrom?: string,
  customTo?: string,
): { from: string; to: string } {
  const now = new Date()
  const to = now.toISOString().slice(0, 10)

  if (preset === "custom") {
    return {
      from: customFrom || "",
      to: customTo || to,
    }
  }

  const fromDate = new Date(now)
  if (preset === "last_3_days") {
    fromDate.setDate(fromDate.getDate() - 3)
  } else if (preset === "last_week") {
    fromDate.setDate(fromDate.getDate() - 7)
  } else if (preset === "this_month") {
    fromDate.setDate(1)
  }

  return {
    from: fromDate.toISOString().slice(0, 10),
    to,
  }
}

export function formatMovementDate(iso: string): string {
  return new Date(iso).toLocaleString("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}
