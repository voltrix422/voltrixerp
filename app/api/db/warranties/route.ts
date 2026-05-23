import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { isWarrantyRegistryVisible } from "@/lib/warranty-registry"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const includeInventory = searchParams.get("includeInventory") === "1"

  const warranties = await prisma.erpWarranty.findMany({
    orderBy: { soldDate: "desc" },
  })

  const visible = includeInventory
    ? warranties
    : warranties.filter((w) => isWarrantyRegistryVisible(w))

  return NextResponse.json(visible)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  
  try {
    if (body.id) {
      // Update existing warranty
      const warranty = await prisma.erpWarranty.update({
        where: { id: body.id },
        data: {
          productName: body.productName,
          soldDate: body.soldDate,
          warrantyStartDate: body.warrantyStartDate,
          warrantyEndDate: body.warrantyEndDate,
          customerName: body.customerName,
          customerEmail: body.customerEmail,
          customerPhone: body.customerPhone,
          notes: body.notes,
        },
      })
      return NextResponse.json(warranty)
    } else {
      // Generate warranty ID in vol-XXXXX format
      const warrantyId = `vol-${Math.floor(10000 + Math.random() * 90000)}`
      
      // Create new warranty
      const warranty = await prisma.erpWarranty.create({
        data: {
          warrantyId,
          productName: body.productName,
          soldDate: body.soldDate,
          warrantyStartDate: body.warrantyStartDate,
          warrantyEndDate: body.warrantyEndDate,
          customerName: body.customerName,
          customerEmail: body.customerEmail,
          customerPhone: body.customerPhone,
          notes: body.notes,
        },
      })
      return NextResponse.json(warranty)
    }
  } catch (error: any) {
    console.error("Error saving warranty:", error)
    console.error("Error details:", error.message)
    console.error("Error code:", error.code)
    return NextResponse.json({ 
      error: "Failed to save warranty", 
      details: error.message || String(error),
      code: error.code || "UNKNOWN"
    }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  await prisma.erpWarranty.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
