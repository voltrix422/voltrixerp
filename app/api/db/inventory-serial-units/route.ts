import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

function addYears(date: Date, years: number) {
  const next = new Date(date)
  next.setFullYear(next.getFullYear() + years)
  return next
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const inventoryStockId = searchParams.get("inventoryStockId")
  const serialNumber = searchParams.get("serialNumber")

  const units = await prisma.erpInventorySerialUnit.findMany({
    where: {
      ...(inventoryStockId ? { inventoryStockId } : {}),
      ...(serialNumber ? { serialNumber } : {}),
    },
    orderBy: { scannedAt: "desc" },
  })

  return NextResponse.json(units)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    serialNumber,
    assignedName,
    productName,
    model,
    specs,
    rawPayload,
    inventoryStockId,
    notes,
    scannedBy,
    createWarranty = true,
  } = body

  const normalizedSerial = String(serialNumber ?? "").trim()
  if (!normalizedSerial) {
    return NextResponse.json({ error: "Serial number is required" }, { status: 400 })
  }

  const existing = await prisma.erpInventorySerialUnit.findFirst({
    where: {
      serialNumber: { equals: normalizedSerial, mode: "insensitive" },
    },
  })
  if (existing) {
    return NextResponse.json({ error: "This serial number is already registered" }, { status: 409 })
  }

  const now = new Date()
  const warrantyStartDate = now
  const warrantyEndDate = addYears(now, 5)
  let warrantyId: string | null = null

  if (createWarranty) {
    const generatedWarrantyId = `vol-${Math.floor(10000 + Math.random() * 90000)}`
    const warranty = await prisma.erpWarranty.create({
      data: {
        warrantyId: generatedWarrantyId,
        serialNumber: normalizedSerial,
        productName: productName || assignedName || normalizedSerial,
        soldDate: now,
        warrantyStartDate,
        warrantyEndDate,
        notes: notes || `Registered from inventory QR scan (${normalizedSerial})`,
        createdBy: scannedBy || "system",
      },
    })
    warrantyId = warranty.warrantyId
  }

  const unit = await prisma.erpInventorySerialUnit.create({
    data: {
      serialNumber: normalizedSerial,
      assignedName: assignedName || "",
      productName: productName || "",
      model: model || "",
      specs: specs || "",
      rawPayload: rawPayload || "",
      inventoryStockId: inventoryStockId || null,
      warrantyId,
      warrantyStartDate,
      warrantyEndDate,
      status: "in_stock",
      notes: notes || "",
      scannedBy: scannedBy || "system",
    },
  })

  return NextResponse.json(unit, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  const { id, assignedName, inventoryStockId, notes, status } = body

  if (!id) {
    return NextResponse.json({ error: "Unit ID is required" }, { status: 400 })
  }

  const unit = await prisma.erpInventorySerialUnit.update({
    where: { id },
    data: {
      assignedName,
      inventoryStockId,
      notes,
      status,
    },
  })

  return NextResponse.json(unit)
}

export async function DELETE(req: NextRequest) {
  let id: string | null = new URL(req.url).searchParams.get("id")
  if (!id) {
    try {
      const body = await req.json()
      id = body?.id ? String(body.id) : null
    } catch {
      id = null
    }
  }

  if (!id) {
    return NextResponse.json({ error: "Unit ID is required" }, { status: 400 })
  }

  const unit = await prisma.erpInventorySerialUnit.findUnique({ where: { id } })
  if (!unit) {
    return NextResponse.json({ error: "Unit not found" }, { status: 404 })
  }

  await prisma.erpWarrantyClaim.deleteMany({ where: { unitId: id } })

  if (unit.warrantyId) {
    await prisma.erpWarranty.deleteMany({ where: { warrantyId: unit.warrantyId } })
  }
  if (unit.serialNumber) {
    await prisma.erpWarranty.deleteMany({
      where: { serialNumber: unit.serialNumber },
    })
  }

  await prisma.erpInventorySerialUnit.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}
