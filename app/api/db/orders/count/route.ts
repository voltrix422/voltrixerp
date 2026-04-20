import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET() {
  const count = await prisma.erpOrder.count()
  return NextResponse.json({ count })
}
