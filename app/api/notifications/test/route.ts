import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { sendTestAppNotification } from "@/lib/notifications-server"

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const userId = String(body.userId || "").trim()
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 })
  }

  const user = await prisma.erpUser.findUnique({ where: { id: userId }, select: { id: true } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const result = await sendTestAppNotification(userId)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({
    ok: true,
    recipients: result.recipients,
    phones: result.phones,
    message:
      result.phones > 0
        ? `Test sent. ${result.phones} phone${result.phones === 1 ? "" : "s"} should get a lock-screen alert now, even if the app is closed.`
        : "Alert saved in the ERP bell, but this phone is not subscribed yet. Allow notifications when asked, then tap Test alert again.",
  })
}
