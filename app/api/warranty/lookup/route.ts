import { NextRequest, NextResponse } from "next/server"
import { lookupWarrantyForPublic } from "@/lib/warranty-activation"

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
      return NextResponse.json({ error: "Warranty not found" }, { status: 404 })
    }

    if (result.pending) {
      return NextResponse.json({
        status: "pending_activation",
        serialNumber: result.warranty.serialNumber,
        productName: result.warranty.productName,
        customerName: result.warranty.customerName,
        customerPhone: result.warranty.customerPhone,
        customerAddress: result.warranty.customerAddress,
        invoiceNumber: result.warranty.invoiceNumber,
        message:
          "Warranty has not been started yet. Open Start warranty on voltrixbatteries.com/warranty and scan your product QR, or ask your dealer to start it.",
      })
    }

    if (!result.active) {
      return NextResponse.json({
        status: "inactive",
        error: "This warranty is not active yet.",
      }, { status: 403 })
    }

    return NextResponse.json(result.warranty)
  } catch (error: unknown) {
    console.error("Error looking up warranty:", error)
    return NextResponse.json({ error: "Failed to lookup warranty" }, { status: 500 })
  }
}
