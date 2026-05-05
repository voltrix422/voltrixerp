import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const count = await prisma.crmQuotation.count()
    return NextResponse.json({ count })
  } catch (error) {
    console.error("Error counting quotations:", error)
    return NextResponse.json({ count: 0 })
  }
}
