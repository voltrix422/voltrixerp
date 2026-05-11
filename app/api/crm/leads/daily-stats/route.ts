import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

function utcDayRange(dateStr: string): { start: Date; end: Date } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim())
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const start = new Date(Date.UTC(y, mo - 1, d, 0, 0, 0, 0))
  const end = new Date(Date.UTC(y, mo - 1, d, 23, 59, 59, 999))
  return { start, end }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const date =
      searchParams.get("date") || new Date().toISOString().slice(0, 10)
    const range = utcDayRange(date)
    if (!range) {
      return NextResponse.json({ error: "Invalid date (use YYYY-MM-DD)" }, { status: 400 })
    }

    const rows = await prisma.crmLeadContact.findMany({
      where: {
        contactedAt: { gte: range.start, lte: range.end },
      },
      select: { contactedBy: true, contactedById: true },
    })

    const agg = new Map<string, { name: string; userId: string | null; count: number }>()
    for (const r of rows) {
      const key = r.contactedById || `name:${r.contactedBy}`
      const prev = agg.get(key) || {
        name: r.contactedBy,
        userId: r.contactedById,
        count: 0,
      }
      prev.count += 1
      agg.set(key, prev)
    }

    const byMember = [...agg.values()].sort((a, b) => b.count - a.count)
    return NextResponse.json({
      date,
      total: rows.length,
      byMember,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Stats failed" }, { status: 500 })
  }
}
