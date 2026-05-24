import { NextRequest, NextResponse } from "next/server"
import { activateWarrantyBySerial } from "@/lib/warranty-activation"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const scan = String(body.scan ?? body.serialNumber ?? body.qr ?? "").trim()
    if (!scan) {
      return NextResponse.json({ error: "Scan payload is required" }, { status: 400 })
    }

    const result = await activateWarrantyBySerial(scan, {
      activatedBy: body.activatedBy ? String(body.activatedBy) : undefined,
      customerName: body.customerName ? String(body.customerName) : undefined,
      customerPhone: body.customerPhone ? String(body.customerPhone) : undefined,
      customerAddress: body.customerAddress ? String(body.customerAddress) : undefined,
      installLocation: body.installLocation ? String(body.installLocation) : undefined,
      invoiceDocumentUrl: body.invoiceDocumentUrl ? String(body.invoiceDocumentUrl) : undefined,
    })

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, code: result.code },
        { status: result.code === "NOT_FOUND" ? 404 : 400 },
      )
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error("[warranty/activate]", err)
    return NextResponse.json({ error: "Failed to activate warranty" }, { status: 500 })
  }
}
