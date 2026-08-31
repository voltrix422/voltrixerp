import { DEFAULT_GST_PERCENT } from "@/lib/gst-inclusive-pricing"
import type { FbrConfig } from "@/lib/fbr-config"
import type { Order, OrderItem } from "@/lib/orders"

export type FbrBuyerProfile = {
  name?: string
  company?: string
  ntn?: string
  address?: string
  city?: string
}

export type FbrInvoiceItemPayload = {
  hsCode: string
  productDescription: string
  rate: string
  uoM: string
  quantity: number
  totalValues: number
  valueSalesExcludingST: number
  fixedNotifiedValueOrRetailPrice: number
  salesTaxApplicable: number
  salesTaxWithheldAtSource: number
  extraTax: number
  furtherTax: number
  sroScheduleNo: string
  fedPayable: number
  discount: number
  saleType: string
  sroItemSerialNo: string
}

export type FbrSaleInvoicePayload = {
  invoiceType: string
  invoiceDate: string
  sellerNTNCNIC: string
  sellerBusinessName: string
  sellerProvince: string
  sellerAddress: string
  buyerNTNCNIC?: string
  buyerBusinessName: string
  buyerProvince: string
  buyerAddress: string
  buyerRegistrationType: "Registered" | "Unregistered"
  invoiceRefNo: string
  scenarioId?: string
  items: FbrInvoiceItemPayload[]
}

export type FbrPostResult = {
  ok: boolean
  invoiceNumber: string
  qr: string
  error: string
  raw: unknown
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

function invoiceDateFrom(createdAt: string | Date | undefined): string {
  const date = createdAt ? new Date(createdAt) : new Date()
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10)
  }
  return date.toISOString().slice(0, 10)
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "")
}

function isRegisteredNtn(ntn: string): boolean {
  const digits = digitsOnly(ntn)
  return digits.length === 7 || digits.length === 13
}

function provinceFromCity(city: string, fallback: string): string {
  const key = city.trim().toLowerCase()
  if (!key) return fallback
  if (
    /lahore|faisalabad|rawalpindi|multan|gujranwala|sialkot|bahawalpur|sargodha|sheikhupura|rahim|gujrat|jhelum|kasur/.test(
      key,
    )
  ) {
    return "Punjab"
  }
  if (/karachi|hyderabad|sukkur|larkana|nawabshah/.test(key)) return "Sindh"
  if (/peshawar|mardan|abbottabad|swat|kohat|nowshera/.test(key)) return "Khyber Pakhtunkhwa"
  if (/quetta|gwadar|turbat/.test(key)) return "Balochistan"
  if (/islamabad|ict/.test(key)) return "Islamabad Capital Territory"
  if (/gilgit|skardu/.test(key)) return "Gilgit-Baltistan"
  if (/muzaffarabad|mirpur|ajk/.test(key)) return "Azad Jammu and Kashmir"
  return fallback
}

function mapUom(unit: string): string {
  const key = unit.trim().toLowerCase()
  if (!key || /pcs|pc|piece|pieces|unit|units|nos|no|number/.test(key)) {
    return "Numbers, pieces, units"
  }
  if (/kg|kgs|kilogram/.test(key)) return "Kilogram"
  if (/ltr|liter|litre/.test(key)) return "Litre"
  return "Numbers, pieces, units"
}

function taxableItems(items: OrderItem[]): OrderItem[] {
  return items.filter((item) => {
    if (item.isFreeItem) return false
    const qty = Math.max(0, Number(item.qty) || 0)
    const price = Math.max(0, Number(item.unitPrice) || 0)
    return qty > 0 && price > 0
  })
}

function allocate(total: number, weights: number[]): number[] {
  const sum = weights.reduce((acc, w) => acc + w, 0)
  if (sum <= 0) return weights.map(() => 0)
  const parts = weights.map((w) => roundMoney((total * w) / sum))
  const drift = roundMoney(total - parts.reduce((acc, n) => acc + n, 0))
  if (parts.length > 0) {
    parts[parts.length - 1] = roundMoney(parts[parts.length - 1] + drift)
  }
  return parts
}

function taxRateLabel(taxPercent: number): string {
  const pct = Math.round(Math.max(0, taxPercent) || DEFAULT_GST_PERCENT)
  return `${pct}%`
}

