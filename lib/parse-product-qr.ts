export type ParsedProductQr = {
  serialNumber: string
  productName: string
  model: string
  specs: string
  notes: string
  inventoryStockId: string
  productId: string
  warrantyStartDate?: string
  warrantyEndDate?: string
  extra: Record<string, string>
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
  if (segments.length < 4) return null
  if (!/^[A-Z0-9-]{6,}$/i.test(segments[0])) return null

  const queryValues = trimmed.includes("?") ? parseQueryString(trimmed) : {}
  const serialNumber = segments[0] || pickString(queryValues, ["c", "serial", "sn", "serialNumber"])
  const manufacturedDate = segments[1] || ""
  const batchRef = segments[2] || ""
  const internalRef = segments[3] || ""

  let model = ""
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const segment = segments[index]
    if (/\.php$/i.test(segment)) continue
    if (/^(AEP|HS|LD)-/i.test(segment) || /^[A-Z]{2,}[A-Z0-9-]*$/i.test(segment)) {
      model = segment
      break
    }
  }
  if (!model && segments[4]) model = segments[4]

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

export function parseProductQrPayload(raw: string): ParsedProductQr {
  const trimmed = raw.trim()
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
      return {
        serialNumber: pickString(parsed, ["serialNumber", "serial_number", "sn", "SN", "serial", "barcode"]),
        productName: pickString(parsed, ["productName", "product_name", "product", "name", "item", "description"]),
        model: pickString(parsed, ["model", "sku", "productId", "product_id"]),
        specs: pickString(parsed, ["specs", "specification", "specifications", "capacity", "voltage"]),
        notes: pickString(parsed, ["notes", "note", "remarks"]),
        inventoryStockId: pickString(parsed, ["inventoryStockId", "inventory_stock_id", "stockId", "stock_id", "manualStockId", "manual_stock_id"]),
        productId: pickString(parsed, ["productId", "product_id", "catalogProductId", "catalog_product_id"]),
        warrantyStartDate: pickString(parsed, ["warrantyStartDate", "warranty_start_date", "startDate"]),
        warrantyEndDate: pickString(parsed, ["warrantyEndDate", "warranty_end_date", "endDate"]),
        extra,
      }
    } catch {
      // Fall through to other parsers.
    }
  }

  if (trimmed.includes("/")) {
    const slashParsed = parseVoltrixSlashPayload(trimmed)
    if (slashParsed) return slashParsed
  }

  if (trimmed.includes("http://") || trimmed.includes("https://") || trimmed.includes("?")) {
    const queryValues = parseQueryString(trimmed)
    Object.assign(extra, queryValues)
    return {
      serialNumber: pickString(queryValues, ["serialNumber", "serial_number", "sn", "serial", "barcode", "c"]),
      productName: pickString(queryValues, ["productName", "product_name", "product", "name", "item", "description"]),
      model: pickString(queryValues, ["model", "sku", "productId", "product_id"]),
      specs: pickString(queryValues, ["specs", "specification", "specifications", "capacity", "voltage"]),
      notes: pickString(queryValues, ["notes", "note", "remarks"]),
      inventoryStockId: pickString(queryValues, ["inventoryStockId", "inventory_stock_id", "stockId", "stock_id", "manualStockId", "manual_stock_id"]),
      productId: pickString(queryValues, ["productId", "product_id", "catalogProductId", "catalog_product_id"]),
      warrantyStartDate: pickString(queryValues, ["warrantyStartDate", "warranty_start_date", "startDate"]),
      warrantyEndDate: pickString(queryValues, ["warrantyEndDate", "warranty_end_date", "endDate"]),
      extra,
    }
  }

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

  if (trimmed.includes("|") || trimmed.includes(";")) {
    const parts = trimmed.split(/[|;]/).map((part) => part.trim()).filter(Boolean)
    parts.forEach((part) => {
      const [label, ...rest] = part.split(":")
      if (!label || rest.length === 0) return
      extra[label.trim().toLowerCase()] = rest.join(":").trim()
    })
    return {
      serialNumber: extra.sn || extra.serial || extra.serialnumber || extra["serial number"] || "",
      productName: extra.product || extra.name || extra.item || extra.description || "",
      model: extra.model || extra.sku || "",
      specs: extra.specs || extra.specification || extra.capacity || "",
      notes: extra.notes || extra.note || "",
      inventoryStockId: extra.inventorystockid || extra.stockid || extra.manualstockid || "",
      productId: extra.productid || extra.catalogproductid || "",
      extra,
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
