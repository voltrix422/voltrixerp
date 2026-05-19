import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { buildMainWarehouseItems, buildModelLabelMap } from "@/lib/main-warehouse-inventory"

function buildBranchTransferNote(params: {
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

async function saveBranchTransferRecord(data: {
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
    },
  })
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const branchId = searchParams.get("branchId")
  
  if (branchId) {
    const branch = await prisma.erpBranch.findUnique({
      where: { id: branchId }
    })

    if (branch?.type === "main_warehouse") {
      const [units, labels, stock] = await Promise.all([
        prisma.erpInventorySerialUnit.findMany({ orderBy: { scannedAt: "desc" } }),
        prisma.erpInventoryModelLabel.findMany(),
        prisma.erpInventoryStock.findMany({ orderBy: { description: "asc" } }),
      ])

      const labelMap = buildModelLabelMap(
        labels.map((l) => ({ model: l.model, displayName: l.displayName })),
        units.map((u) => ({
          id: u.id,
          serialNumber: u.serialNumber,
          assignedName: u.assignedName,
          productName: u.productName,
          model: u.model,
          specs: u.specs,
          rawPayload: u.rawPayload,
          inventoryStockId: u.inventoryStockId,
          status: u.status,
          notes: u.notes,
          scannedBy: u.scannedBy,
          scannedAt: u.scannedAt.toISOString(),
          createdAt: u.createdAt.toISOString(),
          updatedAt: u.updatedAt.toISOString(),
        })),
      )

      const items = buildMainWarehouseItems(
        units.map((u) => ({
          id: u.id,
          serialNumber: u.serialNumber,
          assignedName: u.assignedName,
          productName: u.productName,
          model: u.model,
          specs: u.specs,
          rawPayload: u.rawPayload,
          inventoryStockId: u.inventoryStockId,
          status: u.status,
          notes: u.notes,
          scannedBy: u.scannedBy,
          scannedAt: u.scannedAt.toISOString(),
          createdAt: u.createdAt.toISOString(),
          updatedAt: u.updatedAt.toISOString(),
        })),
        labelMap,
        stock.map((s) => ({
          id: s.id,
          description: s.description,
          name: s.name,
          unit: s.unit,
          availableQty: s.availableQty,
        })),
      )

      const mainWarehouseRows = items.map((item) => ({
        id: item.id,
        branchId,
        inventoryId: item.inventoryStockId ?? item.id,
        productDescription: item.productDescription,
        quantity: item.quantity,
        inStock: item.inStock,
        totalUnits: item.totalUnits,
        unit: item.unit,
        model: item.model,
        itemName: item.itemName,
        specs: item.specs,
        assignedAt: "",
        assignedBy: "system",
        notes: `${item.inStock}/${item.totalUnits} in stock`,
        canDispatch: Boolean(item.inventoryStockId),
      }))

      return NextResponse.json(mainWarehouseRows)
    }

    const inventory = await prisma.erpBranchInventory.findMany({
      where: { branchId },
      orderBy: { assignedAt: "desc" }
    })
    return NextResponse.json(inventory)
  }
  
  return NextResponse.json([])
}

