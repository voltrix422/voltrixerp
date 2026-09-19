import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const userId = String(body.userId || "").trim()
  const endpoint = String(body.endpoint || "").trim()
  const p256dh = String(body.keys?.p256dh || "").trim()
  const auth = String(body.keys?.auth || "").trim()
  const userAgent = String(body.userAgent || "").slice(0, 400)

  if (!userId || !endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "userId, endpoint and keys required" }, { status: 400 })
  }

  const user = await prisma.erpUser.findUnique({ where: { id: userId }, select: { id: true } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const row = await prisma.erpPushSubscription.upsert({
    where: { endpoint },
    create: { userId, endpoint, p256dh, auth, userAgent },
    update: { userId, p256dh, auth, userAgent },
  })

  return NextResponse.json({ ok: true, id: row.id })
}

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const endpoint = String(body.endpoint || "").trim()
  if (!endpoint) return NextResponse.json({ error: "endpoint required" }, { status: 400 })
  await prisma.erpPushSubscription.deleteMany({ where: { endpoint } })
  return NextResponse.json({ ok: true })
}
