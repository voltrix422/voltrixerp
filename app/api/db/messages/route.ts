import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

function parseChatLink(link: string) {
  // chat:<senderId>:<recipientId>
  const parts = String(link || "").split(":")
  if (parts.length !== 3 || parts[0] !== "chat") return null
  return { senderId: parts[1], recipientId: parts[2] }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = String(searchParams.get("userId") || "").trim()
  const partnerId = String(searchParams.get("partnerId") || "").trim()
  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 })
  }

  if (partnerId) {
    const a = `chat:${userId}:${partnerId}`
    const b = `chat:${partnerId}:${userId}`
    const rows = await prisma.erpNotification.findMany({
      where: {
        userId,
        type: "chat_message",
        OR: [{ link: a }, { link: b }],
      },
      orderBy: { createdAt: "asc" },
    })
    return NextResponse.json(
      rows.map((r) => {
        const parsed = parseChatLink(r.link)
        const senderId = parsed?.senderId || ""
        return {
          id: r.id,
          text: r.message,
          senderId,
          recipientId: parsed?.recipientId || "",
          createdAt: r.createdAt,
          mine: senderId === userId,
        }
      }),
    )
  }

  const rows = await prisma.erpNotification.findMany({
    where: { userId, type: "chat_message" },
    orderBy: { createdAt: "desc" },
    take: 300,
  })

  const map = new Map<string, { partnerId: string; text: string; createdAt: Date; unreadCount: number }>()
  for (const row of rows) {
    const parsed = parseChatLink(row.link)
    if (!parsed) continue
    const partner = parsed.senderId === userId ? parsed.recipientId : parsed.senderId
    if (!partner) continue
    const existing = map.get(partner)
    const isIncomingUnread = parsed.senderId === partner && parsed.recipientId === userId && !row.read
    if (!existing) {
      map.set(partner, {
        partnerId: partner,
        text: row.message,
        createdAt: row.createdAt,
        unreadCount: isIncomingUnread ? 1 : 0,
      })
      continue
    }
    if (isIncomingUnread) existing.unreadCount += 1
  }

  return NextResponse.json(Array.from(map.values()))
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const senderId = String(body.senderId || "").trim()
  const senderName = String(body.senderName || "").trim()
  const recipientId = String(body.recipientId || "").trim()
  const recipientName = String(body.recipientName || "").trim()
  const text = String(body.text || "").trim()

  if (!senderId || !recipientId || !text) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  const link = `chat:${senderId}:${recipientId}`
  const [forSender, forRecipient] = await Promise.all([
    prisma.erpNotification.create({
      data: {
        userId: senderId,
        title: recipientName ? `To ${recipientName}` : "Sent message",
        message: text,
        type: "chat_message",
        link,
        read: true,
      },
    }),
    prisma.erpNotification.create({
      data: {
        userId: recipientId,
        title: senderName ? `From ${senderName}` : "New message",
        message: text,
        type: "chat_message",
        link,
        read: false,
      },
    }),
  ])

  return NextResponse.json({
    ok: true,
    messageId: forSender.id,
    recipientMessageId: forRecipient.id,
  })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const userId = String(body.userId || "").trim()
  const partnerId = String(body.partnerId || "").trim()
  if (!userId || !partnerId) {
    return NextResponse.json({ error: "Missing userId or partnerId" }, { status: 400 })
  }

  const incomingLink = `chat:${partnerId}:${userId}`
  const result = await prisma.erpNotification.updateMany({
    where: {
      userId,
      type: "chat_message",
      link: incomingLink,
      read: false,
    },
    data: { read: true },
  })

  return NextResponse.json({ ok: true, updated: result.count })
}

