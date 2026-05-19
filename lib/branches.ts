// DB access via /api/db routes (Prisma)

export type BranchType = "outlet" | "store" | "warehouse" | "branch_warehouse" | "main_warehouse" | "office"

export interface Branch {
  id: string
  name: string
  code: string
  type: BranchType
  address: string
  city: string
  country: string
  phone: string
  email: string
  manager: string
  status: "active" | "inactive"
  notes: string
  createdAt: string
  createdBy: string
}

// ── Branches ────────────────────────────────────────────────────
export async function getBranches(): Promise<Branch[]> {
  try {
    const res = await fetch("/api/db/branches")
    if (!res.ok) return []
    const data = await res.json()
    return (data ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      name: r.name as string,
      code: r.code as string,
      type: r.type as BranchType,
      address: r.address as string,
      city: r.city as string,
      country: r.country as string,
      phone: r.phone as string,
      email: r.email as string,
      manager: r.manager as string,
      status: r.status as "active" | "inactive",
      notes: r.notes as string,
      createdAt: r.createdAt as string,
      createdBy: r.createdBy as string,
    }))
  } catch { return [] }
}

export async function saveBranch(b: Branch): Promise<void> {
  await fetch("/api/db/branches", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(b),
  })
}

export async function deleteBranch(id: string): Promise<void> {
  await fetch("/api/db/branches", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  })
}

export async function generateBranchCode(): Promise<string> {
  try {
    const branches = await getBranches()
    const count = branches.length
    const n = count + 1
    return `BR${String(n).padStart(3, "0")}`
  } catch { return `BR${Date.now()}` }
}

// ── Branch Inventory ────────────────────────────────────────────
export interface BranchInventory {
  id: string
  branchId: string
  inventoryId: string
  productDescription: string
  quantity: number
  unit: string
  assignedAt: string
  assignedBy: string
  notes: string
  model?: string
  itemName?: string
  specs?: string
  inStock?: number
  totalUnits?: number
  canDispatch?: boolean
}

export async function getBranchInventory(branchId: string): Promise<BranchInventory[]> {
  try {
    const res = await fetch(`/api/db/branch-inventory?branchId=${branchId}`)
    if (!res.ok) return []
    const data = await res.json()
    return (data ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      branchId: r.branchId as string,
      inventoryId: r.inventoryId as string,
      productDescription: r.productDescription as string,
      quantity: r.quantity as number,
      unit: r.unit as string,
      assignedAt: r.assignedAt as string,
      assignedBy: r.assignedBy as string,
      notes: r.notes as string,
      model: r.model as string | undefined,
      itemName: r.itemName as string | undefined,
      specs: r.specs as string | undefined,
      inStock: r.inStock as number | undefined,
      totalUnits: r.totalUnits as number | undefined,
      canDispatch: r.canDispatch as boolean | undefined,
    }))
  } catch { return [] }
}

export interface BranchInventoryTransfer {
  id: string
  fromBranchId?: string | null
  fromBranchName: string
  fromBranchCode: string
  toBranchId: string
  toBranchName: string
  toBranchCode: string
  inventoryId: string
  productDescription: string
  quantity: number
  unit: string
  note: string
  transferredBy: string
  transferredAt: string
}

export async function getBranchTransferHistory(branchId: string): Promise<BranchInventoryTransfer[]> {
  try {
    const res = await fetch(`/api/db/branch-transfer-history?branchId=${encodeURIComponent(branchId)}`)
    if (!res.ok) return []
    const data = await res.json()
    return (data ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      fromBranchId: (r.fromBranchId as string | null | undefined) ?? null,
      fromBranchName: r.fromBranchName as string,
      fromBranchCode: r.fromBranchCode as string,
      toBranchId: r.toBranchId as string,
      toBranchName: r.toBranchName as string,
      toBranchCode: r.toBranchCode as string,
      inventoryId: r.inventoryId as string,
      productDescription: r.productDescription as string,
      quantity: r.quantity as number,
      unit: r.unit as string,
      note: r.note as string,
      transferredBy: r.transferredBy as string,
      transferredAt: r.transferredAt as string,
    }))
  } catch { return [] }
}

export async function assignInventoryToBranch(data: {
  branchId: string
  inventoryId: string
  quantity: number
  unit: string
  branchCode: string
  assignedBy: string
  notes: string
  fromBranchId?: string
  fromBranchName?: string
  fromBranchCode?: string
  userNote?: string
}): Promise<void> {
  await fetch("/api/db/branch-inventory", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
}

export async function removeBranchInventory(id: string): Promise<void> {
  await fetch("/api/db/branch-inventory", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  })
}

export async function transferBranchInventory(data: {
  fromBranchInventoryId: string
  toBranchId: string
  quantity: number
  transferredBy: string
  notes?: string
}): Promise<void> {
  await fetch("/api/db/branch-inventory", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
}

export type BatchTransferLine = {
  inventoryId?: string
  fromBranchInventoryId?: string
  quantity: number
  unit?: string
  userNote?: string
}

export async function batchBranchInventoryTransfer(data: {
  mode: "dispatch" | "transfer"
  toBranchId: string
  fromBranchId?: string
  fromBranchName?: string
  fromBranchCode?: string
  destinationBranchCode?: string
  assignedBy: string
  systemNotes?: string
  lines: BatchTransferLine[]
}): Promise<{
  ok: boolean
  succeeded: number
  failed: number
  results: Array<{ ok: boolean; productDescription?: string; error?: string }>
}> {
  const res = await fetch("/api/db/branch-inventory-batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(payload?.error || "Batch transfer failed")
  }
  return payload
}

export async function clearBranchTransferHistory(branchId?: string): Promise<{ deleted: number }> {
  const url = branchId
    ? `/api/db/branch-transfer-history?branchId=${encodeURIComponent(branchId)}`
    : "/api/db/branch-transfer-history?all=true"
  const res = await fetch(url, { method: "DELETE" })
  if (!res.ok) throw new Error("Failed to clear transfer history")
  return res.json()
}

export async function resetBranchInventory(options?: {
  branchId?: string
  returnToMain?: boolean
  clearHistory?: boolean
  all?: boolean
}): Promise<void> {
  const res = await fetch("/api/db/branch-inventory-reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      returnToMain: true,
      clearHistory: true,
      ...options,
    }),
  })
  if (!res.ok) throw new Error("Failed to reset branch inventory")
}
