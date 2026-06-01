import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

function mapTemplate(t: {
  id: string
  name: string
  description: string
  unit: string
  defaultTarget: number
  defaultWeight: number
  periodType: string
  active: boolean
  sortOrder: number
  createdBy: string
  createdAt: Date
}) {
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    unit: t.unit,
    defaultTarget: t.defaultTarget,
    defaultWeight: t.defaultWeight,
    periodType: t.periodType,
    active: t.active,
    sortOrder: t.sortOrder,
    createdBy: t.createdBy,
    createdAt: t.createdAt.toISOString(),
  }
}

export async function GET() {
  const rows = await prisma.hrmKpiTemplate.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  })
  return NextResponse.json(rows.map(mapTemplate))
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 })
  }
  const row = await prisma.hrmKpiTemplate.create({
    data: {
      name: body.name.trim(),
      description: (body.description ?? "").trim(),
      unit: body.unit ?? "count",
      defaultTarget: Number(body.defaultTarget) || 0,
      defaultWeight: Number(body.defaultWeight) || 0,
      periodType: body.periodType ?? "weekly",
      active: body.active !== false,
      sortOrder: Number(body.sortOrder) || 0,
      createdBy: body.createdBy ?? "",
    },
  })
  return NextResponse.json(mapTemplate(row))
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 })

  const row = await prisma.hrmKpiTemplate.update({
    where: { id: body.id },
    data: {
      ...(body.name !== undefined && { name: String(body.name).trim() }),
      ...(body.description !== undefined && { description: String(body.description).trim() }),
      ...(body.unit !== undefined && { unit: body.unit }),
      ...(body.defaultTarget !== undefined && { defaultTarget: Number(body.defaultTarget) || 0 }),
      ...(body.defaultWeight !== undefined && { defaultWeight: Number(body.defaultWeight) || 0 }),
      ...(body.periodType !== undefined && { periodType: body.periodType }),
      ...(body.active !== undefined && { active: Boolean(body.active) }),
      ...(body.sortOrder !== undefined && { sortOrder: Number(body.sortOrder) || 0 }),
    },
  })
  return NextResponse.json(mapTemplate(row))
}

export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })
  await prisma.hrmKpiTemplate.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
