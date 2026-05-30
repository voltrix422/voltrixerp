import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { parseDecimalField } from "@/lib/format-inventory-price"
import { ensureInventoryStockForModel } from "@/lib/ensure-model-stock-link"

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
    retailPrice,
    gstPercent,
    scannedBy,
    createWarranty = false,
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
      retailPrice: parseDecimalField(retailPrice),
      gstPercent: parseDecimalField(gstPercent),
      notes: notes || "",
      scannedBy: scannedBy || "system",
    },
  })

  if (model?.trim()) {
    await ensureInventoryStockForModel(
      model.trim(),
      productName || assignedName || undefined,
    ).catch(() => {})
  }

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

async function deleteSerialUnitAndWarranties(unit: {
  id: string
  warrantyId: string | null
  serialNumber: string | null
}) {
  await prisma.erpWarrantyClaim.deleteMany({ where: { unitId: unit.id } })
  if (unit.warrantyId) {
    await prisma.erpWarranty.deleteMany({ where: { warrantyId: unit.warrantyId } })
  }
  if (unit.serialNumber) {
    await prisma.erpWarranty.deleteMany({ where: { serialNumber: unit.serialNumber } })
  }
  await prisma.erpInventorySerialUnit.delete({ where: { id: unit.id } })
}

export async function DELETE(req: NextRequest) {
  let id: string | null = new URL(req.url).searchParams.get("id")
  let model: string | null = null
  try {
    const body = await req.json()
    if (body?.id) id = String(body.id)
    if (body?.model) model = String(body.model).trim()
  } catch {
    // query param id only
  }

  if (model) {
    const units = await prisma.erpInventorySerialUnit.findMany({
      where: { model },
    })
    if (units.length === 0) {
      return NextResponse.json({ error: "No scanned units for this model" }, { status: 404 })
    }
    for (const unit of units) {
      await deleteSerialUnitAndWarranties(unit)
    }
    return NextResponse.json({ ok: true, deleted: units.length })
  }

  if (!id) {
    return NextResponse.json({ error: "Unit ID or model is required" }, { status: 400 })
  }

  const unit = await prisma.erpInventorySerialUnit.findUnique({ where: { id } })
  if (!unit) {
    return NextResponse.json({ error: "Unit not found" }, { status: 404 })
  }

  await deleteSerialUnitAndWarranties(unit)
  return NextResponse.json({ ok: true, deleted: 1 })
}
