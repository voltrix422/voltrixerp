import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import type { DailyReportLog } from "@/lib/hrm-daily-reports"

function parseLogs(raw: unknown): DailyReportLog[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((x): x is Record<string, unknown> => x && typeof x === "object")
    .map((x, i) => ({
      id: String(x.id ?? `log-${i}`),
      timeFrom: String(x.timeFrom ?? ""),
      timeTo: String(x.timeTo ?? ""),
      details: String(x.details ?? ""),
      imageUrls: Array.isArray(x.imageUrls)
        ? x.imageUrls.filter((u): u is string => typeof u === "string")
        : [],
    }))
}

function mapReport(
  r: {
    id: string
    staffId: string
    reportDate: string
    status: string
    logs: unknown
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
    id: r.id,
    staffId: r.staffId,
    staffName: r.staff?.name ?? "",
    staffEmail: r.staff?.email ?? "",
    staffRole: r.staff?.role ?? "",
    staffDepartment: r.staff?.department ?? "",
    reportDate: r.reportDate,
    status: r.status,
    logs: parseLogs(r.logs),
    employeeNotes: r.employeeNotes,
    adminNotes: r.adminNotes,
    submittedAt: r.submittedAt?.toISOString() ?? null,
    submittedBy: r.submittedBy,
    reviewedAt: r.reviewedAt?.toISOString() ?? null,
    reviewedBy: r.reviewedBy,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }
}

export async function GET(req: NextRequest) {
  const staffId = req.nextUrl.searchParams.get("staffId")
  const reportDate = req.nextUrl.searchParams.get("reportDate")
  const status = req.nextUrl.searchParams.get("status")
  const from = req.nextUrl.searchParams.get("from")
  const to = req.nextUrl.searchParams.get("to")

  const where: Record<string, unknown> = {}
  if (staffId) where.staffId = staffId
  if (reportDate) where.reportDate = reportDate
  if (status) where.status = status
  if (from || to) {
    where.reportDate = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    }
  }

  const rows = await prisma.hrmDailyReport.findMany({
    where,
    include: {
      staff: { select: { name: true, email: true, role: true, department: true } },
    },
    orderBy: [{ reportDate: "desc" }, { submittedAt: "desc" }],
    take: staffId ? 90 : 300,
  })

  return NextResponse.json(rows.map(mapReport))
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  if (!body.staffId || !body.reportDate) {
    return NextResponse.json({ error: "staffId and reportDate required" }, { status: 400 })
  }

  const logs = parseLogs(body.logs)
  const wantsSubmit = body.status === "submitted"
  const wantsDraft = body.status === "draft"

  const existing = await prisma.hrmDailyReport.findUnique({
    where: {
      staffId_reportDate: {
        staffId: body.staffId,
        reportDate: body.reportDate,
      },
    },
  })

  if (existing) {
    if (existing.status === "approved") {
      return NextResponse.json({ error: "This day is already reviewed and locked." }, { status: 409 })
    }
    if (existing.status === "submitted" && wantsSubmit) {
      return NextResponse.json({ error: "Already sent to admin for this date." }, { status: 409 })
    }
    if (existing.status === "submitted" && !wantsDraft) {
      return NextResponse.json({ error: "Cannot edit while waiting for admin review." }, { status: 409 })
    }
  }

  if (wantsSubmit && logs.length === 0) {
    return NextResponse.json({ error: "Add at least one activity log before submitting." }, { status: 400 })
  }

  const status = wantsSubmit ? "submitted" : "draft"
  const isSubmit = status === "submitted"

  const data = {
    staffId: body.staffId,
    reportDate: body.reportDate,
    status,
    logs,
    employeeNotes: (body.employeeNotes ?? "").trim(),
    adminNotes: isSubmit ? "" : existing?.adminNotes ?? "",
    submittedAt: isSubmit ? new Date() : null,
    submittedBy: isSubmit ? (body.submittedBy ?? "") : "",
    reviewedAt: null,
    reviewedBy: "",
  }

  const row = existing
    ? await prisma.hrmDailyReport.update({
        where: { id: existing.id },
        data,
        include: { staff: { select: { name: true, email: true, role: true, department: true } } },
      })
    : await prisma.hrmDailyReport.create({
        data,
        include: { staff: { select: { name: true, email: true, role: true, department: true } } },
      })

  return NextResponse.json(mapReport(row))
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 })

  const status = body.status as string
  if (status !== "approved" && status !== "rejected") {
    return NextResponse.json({ error: "status must be approved or rejected" }, { status: 400 })
  }

  const existing = await prisma.hrmDailyReport.findUnique({ where: { id: body.id } })
  if (!existing) return NextResponse.json({ error: "Report not found" }, { status: 404 })
  if (existing.status !== "submitted") {
    return NextResponse.json({ error: "Only submitted reports can be reviewed" }, { status: 400 })
  }

  const row = await prisma.hrmDailyReport.update({
    where: { id: body.id },
    data: {
      status,
      adminNotes: (body.adminNotes ?? "").trim(),
      reviewedAt: new Date(),
      reviewedBy: body.reviewedBy ?? "",
    },
    include: { staff: { select: { name: true, email: true, role: true, department: true } } },
  })

  return NextResponse.json(mapReport(row))
}
