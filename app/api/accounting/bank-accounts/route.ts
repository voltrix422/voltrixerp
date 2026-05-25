import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET() {
  return NextResponse.json(await prisma.acctBankAccount.findMany())
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const row = await prisma.acctBankAccount.create({
    data: {
      name: String(body.name),
      accountNumber: String(body.accountNumber ?? ""),
      bankName: String(body.bankName ?? ""),
      journalId: String(body.journalId),
      balance: Number(body.balance ?? 0),
    },
  })
  return NextResponse.json(row)
}
