import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()
  const user = await prisma.erpUser.findFirst({ where: { email, password } })
  if (!user) return NextResponse.json(null)
  return NextResponse.json(user)
}
