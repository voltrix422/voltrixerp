import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const staffCategory = String(body.staffCategory ?? "hrm")
    const userId = body.userId ? String(body.userId) : null

    if (userId) {
      const existingByUser = await prisma.erpSalarySlip.findFirst({
        where: { userId, month: body.month, staffCategory },
      })
      if (existingByUser) {
        return NextResponse.json(
          {
            error: "Salary slip already exists for this person and month",
            existingId: existingByUser.id,
          },
          { status: 409 },
        )
      }
    } else {
      const existing = await prisma.erpSalarySlip.findFirst({
        where: {
          staffName: body.staffName,
          month: body.month,
          staffCategory,
        },
      })
      if (existing) {
        return NextResponse.json(
          {
            error: "Salary slip already exists for this staff and month",
            existingId: existing.id,
          },
          { status: 409 },
        )
      }
    }

    const salarySlip = await prisma.erpSalarySlip.create({
      data: {
        userId,
        staffName: body.staffName,
        staffRole: body.staffRole,
        staffDepartment: body.staffDepartment,
        staffCategory,
        month: body.month,
        baseSalary: body.baseSalary,
        currency: body.currency || "PKR",
        adjustments: body.adjustments || [],
        netSalary: body.netSalary,
        generatedDate: new Date(body.generatedDate),
        bankName: body.bankName ?? "",
        bankAccountNumber: body.bankAccountNumber ?? "",
        bankAccountTitle: body.bankAccountTitle ?? "",
      },
    })

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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const staffName = searchParams.get("staffName")
    const staffCategory = searchParams.get("staffCategory")
    const month = searchParams.get("month")
    const userId = searchParams.get("userId")

    const salarySlips = await prisma.erpSalarySlip.findMany({
      where: {
        ...(staffName ? { staffName } : {}),
        ...(staffCategory ? { staffCategory } : {}),
        ...(month ? { month } : {}),
        ...(userId ? { userId } : {}),
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