export function buildFbrSaleInvoicePayload(
  order: Pick<
    Order,
    | "clientName"
    | "deliveryAddress"
    | "createdAt"
    | "items"
    | "subtotal"
    | "tax"
    | "taxPercent"
    | "total"
    | "transportCost"
    | "otherCost"
    | "shipping"
  >,
  buyer: FbrBuyerProfile | null,
  config: FbrConfig,
): FbrSaleInvoicePayload {
  const items = taxableItems(order.items || [])
  const subtotal = Math.max(0, Number(order.subtotal) || 0)
  const gstPercent = Number(order.taxPercent) || DEFAULT_GST_PERCENT
  let tax = Math.max(0, Number(order.tax) || 0)
  if (tax <= 0 && subtotal > 0) {
    const rate = gstPercent / 100
    tax = roundMoney(subtotal - subtotal / (1 + rate))
  }
  const extras =
    Math.max(0, Number(order.transportCost) || 0) +
    Math.max(0, Number(order.otherCost) || 0) +
    Math.max(0, Number(order.shipping) || 0)
  const total = Math.max(0, Number(order.total) || 0)
  const exclNet = Math.max(0, roundMoney(total - tax - extras))
  const exclGross = Math.max(0, roundMoney(subtotal - tax))
  const discountAmt = Math.max(0, roundMoney(exclGross - exclNet))

  const weights = items.map((item) => {
    const qty = Math.max(0, Number(item.qty) || 0)
    const price = Math.max(0, Number(item.unitPrice) || 0)
    return qty * price
  })
  const exclParts = allocate(exclNet, weights)
  const taxParts = allocate(tax, weights)
  const discountParts = allocate(discountAmt, weights)
  const rate = taxRateLabel(gstPercent)

  const fbrItems: FbrInvoiceItemPayload[] = items.map((item, index) => {
    const qty = roundMoney(Math.max(0, Number(item.qty) || 0))
    const excl = exclParts[index] || 0
    const st = taxParts[index] || 0
    const discount = discountParts[index] || 0
    const hsCode = String((item as OrderItem & { hsCode?: string }).hsCode || "").trim() || config.defaultHsCode
    return {
      hsCode,
      productDescription: String(item.description || item.model || "Battery").trim() || "Battery",
      rate,
      uoM: mapUom(item.unit || "pcs"),
      quantity: qty,
      totalValues: roundMoney(excl + st),
      valueSalesExcludingST: excl,
      fixedNotifiedValueOrRetailPrice: 0,
      salesTaxApplicable: st,
      salesTaxWithheldAtSource: 0,
      extraTax: 0,
      furtherTax: 0,
      sroScheduleNo: "",
      fedPayable: 0,
      discount,
      saleType: "Goods at standard rate (default)",
      sroItemSerialNo: "",
    }
  })

  const buyerNtn = String(buyer?.ntn || "").trim()
  const registered = isRegisteredNtn(buyerNtn)
  const buyerName =
    String(buyer?.company || "").trim() ||
    String(buyer?.name || "").trim() ||
    String(order.clientName || "").trim() ||
    "Walk-in customer"
  const buyerCity = String(buyer?.city || "").trim()
  const buyerAddress =
    String(buyer?.address || "").trim() ||
    String(order.deliveryAddress || "").trim() ||
    buyerCity ||
    config.sellerAddress
  const buyerProvince = provinceFromCity(buyerCity, "Punjab")

  const payload: FbrSaleInvoicePayload = {
    invoiceType: "Sale Invoice",
    invoiceDate: invoiceDateFrom(order.createdAt),
    sellerNTNCNIC: config.sellerNTN,
    sellerBusinessName: config.sellerBusinessName,
    sellerProvince: config.sellerProvince,
    sellerAddress: config.sellerAddress,
    buyerBusinessName: buyerName,
    buyerProvince,
    buyerAddress,
    buyerRegistrationType: registered ? "Registered" : "Unregistered",
    invoiceRefNo: "",
    items: fbrItems,
  }

  if (registered) {
    payload.buyerNTNCNIC = digitsOnly(buyerNtn)
  }

  if (config.env === "sandbox") {
    payload.scenarioId =
      config.sandboxScenarioId || (registered ? "SN001" : "SN002")
  }

  return payload
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null
}

function pickString(...values: unknown[]): string {
  for (const value of values) {
    const text = String(value ?? "").trim()
    if (text) return text
  }
  return ""
}

export function parseFbrPostResponse(httpOk: boolean, body: unknown): FbrPostResult {
  const root = asRecord(body)
  const validation = asRecord(root?.validationResponse) || asRecord(root?.ValidationResponse)
  const invoiceNumber = pickString(
    root?.invoiceNumber,
    root?.InvoiceNumber,
    root?.invoiceNo,
    root?.InvoiceNo,
  )
  const statusCode = pickString(validation?.statusCode, validation?.StatusCode, root?.statusCode)
  const status = pickString(validation?.status, validation?.Status, root?.status)
  const error = pickString(
    validation?.error,
    validation?.Error,
    validation?.errorCode,
    root?.error,
    root?.message,
    root?.Message,
  )

  const validFlag =
    statusCode === "00" ||
    status.toLowerCase() === "valid" ||
    status.toLowerCase() === "success"
  const invalidFlag =
    statusCode === "01" ||
    status.toLowerCase() === "invalid" ||
    status.toLowerCase() === "error"

  if (httpOk && invoiceNumber && !invalidFlag) {
    return { ok: true, invoiceNumber, qr: invoiceNumber, error: "", raw: body }
  }
  if (httpOk && validFlag && invoiceNumber) {
    return { ok: true, invoiceNumber, qr: invoiceNumber, error: "", raw: body }
  }

  const fallback = error || (httpOk ? "FBR rejected this invoice" : "FBR request failed")
  return { ok: false, invoiceNumber, qr: "", error: fallback.slice(0, 1000), raw: body }
}

export async function postFbrSaleInvoice(
  payload: FbrSaleInvoicePayload,
  config: FbrConfig,
): Promise<FbrPostResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 25000)
  try {
    const res = await fetch(config.postUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    const text = await res.text()
    let parsed: unknown = text
    try {
      parsed = text ? JSON.parse(text) : null
    } catch {
      parsed = { message: text.slice(0, 1000) }
    }
    return parseFbrPostResponse(res.ok, parsed)
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError"
    return {
      ok: false,
      invoiceNumber: "",
      qr: "",
      error: aborted ? "FBR request timed out" : err instanceof Error ? err.message : "FBR request failed",
      raw: null,
    }
  } finally {
    clearTimeout(timer)
  }
}
