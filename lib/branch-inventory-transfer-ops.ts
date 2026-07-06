import { randomUUID } from "crypto"
import { prisma } from "@/lib/db"
import { buildBatchTransferSummary } from "@/lib/branch-transfer-history-display"
import {
  allocateSerialUnitsForBranchDispatch,
  countInStockSerialsForModel,
  ensureInventoryStockForModel,
} from "@/lib/ensure-model-stock-link"
import {
  decrementManualInventoryByModel,
  restoreManualInventoryByStockId,
  resolveManualInventoryForBranchDispatch,
} from "@/lib/manual-inventory-server"

/** Add qty to an existing branch line or create one — avoids duplicate rows per product. */
export async function upsertBranchInventoryAssignment(params: {
  branchId: string
  inventoryId: string
  productDescription: string
  quantity: number
  unit: string
  assignedBy: string
  notes?: string
}) {
  const productDescription = params.productDescription.trim()
  const existing = await prisma.erpBranchInventory.findFirst({
    where: {
      branchId: params.branchId,
      productDescription: { equals: productDescription, mode: "insensitive" },
    },
    orderBy: { assignedAt: "asc" },
  })

  if (existing) {
    return prisma.erpBranchInventory.update({
      where: { id: existing.id },
      data: {
        quantity: { increment: params.quantity },
        inventoryId: params.inventoryId || existing.inventoryId,
        assignedBy: params.assignedBy,
        notes: params.notes?.trim() || existing.notes,
      },
    })
  }

  return prisma.erpBranchInventory.create({
    data: {
      branchId: params.branchId,
      inventoryId: params.inventoryId,
      productDescription,
      quantity: params.quantity,
      unit: params.unit,
      assignedBy: params.assignedBy,
      notes: params.notes?.trim() || "",
    },
  })
}

export function buildBranchTransferNote(params: {
  quantity: number
  unit: string
  productDescription: string
  fromBranchName: string
  fromBranchCode: string
  toBranchName: string
  toBranchCode: string
  transferredBy: string
  userNote?: string
}) {
  const base = `Sent ${params.quantity} ${params.unit} of "${params.productDescription}" from ${params.fromBranchName} (${params.fromBranchCode}) to ${params.toBranchName} (${params.toBranchCode}) by ${params.transferredBy}.`
  const trimmed = params.userNote?.trim()
  return trimmed ? `${base} Note: ${trimmed}` : base
}

export async function saveBranchTransferRecord(data: {
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
  transferBatchId?: string | null
}) {
  await prisma.erpBranchInventoryTransfer.create({
    data: {
      fromBranchId: data.fromBranchId || null,
      fromBranchName: data.fromBranchName,
      fromBranchCode: data.fromBranchCode,
      toBranchId: data.toBranchId,
      toBranchName: data.toBranchName,
      toBranchCode: data.toBranchCode,
      inventoryId: data.inventoryId,
      productDescription: data.productDescription,
      quantity: data.quantity,
      unit: data.unit,
      note: data.note,
      transferredBy: data.transferredBy,
      transferBatchId: data.transferBatchId || null,
    },
  })
}

export type BatchTransferLineResult = {
  inventoryId: string
  productDescription: string
  quantity: number
  unit: string
  userNote?: string
}

