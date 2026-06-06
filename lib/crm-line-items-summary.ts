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
