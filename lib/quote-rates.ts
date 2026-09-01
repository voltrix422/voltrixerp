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

/** Item → supplier → rates newest date first. */
export function groupQuoteRates(rates: QuoteRate[]): GroupedQuoteRates[] {
  const byItem = new Map<string, Map<string, QuoteRate[]>>()
  for (const rate of rates) {
    const itemKey = rate.itemName.trim() || "Untitled"
    const supplierKey = rate.supplier.trim() || "Unknown"
    if (!byItem.has(itemKey)) byItem.set(itemKey, new Map())
    const suppliers = byItem.get(itemKey)!
    const list = suppliers.get(supplierKey) || []
    list.push(rate)
    suppliers.set(supplierKey, list)
  }
  return [...byItem.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([itemName, suppliers]) => ({
      itemName,
      suppliers: [...suppliers.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([supplier, rows]) => ({
          supplier,
          rows: [...rows].sort((a, b) => b.rateDate.localeCompare(a.rateDate) || b.createdAt.localeCompare(a.createdAt)),
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
