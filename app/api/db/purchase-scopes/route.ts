import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

const DEFAULTS = [
  { id: "P1", name: "Main Office", active: true },
  { id: "P2", name: "Attock", active: true },
  { id: "P3", name: "Wah Cantt", active: true },
]

async function ensureDefaults() {
  const count = await prisma.erpPurchaseScope.count()
  if (count > 0) return
  await prisma.erpPurchaseScope.createMany({
    data: DEFAULTS,
    skipDuplicates: true,
  })
}

export async function GET() {
  await ensureDefaults()
  const scopes = await prisma.erpPurchaseScope.findMany({
    where: { active: true },
    orderBy: { id: "asc" },
  })
  return NextResponse.json(scopes.length > 0 ? scopes : DEFAULTS)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const id = String(body.id || "").trim().toUpperCase()
  const name = String(body.name || "").trim()
  if (!id || !name) {
    return NextResponse.json({ error: "id and name are required" }, { status: 400 })
  }

  const scope = await prisma.erpPurchaseScope.upsert({
    where: { id },
    update: {
      name,
      active: body.active !== false,
    },
    create: {
      id,
      name,
      active: body.active !== false,
    },
  })
  return NextResponse.json(scope)
}
