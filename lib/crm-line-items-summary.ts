export type CrmQtyLineItem = { qty?: number }

export function getCrmItemsTotalQty(items?: CrmQtyLineItem[] | null): number {
  if (!items?.length) return 0
  return items.reduce((sum, item) => sum + Math.max(0, Number(item.qty) || 0), 0)
}

export function getCrmItemsLineCount(items?: unknown[] | null): number {
  return items?.length ?? 0
}
