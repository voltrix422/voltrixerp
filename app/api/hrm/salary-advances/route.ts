import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const staffId = searchParams.get("staffId")
    const summary = searchParams.get("summary") === "1"

    if (summary) {
      const rows = await prisma.hrmSalaryAdvance.groupBy({
        by: ["staffId", "currency"],
        where: { status: "outstanding" },
        _sum: { amount: true },
      })
      return NextResponse.json(
        rows.map((row) => ({
          staffId: row.staffId,
          outstanding: row._sum.amount ?? 0,
          currency: row.currency,
        })),
      )
    }

    const advances = await prisma.hrmSalaryAdvance.findMany({
      where: staffId ? { staffId } : undefined,
      orderBy: { givenAt: "desc" },
    })
    return NextResponse.json(advances)
  } catch (error) {
    console.error("Error fetching salary advances:", error)
    return NextResponse.json({ error: "Failed to fetch salary advances" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const staffId = String(body.staffId || "").trim()
    const reason = String(body.reason || "").trim()
    const givenBy = String(body.givenBy || "").trim()
    const amount = Number(body.amount)

    if (!staffId || !reason || !givenBy) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Advance amount must be greater than zero" }, { status: 400 })
    }

    const staff = await prisma.erpStaff.findUnique({ where: { id: staffId } })
    if (!staff) {
      return NextResponse.json({ error: "Staff member not found" }, { status: 404 })
    }

    const advance = await prisma.hrmSalaryAdvance.create({
      data: {
        staffId,
        amount,
        currency: String(body.currency || staff.currency || "PKR"),
        reason,
        notes: String(body.notes || "").trim(),
        givenBy,
        proofUrl: body.proofUrl || null,
        proofName: body.proofName || null,
        status: "outstanding",
      },
    })

    return NextResponse.json(advance, { status: 201 })
  } catch (error) {
    console.error("Error creating salary advance:", error)
    return NextResponse.json({ error: "Failed to record salary advance" }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const action = String(body.action || "").trim()

    if (action === "cancel") {
      const id = String(body.id || "").trim()
      const cancelledBy = String(body.cancelledBy || "").trim()
      if (!id || !cancelledBy) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
      }

      const existing = await prisma.hrmSalaryAdvance.findUnique({ where: { id } })
      if (!existing) {
        return NextResponse.json({ error: "Advance not found" }, { status: 404 })
      }
      if (existing.status !== "outstanding") {
        return NextResponse.json({ error: "Only outstanding advances can be cancelled" }, { status: 400 })
      }

      const advance = await prisma.hrmSalaryAdvance.update({
        where: { id },
        data: {
          status: "cancelled",
          notes: existing.notes
            ? `${existing.notes}\nCancelled by ${cancelledBy}`
            : `Cancelled by ${cancelledBy}`,
        },
      })
      return NextResponse.json(advance)
    }

    if (action === "recover") {
      const staffId = String(body.staffId || "").trim()
      const month = String(body.month || "").trim()
      const recoveredBy = String(body.recoveredBy || "").trim()
      if (!staffId || !month || !recoveredBy) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
      }

      const outstanding = await prisma.hrmSalaryAdvance.findMany({
        where: { staffId, status: "outstanding" },
      })
      if (outstanding.length === 0) {
        return NextResponse.json({ recoveredCount: 0, recoveredTotal: 0 })
      }

      const now = new Date()
      const recoveredTotal = outstanding.reduce((sum, row) => sum + row.amount, 0)
      for (const row of outstanding) {
        const noteSuffix = `Recovered in payroll ${month} by ${recoveredBy}`
        await prisma.hrmSalaryAdvance.update({
          where: { id: row.id },
          data: {
            status: "recovered",
            recoveredAt: now,
            recoveredInMonth: month,
            notes: row.notes ? `${row.notes}\n${noteSuffix}` : noteSuffix,
          },
        })
      }

      return NextResponse.json({
        recoveredCount: outstanding.length,
        recoveredTotal,
      })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error("Error updating salary advance:", error)
    return NextResponse.json({ error: "Failed to update salary advance" }, { status: 500 })
  }
}
