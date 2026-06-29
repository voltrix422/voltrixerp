import { prisma } from "@/lib/db"
import {
  collectManualProductMatchTerms,
  findManualInventoryByAnyModelOrAlias,
  findBranchInventoryForManualProduct,
  textMatchesAnyProductTerm,
} from "@/lib/inventory-model-aliases"

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

export type ManualInventoryBusinessSummary = {
  deliveredOrderQty: number
  branchHoldingQty: number
  approvedNotDeductedQty: number
  manualSubtractStockQty: number
  calculatedWarehouseAvailable: number
  gapVsCurrent: number
  recommendedAvailable: number
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
  businessSummary: ManualInventoryBusinessSummary
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
  return findManualInventoryByAnyModelOrAlias(model)
}

export async function auditManualInventoryStock(model: string): Promise<ManualInventoryAudit | null> {
  const manual = await findManualInventoryByModel(model)
  if (!manual) return null

  const matchTerms = await collectManualProductMatchTerms(manual)

  const history = await prisma.erpInventoryHistory.findMany({
    orderBy: { createdAt: "asc" },
  })

  const movements: ManualInventoryMovement[] = history
    .filter((row) => textMatchesAnyProductTerm(row.itemDescription || "", matchTerms))
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
      const model = String(item.model || "")
      if (
        !textMatchesAnyProductTerm(description, matchTerms) &&
        !textMatchesAnyProductTerm(model, matchTerms)
      ) {
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

  const branchRows = await findBranchInventoryForManualProduct(manual)
  const branchAssignments = branchRows.map((row) => ({
    quantity: row.quantity,
    productDescription: row.productDescription,
    branchId: row.branchId,
    notes: row.notes || "",
  }))

  const deliveredOrderQty = orderLines
    .filter((line) => line.status === "delivered" && line.inventoryDeductedAt)
    .reduce((sum, line) => sum + line.qty, 0)

  const approvedNotDeductedQty = orderLines
    .filter(
      (line) =>
        line.status === "approved" &&
        !line.inventoryDeductedAt &&
        !line.description.toUpperCase().includes("HS-TL100"),
    )
    .reduce((sum, line) => sum + line.qty, 0)

  const branchHoldingQty = branchAssignments.reduce(
    (sum, row) => sum + (Number(row.quantity) || 0),
    0,
  )

  const manualSubtractStockQty = movements
    .filter((row) => row.type === "out" && row.referenceType === "manual_subtract_stock")
    .reduce((sum, row) => sum + Math.abs(row.quantity), 0)

  const calculatedWarehouseAvailable = Math.max(
    0,
    totalQty - deliveredOrderQty - branchHoldingQty,
  )

  const businessSummary: ManualInventoryBusinessSummary = {
    deliveredOrderQty,
    branchHoldingQty,
    approvedNotDeductedQty,
    manualSubtractStockQty,
    calculatedWarehouseAvailable,
    gapVsCurrent: currentAvailable - calculatedWarehouseAvailable,
    recommendedAvailable: calculatedWarehouseAvailable,
  }

  return {
    model: manual.model,
    name: manual.name,
    manualId: manual.id,
    totalQty,
    currentAvailable,
    committed,
    expectedAvailable,
    discrepancy: currentAvailable - expectedAvailable,
    businessSummary,
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
