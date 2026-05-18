import type { ParsedProductQr } from "@/lib/parse-product-qr"
import {
  looksLikeProductModel,
  looksLikeSerialNumber,
  looksLikeUrlOrPath,
} from "@/lib/label-field-utils"

function emptyParsed(): ParsedProductQr {
  return {
    serialNumber: "",
    productName: "",
    model: "",
    specs: "",
    notes: "",
    inventoryStockId: "",
    productId: "",
    extra: {},
  }
}

function cleanValue(value: string): string {
  return value
    .replace(/[|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function pickFromText(text: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[1]) {
      const value = cleanValue(match[1])
      if (value.length >= 2) return value
    }
  }
  return ""
}

function findModelInText(text: string): string {
  const patterns = [
    /\b(AEP-\d{2}KS\d{2}P\d)\b/gi,
    /\b(HS-[A-Z0-9]{4,20})\b/gi,
    /\b(BG\d{4,6}W)\b/gi,
    /\b(HSLD\d{2}KW)\b/gi,
    /\b(\d{1,3}A-[A-Z]-[A-Z]-[A-Z])\b/gi,
  ]
  for (const pattern of patterns) {
    const m = text.match(pattern)
    if (m?.[0] && looksLikeProductModel(m[0])) return m[0].toUpperCase()
  }

  for (const line of text.split(/\n/)) {
    const lineClean = cleanValue(line)
    if (looksLikeProductModel(lineClean)) return lineClean
    const afterModel = lineClean.match(/^model\s*[:\s]*(.+)$/i)
    if (afterModel?.[1] && looksLikeProductModel(afterModel[1])) return afterModel[1]
  }
  return ""
}

function findModelSnCombinedLine(text: string): { model: string; serialNumber: string } | null {
  const oneLine = text.replace(/\n/g, " ").replace(/\s+/g, " ")

  const spaced = oneLine.match(/\b([A-Z][A-Z0-9._/-]{2,28})\s*[-–—]\s*([A-Z0-9][A-Z0-9]{6,})\b/i)
  if (spaced && looksLikeProductModel(spaced[1])) {
    return { model: spaced[1], serialNumber: spaced[2] }
  }

  const glued = oneLine.match(/\b(BG\d{3,6}W)-([A-Z0-9]{10,})\b/i)
  if (glued) return { model: glued[1], serialNumber: glued[2] }

  const glued2 = oneLine.match(/\b(HSLD\d{2}KW)\s*[-–—]?\s*([A-Z0-9]{8,})\b/i)
  if (glued2) return { model: glued2[1], serialNumber: glued2[2] }

  return null
}

function findSerialInLines(lines: string[]): string {
  for (const line of lines) {
    const fromLabel = line.match(/^(?:s\/n|sn|serial\s*(?:no|number)?)\s*[:\s#]*(.+)$/i)
    if (fromLabel?.[1]) {
      const sn = cleanValue(fromLabel[1])
      if (looksLikeSerialNumber(sn)) return sn
    }
  }

  for (const line of lines) {
    const clean = cleanValue(line)
    if (looksLikeSerialNumber(clean) && !looksLikeProductModel(clean)) return clean
  }
  return ""
}

/** Parse raw OCR / pasted label text (Voltrix AEP, BG, shipping labels). */
export function parseLabelOcrText(ocrText: string): ParsedProductQr {
  const raw = ocrText.trim()
  if (!raw) return emptyParsed()

  const flat = raw.replace(/\r/g, "\n")
  const lines = flat
    .split(/\n/)
    .map((l) => cleanValue(l))
    .filter((l) => l.length > 0 && !/^made in china$/i.test(l))
  const oneLine = lines.join(" ")

  const combined = findModelSnCombinedLine(oneLine)
  let model = findModelInText(oneLine)
  if (combined?.model) model = combined.model

  const labeledSn = pickFromText(oneLine, [
    /(?:^|\s)(?:s\/n|sn|serial\s*(?:no|number)?|序列号)\s*[:\s#]+([A-Z0-9][A-Z0-9._/-]{4,40})/i,
  ])

  let serialNumber = combined?.serialNumber || labeledSn || findSerialInLines(lines)

  const itemNo = pickFromText(oneLine, [
    /(?:item\s*no\.?|item\s*number|item\s*#)\s*[:\s#]*([A-Z0-9][A-Z0-9._/-]{2,40})/i,
  ])

  const partNo = pickFromText(oneLine, [
    /(?:part\s*no\.?|part\s*number|p\/n|pn)\s*[:\s#]*([A-Z0-9][A-Z0-9._/-]{2,40})/i,
  ])

  const productId = partNo || itemNo

  const poNumber = pickFromText(oneLine, [
    /(?:po\s*no\.?|po\s*编号|po\s*number)\s*[:\s#]*([A-Z0-9][A-Z0-9._/-]{2,30})/i,
  ])

  const productName = pickFromText(oneLine, [
    /(?:product\s*name|物品名称|description)\s*[:\s#]*([^|]{2,60}?)(?:\s+(?:specification|qty|box)|$)/i,
  ])

  const extra: Record<string, string> = {}
  if (itemNo) extra.itemNo = itemNo
  if (partNo) extra.partNo = partNo
  if (poNumber) extra.poNumber = poNumber
  if (labeledSn && serialNumber === labeledSn) extra.snFromLabel = "1"

  const notes = [
    itemNo ? `Item ${itemNo}` : "",
    partNo ? `Part ${partNo}` : "",
    poNumber ? `PO ${poNumber}` : "",
  ]
    .filter(Boolean)
    .join(" · ")

  if (!model && itemNo && looksLikeUrlOrPath(serialNumber)) {
    serialNumber = ""
  }

  return {
    serialNumber,
    productName: productName || model,
    model,
    specs: partNo || itemNo || "",
    notes,
    inventoryStockId: "",
    productId: productId || poNumber || "",
    extra,
  }
}
