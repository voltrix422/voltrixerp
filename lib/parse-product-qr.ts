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

  if (trimmed.includes("http://") || trimmed.includes("https://") || trimmed.includes("?")) {
    const queryValues = parseQueryString(trimmed)
    Object.assign(extra, queryValues)
    return {
      serialNumber: pickString(queryValues, ["serialNumber", "serial_number", "sn", "serial", "barcode"]),
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

  const searchTerms = [parsed.productName, parsed.model, parsed.specs]
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
