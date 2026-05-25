import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { withAcctApi } from "@/lib/accounting/api-route"

export async function GET() {
  return withAcctApi(async () => {
    const journals = await prisma.acctJournal.findMany({ orderBy: { code: "asc" } })
    return NextResponse.json(journals)
  })
}

export async function POST(req: NextRequest) {
  return withAcctApi(async () => {
    const body = await req.json()
    const journal = await prisma.acctJournal.create({
      data: {
        code: String(body.code),
        name: String(body.name),
        journalType: String(body.journalType),
        defaultAccountId: String(body.defaultAccountId ?? ""),
        sequencePrefix: String(body.sequencePrefix ?? body.code),
      },
    })
    return NextResponse.json(journal)
  })
}
