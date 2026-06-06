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
        "inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-medium leading-tight",
        STATUS_COLORS[status] || "bg-gray-50 text-gray-600 border-gray-200",
        className
      )}
    >
      {STATUS_LABELS[status] || status}
    </span>
  )
}
