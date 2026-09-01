export type ExtensiveQuoteLine = {
  id: string
  rateId?: string
  itemName: string
  supplier: string
  rate: number
  rateDate: string
  qty: number
  unit: string
  included: boolean
}

export type QuoteTermSection = {
  id: string
  heading: string
  bullets: string[]
}

export type ExtensiveQuotationStatus = "draft" | "sent" | "accepted" | "rejected" | "expired"

export type ExtensiveQuotation = {
  id: string
  quotationNumber: string
  recipientName: string
  recipientCompany: string
  recipientAddress: string
  quoteDate: string
  validUntil: string
  notes: string
  showBranding: boolean
  items: ExtensiveQuoteLine[]
  terms: QuoteTermSection[]
  subtotal: number
  total: number
  status: ExtensiveQuotationStatus
  createdAt: string
  createdBy: string
  ownerUserId?: string
}

export function includedQuoteTotal(items: ExtensiveQuoteLine[]): number {
  return items.reduce((sum, line) => {
    if (!line.included) return sum
    const qty = Math.max(0, Number(line.qty) || 0)
    const rate = Math.max(0, Number(line.rate) || 0)
    return sum + qty * rate
  }, 0)
}

function mapLine(raw: unknown, idx: number): ExtensiveQuoteLine {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  return {
    id: String(r.id ?? `line-${idx}`),
    rateId: r.rateId ? String(r.rateId) : undefined,
    itemName: String(r.itemName ?? "").trim(),
    supplier: String(r.supplier ?? "").trim(),
    rate: Number(r.rate) || 0,
    rateDate: String(r.rateDate ?? "").slice(0, 10),
    qty: Math.max(0, Number(r.qty) || 0),
    unit: String(r.unit ?? "pcs").trim() || "pcs",
    included: r.included !== false,
  }
}

function mapTerm(raw: unknown, idx: number): QuoteTermSection {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  const bullets = Array.isArray(r.bullets)
    ? r.bullets.map((b) => String(b ?? "").trim()).filter(Boolean)
    : []
  return {
    id: String(r.id ?? `term-${idx}`),
    heading: String(r.heading ?? "").trim(),
    bullets,
  }
}

export function rowToExtensiveQuotation(r: Record<string, unknown>): ExtensiveQuotation {
  const items = Array.isArray(r.items) ? r.items.map(mapLine) : []
  const total = includedQuoteTotal(items)
  return {
    id: String(r.id ?? ""),
    quotationNumber: String(r.quotationNumber ?? ""),
    recipientName: String(r.recipientName ?? ""),
    recipientCompany: String(r.recipientCompany ?? ""),
    recipientAddress: String(r.recipientAddress ?? ""),
    quoteDate: String(r.quoteDate ?? "").slice(0, 10),
    validUntil: String(r.validUntil ?? "").slice(0, 10),
    notes: String(r.notes ?? ""),
    showBranding: r.showBranding !== false,
    items,
    terms: Array.isArray(r.terms) ? r.terms.map(mapTerm) : [],
    subtotal: total,
    total: Number(r.total) || total,
    status: (String(r.status || "draft") as ExtensiveQuotationStatus) || "draft",
    createdAt: r.createdAt ? new Date(r.createdAt as string | Date).toISOString() : "",
    createdBy: String(r.createdBy ?? ""),
    ownerUserId: r.ownerUserId ? String(r.ownerUserId) : undefined,
  }
}

export async function getExtensiveQuotations(): Promise<ExtensiveQuotation[]> {
  try {
    const res = await fetch("/api/crm/extensive-quotations", { cache: "no-store" })
    if (!res.ok) return []
    const data = await res.json()
    return (Array.isArray(data) ? data : []).map(rowToExtensiveQuotation)
  } catch {
    return []
  }
}

export async function saveExtensiveQuotation(quote: ExtensiveQuotation): Promise<ExtensiveQuotation> {
  const total = includedQuoteTotal(quote.items)
  const payload = { ...quote, subtotal: total, total }
  const res = await fetch("/api/crm/extensive-quotations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || "Could not save quotation")
  }
  return rowToExtensiveQuotation(await res.json())
}

export async function deleteExtensiveQuotation(id: string): Promise<void> {
  const res = await fetch("/api/crm/extensive-quotations", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || "Could not delete quotation")
  }
}

export async function generateExtensiveQuotationNumber(): Promise<string> {
  try {
    const res = await fetch("/api/crm/extensive-quotations/count", { cache: "no-store" })
    const { count } = await res.json()
    return `Q2-${String((count ?? 0) + 1).padStart(5, "0")}`
  } catch {
    return `Q2-${Date.now()}`
  }
}

export function duplicateExtensiveQuotation(source: ExtensiveQuotation): ExtensiveQuotation {
  const today = new Date().toISOString().slice(0, 10)
  return {
    ...source,
    id: "",
    quotationNumber: "",
    status: "draft",
    createdAt: "",
    quoteDate: today,
    items: source.items.map((item, idx) => ({
      ...item,
      id: `dup-${Date.now()}-${idx}`,
    })),
    terms: source.terms.map((term, idx) => ({
      ...term,
      id: `dup-term-${Date.now()}-${idx}`,
      bullets: [...term.bullets],
    })),
  }
}

export const EXTENSIVE_STATUS_LABELS: Record<ExtensiveQuotationStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  accepted: "Accepted",
  rejected: "Rejected",
  expired: "Expired",
}

export const EXTENSIVE_STATUS_COLORS: Record<ExtensiveQuotationStatus, string> = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  sent: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  accepted: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  expired: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
}