export async function saveCombinedBatchTransferRecord(params: {
  fromBranchId?: string | null
  fromBranchName: string
  fromBranchCode: string
  toBranchId: string
  toBranchName: string
  toBranchCode: string
  transferredBy: string
  systemNotes?: string
  lines: BatchTransferLineResult[]
  transferBatchId?: string
}) {
  if (params.lines.length === 0) return null

  const transferBatchId = params.transferBatchId || randomUUID()
  const totalQty = params.lines.reduce((sum, line) => sum + line.quantity, 0)
  const unit = params.lines.every((line) => line.unit === params.lines[0].unit)
    ? params.lines[0].unit
    : "pcs"

  const productDescription =
    params.lines.length === 1
      ? params.lines[0].productDescription
      : `${params.lines.length} ${params.lines.length === 1 ? "product" : "products"} (${totalQty} ${unit} total)`

  const note =
    params.lines.length === 1
      ? buildBranchTransferNote({
          quantity: params.lines[0].quantity,
          unit: params.lines[0].unit,
          productDescription: params.lines[0].productDescription,
          fromBranchName: params.fromBranchName,
          fromBranchCode: params.fromBranchCode,
          toBranchName: params.toBranchName,
          toBranchCode: params.toBranchCode,
          transferredBy: params.transferredBy,
          userNote: params.lines[0].userNote || params.systemNotes,
        })
      : buildBatchTransferSummary({
          fromBranchName: params.fromBranchName,
          fromBranchCode: params.fromBranchCode,
          toBranchName: params.toBranchName,
          toBranchCode: params.toBranchCode,
          transferredBy: params.transferredBy,
          systemNotes: params.systemNotes,
          lines: params.lines.map((line) => ({
            productDescription: line.productDescription,
            quantity: line.quantity,
            unit: line.unit,
            userNote: line.userNote,
          })),
        })

  await saveBranchTransferRecord({
    fromBranchId: params.fromBranchId,
    fromBranchName: params.fromBranchName,
    fromBranchCode: params.fromBranchCode,
    toBranchId: params.toBranchId,
    toBranchName: params.toBranchName,
    toBranchCode: params.toBranchCode,
    inventoryId: params.lines[0].inventoryId,
    productDescription,
    quantity: params.lines.length === 1 ? params.lines[0].quantity : totalQty,
    unit: params.lines.length === 1 ? params.lines[0].unit : unit,
    note,
    transferredBy: params.transferredBy,
    transferBatchId,
  })

  return transferBatchId
}

export type DispatchLineInput = {
  inventoryId?: string
  model?: string
  productName?: string
  quantity: number
  unit?: string
  userNote?: string
}

