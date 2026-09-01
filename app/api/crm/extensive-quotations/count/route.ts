import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET() {
  try {
    const count = await prisma.crmExtensiveQuotation.count()
    return NextResponse.json({ count })
  } catch (error) {
    console.error("[extensive-quotations count]", error)
    return NextResponse.json({ count: 0 })
  }
}
