import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

function mapTerminal(row: {
  id: string
  name: string
  code: string
  location: string
  isActive: boolean
  createdAt: Date
}) {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    location: row.location,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
  }
}

export async function GET() {
  const rows = await prisma.erpPosTerminal.findMany({ orderBy: { createdAt: "asc" } })
  return NextResponse.json(rows.map(mapTerminal))
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const code = String(body.code || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
  const name = String(body.name || "").trim()
  if (!name || !code) {
    return NextResponse.json({ error: "Name and code are required" }, { status: 400 })
  }

  const row = body.id
    ? await prisma.erpPosTerminal.update({
        where: { id: body.id },
        data: {
          name,
          code,
          location: String(body.location || "").trim(),
          isActive: body.isActive !== false,
        },
      })
    : await prisma.erpPosTerminal.create({
        data: {
          name,
          code,
          location: String(body.location || "").trim(),
          isActive: true,
        },
      })

  return NextResponse.json(mapTerminal(row))
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })
  await prisma.erpPosTerminal.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
