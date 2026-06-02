import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

function mapStaffKpi(k: {
  id: string
  staffId: string
  templateId: string | null
  name: string
  unit: string
  targetValue: number
  weight: number
  periodType: string
  active: boolean
  notes: string
  assignedBy: string
  approvedActual: number
  lastApprovedPeriod: string
  createdAt: Date
}) {
  return {
    id: k.id,
    staffId: k.staffId,
    templateId: k.templateId,
    name: k.name,
    unit: k.unit,
    targetValue: k.targetValue,
    weight: k.weight,
    periodType: k.periodType,
    active: k.active,
    notes: k.notes,
    assignedBy: k.assignedBy,
    approvedActual: k.approvedActual,
    lastApprovedPeriod: k.lastApprovedPeriod,
    createdAt: k.createdAt.toISOString(),
  }
}

export async function GET(req: NextRequest) {
  const staffId = req.nextUrl.searchParams.get("staffId")
  if (!staffId) return NextResponse.json({ error: "staffId required" }, { status: 400 })

  const rows = await prisma.hrmStaffKpi.findMany({
    where: { staffId },
    orderBy: { createdAt: "asc" },
  })
  return NextResponse.json(rows.map(mapStaffKpi))
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  if (!body.staffId || !body.name?.trim()) {
    return NextResponse.json({ error: "staffId and name required" }, { status: 400 })
  }

  let name = body.name.trim()
  let unit = body.unit ?? "count"
  let targetValue = Number(body.targetValue) || 0
  let weight = Number(body.weight) || 0
  let periodType = body.periodType ?? "weekly"

  if (body.templateId) {
    const tpl = await prisma.hrmKpiTemplate.findUnique({ where: { id: body.templateId } })
    if (tpl) {
      if (!body.name) name = tpl.name
      if (body.unit === undefined) unit = tpl.unit
      if (body.targetValue === undefined) targetValue = tpl.defaultTarget
      if (body.weight === undefined) weight = tpl.defaultWeight
      if (body.periodType === undefined) periodType = tpl.periodType
    }
  }

  const normalizedName = name.trim()
  if (body.templateId) {
    const existingByTemplate = await prisma.hrmStaffKpi.findFirst({
      where: {
        staffId: body.staffId,
        templateId: body.templateId,
        active: true,
      },
      select: { id: true },
    })
    if (existingByTemplate) {
      return NextResponse.json({ error: "This KPI template is already assigned to this user." }, { status: 409 })
    }
  }

  const existingByName = await prisma.hrmStaffKpi.findFirst({
    where: {
      staffId: body.staffId,
      periodType,
      active: true,
      name: {
        equals: normalizedName,
        mode: "insensitive",
      },
    },
    select: { id: true },
  })
  if (existingByName) {
    return NextResponse.json({ error: "This KPI is already assigned for the same period." }, { status: 409 })
  }

  const row = await prisma.hrmStaffKpi.create({
    data: {
      staffId: body.staffId,
      templateId: body.templateId || null,
      name,
      unit,
      targetValue,
      weight,
      periodType,
      active: body.active !== false,
      notes: (body.notes ?? "").trim(),
      assignedBy: body.assignedBy ?? "",
    },
  })
  return NextResponse.json(mapStaffKpi(row))
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 })

  const row = await prisma.hrmStaffKpi.update({
    where: { id: body.id },
    data: {
      ...(body.name !== undefined && { name: String(body.name).trim() }),
      ...(body.targetValue !== undefined && { targetValue: Number(body.targetValue) || 0 }),
      ...(body.weight !== undefined && { weight: Number(body.weight) || 0 }),
      ...(body.active !== undefined && { active: Boolean(body.active) }),
      ...(body.notes !== undefined && { notes: String(body.notes).trim() }),
    },
  })
  return NextResponse.json(mapStaffKpi(row))
}

export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })
  await prisma.hrmStaffKpi.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
