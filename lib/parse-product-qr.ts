export type ParsedProductQr = {
  serialNumber: string
  productName: string
  model: string
  specs: string
  notes: string
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
      extra,
    }
  }

  return {
    serialNumber: trimmed,
    productName: "",
    model: "",
    specs: "",
    notes: "",
    extra,
  }
}
