import { NextRequest, NextResponse } from "next/server"
import { lookupWarrantyForPublic, previewWarrantyStart } from "@/lib/warranty-activation"

const NO_WARRANTY_DATA_MSG = "No warranty data exists for this product."

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const raw =
    searchParams.get("id") ||
    searchParams.get("sn") ||
    searchParams.get("serial") ||
    searchParams.get("scan")

  if (!raw?.trim()) {
    return NextResponse.json({ error: "Warranty ID or serial number is required" }, { status: 400 })
  }

  try {
    const result = await lookupWarrantyForPublic(raw.trim())

    if (!result) {
      const preview = await previewWarrantyStart(raw.trim())
      if (preview.ok && preview.status === "delivered_pending") {
        return NextResponse.json({ error: NO_WARRANTY_DATA_MSG }, { status: 404 })
      }
      return NextResponse.json({ error: "Warranty not found" }, { status: 404 })
    }

    if (result.pending || !result.active) {
      return NextResponse.json({ error: NO_WARRANTY_DATA_MSG }, { status: 404 })
    }

    return NextResponse.json(result.warranty)
  } catch (error: unknown) {
    console.error("Error looking up warranty:", error)
    return NextResponse.json({ error: "Failed to lookup warranty" }, { status: 500 })
  }
}
