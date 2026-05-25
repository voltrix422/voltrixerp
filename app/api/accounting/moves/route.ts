import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createDraftMove, postMove } from "@/lib/accounting/posting"
import { withAcctApi } from "@/lib/accounting/api-route"

export async function GET() {
  return withAcctApi(async () => {
    const moves = await prisma.acctMove.findMany({
      orderBy: { date: "desc" },
      include: { lines: true },
      take: 200,
    })
    return NextResponse.json(moves)
  })
}

export async function POST(req: NextRequest) {
  return withAcctApi(async () => {
    const body = await req.json()
    if (body.action === "post" && body.id) {
      const move = await postMove(body.id)
      return NextResponse.json(move)
    }

    const move = await createDraftMove({
      journalId: body.journalId,
      date: new Date(body.date),
      partnerId: body.partnerId,
      ref: body.ref,
      narration: body.narration,
      lines: body.lines,
      createdBy: body.createdBy,
    })
    if (body.postImmediately) {
      await postMove(move.id)
      const posted = await prisma.acctMove.findUnique({
        where: { id: move.id },
        include: { lines: true },
      })
      return NextResponse.json(posted)
    }
    return NextResponse.json(move)
  })
}
