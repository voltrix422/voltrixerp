import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { computeWeightedScore, type SettlementEntry } from "@/lib/hrm-kpis"

function mapSettlement(s: {
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
}) {
  return {
    id: s.id,
    staffId: s.staffId,
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

  const where: Record<string, unknown> = {}
  if (staffId) where.staffId = staffId
  if (periodStart) where.periodStart = periodStart
  if (periodEnd) where.periodEnd = periodEnd

  const rows = await prisma.hrmKpiSettlement.findMany({
    where,
    orderBy: { periodStart: "desc" },
    take: staffId ? 52 : 100,
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
  const status = body.status === "submitted" ? "submitted" : "draft"
  const isSubmit = status === "submitted"

  const existing = await prisma.hrmKpiSettlement.findUnique({
    where: {
      staffId_periodStart_periodEnd: {
        staffId: body.staffId,
        periodStart: body.periodStart,
        periodEnd: body.periodEnd,
      },
    },
  })

  if (existing && existing.status !== "draft" && !body.forceDraft) {
    return NextResponse.json(
      { error: "Settlement already submitted for this period" },
      { status: 409 }
    )
  }

  const data = {
    staffId: body.staffId,
    periodType: body.periodType ?? "weekly",
    periodStart: body.periodStart,
    periodEnd: body.periodEnd,
    status,
    entries,
    weightedScore,
    employeeNotes: (body.employeeNotes ?? "").trim(),
    submittedAt: isSubmit ? new Date() : null,
    submittedBy: isSubmit ? (body.submittedBy ?? "") : "",
  }

  const row = existing
    ? await prisma.hrmKpiSettlement.update({
        where: { id: existing.id },
        data,
      })
    : await prisma.hrmKpiSettlement.create({ data })

  return NextResponse.json(mapSettlement(row))
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 })

  const status = body.status as string
  if (status !== "approved" && status !== "rejected") {
    return NextResponse.json({ error: "status must be approved or rejected" }, { status: 400 })
  }

  const row = await prisma.hrmKpiSettlement.update({
    where: { id: body.id },
    data: {
      status,
      adminNotes: (body.adminNotes ?? "").trim(),
      reviewedAt: new Date(),
      reviewedBy: body.reviewedBy ?? "",
    },
  })
  return NextResponse.json(mapSettlement(row))
}
