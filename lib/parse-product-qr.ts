import {
  isDateSegment,
  looksLikeHsVoltageModel,
  looksLikeProductModel,
  looksLikeSerialNumber,
  looksLikeUrlOrPath,
  normalizeAepModelCode,
  parseAepModelAndSerial,
  parseHsModelAndSerial,
  scoreSerialCandidate,
} from "@/lib/label-field-utils"

export type ParsedProductQr = {
  serialNumber: string
  productName: string
  model: string
  specs: string
  notes: string
  inventoryStockId: string
  productId: string
  retailPrice?: number | null
  gstPercent?: number | null
  warrantyStartDate?: string
  warrantyEndDate?: string
  extra: Record<string, string>
}

function pickNumber(source: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === "number" && Number.isFinite(value)) return value
    if (typeof value === "string" && value.trim()) {
      const cleaned = value.trim().replace(/,/g, "").replace(/[^\d.]/g, "")
      if (!cleaned) continue
      const n = Number(cleaned)
      if (Number.isFinite(n)) return n
    }
  }
  return null
}

function pickPricing(source: Record<string, unknown>): {
  retailPrice: number | null
  gstPercent: number | null
} {
  const retailPrice = pickNumber(source, [
    "retailPrice",
    "retail_price",
    "price",
    "retail",
    "mrp",
    "unitPrice",
    "unit_price",
  ])
  let gstPercent = pickNumber(source, [
    "gstPercent",
    "gst_percent",
    "gstRate",
    "gst_rate",
    "gst",
    "taxPercent",
    "tax_percent",
    "vat",
  ])
  if (gstPercent != null && gstPercent > 0 && gstPercent <= 1) {
    gstPercent = Math.round(gstPercent * 10000) / 100
  }
  return { retailPrice, gstPercent }
}

function pickString(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === "string" && value.trim()) return value.trim()
    if (typeof value === "number" && Number.isFinite(value)) return String(value)
  }
  return ""
}

function parseQueryString(raw: string) {
  const query = raw.includes("?") ? raw.split("?").pop() || "" : raw
  const params = new URLSearchParams(query.startsWith("?") ? query : `?${query}`)
  const extra: Record<string, string> = {}
  params.forEach((value, key) => {
    extra[key] = value
  })
  return extra
}

function parseEuropeanDate(value: string): string | undefined {
  const match = value.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/)
  if (!match) return undefined
  const [, day, month, year] = match
  return `${year}-${month}-${day}`
}

