export type ExtensiveQuoteLineKind = "rate" | "expense"

export type ExtensiveQuoteLine = {
  id: string
  /** rate = from rate book (or saved to it); expense = custom named cost (transport, etc.) */
  lineKind?: ExtensiveQuoteLineKind
  rateId?: string
  itemName: string
  supplier: string
  rate: number
  rateDate: string
  qty: number
  unit: string
  included: boolean
}

export type QuoteBodyType = "bullets" | "plain"

export type QuoteTermSection = {
  id: string
  heading: string
  bodyType?: QuoteBodyType
  bullets: string[]
  plainText?: string
}

export type QuoteProjectCard = {
  id: string
  title: string
  location: string
  summary: string
  imageUrls: string[]
}

export type QuoteWarrantySection = {
  id: string
  productName: string
  heading: string
  bodyType: QuoteBodyType
  bullets: string[]
  plainText: string
}

export type QuoteTestimonial = {
  id: string
  name: string
  role: string
  quote: string
}

export type QuoteCustomSection = {
  id: string
  heading: string
  bodyType: QuoteBodyType
  bullets: string[]
  plainText: string
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
  introText: string
  footerText: string
  /** Shown on PDF as Prepared by (editable; default Engr. Fasi Ur Rehman). */
  preparedBy: string
  showBranding: boolean
  items: ExtensiveQuoteLine[]
  terms: QuoteTermSection[]
  projects: QuoteProjectCard[]
  warranties: QuoteWarrantySection[]
  testimonials: QuoteTestimonial[]
  customSections: QuoteCustomSection[]
  subtotal: number
  total: number
  status: ExtensiveQuotationStatus
  createdAt: string
  createdBy: string
  ownerUserId?: string
}

/** Seed options for “Add from defaults” in Create Q2. */
export const DEFAULT_Q2_TESTIMONIALS: Omit<QuoteTestimonial, "id">[] = [
  {
    name: "Ali Khan",
    role: "Business Owner",
    quote:
      "Voltrix lithium batteries provide long-lasting power and excellent customer support. Truly a game-changer for our facility.",
  },
  {
    name: "Sara Ahmed",
    role: "Operations Manager",
    quote:
      "Reliable and efficient! Our operations have never been smoother since switching to Voltrix lithium battery energy systems.",
  },
  {
    name: "Bilal Shah",
    role: "Factory Director",
    quote:
      "Highly recommend Voltrix lithium batteries for their performance and durability. The ROI has been exceptional.",
  },
  {
    name: "Usman Malik",
    role: "Solar Consultant",
    quote:
      "The BMS on every Voltrix lithium battery pack is outstanding. Real-time Bluetooth monitoring gives us complete peace of mind.",
  },
  {
    name: "Hina Raza",
    role: "Homeowner",
    quote:
      "Switched from lead-acid to Voltrix LiFePO₄ lithium batteries — the difference is night and day. Zero maintenance headaches.",
  },
  {
    name: "Tariq Butt",
    role: "EV Fleet Manager",
    quote:
      "Our electric rickshaw fleet runs on Voltrix EV lithium battery packs. Range improved by 40% and downtime is near zero.",
  },
]

export function includedQuoteTotal(items: ExtensiveQuoteLine[]): number {
  return items.reduce((sum, line) => {
    if (!line.included) return sum
    const qty = Math.max(0, Number(line.qty) || 0)
    const rate = Math.max(0, Number(line.rate) || 0)
    return sum + qty * rate
  }, 0)
}

function mapBodyType(raw: unknown): QuoteBodyType {
  return String(raw ?? "").toLowerCase() === "plain" ? "plain" : "bullets"
}

function mapLine(raw: unknown, idx: number): ExtensiveQuoteLine {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  const kindRaw = String(r.lineKind ?? "").toLowerCase()
  const lineKind: ExtensiveQuoteLineKind = kindRaw === "expense" ? "expense" : "rate"
  return {
    id: String(r.id ?? `line-${idx}`),
    lineKind,
    rateId: r.rateId ? String(r.rateId) : undefined,
    itemName: String(r.itemName ?? "").trim(),
    supplier: String(r.supplier ?? "").trim(),
    rate: Number(r.rate) || 0,
    rateDate: String(r.rateDate ?? "").slice(0, 10),
    qty: Math.max(0, Number(r.qty) || 0),
    unit: String(r.unit ?? (lineKind === "expense" ? "job" : "pcs")).trim() || (lineKind === "expense" ? "job" : "pcs"),
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
    bodyType: mapBodyType(r.bodyType),
    bullets,
    plainText: String(r.plainText ?? "").trim(),
  }
}

