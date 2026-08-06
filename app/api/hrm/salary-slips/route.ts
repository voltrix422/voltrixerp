import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

type SlipStatus = "draft" | "finalized"

function slipWhereForStaff(body: {
  staffName: string
  month: string
  staffCategory?: string
  userId?: string | null
  staffLocalId?: string | null
}) {
  const staffCategory = String(body.staffCategory ?? "hrm")
  if (body.userId) {
    return { userId: String(body.userId), month: body.month, staffCategory }
  }
  if (body.staffLocalId) {
    return { staffLocalId: String(body.staffLocalId), month: body.month, staffCategory }
  }
  return { staffName: body.staffName, month: body.month, staffCategory }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const staffCategory = String(body.staffCategory ?? "hrm")
    const userId = body.userId ? String(body.userId) : null
    const staffLocalId = body.staffLocalId ? String(body.staffLocalId) : null
    const status = (String(body.status ?? "finalized") as SlipStatus) === "draft" ? "draft" : "finalized"
    const whereBase = slipWhereForStaff({
      staffName: body.staffName,
      month: body.month,
      staffCategory,
      userId,
      staffLocalId,
    })

    const existingFinalized = await prisma.erpSalarySlip.findFirst({
      where: { ...whereBase, status: "finalized" },
    })
    if (existingFinalized && status === "finalized") {
      return NextResponse.json(
        {
          error: "Salary slip already exists for this person and month",
          existingId: existingFinalized.id,
        },
        { status: 409 },
      )
    }

    const slipData = {
      userId,
      staffLocalId,
      staffName: body.staffName,
      staffRole: body.staffRole,
      staffDepartment: body.staffDepartment,
      staffCategory,
      month: body.month,
      periodStart: body.periodStart ? String(body.periodStart) : null,
      periodEnd: body.periodEnd ? String(body.periodEnd) : null,
      baseSalary: Number(body.baseSalary) || 0,
      currency: body.currency || "PKR",
      adjustments: body.adjustments || [],
      netSalary: Number(body.netSalary) || 0,
      status,
      generatedDate: new Date(body.generatedDate || Date.now()),
      bankName: body.bankName ?? "",
      bankAccountNumber: body.bankAccountNumber ?? "",
      bankAccountTitle: body.bankAccountTitle ?? "",
      ...(body.paidAt != null
        ? { paidAt: body.paidAt ? new Date(body.paidAt) : null }
        : status === "finalized"
          ? { paidAt: new Date() }
          : {}),
      ...(body.paidBy != null
        ? { paidBy: String(body.paidBy) }
        : status === "finalized" && body.recoveredBy
          ? { paidBy: String(body.recoveredBy) }
          : {}),
      ...(body.paymentNotes != null ? { paymentNotes: String(body.paymentNotes) } : {}),
      ...(body.paymentAttachments != null
        ? { paymentAttachments: Array.isArray(body.paymentAttachments) ? body.paymentAttachments : [] }
        : {}),
    }

    if (status === "draft") {
      const existingDraft = await prisma.erpSalarySlip.findFirst({
        where: { ...whereBase, status: "draft" },
      })
      if (existingDraft) {
        const salarySlip = await prisma.erpSalarySlip.update({
          where: { id: existingDraft.id },
          data: slipData,
        })
        return NextResponse.json(salarySlip)
      }
      const salarySlip = await prisma.erpSalarySlip.create({ data: slipData })
      return NextResponse.json(salarySlip)
    }

    if (existingFinalized) {
      return NextResponse.json(
        { error: "Salary slip already exists for this person and month", existingId: existingFinalized.id },
        { status: 409 },
      )
    }

    await prisma.erpSalarySlip.deleteMany({
      where: { ...whereBase, status: "draft" },
    })

    const salarySlip = await prisma.erpSalarySlip.create({ data: slipData })
    return NextResponse.json(salarySlip)
  } catch (error) {
    console.error("Error saving salary slip:", error)
    return NextResponse.json(
      {
        error: "Failed to save salary slip",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const id = String(body.id || "")
    if (!id) {
      return NextResponse.json({ error: "Missing slip id" }, { status: 400 })
    }

    const existing = await prisma.erpSalarySlip.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "Salary slip not found" }, { status: 404 })
    }

    if (body.status === "finalized" && existing.status === "draft") {
      const whereBase = slipWhereForStaff({
        staffName: existing.staffName,
        month: existing.month,
        staffCategory: existing.staffCategory,
        userId: existing.userId,
        staffLocalId: existing.staffLocalId,
      })
      const conflict = await prisma.erpSalarySlip.findFirst({
        where: { ...whereBase, status: "finalized", NOT: { id } },
      })
      if (conflict) {
        return NextResponse.json(
          { error: "A finalized salary slip already exists for this person and month" },
          { status: 409 },
        )
      }
    }

    const salarySlip = await prisma.erpSalarySlip.update({
      where: { id },
      data: {
        ...(body.status ? { status: String(body.status) } : {}),
        ...(body.baseSalary != null ? { baseSalary: Number(body.baseSalary) } : {}),
        ...(body.netSalary != null ? { netSalary: Number(body.netSalary) } : {}),
        ...(body.adjustments != null ? { adjustments: body.adjustments } : {}),
        ...(body.periodStart != null ? { periodStart: String(body.periodStart) } : {}),
        ...(body.periodEnd != null ? { periodEnd: String(body.periodEnd) } : {}),
        ...(body.generatedDate ? { generatedDate: new Date(body.generatedDate) } : {}),
        ...(body.paidAt !== undefined
          ? { paidAt: body.paidAt ? new Date(body.paidAt) : null }
          : {}),
        ...(body.paidBy !== undefined ? { paidBy: body.paidBy ? String(body.paidBy) : null } : {}),
        ...(body.paymentNotes !== undefined ? { paymentNotes: String(body.paymentNotes || "") } : {}),
        ...(body.paymentAttachments !== undefined
          ? {
              paymentAttachments: Array.isArray(body.paymentAttachments)
                ? body.paymentAttachments
                : [],
            }
          : {}),
      },
    })

    return NextResponse.json(salarySlip)
  } catch (error) {
    console.error("Error updating salary slip:", error)
    return NextResponse.json(
      {
        error: "Failed to update salary slip",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const staffName = searchParams.get("staffName")
    const staffCategory = searchParams.get("staffCategory")
    const month = searchParams.get("month")
    const userId = searchParams.get("userId")
    const status = searchParams.get("status")

    const salarySlips = await prisma.erpSalarySlip.findMany({
      where: {
        ...(staffName ? { staffName } : {}),
        ...(staffCategory ? { staffCategory } : {}),
        ...(month ? { month } : {}),
        ...(userId ? { userId } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { month: "desc" },
    })

    return NextResponse.json(salarySlips)
  } catch (error) {
    console.error("Error fetching salary slips:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch salary slips",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = String(searchParams.get("id") || "").trim()
    if (!id) {
      return NextResponse.json({ error: "Missing slip id" }, { status: 400 })
    }

    const existing = await prisma.erpSalarySlip.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "Salary slip not found" }, { status: 404 })
    }

    // Re-open advances recovered against this slip month so payroll can be regenerated cleanly.
    let staffId = existing.staffLocalId || ""
    if (!staffId && existing.staffName) {
      const staff = await prisma.erpStaff.findFirst({
        where: { name: existing.staffName },
        select: { id: true },
      })
      staffId = staff?.id || ""
    }
    if (staffId && existing.month) {
      await prisma.hrmSalaryAdvance.updateMany({
        where: {
          staffId,
          status: "recovered",
          recoveredInMonth: existing.month,
        },
        data: {
          status: "outstanding",
          recoveredAt: null,
          recoveredInMonth: null,
        },
      })
    }

    await prisma.erpSalarySlip.delete({ where: { id } })
    return NextResponse.json({ success: true, id })
  } catch (error) {
    console.error("Error deleting salary slip:", error)
    return NextResponse.json(
      {
        error: "Failed to delete salary slip",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
