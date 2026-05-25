import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { withAcctApi } from "@/lib/accounting/api-route"

export async function GET() {
  return withAcctApi(async () => {
    const statements = await prisma.acctBankStatement.findMany({
      orderBy: { date: "desc" },
      include: { lines: true },
    })
    return NextResponse.json(statements)
  })
}

export async function POST(req: NextRequest) {
  return withAcctApi(async () => {
    const body = await req.json()
    const stmt = await prisma.acctBankStatement.create({
      data: {
        name: String(body.name),
        bankAccountId: String(body.bankAccountId),
        date: new Date(body.date),
        balanceStart: Number(body.balanceStart),
        balanceEnd: Number(body.balanceEnd),
        lines: {
          create: (body.lines ?? []).map((l: { date: string; paymentRef?: string; partnerName?: string; amount: number }) => ({
            date: new Date(l.date),
            paymentRef: l.paymentRef ?? "",
            partnerName: l.partnerName ?? "",
            amount: Number(l.amount),
          })),
        },
      },
      include: { lines: true },
    })
    return NextResponse.json(stmt)
  })
}

export async function PATCH(req: NextRequest) {
  return withAcctApi(async () => {
    const body = await req.json()
    if (body.action === "reconcile" && body.lineId) {
      await prisma.acctBankStatementLine.update({
        where: { id: body.lineId },
        data: { reconciled: true, moveLineId: body.moveLineId ?? "" },
      })
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  })
}