function parseVoltrixSlashPayload(raw: string): ParsedProductQr | null {
  const trimmed = raw.trim()
  const basePath = trimmed.split(/[?#]/)[0] ?? trimmed
  const segments = basePath.split("/").map((part) => part.trim()).filter(Boolean)
  if (segments.length < 3) return null

  const queryValues = trimmed.includes("?") ? parseQueryString(trimmed) : {}

  let serialNumber = pickString(queryValues, ["c", "serial", "sn", "serialNumber"])
  if (!serialNumber) {
    let bestScore = -1
    for (const segment of segments) {
      if (/\.php$/i.test(segment) || isDateSegment(segment) || looksLikeProductModel(segment)) continue
      const score = scoreSerialCandidate(segment)
      if (score > bestScore) {
        bestScore = score
        serialNumber = segment
      }
    }
  }
  if (!serialNumber && segments[0] && !isDateSegment(segments[0]) && !looksLikeUrlOrPath(segments[0])) {
    serialNumber = segments[0]
  }

  const manufacturedDate =
    segments.find((s) => isDateSegment(s)) || (isDateSegment(segments[1] || "") ? segments[1] : "")
  const batchRef = segments.find((s, i) => i > 0 && !isDateSegment(s) && s !== serialNumber && /^[A-Z0-9-]{4,}$/i.test(s) && !looksLikeProductModel(s)) || segments[2] || ""
  const internalRef = segments[3] || ""

  let model = ""
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const segment = segments[index].replace(/\.php$/i, "")
    if (!segment || segment === serialNumber) continue
    if (looksLikeProductModel(segment)) {
      model = segment
      break
    }
  }
  if (!model && segments[4]) model = segments[4].replace(/\.php$/i, "")

  // BarTender path: .../MODEL//c.php?c=SN — model may include spaces (e.g. HS-TQ25.6V 314Ah)
  if (!model) {
    const phpIdx = segments.findIndex((s) => /\.php$/i.test(s))
    if (phpIdx > 0) {
      const candidate = segments[phpIdx - 1].replace(/\.php$/i, "")
      if (candidate && candidate !== serialNumber && !isDateSegment(candidate)) {
        model = candidate
      }
    }
  }

  const extra: Record<string, string> = { ...queryValues }
  if (manufacturedDate) extra.manufacturedDate = manufacturedDate
  if (batchRef) extra.batchRef = batchRef
  if (internalRef) extra.internalRef = internalRef

  const notes = [
    manufacturedDate ? `Manufactured ${manufacturedDate}` : "",
    batchRef ? `Batch ${batchRef}` : "",
    internalRef ? `Internal ref ${internalRef}` : "",
  ]
    .filter(Boolean)
    .join(" · ")

  return {
    serialNumber,
    productName: "",
    model,
    specs: internalRef,
    notes,
    inventoryStockId: "",
    productId: "",
    warrantyStartDate: parseEuropeanDate(manufacturedDate),
    extra,
  }
}

/**
 * BarTender serialization: fixed model, then "/", then SN (and optional Voltrix tail).
 * Examples:
 *   HS-TQ25.6V314Ah/12345678
 *   HS-TQ25.6V314Ah/1GY26340670064/03-05-2026/610110-00342/X60304255//c.php?c=1GY26340670064
 */
function parseModelPrefixSlashPayload(trimmed: string): ParsedProductQr | null {
  const slashIdx = trimmed.indexOf("/")
  if (slashIdx <= 0) return null

  const modelPart = trimmed.slice(0, slashIdx).trim()
  const restPart = trimmed.slice(slashIdx + 1).trim()
  if (!modelPart || !restPart) return null

  const isKnownModel =
    looksLikeProductModel(modelPart) ||
    looksLikeHsVoltageModel(modelPart) ||
    /^HS[-\s]?TQ[\d.A-Za-z.]+V?\d*Ah?$/i.test(modelPart)
  if (!isKnownModel) return null

  const queryValues = restPart.includes("?") ? parseQueryString(restPart) : {}
  const snFromQuery = pickString(queryValues, ["c", "serial", "sn", "serialNumber"])
  const pathOnly = restPart.split("?")[0]
  const restSegments = pathOnly.split("/").map((s) => s.trim()).filter(Boolean)

  if (restSegments.length >= 2 || /\.php/i.test(restPart)) {
    const voltrix = parseVoltrixSlashPayload(restPart)
    if (voltrix?.serialNumber) {
      return {
        ...voltrix,
        model: modelPart,
        productName: modelPart,
        extra: { ...voltrix.extra, source: "model-prefix-voltrix" },
      }
    }
  }

  const serialNumber = snFromQuery || restSegments[0] || pathOnly.trim()
  if (!serialNumber || serialNumber.length < 4) return null

  return {
    serialNumber,
    productName: modelPart,
    model: modelPart,
    specs: "",
    notes: "",
    inventoryStockId: "",
    productId: "",
    extra: { source: "model-prefix-sn", ...queryValues },
  }
}

export function parseProductQrPayload(raw: string): ParsedProductQr {
  const trimmed = normalizeScanPayload(raw)
  const extra: Record<string, string> = {}

  if (!trimmed) {
    return {
      serialNumber: "",
      productName: "",
      model: "",
      specs: "",
      notes: "",
      inventoryStockId: "",
      productId: "",
      retailPrice: null,
      gstPercent: null,
      extra,
    }
  }

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>
      Object.entries(parsed).forEach(([key, value]) => {
        if (typeof value === "string" || typeof value === "number") {
          extra[key] = String(value)
        }
      })
      const pricing = pickPricing(parsed)
      return {
        serialNumber: pickString(parsed, ["serialNumber", "serial_number", "sn", "SN", "serial", "barcode"]),
        productName: pickString(parsed, ["productName", "product_name", "product", "name", "item", "description"]),
        model: pickString(parsed, ["model", "sku", "productId", "product_id"]),
        specs: pickString(parsed, ["specs", "specification", "specifications", "capacity", "voltage"]),
        notes: pickString(parsed, ["notes", "note", "remarks"]),
        inventoryStockId: pickString(parsed, ["inventoryStockId", "inventory_stock_id", "stockId", "stock_id", "manualStockId", "manual_stock_id"]),
        productId: pickString(parsed, ["productId", "product_id", "catalogProductId", "catalog_product_id"]),
        ...pricing,
        warrantyStartDate: pickString(parsed, ["warrantyStartDate", "warranty_start_date", "startDate"]),
        warrantyEndDate: pickString(parsed, ["warrantyEndDate", "warranty_end_date", "endDate"]),
        extra,
      }
    } catch {
      // Fall through to other parsers.
    }
  }

  if (trimmed.includes("/")) {
    const modelFirst = parseModelPrefixSlashPayload(trimmed)
    if (modelFirst?.serialNumber) return modelFirst

    const slashParsed = parseVoltrixSlashPayload(trimmed)
    if (slashParsed) return slashParsed
  }

  if (trimmed.includes("http://") || trimmed.includes("https://") || trimmed.includes("?")) {
    const queryValues = parseQueryString(trimmed)
    Object.assign(extra, queryValues)
    const pricing = pickPricing(queryValues as Record<string, unknown>)
    return {
      serialNumber: pickString(queryValues, ["serialNumber", "serial_number", "sn", "serial", "barcode", "c"]),
      productName: pickString(queryValues, ["productName", "product_name", "product", "name", "item", "description"]),
      model: pickString(queryValues, ["model", "sku", "productId", "product_id"]),
      specs: pickString(queryValues, ["specs", "specification", "specifications", "capacity", "voltage"]),
      notes: pickString(queryValues, ["notes", "note", "remarks"]),
      inventoryStockId: pickString(queryValues, ["inventoryStockId", "inventory_stock_id", "stockId", "stock_id", "manualStockId", "manual_stock_id"]),
      productId: pickString(queryValues, ["productId", "product_id", "catalogProductId", "catalog_product_id"]),
      ...pricing,
      warrantyStartDate: pickString(queryValues, ["warrantyStartDate", "warranty_start_date", "startDate"]),
      warrantyEndDate: pickString(queryValues, ["warrantyEndDate", "warranty_end_date", "endDate"]),
      extra,
    }
  }

  const multiline = parseMultilineModelSn(trimmed)
  if (multiline) return multiline

  // Must run before the generic model-SN pair split so
  // MAN-HS-25-6V100AHvoltrix-12 is not broken at the wrong dash.
  const hsGluedEarly = parseHsModelAndSerial(trimmed)
  if (hsGluedEarly) {
    return {
      serialNumber: hsGluedEarly.serialNumber,
      productName: hsGluedEarly.model,
      model: hsGluedEarly.model,
      specs: "",
      notes: "",
      inventoryStockId: "",
      productId: "",
      extra: { source: "hs-glued" },
    }
  }

  const modelSnPair = parseModelSnPair(trimmed)
  if (modelSnPair) return modelSnPair

  const modelSnSpaced = trimmed.match(/^([A-Z][A-Z0-9._/-]{2,30})\s*[-–—]\s*([A-Z0-9][A-Z0-9._/-]{5,})$/i)
  if (modelSnSpaced) {
    const [, modelPart, snPart] = modelSnSpaced
    return {
      serialNumber: snPart,
      productName: modelPart,
      model: modelPart,
      specs: "",
      notes: "",
      inventoryStockId: "",
      productId: "",
      extra: { source: "model-sn-text" },
    }
  }

  const modelSnHyphen = trimmed.match(/^([A-Z]{2,}[A-Z0-9]*(?:[.-][A-Z0-9]+)?)-([A-Z0-9]{8,})$/i)
  if (modelSnHyphen && !trimmed.includes("/") && !trimmed.startsWith("{")) {
    const [, modelPart, snPart] = modelSnHyphen
    return {
      serialNumber: snPart,
      productName: modelPart,
      model: modelPart,
      specs: "",
      notes: "",
      inventoryStockId: "",
      productId: "",
      extra: { source: "model-sn-compact" },
    }
  }

  if (/^[A-Z0-9]{14,}$/i.test(trimmed) && /[A-Z]/i.test(trimmed) && /\d/.test(trimmed)) {
    const compact = trimmed.match(/^([A-Z]{2,}[A-Z0-9]*?)([A-Z]{1,3}\d{5,}[A-Z0-9]*)$/i)
    if (compact) {
      return {
        serialNumber: compact[2],
        productName: compact[1],
        model: compact[1],
        specs: "",
        notes: "",
        inventoryStockId: "",
        productId: "",
        extra: { source: "model-sn-glued" },
      }
    }
  }

  const pipeModelSn = trimmed.match(/^([A-Za-z0-9][A-Za-z0-9._/\s-]{2,48})[|]([A-Za-z0-9][A-Za-z0-9._/-]{2,60})$/i)
  if (pipeModelSn) {
    const modelPart = normalizeAepModelCode(pipeModelSn[1].trim())
    const snPart = pipeModelSn[2].trim()
    return {
      serialNumber: snPart,
      productName: modelPart,
      model: modelPart,
      specs: "",
      notes: "",
      inventoryStockId: "",
      productId: "",
      extra: { source: "model-sn-pipe" },
    }
  }

  if (trimmed.includes("|") || trimmed.includes(";")) {
    const parts = trimmed.split(/[|;]/).map((part) => part.trim()).filter(Boolean)
    parts.forEach((part) => {
      const [label, ...rest] = part.split(":")
      if (!label || rest.length === 0) return
      extra[label.trim().toLowerCase()] = rest.join(":").trim()
    })
    const pricing = pickPricing(extra as Record<string, unknown>)
    return {
      serialNumber: extra.sn || extra.serial || extra.serialnumber || extra["serial number"] || "",
      productName: extra.product || extra.name || extra.item || extra.description || "",
      model: extra.model || extra.sku || "",
      specs: extra.specs || extra.specification || extra.capacity || "",
      notes: extra.notes || extra.note || "",
      inventoryStockId: extra.inventorystockid || extra.stockid || extra.manualstockid || "",
      productId: extra.productid || extra.catalogproductid || "",
      ...pricing,
      extra,
    }
  }

  const aepGlued = parseAepModelAndSerial(trimmed)
  if (aepGlued) {
    return {
      serialNumber: aepGlued.serialNumber,
      productName: aepGlued.model,
      model: aepGlued.model,
      specs: "",
      notes: "",
      inventoryStockId: "",
      productId: "",
      extra: { source: "aep-glued" },
    }
  }

  if (looksLikeSerialNumber(trimmed)) {
    const normalized = normalizeAepModelCode(trimmed)
    if (looksLikeProductModel(normalized)) {
      return {
        serialNumber: trimmed,
        productName: normalized,
        model: normalized,
        specs: "",
        notes: "",
        inventoryStockId: "",
        productId: "",
        extra: { source: "aep-model-as-sn" },
      }
    }
    return {
      serialNumber: trimmed,
      productName: "",
      model: "",
      specs: "",
      notes: "",
      inventoryStockId: "",
      productId: "",
      extra,
    }
  }

  return {
    serialNumber: "",
    productName: "",
    model: looksLikeProductModel(trimmed) ? trimmed : "",
    specs: "",
    notes: "",
    inventoryStockId: "",
    productId: "",
    extra,
  }
}

