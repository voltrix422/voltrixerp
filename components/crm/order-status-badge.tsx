import { STATUS_COLORS, STATUS_LABELS, type Order } from "@/lib/orders"
import { cn } from "@/lib/utils"

type Props = {
  status: Order["status"]
  className?: string
}

export function OrderStatusBadge({ status, className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-tight leading-tight whitespace-nowrap",
        STATUS_COLORS[status] || "bg-black/[0.06] text-[#6e6e73]",
        className
      )}
    >
      {STATUS_LABELS[status] || status}
    </span>
  )
}
