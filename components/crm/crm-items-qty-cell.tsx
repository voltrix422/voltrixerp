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
    <div className="flex flex-col items-center leading-tight" title={`${lineCount} product line(s), ${totalQty} total qty`}>
      <span className="font-medium tabular-nums">{totalQty}</span>
      <span className="text-[9px] text-[hsl(var(--muted-foreground))]">
        {lineCount} {lineCount === 1 ? "line" : "lines"}
      </span>
    </div>
  )
}

export function formatCrmItemsQtyLabel(items?: CrmQtyLineItem[] | null): string {
  const totalQty = getCrmItemsTotalQty(items)
  const lineCount = getCrmItemsLineCount(items)
  if (lineCount === 0) return "0 pcs"
  if (lineCount === 1) return `${totalQty} ${totalQty === 1 ? "pc" : "pcs"}`
  return `${totalQty} pcs · ${lineCount} lines`
}
