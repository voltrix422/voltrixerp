export type CrmQtyLineItem = { qty?: number; unit?: string }

export function getCrmItemsTotalQty(items?: CrmQtyLineItem[] | null): number {
  if (!items?.length) return 0
  return items.reduce((sum, item) => sum + Math.max(0, Number(item.qty) || 0), 0)
}

export function getCrmItemsLineCount(items?: unknown[] | null): number {
  return items?.length ?? 0
}

/** Per invoice line: e.g. "3 pc", "2 pc" */
export function getCrmLineQtyLabels(items?: CrmQtyLineItem[] | null): string[] {
  if (!items?.length) return []
  return items.map((item) => {
    const qty = Math.max(0, Number(item.qty) || 0)
    const unit = (item.unit || "pc").trim() || "pc"
    return `${qty} ${unit}`
  })
}

/** Order total qty label: e.g. "11 pcs", "1 pc" */
export function getCrmItemsTotalQtyLabel(items?: CrmQtyLineItem[] | null): string {
  const totalQty = getCrmItemsTotalQty(items)
  const lines = items ?? []
  if (!lines.length) return "0 pcs"

  if (lines.length === 1) {
    const unit = (lines[0].unit || "pc").trim() || "pc"
    return `${totalQty} ${unit}`
  }

  const units = new Set(lines.map((i) => (i.unit || "pc").trim() || "pc"))
  if (units.size === 1) {
    const unit = [...units][0]!
    const displayUnit = unit === "pc" ? (totalQty === 1 ? "pc" : "pcs") : unit
    return `${totalQty} ${displayUnit}`
  }

  return `${totalQty} pcs`
}
