export type QuoteRate = {
  id: string
  itemName: string
  supplier: string
  rate: number
  rateDate: string
  notes: string
  createdAt: string
  createdBy: string
}

function mapRow(r: Record<string, unknown>): QuoteRate {
  return {
    id: String(r.id ?? ""),
    itemName: String(r.itemName ?? "").trim(),
    supplier: String(r.supplier ?? "").trim(),
    rate: Number(r.rate) || 0,
    rateDate: String(r.rateDate ?? "").slice(0, 10),
    notes: String(r.notes ?? ""),
    createdAt: r.createdAt ? new Date(r.createdAt as string | Date).toISOString() : "",
    createdBy: String(r.createdBy ?? ""),
  }
}

export async function getQuoteRates(): Promise<QuoteRate[]> {
  try {
    const res = await fetch("/api/crm/quote-rates", { cache: "no-store" })
    if (!res.ok) return []
    const data = await res.json()
    return (Array.isArray(data) ? data : []).map(mapRow)
  } catch {
    return []
  }
}

export async function saveQuoteRate(rate: Partial<QuoteRate> & Pick<QuoteRate, "itemName" | "supplier" | "rate" | "rateDate" | "createdBy">): Promise<QuoteRate> {
  const res = await fetch("/api/crm/quote-rates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rate),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || "Could not save rate")
  }
  return mapRow(await res.json())
}

export type GroupedQuoteRates = {
  itemName: string
  suppliers: { supplier: string; rows: QuoteRate[] }[]
}

export type RateTiming = "upcoming" | "current" | "past"

export function todayIsoDate() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/** Most recent rate date that is not in the future. */
export function currentRateDate(rows: QuoteRate[], today = todayIsoDate()): string {
  const notFuture = rows
    .filter((r) => r.rateDate && r.rateDate <= today)
    .sort((a, b) => b.rateDate.localeCompare(a.rateDate))
  return notFuture[0]?.rateDate || ""
}

export function rateTiming(rateDate: string, currentDate: string, today = todayIsoDate()): RateTiming {
  if (rateDate > today) return "upcoming"
  if (currentDate && rateDate === currentDate) return "current"
  if (rateDate < today) return "past"
  return "current"
}

/** Upcoming (soonest first), then current/past (newest first). */
export function sortRatesForDisplay(rows: QuoteRate[], today = todayIsoDate()): QuoteRate[] {
  return [...rows].sort((a, b) => {
    const aUp = a.rateDate > today
    const bUp = b.rateDate > today
    if (aUp && !bUp) return -1
    if (!aUp && bUp) return 1
    if (aUp && bUp) return a.rateDate.localeCompare(b.rateDate)
    return b.rateDate.localeCompare(a.rateDate) || b.createdAt.localeCompare(a.createdAt)
  })
}

/** Item → supplier → all dated rates (past and upcoming). */
export function groupQuoteRates(rates: QuoteRate[]): GroupedQuoteRates[] {
  const byItem = new Map<string, { name: string; suppliers: Map<string, { name: string; rows: QuoteRate[] }> }>()
  for (const rate of rates) {
    const itemKey = rate.itemName.trim().toLowerCase() || "untitled"
    const supplierKey = rate.supplier.trim().toLowerCase() || "unknown"
    if (!byItem.has(itemKey)) byItem.set(itemKey, { name: rate.itemName.trim() || "Untitled", suppliers: new Map() })
    const item = byItem.get(itemKey)!
    if (!item.suppliers.has(supplierKey)) {
      item.suppliers.set(supplierKey, { name: rate.supplier.trim() || "Unknown", rows: [] })
    }
    item.suppliers.get(supplierKey)!.rows.push(rate)
  }
  return [...byItem.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((item) => ({
      itemName: item.name,
      suppliers: [...item.suppliers.values()]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((sup) => ({
          supplier: sup.name,
          rows: sortRatesForDisplay(sup.rows),
        })),
    }))
}

export async function deleteQuoteRate(id: string): Promise<void> {
  const res = await fetch("/api/crm/quote-rates", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || "Could not delete rate")
  }
}
