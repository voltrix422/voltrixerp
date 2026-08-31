import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { ROLE_LABELS, type UserRole } from "@/lib/auth"

type Presence = {
  lastSeen: number
  userAgent?: string
  ip?: string
  userId?: string
  userName?: string
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

function getUniqueCount(): number {
  const keys = new Set<string>()
  for (const [sessionId, data] of activeUsers.entries()) {
    keys.add(data.userId || data.ip || sessionId)
  }
  return keys.size
}

function cleanupInactiveUsers() {
  const now = Date.now()
  const timeout = 5 * 60 * 1000
  for (const [sessionId, data] of activeUsers.entries()) {
    if (now - data.lastSeen > timeout) {
      activeUsers.delete(sessionId)
    }
  }
}

function listVisitors() {
  cleanupInactiveUsers()

  const identityMap = new Map<string, Presence & { sessionId: string }>()
  for (const [sessionId, data] of activeUsers.entries()) {
    const key = data.userId || data.ip || sessionId
    const existing = identityMap.get(key)
    if (!existing || data.lastSeen > existing.lastSeen) {
      identityMap.set(key, { sessionId, ...data })
    }
  }

  return Array.from(identityMap.values())
    .sort((a, b) => b.lastSeen - a.lastSeen)
    .map((row) => ({
      sessionId: row.sessionId,
      lastSeen: row.lastSeen,
      userAgent: row.userAgent,
      ip: row.ip,
      userId: row.userId || null,
      userName: row.userName || null,
      role: row.role || null,
      roleLabel: roleLabel(row.role) || null,
    }))
}

export async function GET() {
  const visitors = listVisitors()
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

    let userId = clip(body.userId, 64)
    let userName = clip(body.userName)
    let role = clip(body.role, 40)

    if (userId) {
      try {
        const row = await prisma.erpUser.findUnique({
          where: { id: userId },
          select: { id: true, name: true, role: true },
        })
        if (row) {
          userId = row.id
          userName = clip(row.name) || userName
          role = clip(row.role, 40) || role
        }
      } catch {
        // Keep the name from the ERP session if the lookup fails.
      }
    }

    const cookieSession = request.cookies.get("session-id")?.value
    const headerSession = request.headers.get("x-session-id")
    const sessionId =
      (userId ? `user:${userId}` : "") ||
      cookieSession ||
      headerSession ||
      `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

    const previous = activeUsers.get(sessionId)
    activeUsers.set(sessionId, {
      lastSeen: Date.now(),
      userAgent: request.headers.get("user-agent") || previous?.userAgent,
      ip: clientIp(request),
      userId: userId || previous?.userId,
      userName: userName || previous?.userName,
      role: role || previous?.role,
    })

    cleanupInactiveUsers()

    const res = NextResponse.json({
      count: getUniqueCount(),
      sessionId,
      active: true,
    })
    res.cookies.set("session-id", sessionId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60,
    })
    return res
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
    const sessionId =
      request.cookies.get("session-id")?.value || request.headers.get("x-session-id")

    if (sessionId && activeUsers.has(sessionId)) {
      activeUsers.delete(sessionId)
    }

    return NextResponse.json({
      count: getUniqueCount(),
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
