import { parseLabelOcrText } from "@/lib/parse-label-ocr"
import { parseProductQrPayload, type ParsedProductQr } from "@/lib/parse-product-qr"

function pickBest(primary: string, fallback: string): string {
  const a = primary.trim()
  const b = fallback.trim()
  if (a.length >= b.length) return a || b
  return b || a
}

/** Combine QR decode + OCR into one record (QR wins for SN when both present). */
export function mergeLabelScan(qrRaw = "", ocrRaw = ""): ParsedProductQr {
  const fromQr = qrRaw.trim() ? parseProductQrPayload(qrRaw) : parseProductQrPayload("")
  const fromOcr = ocrRaw.trim() ? parseLabelOcrText(ocrRaw) : parseProductQrPayload("")

  const extra: Record<string, string> = { ...fromOcr.extra, ...fromQr.extra }
  if (fromOcr.productId && !fromQr.productId) extra.productId = fromOcr.productId
  if (fromOcr.extra.poNumber) extra.poNumber = fromOcr.extra.poNumber

  const serialNumber = pickBest(fromQr.serialNumber, fromOcr.serialNumber)
  const model = pickBest(fromQr.model, fromOcr.model)
  const productName = pickBest(fromQr.productName, fromOcr.productName) || model
  const productId = pickBest(fromQr.productId, fromOcr.productId)
  const specs = pickBest(fromQr.specs, fromOcr.specs) || productId

  const notes = [fromQr.notes, fromOcr.notes].filter(Boolean).join(" · ")

  return {
    serialNumber,
    productName,
    model,
    specs,
    notes,
    inventoryStockId: fromQr.inventoryStockId || fromOcr.inventoryStockId,
    productId,
    warrantyStartDate: fromQr.warrantyStartDate || fromOcr.warrantyStartDate,
    warrantyEndDate: fromQr.warrantyEndDate || fromOcr.warrantyEndDate,
    extra,
  }
}
