"use client"

import {
  getCrmItemsLineCount,
  getCrmItemsTotalQty,
  type CrmQtyLineItem,
} from "@/lib/crm-line-items-summary"

export function CrmItemsQtyCell({ items }: { items?: CrmQtyLineItem[] | null }) {
  const totalQty = getCrmItemsTotalQty(items)
  const lineCount = getCrmItemsLineCount(items)

  if (lineCount === 0) {
    return <span className="text-[hsl(var(--muted-foreground))]">0</span>
  }

  return (
    <span
      className="inline-flex flex-wrap items-baseline justify-center gap-x-1 tabular-nums"
      title={`${lineCount} product line(s), ${totalQty} total qty`}
    >
      <span className="font-medium">{totalQty}</span>
      <span className="text-[10px] text-[hsl(var(--muted-foreground))] whitespace-nowrap">
        {lineCount === 1 ? "pc" : `pcs · ${lineCount} lines`}
      </span>
    </span>
  )
}

export function formatCrmItemsQtyLabel(items?: CrmQtyLineItem[] | null): string {
  const totalQty = getCrmItemsTotalQty(items)
  const lineCount = getCrmItemsLineCount(items)
  if (lineCount === 0) return "0 pcs"
  if (lineCount === 1) return `${totalQty} ${totalQty === 1 ? "pc" : "pcs"}`
  return `${totalQty} pcs · ${lineCount} lines`
}
