import { isSalesAgentOrder, type Order } from "@/lib/orders"
import { SalesAgentSourceBadge } from "@/components/crm/sales-agent-source-badge"
import { cn } from "@/lib/utils"

type Props = {
  order: Pick<Order, "ownerUserId" | "createdBy">
  className?: string
}

export function OrderSourceBadge({ order, className }: Props) {
  if (isSalesAgentOrder(order)) {
    return <SalesAgentSourceBadge agentName={order.createdBy} kind="order" className={className} />
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
