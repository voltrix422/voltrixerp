import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import type { Prisma } from "@prisma/client"

function parseStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((u) => String(u ?? "").trim()).filter(Boolean)
}

function buildPhotoUrls(body: Record<string, unknown>): Prisma.InputJsonValue {
  const before = parseStringList(body.beforePhotoUrls)
  const after = parseStringList(body.afterPhotoUrls)
  const legacy = parseStringList(body.photoUrls)
  return {
    before: before.length > 0 ? before : legacy,
    after,
  } as unknown as Prisma.InputJsonValue
}

const OUT_DISPOSITIONS = new Set([
  "returned_to_customer",
  "not_serviceable",
  "replaced",
  "to_faulty",
  "scrap",
])

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const ticketId = searchParams.get("ticketId")?.trim() || ""
  const movementType = searchParams.get("movementType")?.trim() || ""
  const status = searchParams.get("status")?.trim() || ""

  const rows = await prisma.erpAfterSaleItemMovement.findMany({
    where: {
      ...(ticketId ? { ticketId } : {}),
      ...(movementType ? { movementType } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const action = String(body.action ?? "").trim().toLowerCase()
  const createdBy = String(body.createdBy ?? "After Sale").trim() || "After Sale"

  try {
    if (action === "in") {
      const serialNumber = String(body.serialNumber ?? "").trim()
      if (!serialNumber) {
        return NextResponse.json({ error: "Serial number is required" }, { status: 400 })
      }

      const held = await prisma.erpAfterSaleItemMovement.findFirst({
        where: {
          movementType: "in",
          status: "held",
          serialNumber: { equals: serialNumber, mode: "insensitive" },
        },
      })
      if (held) {
        return NextResponse.json(
          { error: `Serial ${serialNumber} is already held in after-sale (ticket ${held.ticketNumber || "—"})` },
          { status: 409 },
        )
      }

      let ticketId = body.ticketId ? String(body.ticketId).trim() : ""
      let ticketNumber = body.ticketNumber ? String(body.ticketNumber).trim() : ""
      let customerName = String(body.customerName ?? "").trim()
      let customerPhone = body.customerPhone ? String(body.customerPhone).trim() : ""

      if (ticketId) {
        const ticket = await prisma.erpTicket.findUnique({ where: { id: ticketId } })
        if (!ticket) {
          return NextResponse.json({ error: "Linked case not found" }, { status: 404 })
        }
        ticketNumber = ticket.ticketNumber
        if (!customerName) customerName = ticket.customerName
        if (!customerPhone) customerPhone = ticket.customerPhone || ""
      }

      const row = await prisma.erpAfterSaleItemMovement.create({
        data: {
          movementType: "in",
          ticketId: ticketId || null,
          ticketNumber: ticketNumber || null,
          serialNumber,
          productName: String(body.productName ?? "").trim(),
          model: String(body.model ?? "").trim(),
          condition: String(body.condition ?? "unknown").trim() || "unknown",
          customerName,
          customerPhone: customerPhone || null,
          notes: String(body.notes ?? "").trim(),
          beforeRemark: String(body.beforeRemark ?? "").trim(),
          afterRemark: String(body.afterRemark ?? "").trim(),
          status: "held",
          photoUrls: buildPhotoUrls(body),
          createdBy,
        },
      })
      return NextResponse.json(row, { status: 201 })
    }

    if (action === "out") {
      const linkedInId = String(body.linkedInId ?? "").trim()
      if (!linkedInId) {
        return NextResponse.json({ error: "linkedInId is required" }, { status: 400 })
      }
      const disposition = String(body.disposition ?? "").trim()
      if (!OUT_DISPOSITIONS.has(disposition)) {
        return NextResponse.json({ error: "Invalid disposition" }, { status: 400 })
      }

      const held = await prisma.erpAfterSaleItemMovement.findUnique({ where: { id: linkedInId } })
      if (!held || held.movementType !== "in") {
        return NextResponse.json({ error: "Item In record not found" }, { status: 404 })
      }
      if (held.status !== "held") {
        return NextResponse.json({ error: "This item was already released" }, { status: 409 })
      }

      const outSerial = String(body.outSerialNumber ?? "").trim() || held.serialNumber
      const afterRemark = String(body.afterRemark ?? body.notes ?? "").trim()
      const afterPhotos = parseStringList(body.afterPhotoUrls)
      const heldPhotos =
        held.photoUrls && typeof held.photoUrls === "object" && !Array.isArray(held.photoUrls)
          ? (held.photoUrls as { before?: unknown; after?: unknown })
          : { before: Array.isArray(held.photoUrls) ? held.photoUrls : [], after: [] }
      const beforeFromHeld = parseStringList(heldPhotos.before)

      const [outRow] = await prisma.$transaction([
        prisma.erpAfterSaleItemMovement.create({
          data: {
            movementType: "out",
            ticketId: held.ticketId,
            ticketNumber: held.ticketNumber,
            serialNumber: held.serialNumber,
            productName: held.productName,
            model: held.model,
            condition: held.condition,
            customerName: held.customerName,
            customerPhone: held.customerPhone,
            notes: String(body.notes ?? "").trim(),
            beforeRemark: held.beforeRemark || "",
            afterRemark,
            status: "released",
            linkedInId: held.id,
            disposition,
            outSerialNumber: outSerial,
            photoUrls: {
              before: beforeFromHeld,
              after: afterPhotos,
            } as unknown as Prisma.InputJsonValue,
            createdBy,
          },
        }),
        prisma.erpAfterSaleItemMovement.update({
          where: { id: held.id },
          data: {
            status: "released",
            ...(afterRemark
              ? { afterRemark }
              : {}),
            ...(afterPhotos.length > 0
              ? {
                  photoUrls: {
                    before: beforeFromHeld,
                    after: afterPhotos,
                  } as unknown as Prisma.InputJsonValue,
                }
              : {}),
          },
        }),
      ])

      return NextResponse.json(outRow, { status: 201 })
    }

    return NextResponse.json({ error: "action must be in or out" }, { status: 400 })
  } catch (err) {
    console.error("after-sale-items error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "After-sale item action failed" },
      { status: 500 },
    )
  }
}

export async function DELETE(req: NextRequest) {
  const body = await req.json()
  const id = String(body.id ?? "").trim()
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

  const row = await prisma.erpAfterSaleItemMovement.findUnique({ where: { id } })
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (row.movementType === "in" && row.status === "released") {
    return NextResponse.json({ error: "Cannot delete a released Item In — remove the Out first" }, { status: 400 })
  }
  if (row.movementType === "out" && row.linkedInId) {
    await prisma.$transaction([
      prisma.erpAfterSaleItemMovement.delete({ where: { id } }),
      prisma.erpAfterSaleItemMovement.update({
        where: { id: row.linkedInId },
        data: { status: "held" },
      }),
    ])
    return NextResponse.json({ ok: true })
  }

  await prisma.erpAfterSaleItemMovement.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
