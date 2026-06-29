import type { InventoryTransaction } from "@/lib/inventory-history"
import { normalizeProductText } from "@/lib/order-product-search"

function parseBranchTransferFromNote(notes?: string | null): {
  fromName: string
  fromCode: string
  toName: string
  toCode: string
} | null {
  if (!notes) return null
  const match = notes.match(
    /from\s+(.+?)\s*\(([^)]+)\)\s+to\s+(.+?)\s*\(([^)]+)\)/i,
  )
  if (!match) return null
  return {
    fromName: match[1].trim(),
    fromCode: match[2].trim(),
    toName: match[3].trim(),
    toCode: match[4].trim(),
  }
}

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
  /** ERP model code when known (e.g. MAN-15-6-KWH-BATTERY-STORAGE) */
  item_model_code?: string
  /** Main warehouse qty for this product before this movement */
  balance_before?: number | null
  /** Main warehouse qty for this product after this movement */
  balance_after?: number | null
}

export type MovementProductCatalog = {
  displayNameByKey: Map<string, string>
  modelCodeByKey: Map<string, string>
  currentMainQtyByKey: Map<string, number>
  keyForDescription: (description: string) => string
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
    const parsed = parseBranchTransferFromNote(tx.notes)
    if (parsed) {
      return {
        source: `${parsed.fromName} (${parsed.fromCode})`,
        destination: `${parsed.toName} (${parsed.toCode})`,
      }
    }
    if (tx.transaction_type === "assigned_to_branch") {
      return { source: "Main Warehouse", destination: `Branch ${refNum}` }
    }
    if (tx.transaction_type === "branch_transfer") {
      return { source: `Branch ${refNum}`, destination: `Branch ${refNum}` }
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

function movementItemKeyFallback(description: string): string {
  const n = normalizeProductText(description)
  if (!n) return "unknown"
  if (
    (n.includes("15.6") || n.includes("15-6")) &&
    n.includes("kwh") &&
    n.includes("battery")
  ) {
    return "product:15-6-kwh-battery"
  }
  if (n.startsWith("man-")) return n
  return n
}

/** Group alias product names (e.g. MAN-15-6… ↔ 15.6 KWh Battery Storage). */
export function movementItemKey(
  description: string,
  catalog?: MovementProductCatalog,
): string {
  if (catalog) return catalog.keyForDescription(description)
  return movementItemKeyFallback(description)
}

/** Map manual inventory items to one display name + model code per product. */
export function buildMovementProductCatalog(
  manualItems: Array<{ name: string; model: string; availableQty?: number }>,
): MovementProductCatalog {
  const displayNameByKey = new Map<string, string>()
  const modelCodeByKey = new Map<string, string>()
  const currentMainQtyByKey = new Map<string, number>()
  const aliasToCanonicalKey = new Map<string, string>()

  for (const manual of manualItems) {
    const model = manual.model.trim()
    const name = manual.name.trim()
    if (!model && !name) continue

    const canonicalKey = `model:${normalizeProductText(model || name)}`
    const displayName = name || model

    displayNameByKey.set(canonicalKey, displayName)
    if (model) modelCodeByKey.set(canonicalKey, model)
    currentMainQtyByKey.set(canonicalKey, manual.availableQty ?? 0)

    for (const alias of [model, name]) {
      const normalized = normalizeProductText(alias)
      if (normalized) aliasToCanonicalKey.set(normalized, canonicalKey)
    }
    const fallbackKey = movementItemKeyFallback(name || model)
    if (fallbackKey !== "unknown") {
      aliasToCanonicalKey.set(fallbackKey, canonicalKey)
    }
  }

  return {
    displayNameByKey,
    modelCodeByKey,
    currentMainQtyByKey,
    keyForDescription(description: string) {
      const normalized = normalizeProductText(description)
      if (!normalized) return "unknown"
      const fromAlias = aliasToCanonicalKey.get(normalized)
      if (fromAlias) return fromAlias
      const fallback = movementItemKeyFallback(description)
      const fromFallback = aliasToCanonicalKey.get(fallback)
      if (fromFallback) return fromFallback
      return fallback
    },
  }
}

/** One friendly name per product line in movement history. */
export function applyMovementCatalog(
  movements: InventoryMovementRow[],
  catalog: MovementProductCatalog,
): InventoryMovementRow[] {
  return movements.map((m) => {
    const key = catalog.keyForDescription(m.item_description)
    const displayName = catalog.displayNameByKey.get(key) ?? m.item_description
    const modelCode = catalog.modelCodeByKey.get(key)
    return {
      ...m,
      item_description: displayName,
      item_model_code: modelCode,
    }
  })
}

function locationIsMainWarehouse(label: string): boolean {
  const n = normalizeProductText(label)
  return (
    n.includes("main warehouse") ||
    n === "br001" ||
    /\bmain\s*warehouse\b/i.test(label)
  )
}

/** Signed change to main-warehouse stock for one movement. */
export function mainWarehouseDelta(m: InventoryMovementRow): number {
  const q = m.abs_quantity
  const fromMain = locationIsMainWarehouse(m.source)
  const toMain = locationIsMainWarehouse(m.destination)

  if (m.reference_type === "po" || m.reference_type.startsWith("manual_add")) {
    return q
  }
  if (m.reference_type === "order") {
    return -q
  }
  if (m.transaction_type === "assigned_to_branch") {
    return -q
  }
  if (m.reference_type === "branch" || m.transaction_type === "branch_transfer") {
    if (fromMain && !toMain) return -q
    if (toMain && !fromMain) return q
    return 0
  }
  if (m.reference_type.startsWith("manual_subtract_stock")) {
    return -q
  }
  if (m.is_inbound) return q
  if (m.is_inbound === false) return -q
  return 0
}

/** Attach main-warehouse before/after qty per product line (uses full history, chronological). */
export function attachMainWarehouseBalances(
  movements: InventoryMovementRow[],
  catalog?: MovementProductCatalog,
): InventoryMovementRow[] {
  const sorted = [...movements].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )

  const keyFor = (description: string) => movementItemKey(description, catalog)
  const currentMainQtyByKey = catalog?.currentMainQtyByKey ?? new Map<string, number>()

  const totalDeltaByKey = new Map<string, number>()
  for (const m of sorted) {
    const key = keyFor(m.item_description)
    totalDeltaByKey.set(key, (totalDeltaByKey.get(key) ?? 0) + mainWarehouseDelta(m))
  }

  const openingByKey = new Map<string, number>()
  for (const [key, totalDelta] of totalDeltaByKey) {
    const current = currentMainQtyByKey.get(key)
    openingByKey.set(key, current != null ? current - totalDelta : 0)
  }

  const running = new Map(openingByKey)
  const balanceById = new Map<string, { before: number; after: number }>()

  for (const m of sorted) {
    const key = keyFor(m.item_description)
    const before = running.get(key) ?? 0
    const after = before + mainWarehouseDelta(m)
    running.set(key, after)
    balanceById.set(m.id, { before, after })
  }

  return movements.map((m) => {
    const b = balanceById.get(m.id)
    if (!b) return m
    return { ...m, balance_before: b.before, balance_after: b.after }
  })
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
