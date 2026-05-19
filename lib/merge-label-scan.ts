import { parseLabelOcrText } from "@/lib/parse-label-ocr"
import {
  looksLikeProductModel,
  looksLikeSerialNumber,
  looksLikeUrlOrPath,
  scoreModelCandidate,
  scoreSerialCandidate,
} from "@/lib/label-field-utils"
import { parseProductQrPayload, type ParsedProductQr } from "@/lib/parse-product-qr"

function pickSerial(
  fromQr: string,
  fromOcr: string,
  ocrExtra: Record<string, string>,
): string {
  if (ocrExtra.snFromLabel === "1" && fromOcr.trim()) return fromOcr

  const qrScore = scoreSerialCandidate(fromQr)
  const ocrScore = scoreSerialCandidate(fromOcr)

  if (ocrScore >= 0 && qrScore < 0) return fromOcr
  if (qrScore >= 0 && ocrScore < 0) return fromQr
  if (ocrScore >= 0 && qrScore >= 0) {
    if (looksLikeUrlOrPath(fromQr) && !looksLikeUrlOrPath(fromOcr)) return fromOcr
    return ocrScore >= qrScore ? fromOcr : fromQr
  }
  return fromOcr || fromQr
}

function pickModel(fromQr: string, fromOcr: string): string {
  const qrScore = scoreModelCandidate(fromQr)
  const ocrScore = scoreModelCandidate(fromOcr)

  if (ocrScore >= qrScore && ocrScore >= 0) return fromOcr
  if (qrScore >= 0) return fromQr
  if (ocrScore >= 0) return fromOcr
  if (looksLikeProductModel(fromOcr)) return fromOcr
  if (looksLikeProductModel(fromQr)) return fromQr
  return fromOcr || fromQr
}

function pickProductId(fromQr: ParsedProductQr, fromOcr: ParsedProductQr): string {
  const ocrPart = fromOcr.extra.partNo || fromOcr.productId
  const ocrItem = fromOcr.extra.itemNo || ""
  if (ocrPart) return ocrPart
  if (fromOcr.productId && !looksLikeUrlOrPath(fromOcr.productId)) return fromOcr.productId
  if (ocrItem) return ocrItem
  if (fromQr.productId && !looksLikeUrlOrPath(fromQr.productId)) return fromQr.productId
  return fromQr.extra.partNo || fromQr.extra.itemNo || ""
}

/** Combine QR decode + OCR — label text wins for model & part numbers; best SN wins. */
export function mergeLabelScan(qrRaw = "", ocrRaw = ""): ParsedProductQr {
  const fromQr = qrRaw.trim() ? parseProductQrPayload(qrRaw) : parseProductQrPayload("")
  const fromOcr = ocrRaw.trim() ? parseLabelOcrText(ocrRaw) : parseProductQrPayload("")

  const extra: Record<string, string> = {
    ...fromQr.extra,
    ...fromOcr.extra,
  }
  if (fromOcr.extra.itemNo) extra.itemNo = fromOcr.extra.itemNo
  if (fromOcr.extra.partNo) extra.partNo = fromOcr.extra.partNo
  if (fromOcr.extra.poNumber) extra.poNumber = fromOcr.extra.poNumber

  const serialNumber = pickSerial(fromQr.serialNumber, fromOcr.serialNumber, fromOcr.extra)
  const model = pickModel(fromQr.model, fromOcr.model)
  const productId = pickProductId(fromQr, fromOcr)
  const productName =
    (fromOcr.productName && fromOcr.productName !== "Unknown model" ? fromOcr.productName : "") ||
    model ||
    fromQr.productName ||
    ""

  const specs =
    fromOcr.extra.partNo ||
    fromOcr.specs ||
    fromQr.specs ||
    productId ||
    ""

  const notes = [fromOcr.notes, fromQr.notes].filter(Boolean).join(" · ")

  return {
    serialNumber,
    productName,
    model: model || productName,
    specs,
    notes,
    inventoryStockId: fromQr.inventoryStockId || fromOcr.inventoryStockId,
    productId,
    retailPrice: fromQr.retailPrice ?? fromOcr.retailPrice ?? null,
    gstPercent: fromQr.gstPercent ?? fromOcr.gstPercent ?? null,
    warrantyStartDate: fromQr.warrantyStartDate || fromOcr.warrantyStartDate,
    warrantyEndDate: fromQr.warrantyEndDate || fromOcr.warrantyEndDate,
    extra,
  }
}
