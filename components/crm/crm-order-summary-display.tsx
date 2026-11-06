"use client"

import type { Order } from "@/lib/orders"
import { splitGstInclusiveAmount } from "@/lib/gst-inclusive-pricing"

function SummaryRow({
  label,
  value,
  className = "",
}: {
  label: string
  value: string
  className?: string
}) {
  return (
    <div className={`flex items-center justify-between gap-3 px-0 py-1.5 text-[13px] ${className}`}>
      <span className="text-[hsl(var(--muted-foreground))]">{label}</span>
      <span className="font-medium text-right tabular-nums">{value}</span>
    </div>
  )
}

export function CrmOrderSummaryDisplay({ order }: { order: Order }) {
  const taxPercent = order.taxPercent || 18
  const { base: baseBeforeDiscount } = splitGstInclusiveAmount(order.subtotal, taxPercent)

  const discountAmount =
    order.discountValue !== undefined && order.discountValue !== null && order.discountValue > 0
      ? order.discountValue
      : order.discountIsPercentage === true
        ? baseBeforeDiscount * (order.discount || 0) / 100
        : order.discountIsPercentage === false
          ? order.discount
          : (order.discount || 0) <= 100
            ? baseBeforeDiscount * (order.discount || 0) / 100
            : (order.discount || 0)

  const baseAfterDiscount = Math.max(0, baseBeforeDiscount - Number(discountAmount || 0))

  const rows: { label: string; value: string; className?: string }[] = [
    { label: "Base (excl. GST)", value: `PKR ${baseBeforeDiscount.toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
  ]

  if (
    (order.discountValue !== undefined && order.discountValue !== null && order.discountValue > 0) ||
    (order.discount !== undefined && order.discount !== null && order.discount > 0)
  ) {
    const discountLabel =
      order.discountIsPercentage === true
        ? `Discount (${order.discount || 0}%)`
        : "Discount"

    rows.push({
      label: discountLabel,
      value: `- PKR ${Number(discountAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      className: "text-green-600",
    })

    rows.push({
      label: "Base After Discount",
      value: `PKR ${baseAfterDiscount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
    })
  }

  if ((order.tax || 0) > 0) {
    rows.push({
      label: `Included GST (${order.taxPercent || 18}%)`,
      value: `PKR ${(order.tax || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
    })
  }

  if (order.transportCost > 0) {
    rows.push({
      label: `${order.transportLabel || "Transport"}${order.transportIsPercentage ? ` (${order.transportCost}%)` : ""}`,
      value: `PKR ${(order.transportCostValue || order.transportCost).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
    })
  }

  if (order.otherCost > 0) {
    rows.push({
      label: `${order.otherCostLabel || "Other"}${order.otherCostIsPercentage ? ` (${order.otherCost}%)` : ""}`,
      value: `PKR ${(order.otherCostValue || order.otherCost).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
    })
  }

  if (order.shipping > 0) {
    rows.push({
      label: "Shipping",
      value: `PKR ${order.shipping.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
    })
  }

  return (
    <>
      <div className="sm:hidden rounded-lg border divide-y overflow-hidden">
        {rows.map((row) => (
          <SummaryRow key={row.label} label={row.label} value={row.value} className={row.className} />
        ))}
        <div className="flex items-center justify-between gap-3 px-0 py-2 bg-[hsl(var(--muted))]/50 font-bold text-[15px]">
          <span>Total</span>
          <span className="text-[#1faca6] tabular-nums">
            PKR {order.total.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      <div className="hidden sm:block overflow-hidden">
        <table className="w-full text-[13px]">
          <tbody className="divide-y divide-black/[0.05]">
            {rows.map((row) => (
              <tr key={row.label}>
                <td className={`px-0 py-1.5 text-right font-medium ${row.className || ""}`}>{row.label}</td>
                <td className={`pl-3 py-1.5 text-right font-medium w-44 tabular-nums ${row.className || ""}`}>{row.value}</td>
              </tr>
            ))}
            <tr className="font-bold border-t border-black/[0.08]">
              <td className="px-0 py-2 text-right text-[15px]">Total</td>
              <td className="pl-3 py-2 text-right text-[15px] text-[#1faca6] tabular-nums">
                PKR {order.total.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  )
}
