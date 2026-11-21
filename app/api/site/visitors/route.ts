import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"

async function ensureCounter() {
  return prisma.erpSiteVisitorCounter.upsert({
    where: { id: "main" },
    create: { id: "main", count: 0 },
    update: {},
  })
}

/** Read current count without incrementing (for live polling). */
export async function GET() {
  try {
    const row = await ensureCounter()
    return NextResponse.json({
      count: row.count,
      updatedAt: row.updatedAt.toISOString(),
    })
  } catch (e) {
    console.error("[site/visitors GET]", e)
    return NextResponse.json({ error: "Failed to load visitor count" }, { status: 500 })
  }
}

/** Increment by 1 and return the new count (one page visit). */
export async function POST() {
  try {
    await ensureCounter()
    const row = await prisma.erpSiteVisitorCounter.update({
      where: { id: "main" },
      data: { count: { increment: 1 } },
    })
    return NextResponse.json({
      count: row.count,
      updatedAt: row.updatedAt.toISOString(),
    })
  } catch (e) {
    console.error("[site/visitors POST]", e)
    return NextResponse.json({ error: "Failed to update visitor count" }, { status: 500 })
  }
}
