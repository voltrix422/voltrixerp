import type { ParsedProductQr } from "@/lib/parse-product-qr"

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
  return value.replace(/\s+/g, " ").trim()
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

/** Parse raw OCR text from shipping / product labels (English + common Chinese labels). */
export function parseLabelOcrText(ocrText: string): ParsedProductQr {
  const raw = ocrText.trim()
  if (!raw) return emptyParsed()

  const flat = raw.replace(/\r/g, "\n")
  const oneLine = flat.replace(/\n+/g, " ").replace(/\s+/g, " ")

  const model = pickFromText(oneLine, [
    /(?:^|\s)(?:model|mod(?:el)?|规格型号|规格\s*&\s*型号|specification\s*&\s*model)[:\s#]+([A-Z0-9][A-Z0-9._/\s-]{2,40})/i,
    /(?:^|\s)(?:model|规格型号)[\/\s]+([A-Z0-9][A-Z0-9._/-]{2,40})/i,
  ])

  const serialNumber = pickFromText(oneLine, [
    /(?:^|\s)(?:s\/n|sn|serial\s*(?:no|number)?|序列号)[:\s#]+([A-Z0-9][A-Z0-9._/-]{4,40})/i,
    /(?:^|\s)SN[:\s]+([A-Z0-9][A-Z0-9._/-]{4,40})/i,
  ])

  const productId = pickFromText(oneLine, [
    /(?:^|\s)(?:p\/n|pn|product\s*id|product\s*no|item\s*no|货号)[:\s#]+([A-Z0-9][A-Z0-9._/-]{2,40})/i,
  ])

  const poNumber = pickFromText(oneLine, [
    /(?:^|\s)(?:po\s*no\.?|po\s*编号|po\s*number|purchase\s*order)[:\s#]+([A-Z0-9][A-Z0-9._/-]{2,30})/i,
  ])

  const productName = pickFromText(oneLine, [
    /(?:^|\s)(?:product\s*name|物品名称|item\s*name|description)[:\s#]+([^|\n]{2,80}?)(?:\s+(?:specification|qty|quantity|box|volume)|$)/i,
  ])

  const qty = pickFromText(oneLine, [
    /(?:^|\s)(?:qty|quantity|数量)[:\s#]+(\d+)\s*(?:pc|pcs|ea|unit)?/i,
  ])

  const extra: Record<string, string> = {}
  if (poNumber) extra.poNumber = poNumber
  if (productId) extra.productId = productId
  if (qty) extra.qty = qty

  const notes = [
    poNumber ? `PO ${poNumber}` : "",
    productId ? `P/N ${productId}` : "",
    qty ? `Qty ${qty}` : "",
  ]
    .filter(Boolean)
    .join(" · ")

  return {
    serialNumber,
    productName: productName || "",
    model,
    specs: productId || poNumber || "",
    notes,
    inventoryStockId: "",
    productId: productId || poNumber || "",
    extra,
  }
}
