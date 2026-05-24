import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { filterWarrantiesForRegistry, filterDeliveredPendingWarranties } from "@/lib/warranty-registry"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const includeInventory = searchParams.get("includeInventory") === "1"
  const split = searchParams.get("split") === "1"

  const warranties = await prisma.erpWarranty.findMany({
    orderBy: { soldDate: "desc" },
  })

  if (includeInventory) {
    return NextResponse.json(warranties)
  }

  const warrantyIds = warranties
    .map((w) => w.warrantyId)
    .filter((id): id is string => !!id?.trim())
  const serialKeys = [
    ...new Set(
      warranties.flatMap((w) => [w.serialNumber, w.productName].filter((s): s is string => !!s?.trim())),
    ),
  ]

  const units =
    warrantyIds.length > 0 || serialKeys.length > 0
      ? await prisma.erpInventorySerialUnit.findMany({
          where: {
            OR: [
              ...(warrantyIds.length > 0 ? [{ warrantyId: { in: warrantyIds } }] : []),
              ...(serialKeys.length > 0 ? [{ serialNumber: { in: serialKeys } }] : []),
            ],
          },
          select: { warrantyId: true, serialNumber: true, status: true },
        })
      : []

  if (split) {
    return NextResponse.json({
      started: filterWarrantiesForRegistry(warranties, units),
      delivered: filterDeliveredPendingWarranties(warranties, units),
    })
  }

  return NextResponse.json(filterWarrantiesForRegistry(warranties, units))
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
          customerAddress: body.customerAddress,
          invoiceDocumentUrl: body.invoiceDocumentUrl,
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
          activatedAt: body.warrantyStartDate ? new Date(body.warrantyStartDate) : new Date(),
          customerName: body.customerName,
          customerEmail: body.customerEmail,
          customerPhone: body.customerPhone,
          customerAddress: body.customerAddress,
          invoiceDocumentUrl: body.invoiceDocumentUrl,
          notes: body.notes,
        },
      })
      return NextResponse.json(warranty)
    }
  } catch (error: unknown) {
    const err = error as { message?: string; code?: string }
    console.error("Error saving warranty:", error)
    return NextResponse.json({ 
      error: "Failed to save warranty", 
      details: err.message || String(error),
      code: err.code || "UNKNOWN"
    }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  await prisma.erpWarranty.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