export async function executeDispatchLine(params: {
  destinationBranchId: string
  destinationBranchCode: string
  fromBranchId?: string
  fromBranchName: string
  fromBranchCode: string
  assignedBy: string
  systemNotes?: string
  line: DispatchLineInput
  skipTransferHistory?: boolean
}) {
  const { line, destinationBranchId, destinationBranchCode, assignedBy } = params
  const quantity = line.quantity

  let stockId = line.inventoryId?.trim() || ""
  let modelKey = line.model?.trim() || ""

  if ((!stockId || stockId.startsWith("wh:")) && modelKey) {
    const ensured = await ensureInventoryStockForModel(
      modelKey,
      line.productName,
      line.unit || "pcs",
    )
    stockId = ensured.stock.id
    if (ensured.inStockCount < quantity) {
      throw new Error(
        `Insufficient stock for "${modelKey}" (available: ${ensured.inStockCount})`,
      )
    }
  } else if (stockId && !modelKey) {
    const linked = await prisma.erpInventorySerialUnit.findFirst({
      where: { inventoryStockId: stockId },
      select: { model: true },
    })
    if (linked?.model) modelKey = linked.model
  }

  if (!stockId) {
    throw new Error("Missing inventory item or model for dispatch")
  }

  let inventory = await prisma.erpInventoryStock.findUnique({
    where: { id: stockId },
  })
  if (!inventory) {
    throw new Error(`Stock item not found: ${stockId}`)
  }

  const manualItem = await resolveManualInventoryForBranchDispatch({
    modelKey,
    stockId,
    productName: line.productName || inventory.description,
  })
  if (manualItem) {
    modelKey = manualItem.model
    if (manualItem.inventoryStockId && manualItem.inventoryStockId !== stockId) {
      stockId = manualItem.inventoryStockId
      inventory =
        (await prisma.erpInventoryStock.findUnique({ where: { id: stockId } })) ?? inventory
    }
  }

  const serialInStock = modelKey ? await countInStockSerialsForModel(modelKey) : 0

  let effectiveAvailable = inventory.availableQty
  if (modelKey) {
    if (serialInStock > 0) {
      effectiveAvailable = serialInStock
    } else if (manualItem) {
      effectiveAvailable = manualItem.availableQty ?? 0
    }
  }

  if (effectiveAvailable < quantity) {
    throw new Error(
      `Insufficient stock for "${inventory.description}" (available: ${effectiveAvailable})`,
    )
  }

  if (modelKey) {
    await ensureInventoryStockForModel(modelKey, line.productName || inventory.description, inventory.unit)
  }

  const destinationBranch = await prisma.erpBranch.findUnique({
    where: { id: destinationBranchId },
  })
  if (!destinationBranch) {
    throw new Error("Destination branch not found")
  }

  const transferNote = buildBranchTransferNote({
    quantity,
    unit: line.unit || inventory.unit,
    productDescription: inventory.description,
    fromBranchName: params.fromBranchName,
    fromBranchCode: params.fromBranchCode,
    toBranchName: destinationBranch.name,
    toBranchCode: destinationBranch.code,
    transferredBy: assignedBy,
    userNote: line.userNote || params.systemNotes,
  })

  await upsertBranchInventoryAssignment({
    branchId: destinationBranchId,
    inventoryId: stockId,
    productDescription: manualItem?.model || inventory.description,
    quantity,
    unit: line.unit || inventory.unit,
    assignedBy,
    notes: params.systemNotes || "",
  })

  if (modelKey && serialInStock >= quantity) {
    await allocateSerialUnitsForBranchDispatch({
      model: modelKey,
      inventoryStockId: stockId,
      quantity,
      branchCode: destinationBranchCode || destinationBranch?.code || "",
    })
    const remaining = await countInStockSerialsForModel(modelKey)
    await prisma.erpInventoryStock.update({
      where: { id: stockId },
      data: {
        availableQty: remaining,
        allocatedQty: { increment: quantity },
      },
    })
    if (manualItem) {
      await decrementManualInventoryByModel(modelKey, quantity)
    }
  } else if (manualItem) {
    await decrementManualInventoryByModel(modelKey, quantity)
    await prisma.erpInventoryStock.update({
      where: { id: stockId },
      data: { allocatedQty: { increment: quantity } },
    })
  } else {
    await prisma.erpInventoryStock.update({
      where: { id: stockId },
      data: {
        availableQty: inventory.availableQty - quantity,
        allocatedQty: inventory.allocatedQty + quantity,
      },
    })
  }

  await prisma.erpInventoryHistory.create({
    data: {
      itemDescription: inventory.description,
      transactionType: "assigned_to_branch",
      quantity: -quantity,
      unit: line.unit || inventory.unit,
      referenceType: "branch",
      referenceId: destinationBranchId,
      referenceNumber: destinationBranchCode || destinationBranch.code,
      notes: transferNote,
      createdBy: assignedBy,
    },
  })

  if (!params.skipTransferHistory) {
    await saveBranchTransferRecord({
      fromBranchId: params.fromBranchId || null,
      fromBranchName: params.fromBranchName,
      fromBranchCode: params.fromBranchCode,
      toBranchId: destinationBranch.id,
      toBranchName: destinationBranch.name,
      toBranchCode: destinationBranch.code,
      inventoryId: stockId,
      productDescription: manualItem?.model || inventory.description,
      quantity,
      unit: line.unit || inventory.unit,
      note: transferNote,
      transferredBy: assignedBy,
    })
  }

  return {
    productDescription: inventory.description,
    quantity,
    inventoryId: stockId,
    unit: line.unit || inventory.unit,
    userNote: line.userNote,
  }
}

export type TransferLineInput = {
  fromBranchInventoryId: string
  quantity: number
  userNote?: string
}

