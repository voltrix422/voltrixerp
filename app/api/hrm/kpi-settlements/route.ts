import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { computeWeightedScore, type SettlementEntry } from "@/lib/hrm-kpis"

function mapSettlement(
  s: {
    id: string
    staffId: string
    periodType: string
    periodStart: string
    periodEnd: string
    status: string
    entries: unknown
    weightedScore: number | null
    employeeNotes: string
    adminNotes: string
    submittedAt: Date | null
    submittedBy: string
    reviewedAt: Date | null
    reviewedBy: string
    createdAt: Date
    updatedAt: Date
    staff?: { name: string; email: string; role: string; department: string } | null
  }
) {
  return {
    id: s.id,
    staffId: s.staffId,
    staffName: s.staff?.name ?? "",
    staffEmail: s.staff?.email ?? "",
    staffRole: s.staff?.role ?? "",
    staffDepartment: s.staff?.department ?? "",
    periodType: s.periodType,
    periodStart: s.periodStart,
    periodEnd: s.periodEnd,
    status: s.status,
    entries: (Array.isArray(s.entries) ? s.entries : []) as SettlementEntry[],
    weightedScore: s.weightedScore,
    employeeNotes: s.employeeNotes,
    adminNotes: s.adminNotes,
    submittedAt: s.submittedAt?.toISOString() ?? null,
    submittedBy: s.submittedBy,
    reviewedAt: s.reviewedAt?.toISOString() ?? null,
    reviewedBy: s.reviewedBy,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }
}

export async function GET(req: NextRequest) {
  const staffId = req.nextUrl.searchParams.get("staffId")
  const periodStart = req.nextUrl.searchParams.get("periodStart")
  const periodEnd = req.nextUrl.searchParams.get("periodEnd")
  const status = req.nextUrl.searchParams.get("status")

  const where: Record<string, unknown> = {}
  if (staffId) where.staffId = staffId
  if (periodStart) where.periodStart = periodStart
  if (periodEnd) where.periodEnd = periodEnd
  if (status) where.status = status

  const rows = await prisma.hrmKpiSettlement.findMany({
    where,
    include: {
      staff: { select: { name: true, email: true, role: true, department: true } },
    },
    orderBy: { submittedAt: "desc" },
    take: staffId ? 52 : 200,
  })
  return NextResponse.json(rows.map(mapSettlement))
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  if (!body.staffId || !body.periodStart || !body.periodEnd) {
    return NextResponse.json({ error: "staffId, periodStart, periodEnd required" }, { status: 400 })
  }

  const entries = (body.entries ?? []) as SettlementEntry[]
  const weightedScore = computeWeightedScore(entries)
  const wantsSubmit = body.status === "submitted"
  const wantsDraft = body.status === "draft"

  const existing = await prisma.hrmKpiSettlement.findUnique({
    where: {
      staffId_periodStart_periodEnd: {
        staffId: body.staffId,
        periodStart: body.periodStart,
        periodEnd: body.periodEnd,
      },
    },
  })

  if (existing) {
    if (existing.status === "approved") {
      return NextResponse.json({ error: "This period is already approved and locked." }, { status: 409 })
    }
    if (existing.status === "submitted" && wantsSubmit) {
      return NextResponse.json({ error: "Already waiting for admin approval." }, { status: 409 })
    }
    if (existing.status === "submitted" && !wantsDraft) {
      return NextResponse.json({ error: "Cannot edit while pending approval." }, { status: 409 })
    }
  }

  const status = wantsSubmit ? "submitted" : "draft"
  const isSubmit = status === "submitted"

  const data = {
    staffId: body.staffId,
    periodType: body.periodType ?? "weekly",
    periodStart: body.periodStart,
    periodEnd: body.periodEnd,
    status,
    entries,
    weightedScore,
    employeeNotes: (body.employeeNotes ?? "").trim(),
    adminNotes: isSubmit ? "" : existing?.adminNotes ?? "",
    submittedAt: isSubmit ? new Date() : null,
    submittedBy: isSubmit ? (body.submittedBy ?? "") : "",
    reviewedAt: null,
    reviewedBy: "",
  }

  const row = existing
    ? await prisma.hrmKpiSettlement.update({
        where: { id: existing.id },
        data,
        include: { staff: { select: { name: true, email: true, role: true, department: true } } },
      })
    : await prisma.hrmKpiSettlement.create({
        data,
        include: { staff: { select: { name: true, email: true, role: true, department: true } } },
      })

  return NextResponse.json(mapSettlement(row))
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 })

  const status = body.status as string
  if (status !== "approved" && status !== "rejected") {
    return NextResponse.json({ error: "status must be approved or rejected" }, { status: 400 })
  }

  const existing = await prisma.hrmKpiSettlement.findUnique({ where: { id: body.id } })
  if (!existing) return NextResponse.json({ error: "Settlement not found" }, { status: 404 })
  if (existing.status !== "submitted") {
    return NextResponse.json({ error: "Only submitted settlements can be reviewed" }, { status: 400 })
  }

  const entries = (Array.isArray(existing.entries) ? existing.entries : []) as SettlementEntry[]
  const periodKey = `${existing.periodStart}_${existing.periodEnd}`

  if (status === "approved") {
    await Promise.all(
      entries.map(entry =>
        prisma.hrmStaffKpi.updateMany({
          where: { id: entry.staffKpiId, staffId: existing.staffId },
          data: {
            approvedActual: entry.actual,
            lastApprovedPeriod: periodKey,
          },
        })
      )
    )
  }

  const row = await prisma.hrmKpiSettlement.update({
    where: { id: body.id },
    data: {
      status,
      adminNotes: (body.adminNotes ?? "").trim(),
      reviewedAt: new Date(),
      reviewedBy: body.reviewedBy ?? "",
    },
    include: { staff: { select: { name: true, email: true, role: true, department: true } } },
  })

  return NextResponse.json(mapSettlement(row))
}
