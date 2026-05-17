"use client"

import type { Order } from "@/lib/orders"
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/orders"
import { OrderSourceBadge } from "@/components/crm/order-source-badge"
import { formatCrmItemsQtyLabel } from "@/components/crm/crm-items-qty-cell"

export function CrmOrdersListCards({
  orders,
  onSelect,
  onDownloadPdf,
  onDelete,
}: {
  orders: Order[]
  onSelect: (order: Order) => void
  onDownloadPdf: (order: Order) => void
  onDelete: (order: Order) => void
}) {
  return (
    <div className="md:hidden space-y-2">
      {orders.map((order) => (
        <button
          key={order.id}
          type="button"
          onClick={() => onSelect(order)}
          className="w-full text-left rounded-lg border p-3 space-y-2 hover:bg-[hsl(var(--muted))]/20 transition-colors cursor-pointer"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-1">
              <OrderSourceBadge order={order} />
              <p className="text-xs font-semibold text-[#1faca6] truncate">{order.orderNumber || "—"}</p>
              <p className="text-sm font-medium truncate">{order.clientName || "—"}</p>
            </div>
            <span
              className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[order.status] || "bg-gray-100 text-gray-600"}`}
            >
              {STATUS_LABELS[order.status] || order.status || "Unknown"}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[hsl(var(--muted-foreground))]">
            <span>{formatCrmItemsQtyLabel(order.items)}</span>
            <span className="font-semibold text-[hsl(var(--foreground))]">
              PKR {(order.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
            <span>{order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "—"}</span>
          </div>
          <div className="flex gap-4 pt-1" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => onDownloadPdf(order)}
              className="text-[#1a9f9a] text-xs cursor-pointer"
            >
              PDF
            </button>
            <button
              type="button"
              onClick={() => onDelete(order)}
              className="text-red-500 text-xs cursor-pointer"
            >
              Delete
            </button>
          </div>
        </button>
      ))}
    </div>
  )
}