export async function executeTransferLine(params: {
  toBranchId: string
  transferredBy: string
  line: TransferLineInput
  skipTransferHistory?: boolean
}) {
  const { line, toBranchId, transferredBy } = params
  const quantity = line.quantity

  const source = await prisma.erpBranchInventory.findUnique({
    where: { id: line.fromBranchInventoryId },
  })
  if (!source) {
    throw new Error("Source branch inventory not found")
  }
  if (source.branchId === toBranchId) {
    throw new Error("Destination branch must be different")
  }
  if (source.quantity < quantity) {
    throw new Error(
      `Insufficient quantity for "${source.productDescription}" (available: ${source.quantity})`,
    )
  }

  const destinationBranch = await prisma.erpBranch.findUnique({
    where: { id: toBranchId },
  })
  if (!destinationBranch) {
    throw new Error("Destination branch not found")
  }

  const sourceBranch = await prisma.erpBranch.findUnique({
    where: { id: source.branchId },
  })

  const transferNote = buildBranchTransferNote({
    quantity,
    unit: source.unit,
    productDescription: source.productDescription,
    fromBranchName: sourceBranch?.name || "Branch warehouse",
    fromBranchCode: sourceBranch?.code || "N/A",
    toBranchName: destinationBranch.name,
    toBranchCode: destinationBranch.code,
    transferredBy,
    userNote: line.userNote,
  })

  const existingDestination = await prisma.erpBranchInventory.findFirst({
    where: {
      branchId: toBranchId,
      productDescription: { equals: source.productDescription, mode: "insensitive" },
    },
    orderBy: { assignedAt: "asc" },
  })

  await prisma.$transaction(async (tx) => {
    await tx.erpBranchInventory.update({
      where: { id: line.fromBranchInventoryId },
      data: { quantity: { decrement: quantity } },
    })

    if (destinationBranch.type === "main_warehouse") {
      const restoredManual = await restoreManualInventoryByStockId(
        source.inventoryId,
        quantity,
        tx,
      )
      if (restoredManual) {
        await tx.erpInventoryStock.update({
          where: { id: source.inventoryId },
          data: { allocatedQty: { decrement: quantity } },
        })
      } else {
        await tx.erpInventoryStock.update({
          where: { id: source.inventoryId },
          data: {
            availableQty: { increment: quantity },
            allocatedQty: { decrement: quantity },
          },
        })
      }
    } else if (existingDestination) {
      await tx.erpBranchInventory.update({
        where: { id: existingDestination.id },
        data: {
          quantity: { increment: quantity },
          inventoryId: source.inventoryId,
        },
      })
    } else {
      await tx.erpBranchInventory.create({
        data: {
          branchId: toBranchId,
          inventoryId: source.inventoryId,
          productDescription: source.productDescription,
          quantity,
          unit: source.unit,
          assignedBy: transferredBy,
          notes: line.userNote?.trim() || "",
        },
      })
    }

    await tx.erpInventoryHistory.create({
      data: {
        itemDescription: source.productDescription,
        transactionType: "branch_transfer",
        quantity: -quantity,
        unit: source.unit,
        referenceType: "branch",
        referenceId: source.branchId,
        referenceNumber: destinationBranch.code,
        notes: transferNote,
        createdBy: transferredBy,
      },
    })

    if (!params.skipTransferHistory) {
      await tx.erpBranchInventoryTransfer.create({
        data: {
          fromBranchId: source.branchId,
          fromBranchName: sourceBranch?.name || "Branch warehouse",
          fromBranchCode: sourceBranch?.code || "N/A",
          toBranchId: destinationBranch.id,
          toBranchName: destinationBranch.name,
          toBranchCode: destinationBranch.code,
          inventoryId: source.inventoryId,
          productDescription: source.productDescription,
          quantity,
          unit: source.unit,
          note: transferNote,
          transferredBy,
        },
      })
    }
  })

  const updatedSource = await prisma.erpBranchInventory.findUnique({
    where: { id: line.fromBranchInventoryId },
  })
  if (updatedSource && updatedSource.quantity <= 0) {
    await prisma.erpBranchInventory.delete({ where: { id: line.fromBranchInventoryId } })
  }

  return {
    productDescription: source.productDescription,
    quantity,
    inventoryId: source.inventoryId,
    unit: source.unit,
    userNote: line.userNote,
  }
}
