import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET(req: NextRequest) {
  const userId = new URL(req.url).searchParams.get("userId")
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 })
  }

  const notifications = await prisma.erpNotification.findMany({
    where: {
      userId,
      // Chat lives in Messages — keep the bell for system alerts only
      NOT: { type: "chat_message" },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  return NextResponse.json(
    notifications.map(n => ({
      ...n,
      createdAt: n.createdAt.toISOString(),
    })),
  )
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()

  if (body.all && body.userId) {
    await prisma.erpNotification.updateMany({
      where: { userId: body.userId, read: false },
      data: { read: true },
    })
    return NextResponse.json({ ok: true })
  }

  if (body.id) {
    await prisma.erpNotification.update({
      where: { id: body.id },
      data: { read: true },
    })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: "id or userId+all required" }, { status: 400 })
}
