export type FaultyInventoryGroup = {
  modelKey: string
  displayName: string
  unit: string
  faultyQty: number
  serialUnits: Array<{
    id: string
    serialNumber: string
    status: string
    notes: string
    scannedAt: string
  }>
  manualId?: string
  stockId?: string
  isManual: boolean
}

async function postFaultyAction(body: Record<string, unknown>) {
  const res = await fetch("/api/db/faulty-inventory", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || "Faulty inventory action failed")
  return data
}

export async function getFaultyInventory(): Promise<{
  groups: FaultyInventoryGroup[]
  totalFaultyQty: number
}> {
  const res = await fetch("/api/db/faulty-inventory", { cache: "no-store" })
  if (!res.ok) throw new Error("Failed to load faulty inventory")
  return res.json()
}

export async function markSerialUnitFaulty(input: {
  unitId: string
  actor?: string
  notes?: string
}) {
  return postFaultyAction({
    action: "mark_serial_faulty",
    unitId: input.unitId,
    actor: input.actor,
    notes: input.notes,
  })
}

export async function restoreSerialFromFaulty(input: { unitId: string; actor?: string }) {
  return postFaultyAction({
    action: "restore_serial",
    unitId: input.unitId,
    actor: input.actor,
  })
}

export async function moveManualQtyToFaulty(input: {
  manualId: string
  qty: number
  actor?: string
  notes?: string
}) {
  return postFaultyAction({
    action: "move_manual_to_faulty",
    manualId: input.manualId,
    qty: input.qty,
    actor: input.actor,
    notes: input.notes,
  })
}

export async function restoreManualQtyFromFaulty(input: {
  manualId: string
  qty: number
  actor?: string
  notes?: string
}) {
  return postFaultyAction({
    action: "restore_manual",
    manualId: input.manualId,
    qty: input.qty,
    actor: input.actor,
    notes: input.notes,
  })
}

export async function moveStockQtyToFaulty(input: {
  stockId: string
  qty: number
  actor?: string
  notes?: string
}) {
  return postFaultyAction({
    action: "move_stock_to_faulty",
    stockId: input.stockId,
    qty: input.qty,
    actor: input.actor,
    notes: input.notes,
  })
}

export async function restoreStockQtyFromFaulty(input: {
  stockId: string
  qty: number
  actor?: string
  notes?: string
}) {
  return postFaultyAction({
    action: "restore_stock",
    stockId: input.stockId,
    qty: input.qty,
    actor: input.actor,
    notes: input.notes,
  })
}
