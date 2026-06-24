"use client"

import {
  getCrmItemsLineCount,
  getCrmItemsTotalQty,
  getCrmItemsTotalQtyLabel,
  getCrmLineQtyLabels,
  type CrmQtyLineItem,
} from "@/lib/crm-line-items-summary"

export function CrmItemsQtyCell({
  items,
  compact = false,
}: {
  items?: CrmQtyLineItem[] | null
  compact?: boolean
}) {
  const lineLabels = getCrmLineQtyLabels(items)
  const totalLabel = getCrmItemsTotalQtyLabel(items)
  const lineCount = getCrmItemsLineCount(items)

  if (lineCount === 0) {
    return <span className="text-[hsl(var(--muted-foreground))]">0</span>
  }

  return (
    <span
      className="inline-flex flex-col items-center gap-0.5 tabular-nums leading-tight text-center min-w-[3rem]"
      title={lineCount > 1 ? lineLabels.join(" + ") : undefined}
    >
      <span className="text-xs font-semibold whitespace-nowrap">{totalLabel}</span>
      {!compact && lineCount > 1 && (
        <span className="text-[10px] text-[hsl(var(--muted-foreground))] whitespace-nowrap max-w-[10rem] truncate">
          {lineLabels.join(" + ")}
        </span>
      )}
      {compact && lineCount > 1 && (
        <span className="text-[10px] text-[hsl(var(--muted-foreground))] whitespace-nowrap">
          {lineCount} lines
        </span>
      )}
    </span>
  )
}

export function formatCrmItemsQtyLabel(items?: CrmQtyLineItem[] | null): string {
  const lineLabels = getCrmLineQtyLabels(items)
  const totalLabel = getCrmItemsTotalQtyLabel(items)
  if (lineLabels.length === 0) return "0 pcs"
  if (lineLabels.length === 1) return totalLabel
  return `${totalLabel} (${lineLabels.join(" + ")})`
}
