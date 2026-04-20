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
