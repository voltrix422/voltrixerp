import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import type { Prisma } from "@prisma/client"

function parseUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((u) => String(u ?? "").trim()).filter(Boolean)
}

function asJsonUrls(value: unknown): Prisma.InputJsonValue {
  return parseUrls(value) as unknown as Prisma.InputJsonValue
}

const allotmentInclude = { vehicle: true } as const

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const resource = searchParams.get("resource")?.trim() || "allotments"

  try {
    if (resource === "vehicles") {
      const includeInactive = searchParams.get("includeInactive") === "1"
      const rows = await prisma.erpFuelVehicle.findMany({
        where: includeInactive ? undefined : { active: true },
        orderBy: [{ active: "desc" }, { name: "asc" }],
      })
      return NextResponse.json(rows)
    }

    const userId = searchParams.get("userId")?.trim() || ""
    const personName = searchParams.get("personName")?.trim() || ""
    const status = searchParams.get("status")?.trim() || ""

    const rows = await prisma.erpFuelAllotment.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(userId || personName
          ? {
              OR: [
                ...(userId ? [{ personUserId: userId }] : []),
                ...(personName
                  ? [{ personName: { equals: personName, mode: "insensitive" as const } }]
                  : []),
              ],
            }
          : {}),
      },
      include: allotmentInclude,
      orderBy: { allottedAt: "desc" },
    })
    return NextResponse.json(rows)
  } catch (err) {
    console.error("[fuel-petrol GET]", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load fuel data" },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const action = String(body.action ?? "").trim().toLowerCase()

  try {
    if (action === "save_vehicle") {
      const name = String(body.name ?? "").trim()
      if (!name) return NextResponse.json({ error: "Vehicle name is required" }, { status: 400 })
      const avgKmPerLiter = Math.max(0, Number(body.avgKmPerLiter) || 0)
      const plate = String(body.plate ?? "").trim()
      const notes = String(body.notes ?? "").trim()
      const createdBy = String(body.createdBy ?? "").trim()
      const id = body.id ? String(body.id).trim() : ""

      if (id) {
        const row = await prisma.erpFuelVehicle.update({
          where: { id },
          data: {
            name,
            plate,
            avgKmPerLiter,
            active: body.active !== false,
            notes,
          },
        })
        return NextResponse.json(row)
      }

      const row = await prisma.erpFuelVehicle.create({
        data: {
          name,
          plate,
          avgKmPerLiter,
          active: body.active !== false,
          notes,
          createdBy,
        },
      })
      return NextResponse.json(row, { status: 201 })
    }

    if (action === "allot") {
      const vehicleId = String(body.vehicleId ?? "").trim()
      const personName = String(body.personName ?? "").trim()
      const amountPkr = Math.max(0, Number(body.amountPkr) || 0)
      if (!vehicleId) return NextResponse.json({ error: "Vehicle is required" }, { status: 400 })
      if (!personName) return NextResponse.json({ error: "Person is required" }, { status: 400 })
      if (amountPkr <= 0) return NextResponse.json({ error: "Amount must be greater than 0" }, { status: 400 })

      const vehicle = await prisma.erpFuelVehicle.findUnique({ where: { id: vehicleId } })
      if (!vehicle) return NextResponse.json({ error: "Vehicle not found" }, { status: 404 })

      const litersRaw = body.liters
      const liters =
        litersRaw === null || litersRaw === undefined || litersRaw === ""
          ? null
          : Math.max(0, Number(litersRaw) || 0)

      const row = await prisma.erpFuelAllotment.create({
        data: {
          vehicleId,
          personStaffId: body.personStaffId ? String(body.personStaffId).trim() : null,
          personName,
          personUserId: body.personUserId ? String(body.personUserId).trim() : null,
          amountPkr,
          liters,
          notes: String(body.notes ?? "").trim(),
          paymentProofUrls: asJsonUrls(body.paymentProofUrls),
          allottedBy: String(body.allottedBy ?? "").trim(),
          status: "allotted",
        },
        include: allotmentInclude,
      })
      return NextResponse.json(row, { status: 201 })
    }

    if (action === "settle") {
      const id = String(body.id ?? "").trim()
      if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })
      const kmDriven = Math.max(0, Number(body.kmDriven) || 0)
      if (kmDriven <= 0) {
        return NextResponse.json({ error: "KM driven is required" }, { status: 400 })
      }

      const existing = await prisma.erpFuelAllotment.findUnique({ where: { id } })
      if (!existing) return NextResponse.json({ error: "Allotment not found" }, { status: 404 })
      if (existing.status === "settled") {
        return NextResponse.json({ error: "Already settled" }, { status: 409 })
      }

      const odoStart =
        body.odometerStart === null || body.odometerStart === undefined || body.odometerStart === ""
          ? null
          : Number(body.odometerStart)
      const odoEnd =
        body.odometerEnd === null || body.odometerEnd === undefined || body.odometerEnd === ""
          ? null
          : Number(body.odometerEnd)

      const row = await prisma.erpFuelAllotment.update({
        where: { id },
        data: {
          status: "settled",
          kmDriven,
          odometerStart: Number.isFinite(odoStart as number) ? (odoStart as number) : null,
          odometerEnd: Number.isFinite(odoEnd as number) ? (odoEnd as number) : null,
          settlementNotes: String(body.settlementNotes ?? "").trim(),
          spendingProofUrls: asJsonUrls(body.spendingProofUrls),
          settledAt: new Date(),
          settledBy: String(body.settledBy ?? "").trim(),
        },
        include: allotmentInclude,
      })
      return NextResponse.json(row)
    }

    if (action === "delete_allotment") {
      const id = String(body.id ?? "").trim()
      if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })
      const existing = await prisma.erpFuelAllotment.findUnique({ where: { id } })
      if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })
      if (existing.status === "settled") {
        return NextResponse.json({ error: "Cannot delete a settled allotment" }, { status: 400 })
      }
      await prisma.erpFuelAllotment.delete({ where: { id } })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (err) {
    console.error("[fuel-petrol POST]", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Fuel action failed" },
      { status: 500 },
    )
  }
}
