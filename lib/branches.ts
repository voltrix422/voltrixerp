// DB access via /api/db routes (Prisma)

export type BranchType = "outlet" | "store" | "warehouse" | "office"

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
