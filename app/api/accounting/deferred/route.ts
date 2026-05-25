import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET() {
  return NextResponse.json(await prisma.acctDeferredEntry.findMany())
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const row = await prisma.acctDeferredEntry.create({
    data: {
      name: String(body.name),
      entryType: String(body.entryType),
      totalAmount: Number(body.totalAmount),
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      periods: Number(body.periods ?? 12),
      accountCode: String(body.accountCode),
    },
  })
  return NextResponse.json(row)
}
