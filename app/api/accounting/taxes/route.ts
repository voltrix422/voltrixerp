import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { withAcctApi } from "@/lib/accounting/api-route"

export async function GET() {
  return withAcctApi(async () => {
    return NextResponse.json(await prisma.acctTax.findMany())
  })
}

export async function POST(req: NextRequest) {
  return withAcctApi(async () => {
    const body = await req.json()
    const tax = await prisma.acctTax.create({
      data: {
        name: String(body.name),
        rate: Number(body.rate),
        taxType: String(body.taxType),
        accountCode: String(body.accountCode ?? ""),
      },
    })
    return NextResponse.json(tax)
  })
}
