import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const warrantyId = searchParams.get("id")

  if (!warrantyId) {
    return NextResponse.json({ error: "Warranty ID is required" }, { status: 400 })
  }

  try {
    const warranty = await prisma.erpWarranty.findUnique({
      where: { warrantyId }
    })

    if (!warranty) {
      return NextResponse.json({ error: "Warranty not found" }, { status: 404 })
    }

    return NextResponse.json(warranty)
  } catch (error: any) {
    console.error("Error looking up warranty:", error)
    return NextResponse.json({ error: "Failed to lookup warranty" }, { status: 500 })
  }
}
