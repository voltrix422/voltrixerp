import { prisma } from "@/lib/db"

export type ManualInventoryMovement = {
  id: string
  date: string
  type: string
  quantity: number
  referenceType: string
  referenceNumber: string
  notes: string
  createdBy: string
}

export type ManualInventoryAudit = {
  model: string
  name: string
  manualId: string
  totalQty: number
  currentAvailable: number
  committed: number
  expectedAvailable: number
  discrepancy: number
  movements: ManualInventoryMovement[]
  orderLines: Array<{
    orderNumber: string
    status: string
    qty: number
    description: string
    inventoryDeductedAt: string | null
  }>
  branchAssignments: Array<{
    quantity: number
    productDescription: string
    branchId: string
    notes: string
  }>
}

function matchesItem(
  text: string | null | undefined,
  manual: { name: string; model: string },
) {
  const value = (text || "").trim().toLowerCase()
  if (!value) return false
  const name = manual.name.trim().toLowerCase()
  const model = manual.model.trim().toLowerCase()
  return value === name || value === model || value.includes(name) || value.includes(model)
}

function outboundQuantity(row: {
  transactionType: string
  quantity: number
}) {
  const q = Number(row.quantity) || 0
  if (row.transactionType === "assigned_to_branch" || row.transactionType === "branch_transfer") {
    return Math.abs(q)
  }
  if (row.transactionType === "out" || row.transactionType === "manual_subtract_stock") {
    return Math.abs(q)
  }
  return 0
}

export async function findManualInventoryByModel(model: string) {
  const trimmed = model.trim()
  if (!trimmed) return null

  const byModel = await prisma.erpManualInventoryItem.findUnique({
    where: { model: trimmed },
  })
  if (byModel) return byModel

  return prisma.erpManualInventoryItem.findFirst({
    where: {
      OR: [
        { name: { contains: trimmed, mode: "insensitive" } },
        { model: { contains: trimmed, mode: "insensitive" } },
      ],
    },
  })
}

export async function auditManualInventoryStock(model: string): Promise<ManualInventoryAudit | null> {
  const manual = await findManualInventoryByModel(model)
  if (!manual) return null

  const history = await prisma.erpInventoryHistory.findMany({
    orderBy: { createdAt: "asc" },
  })

  const movements: ManualInventoryMovement[] = history
    .filter((row) => matchesItem(row.itemDescription, manual))
    .map((row) => ({
      id: row.id,
      date: row.createdAt.toISOString(),
      type: row.transactionType,
      quantity: Number(row.quantity) || 0,
      referenceType: row.referenceType,
      referenceNumber: row.referenceNumber,
      notes: row.notes || "",
      createdBy: row.createdBy,
    }))

  const totalOutbound = movements.reduce(
    (sum, row) => sum + outboundQuantity({ transactionType: row.type, quantity: row.quantity }),
    0,
  )
  const totalInbound = movements
    .filter((row) => row.type === "in" || row.type === "manual_add_stock")
    .reduce((sum, row) => sum + Math.abs(row.quantity), 0)

  const totalQty = Number(manual.qty) || 0
  const currentAvailable = Number(manual.availableQty) || 0
  const committed = Math.max(0, totalQty - currentAvailable)
  const expectedAvailable = Math.max(0, totalQty - totalOutbound + totalInbound)

  const orders = await prisma.erpOrder.findMany({
    select: {
      orderNumber: true,
      status: true,
      items: true,
      inventoryDeductedAt: true,
    },
  })

  const orderLines: ManualInventoryAudit["orderLines"] = []
  for (const order of orders) {
    const raw = order.items as unknown
    const items = Array.isArray(raw)
      ? raw
      : typeof raw === "string"
        ? JSON.parse(raw)
        : []
    for (const item of items) {
      const description = String(item.description || item.model || "")
      if (!matchesItem(description, manual) && !matchesItem(String(item.model || ""), manual)) {
        continue
      }
      orderLines.push({
        orderNumber: order.orderNumber,
        status: order.status,
        qty: Number(item.qty) || 0,
        description,
        inventoryDeductedAt: order.inventoryDeductedAt
          ? String(order.inventoryDeductedAt)
          : null,
      })
    }
  }

  const branchAssignments = await prisma.erpBranchInventory.findMany({
    where: {
      OR: [
        { productDescription: { equals: manual.model, mode: "insensitive" } },
        { productDescription: { equals: manual.name, mode: "insensitive" } },
        { productDescription: { contains: manual.name, mode: "insensitive" } },
      ],
    },
    select: {
      quantity: true,
      productDescription: true,
      branchId: true,
      notes: true,
    },
  })

  return {
    model: manual.model,
    name: manual.name,
    manualId: manual.id,
    totalQty,
    currentAvailable,
    committed,
    expectedAvailable,
    discrepancy: currentAvailable - expectedAvailable,
    movements,
    orderLines,
    branchAssignments,
  }
}

export async function correctManualInventoryAvailable(input: {
  model: string
  targetAvailable: number
  correctedBy: string
  reason?: string
}) {
  const manual = await findManualInventoryByModel(input.model)
  if (!manual) {
    throw new Error(`Manual inventory not found for model "${input.model}"`)
  }

  const target = Math.max(0, Math.floor(Number(input.targetAvailable)))
  if (!Number.isFinite(target)) {
    throw new Error("Invalid target available quantity")
  }
  if (target > (manual.qty ?? 0)) {
    throw new Error(`Target ${target} exceeds total qty ${manual.qty}`)
  }

  const before = Number(manual.availableQty) || 0
  if (before === target) {
    return {
      ok: true,
      changed: false,
      before,
      after: target,
      model: manual.model,
      name: manual.name,
    }
  }

  const updated = await prisma.erpManualInventoryItem.update({
    where: { id: manual.id },
    data: { availableQty: target },
  })

  if (manual.inventoryStockId) {
    await prisma.erpInventoryStock.update({
      where: { id: manual.inventoryStockId },
      data: { availableQty: target },
    })
  }

  const delta = target - before
  await prisma.erpInventoryHistory.create({
    data: {
      itemDescription: manual.name,
      transactionType: delta >= 0 ? "in" : "out",
      quantity: Math.abs(delta),
      unit: manual.unit || "pcs",
      referenceType: "manual_reconcile",
      referenceId: manual.id,
      referenceNumber: manual.model,
      notes:
        input.reason ||
        `Stock reconcile: adjusted available from ${before} to ${target} (${delta >= 0 ? "+" : ""}${delta})`,
      createdBy: input.correctedBy,
    },
  })

  return {
    ok: true,
    changed: true,
    before,
    after: target,
    delta,
    model: updated.model,
    name: updated.name,
  }
}
