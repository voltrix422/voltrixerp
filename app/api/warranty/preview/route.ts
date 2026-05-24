import { NextRequest, NextResponse } from "next/server"
import { previewWarrantyStart } from "@/lib/warranty-activation"

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const raw =
    searchParams.get("scan") ||
    searchParams.get("id") ||
    searchParams.get("sn") ||
    searchParams.get("serial")

  if (!raw?.trim()) {
    return NextResponse.json({ error: "Scan payload is required" }, { status: 400 })
  }

  try {
    const result = await previewWarrantyStart(raw.trim())
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, code: result.code },
        { status: result.code === "NOT_FOUND" ? 404 : 400 },
      )
    }
    return NextResponse.json(result)
  } catch (err) {
    console.error("[warranty/preview]", err)
    return NextResponse.json({ error: "Failed to verify product" }, { status: 500 })
  }
}
