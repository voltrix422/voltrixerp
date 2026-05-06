import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const branchId = searchParams.get("branchId")
  
  if (branchId) {
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
  const { branchId, inventoryId, quantity, unit, assignedBy, notes } = data
  
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
      referenceNumber: data.branchCode || "N/A",
      notes: `Assigned to branch (${notes || ""})`,
      createdBy: assignedBy || "system"
    }
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

    await tx.erpInventoryHistory.create({
      data: {
        itemDescription: source.productDescription,
        transactionType: "branch_transfer",
        quantity: -quantity,
        unit: source.unit,
        referenceType: "branch",
        referenceId: source.branchId,
        referenceNumber: destinationBranch.code,
        notes: `Transferred to ${destinationBranch.name}${notes ? ` (${notes})` : ""}`,
        createdBy: transferredBy || "system"
      }
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