/** Strip common prefixes from pasted or labeled QR text before parsing. */
export function normalizeScanPayload(raw: string): string {
  let trimmed = raw.trim()
  if (/^QR:\s*/i.test(trimmed)) {
    trimmed = trimmed.replace(/^QR:\s*/i, "").trim()
  }
  return trimmed
}

/** BarTender / labels: model on first line, SN on second (or last) line. */
function parseMultilineModelSn(trimmed: string): ParsedProductQr | null {
  if (!/[\r\n]/.test(trimmed)) return null
  const lines = trimmed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length < 2) return null

  const snLine =
    lines.find((l, i) => i > 0 && (looksLikeSerialNumber(l) || /^\d{6,24}$/.test(l))) ??
    lines[lines.length - 1]
  const modelLine = lines.find((l) => l !== snLine) ?? lines[0]
  if (!snLine || snLine === modelLine) return null
  if (!looksLikeSerialNumber(snLine) && !/^\d{6,24}$/.test(snLine)) return null

  return {
    serialNumber: snLine,
    productName: modelLine,
    model: modelLine,
    specs: "",
    notes: "",
    inventoryStockId: "",
    productId: "",
    extra: { source: "model-sn-multiline" },
  }
}

function parseModelSnPair(trimmed: string): ParsedProductQr | null {
  const match = trimmed.match(
    /^([A-Za-z0-9][A-Za-z0-9._/\s-]{2,48})\s*(?:->|=>|→|—>|-->|[-–—])\s*([A-Za-z0-9][A-Za-z0-9._/-]{4,60})$/i,
  )
  if (!match) return null
  const modelPart = match[1].trim()
  const snPart = match[2].trim()
  if (!looksLikeSerialNumber(snPart)) return null
  return {
    serialNumber: snPart,
    productName: modelPart,
    model: modelPart,
    specs: "",
    notes: "",
    inventoryStockId: "",
    productId: "",
    extra: { source: "model-sn-pair" },
  }
}

type ManualStockMatch = {
  id: string
  description: string
  poNumber?: string
}

export function matchManualStockItem(parsed: ParsedProductQr, items: ManualStockMatch[]): string {
  if (parsed.inventoryStockId) {
    const exact = items.find((item) => item.id === parsed.inventoryStockId)
    if (exact) return exact.id
  }

  const searchTerms = [parsed.model, parsed.productName, parsed.specs]
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 2)

  if (searchTerms.length === 0) return ""

  let bestId = ""
  let bestScore = 0

  for (const item of items) {
    const haystack = `${item.description} ${item.poNumber || ""}`.toLowerCase()
    let score = 0
    for (const term of searchTerms) {
      if (haystack.includes(term)) score += term.length
    }
    if (score > bestScore) {
      bestScore = score
      bestId = item.id
    }
  }

  return bestScore > 0 ? bestId : ""
}
