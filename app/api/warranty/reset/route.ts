import { NextRequest, NextResponse } from "next/server"
import { resetWarrantyToPending } from "@/lib/warranty-activation"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const id = String(body.id ?? "").trim()
    if (!id) {
      return NextResponse.json({ error: "Warranty id is required" }, { status: 400 })
    }

    const result = await resetWarrantyToPending(id)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error("[warranty/reset]", err)
    return NextResponse.json({ error: "Failed to reset warranty" }, { status: 500 })
  }
}
