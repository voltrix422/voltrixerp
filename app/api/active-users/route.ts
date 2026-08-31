import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { ROLE_LABELS, type UserRole } from "@/lib/auth"

type Presence = {
  lastSeen: number
  userAgent?: string
  ip?: string
  userId: string
  userName: string
  role?: string
}

const activeUsers = new Map<string, Presence>()

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for") || ""
  const first = forwarded.split(",")[0]?.trim()
  return first || request.headers.get("x-real-ip") || "unknown"
}

function clip(value: unknown, max = 80): string {
  return String(value ?? "").trim().slice(0, max)
}

function roleLabel(role?: string): string | undefined {
  if (!role) return undefined
  return ROLE_LABELS[role as UserRole] || role
}

function isNamedErpUser(data: Presence | undefined): data is Presence {
  return Boolean(data?.userId && data.userName)
}

function cleanupInactiveUsers() {
  const now = Date.now()
  const timeout = 5 * 60 * 1000
  for (const [sessionId, data] of activeUsers.entries()) {
    if (now - data.lastSeen > timeout || !isNamedErpUser(data)) {
      activeUsers.delete(sessionId)
    }
  }
}

function listErpUsers() {
  cleanupInactiveUsers()

  const byUserId = new Map<string, Presence & { sessionId: string }>()
  for (const [sessionId, data] of activeUsers.entries()) {
    if (!isNamedErpUser(data)) continue
    const existing = byUserId.get(data.userId)
    if (!existing || data.lastSeen > existing.lastSeen) {
      byUserId.set(data.userId, { sessionId, ...data })
    }
  }

  return Array.from(byUserId.values())
    .sort((a, b) => b.lastSeen - a.lastSeen)
    .map((row) => ({
      sessionId: row.sessionId,
      lastSeen: row.lastSeen,
      userAgent: row.userAgent,
      ip: row.ip,
      userId: row.userId,
      userName: row.userName,
      role: row.role || null,
      roleLabel: roleLabel(row.role) || null,
    }))
}

export async function GET() {
  const visitors = listErpUsers()
  return NextResponse.json({
    count: visitors.length,
    visitors,
    active: true,
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      userId?: string
      userName?: string
      role?: string
    }

    const requestedId = clip(body.userId, 64)
    if (!requestedId) {
      return NextResponse.json({
        count: listErpUsers().length,
        sessionId: null,
        active: true,
        ignored: true,
      })
    }

    const row = await prisma.erpUser.findUnique({
      where: { id: requestedId },
      select: { id: true, name: true, role: true },
    })

    const userName = clip(row?.name) || clip(body.userName)
    if (!row || !userName) {
      return NextResponse.json({
        count: listErpUsers().length,
        sessionId: null,
        active: true,
        ignored: true,
      })
    }

    const sessionId = `user:${row.id}`
    activeUsers.set(sessionId, {
      lastSeen: Date.now(),
      userAgent: request.headers.get("user-agent") || undefined,
      ip: clientIp(request),
      userId: row.id,
      userName,
      role: clip(row.role, 40) || clip(body.role, 40),
    })

    const visitors = listErpUsers()
    return NextResponse.json({
      count: visitors.length,
      sessionId,
      active: true,
    })
  } catch (error) {
    console.error("Error tracking active user:", error)
    return NextResponse.json(
      { error: "Failed to track user activity", active: false },
      { status: 500 },
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const sessionId = request.headers.get("x-session-id")
    if (sessionId && activeUsers.has(sessionId)) {
      activeUsers.delete(sessionId)
    }

    return NextResponse.json({
      count: listErpUsers().length,
      active: true,
    })
  } catch (error) {
    console.error("Error removing active user:", error)
    return NextResponse.json(
      { error: "Failed to remove user", active: false },
      { status: 500 },
    )
  }
}
