"use client"

import { getOrderSourcePdfLabel, isSalesAgentOrder, type Order } from "@/lib/orders"
import { SalesAgentSourceBadge } from "@/components/crm/sales-agent-source-badge"
import { useSalesAgentUserIds } from "@/hooks/use-sales-agent-user-ids"
import { cn } from "@/lib/utils"

type Props = {
  order: Pick<Order, "ownerUserId" | "createdBy">
  className?: string
}

function orderSourceOptions(salesAgentUserIds: ReadonlySet<string> | null) {
  return salesAgentUserIds ? { salesAgentUserIds } : undefined
}

export function OrderSourceBadge({ order, className }: Props) {
  const salesAgentUserIds = useSalesAgentUserIds()
  const opts = orderSourceOptions(salesAgentUserIds)

  if (isSalesAgentOrder(order, opts)) {
    return (
      <SalesAgentSourceBadge
        agentName={order.createdBy || "—"}
        kind="order"
        className={className}
      />
    )
  }

  const name = order.createdBy?.trim()
  if (name) {
    return (
      <span
        className={cn(
          "inline-flex max-w-full items-center gap-1 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 px-2 py-0.5 text-[10px] font-medium text-[hsl(var(--muted-foreground))]",
          className
        )}
      >
        <span className="shrink-0">Created by</span>
        <span className="shrink-0 opacity-70">·</span>
        <span className="truncate">{name}</span>
      </span>
    )
  }

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 px-2 py-0.5 text-[10px] font-medium text-[hsl(var(--muted-foreground))]",
        className
      )}
    >
      CRM order
    </span>
  )
}

export function OrderSourceLabel({ order, className }: Props) {
  const salesAgentUserIds = useSalesAgentUserIds()
  return (
    <span className={className}>
      {getOrderSourcePdfLabel(order, orderSourceOptions(salesAgentUserIds))}
    </span>
  )
}