export async function POST(req: NextRequest) {
  const data = await req.json()
  const {
    branchId,
    inventoryId,
    quantity,
    unit,
    assignedBy,
    notes,
    fromBranchId,
    fromBranchName,
    fromBranchCode,
    userNote,
  } = data
  
  // Check if inventory exists and has enough quantity
  const inventory = await prisma.erpInventoryStock.findUnique({
    where: { id: inventoryId }
  })
  
  if (!inventory) {
    return NextResponse.json({ error: "Inventory item not found" }, { status: 404 })
  }
  
  if (inventory.availableQty < quantity) {
    return NextResponse.json({ error: "Insufficient inventory quantity" }, { status: 400 })
  }

  const destinationBranch = await prisma.erpBranch.findUnique({
    where: { id: branchId },
  })
  if (!destinationBranch) {
    return NextResponse.json({ error: "Destination branch not found" }, { status: 404 })
  }

  const sourceBranch = fromBranchId
    ? await prisma.erpBranch.findUnique({ where: { id: fromBranchId } })
    : null
  const sourceName = sourceBranch?.name || fromBranchName || "Main warehouse"
  const sourceCode = sourceBranch?.code || fromBranchCode || "MAIN"
  const transferNote = buildBranchTransferNote({
    quantity,
    unit: unit || inventory.unit,
    productDescription: inventory.description,
    fromBranchName: sourceName,
    fromBranchCode: sourceCode,
    toBranchName: destinationBranch.name,
    toBranchCode: destinationBranch.code,
    transferredBy: assignedBy || "system",
    userNote: userNote || notes,
  })
  
  // Create branch inventory assignment
  const branchInventory = await prisma.erpBranchInventory.create({
    data: {
      branchId,
      inventoryId,
      productDescription: inventory.description,
      quantity,
      unit: unit || inventory.unit,
      assignedBy: assignedBy || "system",
      notes: notes || ""
    }
  })
  
  // Deduct from main inventory
  await prisma.erpInventoryStock.update({
    where: { id: inventoryId },
    data: {
      availableQty: inventory.availableQty - quantity,
      allocatedQty: inventory.allocatedQty + quantity
    }
  })
  
  // Add to inventory history
  await prisma.erpInventoryHistory.create({
    data: {
      itemDescription: inventory.description,
      transactionType: "assigned_to_branch",
      quantity: -quantity,
      unit: unit || inventory.unit,
      referenceType: "branch",
      referenceId: branchId,
      referenceNumber: data.branchCode || destinationBranch.code,
      notes: transferNote,
      createdBy: assignedBy || "system"
    }
  })

  await saveBranchTransferRecord({
    fromBranchId: fromBranchId || sourceBranch?.id || null,
    fromBranchName: sourceName,
    fromBranchCode: sourceCode,
    toBranchId: destinationBranch.id,
    toBranchName: destinationBranch.name,
    toBranchCode: destinationBranch.code,
    inventoryId,
    productDescription: inventory.description,
    quantity,
    unit: unit || inventory.unit,
    note: transferNote,
    transferredBy: assignedBy || "system",
  })
  
  return NextResponse.json(branchInventory)
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  
  // Get the branch inventory record
  const branchInventory = await prisma.erpBranchInventory.findUnique({
    where: { id }
  })
  
  if (!branchInventory) {
    return NextResponse.json({ error: "Branch inventory not found" }, { status: 404 })
  }
  
  // Restore to main inventory
  await prisma.erpInventoryStock.update({
    where: { id: branchInventory.inventoryId },
    data: {
      availableQty: { increment: branchInventory.quantity },
      allocatedQty: { decrement: branchInventory.quantity }
    }
  })
  
  // Delete branch inventory record
  await prisma.erpBranchInventory.delete({
    where: { id }
  })
  
  return NextResponse.json({ ok: true })
}

export async function PUT(req: NextRequest) {
  const data = await req.json()
  const { fromBranchInventoryId, toBranchId, quantity, transferredBy, notes } = data

  if (!fromBranchInventoryId || !toBranchId || !quantity || quantity <= 0) {
    return NextResponse.json({ error: "Invalid transfer payload" }, { status: 400 })
  }

  const source = await prisma.erpBranchInventory.findUnique({
    where: { id: fromBranchInventoryId }
  })
  if (!source) {
    return NextResponse.json({ error: "Source branch inventory not found" }, { status: 404 })
  }
  if (source.branchId === toBranchId) {
    return NextResponse.json({ error: "Destination branch must be different" }, { status: 400 })
  }
  if (source.quantity < quantity) {
    return NextResponse.json({ error: "Insufficient quantity in source branch" }, { status: 400 })
  }

  const destinationBranch = await prisma.erpBranch.findUnique({
    where: { id: toBranchId }
  })
  if (!destinationBranch) {
    return NextResponse.json({ error: "Destination branch not found" }, { status: 404 })
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
    transferredBy: transferredBy || "system",
    userNote: notes,
  })

  const existingDestination = await prisma.erpBranchInventory.findFirst({
    where: {
      branchId: toBranchId,
      inventoryId: source.inventoryId
    }
  })

  await prisma.$transaction(async tx => {
    await tx.erpBranchInventory.update({
      where: { id: fromBranchInventoryId },
      data: { quantity: { decrement: quantity } }
    })

    if (destinationBranch.type === "main_warehouse") {
      await tx.erpInventoryStock.update({
        where: { id: source.inventoryId },
        data: {
          availableQty: { increment: quantity },
          allocatedQty: { decrement: quantity }
        }
      })
    } else {
      if (existingDestination) {
        await tx.erpBranchInventory.update({
          where: { id: existingDestination.id },
          data: { quantity: { increment: quantity } }
        })
      } else {
        await tx.erpBranchInventory.create({
          data: {
            branchId: toBranchId,
            inventoryId: source.inventoryId,
            productDescription: source.productDescription,
            quantity,
            unit: source.unit,
            assignedBy: transferredBy || "system",
            notes: notes || ""
          }
        })
      }
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
        createdBy: transferredBy || "system"
      }
    })

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
        transferredBy: transferredBy || "system",
      },
    })
  })

  const updatedSource = await prisma.erpBranchInventory.findUnique({
    where: { id: fromBranchInventoryId }
  })
  if (updatedSource && updatedSource.quantity <= 0) {
    await prisma.erpBranchInventory.delete({ where: { id: fromBranchInventoryId } })
  }

  return NextResponse.json({ ok: true })
}
