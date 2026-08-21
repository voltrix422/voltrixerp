import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { prisma } from "@/lib/db"

function parseChatLink(link: string) {
  // chat:<senderId>:<recipientId> or chat:<senderId>:<recipientId>:<pairId>
  const parts = String(link || "").split(":")
  if (parts.length < 3 || parts[0] !== "chat") return null
  return {
    senderId: parts[1],
    recipientId: parts[2],
    pairId: parts[3] || null,
  }
}

function chatLink(senderId: string, recipientId: string, pairId?: string) {
  return pairId
    ? `chat:${senderId}:${recipientId}:${pairId}`
    : `chat:${senderId}:${recipientId}`
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = String(searchParams.get("userId") || "").trim()
  const partnerId = String(searchParams.get("partnerId") || "").trim()
  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 })
  }

  if (partnerId) {
    const legacyA = chatLink(userId, partnerId)
    const legacyB = chatLink(partnerId, userId)
    const rows = await prisma.erpNotification.findMany({
      where: {
        userId,
        type: "chat_message",
        OR: [
          { link: legacyA },
          { link: legacyB },
          { link: { startsWith: `${legacyA}:` } },
          { link: { startsWith: `${legacyB}:` } },
        ],
      },
      orderBy: { createdAt: "asc" },
    })

    // Partner copies of *my* messages — used for read receipts (✓✓)
    const myOutgoingLinks = rows
      .map(r => r.link)
      .filter(link => {
        const p = parseChatLink(link)
        return p && p.senderId === userId
      })

    const partnerCopies =
      myOutgoingLinks.length > 0
        ? await prisma.erpNotification.findMany({
            where: {
              userId: partnerId,
              type: "chat_message",
              OR: [
                { link: { in: [...new Set(myOutgoingLinks)] } },
                { link: legacyA },
                { link: { startsWith: `${legacyA}:` } },
              ],
            },
          })
        : []

    const seenByExactLink = new Map<string, boolean>()
    const partnerByMessageKey: Array<{ message: string; createdAt: number; read: boolean }> = []
    for (const copy of partnerCopies) {
      seenByExactLink.set(copy.link, !!copy.read)
      partnerByMessageKey.push({
        message: copy.message,
        createdAt: copy.createdAt.getTime(),
        read: !!copy.read,
      })
    }

    return NextResponse.json(
      rows.map(r => {
        const parsed = parseChatLink(r.link)
        const senderId = parsed?.senderId || ""
        const mine = senderId === userId
        let seen = false
        if (mine) {
          if (parsed?.pairId && seenByExactLink.has(r.link)) {
            seen = !!seenByExactLink.get(r.link)
          } else {
            const t = r.createdAt.getTime()
            const match = partnerByMessageKey.find(
              c =>
                c.message === r.message &&
                Math.abs(c.createdAt - t) < 15_000,
            )
            seen = !!match?.read
          }
        }
        return {
          id: r.id,
          text: r.message,
          senderId,
          recipientId: parsed?.recipientId || "",
          createdAt: r.createdAt,
          mine,
          seen,
        }
      }),
    )
  }

  const [rows, unreadRows, users] = await Promise.all([
    prisma.erpNotification.findMany({
      where: { userId, type: "chat_message" },
      orderBy: { createdAt: "desc" },
      take: 400,
    }),
    prisma.erpNotification.findMany({
      where: { userId, type: "chat_message", read: false },
      select: { link: true, title: true, message: true, createdAt: true },
    }),
    prisma.erpUser.findMany({
      select: { id: true, name: true },
    }),
  ])

  const nameById = new Map(users.map(u => [u.id, String(u.name || "User")]))

  type Conversation = {
    partnerId: string
    text: string
    createdAt: Date
    unreadCount: number
    senderName: string
    partnerName: string
  }

  const unreadByPartner = new Map<string, number>()
  const unreadPreview = new Map<string, { text: string; createdAt: Date; senderName: string }>()
  for (const row of unreadRows) {
    const parsed = parseChatLink(row.link)
    if (!parsed || parsed.recipientId !== userId || !parsed.senderId) continue
    const partner = parsed.senderId
    unreadByPartner.set(partner, (unreadByPartner.get(partner) || 0) + 1)
    const prev = unreadPreview.get(partner)
    if (!prev || row.createdAt > prev.createdAt) {
      unreadPreview.set(partner, {
        text: row.message,
        createdAt: row.createdAt,
        senderName: String(row.title || "").replace(/^From\s+/i, "").trim(),
      })
    }
  }

  const map = new Map<string, Conversation>()
  for (const row of rows) {
    const parsed = parseChatLink(row.link)
    if (!parsed) continue
    const partner = parsed.senderId === userId ? parsed.recipientId : parsed.senderId
    if (!partner) continue
    const senderName =
      parsed.senderId === partner
        ? String(row.title || "").replace(/^From\s+/i, "").trim()
        : ""
    if (map.has(partner)) continue
    map.set(partner, {
      partnerId: partner,
      text: row.message,
      createdAt: row.createdAt,
      unreadCount: 0,
      senderName,
      partnerName: nameById.get(partner) || senderName || "User",
    })
  }

  for (const [partner, count] of unreadByPartner) {
    const preview = unreadPreview.get(partner)
    const existing = map.get(partner)
    if (!existing) {
      map.set(partner, {
        partnerId: partner,
        text: preview?.text || "",
        createdAt: preview?.createdAt || new Date(),
        unreadCount: count,
        senderName: preview?.senderName || "",
        partnerName: nameById.get(partner) || preview?.senderName || "User",
      })
      continue
    }
    existing.unreadCount = count
    if (!existing.senderName && preview?.senderName) existing.senderName = preview.senderName
    existing.partnerName = nameById.get(partner) || existing.senderName || existing.partnerName
  }

  return NextResponse.json(
    Array.from(map.values()).sort((a, b) => {
      if (b.unreadCount !== a.unreadCount) return b.unreadCount - a.unreadCount
      return b.createdAt.getTime() - a.createdAt.getTime()
    }),
  )
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

  const pairId = randomUUID()
  const link = chatLink(senderId, recipientId, pairId)
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
  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 })
  }

  if (body.all) {
    const result = await prisma.erpNotification.updateMany({
      where: { userId, type: "chat_message", read: false },
      data: { read: true },
    })
    return NextResponse.json({ ok: true, updated: result.count })
  }

  const partnerId = String(body.partnerId || "").trim()
  if (!partnerId) {
    return NextResponse.json({ error: "Missing userId or partnerId" }, { status: 400 })
  }

  const incomingLegacy = chatLink(partnerId, userId)
  const result = await prisma.erpNotification.updateMany({
    where: {
      userId,
      type: "chat_message",
      read: false,
      OR: [
        { link: incomingLegacy },
        { link: { startsWith: `${incomingLegacy}:` } },
      ],
    },
    data: { read: true },
  })

  return NextResponse.json({ ok: true, updated: result.count })
}
