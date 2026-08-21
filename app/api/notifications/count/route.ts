import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET(req: NextRequest) {
  const userId = new URL(req.url).searchParams.get("userId")
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 })
  }

  const count = await prisma.erpNotification.count({
    where: { userId, read: false, type: { not: "chat_message" } },
  })

  return NextResponse.json({ count })
}
