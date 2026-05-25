import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { postPayment } from "@/lib/accounting/posting"
import { withAcctApi } from "@/lib/accounting/api-route"

export async function GET(req: NextRequest) {
  return withAcctApi(async () => {
    const type = new URL(req.url).searchParams.get("type")
    const payments = await prisma.acctPayment.findMany({
      where: type ? { paymentType: type } : {},
      orderBy: { date: "desc" },
      take: 200,
    })
    return NextResponse.json(payments)
  })
}

export async function POST(req: NextRequest) {
  return withAcctApi(async () => {
    const body = await req.json()
    if (body.action === "post" && body.id) {
      const pay = await postPayment(body.id)
      return NextResponse.json(pay)
    }

    const pay = await prisma.acctPayment.create({
      data: {
        paymentType: String(body.paymentType),
        partnerId: String(body.partnerId),
        amount: Number(body.amount),
        date: new Date(body.date),
        journalId: String(body.journalId),
        memo: String(body.memo ?? ""),
        invoiceIds: body.invoiceIds ?? [],
        createdBy: String(body.createdBy ?? ""),
      },
    })
    return NextResponse.json(pay)
  })
}
