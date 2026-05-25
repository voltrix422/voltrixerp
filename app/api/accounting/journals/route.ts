import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET() {
  const journals = await prisma.acctJournal.findMany({ orderBy: { code: "asc" } })
  return NextResponse.json(journals)
}

export async function POST(req: NextRequest) {
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
}
