import { NextRequest, NextResponse } from "next/server"
import { activateWarrantyBySerial } from "@/lib/warranty-activation"

/**
 * ERP-only warranty start from a product QR.
 * Unlike /api/warranty/activate, this can create a warranty for an unregistered serial.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const scan = String(body.scan ?? body.serialNumber ?? body.qr ?? "").trim()
    if (!scan) {
      return NextResponse.json({ error: "Scan payload is required" }, { status: 400 })
    }

    const result = await activateWarrantyBySerial(scan, {
      allowUnregistered: true,
      activatedBy: body.activatedBy ? String(body.activatedBy) : "ERP admin",
      customerName: body.customerName ? String(body.customerName) : undefined,
      customerPhone: body.customerPhone ? String(body.customerPhone) : undefined,
      productName: body.productName ? String(body.productName) : undefined,
    })

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, code: result.code },
        { status: result.code === "NOT_FOUND" ? 404 : 400 },
      )
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error("[warranties/scan-start]", err)
    return NextResponse.json({ error: "Failed to start warranty from scan" }, { status: 500 })
  }
}
