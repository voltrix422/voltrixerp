"use client"

import {
  getCrmItemsLineCount,
  getCrmItemsTotalQty,
  getCrmLineQtyLabels,
  type CrmQtyLineItem,
} from "@/lib/crm-line-items-summary"

export function CrmItemsQtyCell({ items }: { items?: CrmQtyLineItem[] | null }) {
  const lineLabels = getCrmLineQtyLabels(items)
  const totalQty = getCrmItemsTotalQty(items)
  const lineCount = getCrmItemsLineCount(items)

  if (lineCount === 0) {
    return <span className="text-[hsl(var(--muted-foreground))]">0</span>
  }

  if (lineCount === 1) {
    const [label] = lineLabels
    const [qty, unit] = label.split(" ")
    return (
      <span
        className="inline-flex flex-col items-center tabular-nums leading-tight"
        title={`1 line · ${totalQty} total`}
      >
        <span className="font-medium">{qty}</span>
        <span className="text-[10px] text-[hsl(var(--muted-foreground))] whitespace-nowrap">{unit}</span>
      </span>
    )
  }

  return (
    <span
      className="inline-flex flex-col items-center gap-0.5 tabular-nums leading-tight min-w-[2.5rem]"
      title={`${lineCount} lines · ${totalQty} total qty`}
    >
      {lineLabels.map((label, index) => (
        <span key={index} className="text-[10px] whitespace-nowrap">
          {label}
        </span>
      ))}
      <span className="text-[9px] font-medium text-[hsl(var(--muted-foreground))] border-t border-[hsl(var(--border))] pt-0.5 w-full text-center">
        Σ {totalQty}
      </span>
    </span>
  )
}

export function formatCrmItemsQtyLabel(items?: CrmQtyLineItem[] | null): string {
  const lineLabels = getCrmLineQtyLabels(items)
  const totalQty = getCrmItemsTotalQty(items)
  const lineCount = lineLabels.length

  if (lineCount === 0) return "0 pcs"
  if (lineCount === 1) return lineLabels[0]
  return `${lineLabels.join(" + ")} (Σ ${totalQty})`
}
