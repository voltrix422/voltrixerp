import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { withAcctApi } from "@/lib/accounting/api-route"

export async function GET() {
  return withAcctApi(async () => {
    return NextResponse.json(await prisma.acctAnalyticAccount.findMany())
  })
}

export async function POST(req: NextRequest) {
  return withAcctApi(async () => {
    const body = await req.json()
    const row = await prisma.acctAnalyticAccount.create({
      data: {
        code: String(body.code ?? ""),
        name: String(body.name),
        plan: String(body.plan ?? "Projects"),
      },
    })
    return NextResponse.json(row)
  })
}
