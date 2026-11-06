"use client"

import type { MouseEvent } from "react"
import {
  getOrderAmountPaid,
  getOrderCreditBalance,
  getOrderNetSalesValue,
  hasOutstandingCredit,
  isOrderReturned,
  type Order,
} from "@/lib/orders"
import { OrderStatusBadge } from "@/components/crm/order-status-badge"
import { OrderSourceLabel } from "@/components/crm/order-source-badge"
import { formatCrmItemsQtyLabel } from "@/components/crm/crm-items-qty-cell"
import { FileText, Loader2, Trash2 } from "lucide-react"

function formatPkr(amount: number) {
  return `PKR ${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
}

export function CrmOrdersListCards({
  orders,
  onSelect,
  onDownloadPdf,
  onDelete,
  pdfDownloadingId,
}: {
  orders: Order[]
  onSelect: (order: Order) => void
  onDownloadPdf?: (order: Order, e: MouseEvent) => void
  onDelete?: (order: Order) => void
  pdfDownloadingId?: string | null
}) {
  return (
    <div className="md:hidden divide-y divide-black/[0.05] dark:divide-[hsl(var(--border))]">
      {orders.map((order) => {
        const paid = getOrderAmountPaid(order)
        const due = getOrderCreditBalance(order)
        const netTotal = getOrderNetSalesValue(order)
        const onCredit = hasOutstandingCredit(order)
        const returned = isOrderReturned(order)
        return (
          <button
            key={order.id}
            type="button"
            onClick={() => onSelect(order)}
            className="w-full text-left p-3.5 space-y-2.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors cursor-pointer"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold tracking-tight text-[#0071e3] truncate">
                  {order.orderNumber || "—"}
                </p>
                <p className="text-[14px] font-semibold tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))] truncate mt-0.5">
                  {order.clientName || "—"}
                </p>
                <p className="text-[10px] text-[#aeaeb2] mt-0.5 truncate">
                  <OrderSourceLabel order={order} />
                </p>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                {onCredit && (
                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-[#ff9f0a]/18 text-[#9a6700]">
                    Credit
                  </span>
                )}
                <OrderStatusBadge status={order.status} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-[12px]">
              <div>
                <p className="text-[10px] font-medium text-[#86868b]">Items</p>
                <p className="font-semibold tracking-tight">
                  {returned ? "0" : formatCrmItemsQtyLabel(order.items)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-medium text-[#86868b]">Total</p>
                <p className="font-semibold tracking-tight tabular-nums">{formatPkr(netTotal)}</p>
              </div>
              <div>
                <p className="text-[10px] font-medium text-[#86868b]">Paid</p>
                <p className="tabular-nums tracking-tight">{formatPkr(paid)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-medium text-[#86868b]">Remaining</p>
                {due <= 0.004 ? (
                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-[#30d158]/18 text-[#248a3d]">
                    Paid
                  </span>
                ) : (
                  <p className="font-semibold tabular-nums tracking-tight text-[#9a6700]">{formatPkr(due)}</p>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] text-[#aeaeb2]">
                {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "—"}
              </p>
              {(onDownloadPdf || onDelete) && (
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  {onDownloadPdf && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => onDownloadPdf(order, e)}
                      className="h-7 w-7 inline-flex items-center justify-center rounded-full text-[#0071e3] hover:bg-[#007aff]/10 cursor-pointer"
                    >
                      {pdfDownloadingId === order.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <FileText className="h-3.5 w-3.5" />
                      )}
                    </span>
                  )}
                  {onDelete && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation()
                        onDelete(order)
                      }}
                      className="h-7 w-7 inline-flex items-center justify-center rounded-full text-[#ff3b30] hover:bg-[#ff3b30]/10 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </span>
                  )}
                </div>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}
