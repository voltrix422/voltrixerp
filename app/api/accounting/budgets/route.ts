import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET() {
  return NextResponse.json(await prisma.acctBudget.findMany())
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const budget = await prisma.acctBudget.create({
    data: {
      name: String(body.name),
      fiscalYear: Number(body.fiscalYear),
      lines: body.lines ?? [],
      state: "draft",
    },
  })
  return NextResponse.json(budget)
}