function mapProject(raw: unknown, idx: number): QuoteProjectCard {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  const imageUrls = Array.isArray(r.imageUrls)
    ? r.imageUrls.map((u) => String(u ?? "").trim()).filter(Boolean)
    : []
  return {
    id: String(r.id ?? `project-${idx}`),
    title: String(r.title ?? "").trim(),
    location: String(r.location ?? "").trim(),
    summary: String(r.summary ?? "").trim(),
    imageUrls,
  }
}

function mapWarranty(raw: unknown, idx: number): QuoteWarrantySection {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  const bullets = Array.isArray(r.bullets)
    ? r.bullets.map((b) => String(b ?? "").trim()).filter(Boolean)
    : []
  return {
    id: String(r.id ?? `warranty-${idx}`),
    productName: String(r.productName ?? "").trim(),
    heading: String(r.heading ?? "").trim(),
    bodyType: mapBodyType(r.bodyType),
    bullets,
    plainText: String(r.plainText ?? "").trim(),
  }
}

function mapTestimonial(raw: unknown, idx: number): QuoteTestimonial {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  return {
    id: String(r.id ?? `testimonial-${idx}`),
    name: String(r.name ?? "").trim(),
    role: String(r.role ?? "").trim(),
    quote: String(r.quote ?? "").trim(),
  }
}

function mapCustomSection(raw: unknown, idx: number): QuoteCustomSection {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  const bullets = Array.isArray(r.bullets)
    ? r.bullets.map((b) => String(b ?? "").trim()).filter(Boolean)
    : []
  return {
    id: String(r.id ?? `custom-${idx}`),
    heading: String(r.heading ?? "").trim(),
    bodyType: mapBodyType(r.bodyType),
    bullets,
    plainText: String(r.plainText ?? "").trim(),
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
    introText: String(r.introText ?? ""),
    footerText: String(r.footerText ?? ""),
    preparedBy: String(r.preparedBy ?? "").trim(),
    showBranding: r.showBranding !== false,
    items,
    terms: Array.isArray(r.terms) ? r.terms.map(mapTerm) : [],
    projects: Array.isArray(r.projects) ? r.projects.map(mapProject) : [],
    warranties: Array.isArray(r.warranties) ? r.warranties.map(mapWarranty) : [],
    testimonials: Array.isArray(r.testimonials) ? r.testimonials.map(mapTestimonial) : [],
    customSections: Array.isArray(r.customSections) ? r.customSections.map(mapCustomSection) : [],
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

function cloneWithNewIds<T extends { id: string }>(rows: T[], prefix: string): T[] {
  return rows.map((row, idx) => ({
    ...row,
    id: `dup-${prefix}-${Date.now()}-${idx}`,
  }))
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
    preparedBy: source.preparedBy || "",
    items: source.items.map((item, idx) => ({
      ...item,
      id: `dup-${Date.now()}-${idx}`,
    })),
    terms: source.terms.map((term, idx) => ({
      ...term,
      id: `dup-term-${Date.now()}-${idx}`,
      bullets: [...term.bullets],
      plainText: term.plainText || "",
      bodyType: term.bodyType || "bullets",
    })),
    projects: cloneWithNewIds(
      source.projects.map((p) => ({ ...p, imageUrls: [...p.imageUrls] })),
      "project",
    ),
    warranties: cloneWithNewIds(
      source.warranties.map((w) => ({ ...w, bullets: [...w.bullets] })),
      "warranty",
    ),
    testimonials: cloneWithNewIds(source.testimonials, "testimonial"),
    customSections: cloneWithNewIds(
      source.customSections.map((s) => ({ ...s, bullets: [...s.bullets] })),
      "custom",
    ),
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
