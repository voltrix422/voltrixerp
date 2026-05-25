import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET() {
  return NextResponse.json(await prisma.acctTax.findMany())
}

export async function POST(req: NextRequest) {
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
}
