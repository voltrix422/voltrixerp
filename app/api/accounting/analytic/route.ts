import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET() {
  return NextResponse.json(await prisma.acctAnalyticAccount.findMany())
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const row = await prisma.acctAnalyticAccount.create({
    data: {
      code: String(body.code ?? ""),
      name: String(body.name),
      plan: String(body.plan ?? "Projects"),
    },
  })
  return NextResponse.json(row)
}
