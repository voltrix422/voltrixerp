import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET() {
  const count = await prisma.erpPurchaseOrder.count()
  return NextResponse.json({ count })
}
