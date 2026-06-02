import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import {
  decrementManualInventoryByModel,
  generateUniqueManualModel,
  restoreManualInventoryByModel,
  syncManualInventoryStock,
} from "@/lib/manual-inventory-server"

function mapRow(row: {
  id: string
  name: string
  model: string
  qty: number
  availableQty: number
  unit: string
  notes: string
  inventoryStockId: string | null
  createdBy: string
  createdAt: Date
  updatedAt: Date
  lastAddedAt?: Date | null
}) {
  return {
    id: row.id,
    name: row.name,
    model: row.model,
    qty: row.qty,
    availableQty: row.availableQty,
    unit: row.unit,
    notes: row.notes,
    inventoryStockId: row.inventoryStockId,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lastAddedAt: row.lastAddedAt ? row.lastAddedAt.toISOString() : null,
  }
}

export async function GET() {
  const rows = await prisma.erpManualInventoryItem.findMany({
    orderBy: { createdAt: "desc" },
  })

  const models = rows.map((r) => r.model).filter(Boolean)
  const serialRows =
    models.length > 0
      ? await prisma.erpInventorySerialUnit.findMany({
          where: { model: { in: models } },
          orderBy: { scannedAt: "desc" },
        })
      : []

  const serialsByModel = new Map<string, typeof serialRows>()
  for (const unit of serialRows) {
    const m = unit.model?.trim()
    if (!m) continue
    const list = serialsByModel.get(m) ?? []
    list.push(unit)
    serialsByModel.set(m, list)
  }

  const restockHistory = await prisma.erpInventoryHistory.findMany({
    where: { referenceType: "manual_add" },
    orderBy: { createdAt: "desc" },
    select: { referenceId: true, createdAt: true },
  })
  const lastAddedByManualId = new Map<string, Date>()
  for (const row of restockHistory) {
    const manualId = row.referenceId?.trim()
    if (!manualId || lastAddedByManualId.has(manualId)) continue
    lastAddedByManualId.set(manualId, row.createdAt)
  }

  return NextResponse.json(
    rows.map((row) => ({
      ...mapRow({
        ...row,
        lastAddedAt: lastAddedByManualId.get(row.id) ?? row.createdAt,
      }),
      serialUnits: (serialsByModel.get(row.model) ?? []).map((u) => ({
        id: u.id,
        serialNumber: u.serialNumber,
        status: u.status,
        notes: u.notes,
        specs: u.specs,
        scannedAt: u.scannedAt.toISOString(),
      })),
    })),
  )
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const name = String(body.name ?? "").trim()
  const qty = Number(body.qty)
  const unit = String(body.unit ?? "pcs").trim() || "pcs"
  const notes = String(body.notes ?? "").trim()
  const createdBy = String(body.createdBy ?? "system").trim() || "system"
  const serialNumbers: string[] = Array.isArray(body.serialNumbers)
    ? body.serialNumbers.map((s: unknown) => String(s ?? "").trim()).filter(Boolean)
    : []

  if (!name) {
    return NextResponse.json({ error: "Item name is required" }, { status: 400 })
  }
  if (!Number.isFinite(qty) || qty <= 0) {
    return NextResponse.json({ error: "Quantity must be greater than zero" }, { status: 400 })
  }

  const model = await generateUniqueManualModel(name)

  const item = await prisma.erpManualInventoryItem.create({
    data: {
      name,
      model,
      qty,
      availableQty: qty,
      unit,
      notes,
      createdBy,
    },
  })

  const stockId = await syncManualInventoryStock(
    item.id,
    name,
    model,
    qty,
    unit,
    null,
  )

  if (serialNumbers.length > 0) {
    const stock = await prisma.erpInventoryStock.findUnique({ where: { id: stockId } })
    for (const sn of serialNumbers) {
      const existing = await prisma.erpInventorySerialUnit.findFirst({
        where: { serialNumber: { equals: sn, mode: "insensitive" } },
      })
      if (existing) continue
      await prisma.erpInventorySerialUnit.create({
        data: {
          serialNumber: sn,
          assignedName: name,
          productName: name,
          model,
          specs: "",
          rawPayload: "",
          inventoryStockId: stockId,
          notes: `manual:${item.id}`,
          scannedBy: createdBy,
          status: "in_stock",
        },
      })
    }
    const inStock = await prisma.erpInventorySerialUnit.count({
      where: { model, status: "in_stock" },
    })
    if (stock) {
      await prisma.erpInventoryStock.update({
        where: { id: stockId },
        data: { availableQty: inStock, receivedQty: Math.max(stock.receivedQty, inStock) },
      })
    }
  }

  const updated = await prisma.erpManualInventoryItem.findUniqueOrThrow({
    where: { id: item.id },
  })
  return NextResponse.json(mapRow(updated))
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  const id = String(body.id ?? "").trim()
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

  const existing = await prisma.erpManualInventoryItem.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const name = body.name !== undefined ? String(body.name).trim() : existing.name
  const qty = body.qty !== undefined ? Number(body.qty) : existing.qty
  const availableQty =
    body.availableQty !== undefined ? Number(body.availableQty) : existing.availableQty
  const unit = body.unit !== undefined ? String(body.unit).trim() || "pcs" : existing.unit
  const notes = body.notes !== undefined ? String(body.notes).trim() : existing.notes

  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 })
  if (!Number.isFinite(qty) || qty < 0) {
    return NextResponse.json({ error: "Invalid quantity" }, { status: 400 })
  }

  const item = await prisma.erpManualInventoryItem.update({
    where: { id },
    data: {
      name,
      qty,
      availableQty: Math.min(availableQty, qty),
      unit,
      notes,
    },
  })

  await syncManualInventoryStock(
    item.id,
    item.name,
    item.model,
    item.availableQty,
    item.unit,
    item.inventoryStockId,
  )

  if (body.displayName !== undefined || name !== existing.name) {
    await prisma.erpInventoryModelLabel.upsert({
      where: { model: item.model },
      create: { model: item.model, displayName: name },
      update: { displayName: name },
    })
  }

  return NextResponse.json(mapRow(item))
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const action = String(body.action ?? "")

  if (action === "reserve") {
    const items = Array.isArray(body.items) ? body.items : []
    for (const row of items) {
      const manualId = String(row.manualId ?? "").trim()
      const qty = Number(row.qty)
      if (!manualId || !Number.isFinite(qty) || qty <= 0) continue

      const item = await prisma.erpManualInventoryItem.findUnique({ where: { id: manualId } })
      if (!item) {
        return NextResponse.json({ error: `Manual item not found: ${manualId}` }, { status: 404 })
      }
      if ((item.availableQty ?? 0) < qty) {
        return NextResponse.json(
          { error: `Not enough stock for "${item.name}" (available ${item.availableQty})` },
          { status: 400 },
        )
      }
      const next = (item.availableQty ?? 0) - qty
      await prisma.erpManualInventoryItem.update({
        where: { id: manualId },
        data: { availableQty: next },
      })
      if (item.inventoryStockId) {
        await prisma.erpInventoryStock.update({
          where: { id: item.inventoryStockId },
          data: { availableQty: next },
        })
      }
    }
    return NextResponse.json({ ok: true })
  }

  if (action === "restore") {
    const items = Array.isArray(body.items) ? body.items : []
    for (const row of items) {
      const manualId = String(row.manualId ?? "").trim()
      const qty = Number(row.qty)
      if (!manualId || !Number.isFinite(qty) || qty <= 0) continue
      const item = await prisma.erpManualInventoryItem.findUnique({ where: { id: manualId } })
      if (!item) continue
      await restoreManualInventoryByModel(item.model, qty)
      if (item.inventoryStockId) {
        const restored = await prisma.erpManualInventoryItem.findUnique({ where: { id: manualId } })
        if (restored) {
          await prisma.erpInventoryStock.update({
            where: { id: item.inventoryStockId },
            data: { availableQty: restored.availableQty },
          })
        }
      }
    }
    return NextResponse.json({ ok: true })
  }

  if (action === "add_qty") {
    const manualId = String(body.manualId ?? "").trim()
    const qty = Number(body.qty)
    const addedBy = String(body.addedBy ?? "system").trim() || "system"
    const notes = String(body.notes ?? "").trim()

    if (!manualId) {
      return NextResponse.json({ error: "manualId is required" }, { status: 400 })
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      return NextResponse.json({ error: "Quantity must be greater than zero" }, { status: 400 })
    }

    const item = await prisma.erpManualInventoryItem.findUnique({ where: { id: manualId } })
    if (!item) return NextResponse.json({ error: "Manual item not found" }, { status: 404 })

    const nextQty = (item.qty ?? 0) + qty
    const nextAvailableQty = (item.availableQty ?? 0) + qty

    const updated = await prisma.erpManualInventoryItem.update({
      where: { id: manualId },
      data: {
        qty: nextQty,
        availableQty: nextAvailableQty,
      },
    })

    if (item.inventoryStockId) {
      await prisma.erpInventoryStock.update({
        where: { id: item.inventoryStockId },
        data: {
          receivedQty: nextQty,
          availableQty: nextAvailableQty,
        },
      })
    }

    await prisma.erpInventoryHistory.create({
      data: {
        itemDescription: item.name,
        transactionType: "in",
        quantity: qty,
        unit: item.unit || "pcs",
        referenceType: "manual_add",
        referenceId: item.id,
        referenceNumber: item.model,
        notes: notes || undefined,
        createdBy: addedBy,
      },
    })

    return NextResponse.json(
      mapRow({
        ...updated,
        lastAddedAt: new Date(),
      }),
    )
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 })
}

export async function DELETE(req: NextRequest) {
  const body = await req.json()
  const id = String(body.id ?? "").trim()
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

  const item = await prisma.erpManualInventoryItem.findUnique({ where: { id } })
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const inStockSerials = await prisma.erpInventorySerialUnit.count({
    where: { model: item.model, status: "in_stock" },
  })
  if (inStockSerials > 0) {
    return NextResponse.json(
      { error: "Remove or reassign serial units before deleting this item" },
      { status: 400 },
    )
  }

  if (item.inventoryStockId) {
    await prisma.erpInventoryStock.delete({ where: { id: item.inventoryStockId } }).catch(() => {})
  }

  await prisma.erpManualInventoryItem.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
