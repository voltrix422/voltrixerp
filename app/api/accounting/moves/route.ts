import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createDraftMove, postMove } from "@/lib/accounting/posting"

export async function GET() {
  const moves = await prisma.acctMove.findMany({
    orderBy: { date: "desc" },
    include: { lines: true },
    take: 200,
  })
  return NextResponse.json(moves)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  if (body.action === "post" && body.id) {
    try {
      const move = await postMove(body.id)
      return NextResponse.json(move)
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 400 })
    }
  }

  try {
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
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
