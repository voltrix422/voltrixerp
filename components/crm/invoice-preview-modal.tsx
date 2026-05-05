"use client"
import { X, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { downloadInvoicePDF } from "@/lib/generate-invoice-pdf"
import type { Order } from "@/lib/orders"
import Image from "next/image"

interface InvoicePreviewModalProps {
  order: Order
  onClose: () => void
}

export function InvoicePreviewModal({ order, onClose }: InvoicePreviewModalProps) {
  const subtotal = order.subtotal
  const tax = order.tax ?? (subtotal * (order.taxPercent || 0)) / 100
  const transport = order.transportCostValue ?? order.transportCost ?? 0
  const otherCost = order.otherCostValue ?? order.otherCost ?? 0
  const discount = order.discountValue ?? (order.discountIsPercentage
    ? (subtotal * (order.discount || 0)) / 100
    : (order.discount || 0))
  const total = order.total
  const totalPaid = (order.payments || []).reduce((s, p) => s + p.amount, 0)
  const remaining = total - totalPaid

  async function handleDownload() {
    try {
      await downloadInvoicePDF(order)
    } catch {
      alert("Failed to generate PDF. Please try again.")
    }
  }

  const fmt = (n: number) => `PKR ${n.toLocaleString(undefined, { minimumFractionDigits: 2 })}`

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] bg-white"
        onClick={e => e.stopPropagation()}
      >
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b bg-gray-50 shrink-0">
          <p className="text-sm font-semibold text-gray-700">Quotation Preview</p>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={handleDownload}>
              <Download className="h-3.5 w-3.5" /> Download PDF
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Scrollable quotation body */}
        <div className="flex-1 overflow-y-auto bg-gray-100 p-5">
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">

            {/* ── Header band ── */}
            <div className="bg-[#1a9f9a] px-7 py-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative h-11 w-11 shrink-0 bg-white rounded p-1">
                  <Image src="/logo.png" alt="Voltrix" fill className="object-contain" />
                </div>
                <div>
                  <p className="text-white font-bold text-base leading-tight">VOLTRIX PVT LIMITED</p>
                  <p className="text-white/80 text-[11px] mt-0.5">Plot # 73, Street 14, Industrial Area I-9/2, Islamabad</p>
                  <p className="text-white/80 text-[11px]">+92 303 4927779</p>
                </div>
              </div>
              <p className="text-white font-bold text-2xl tracking-wide">QUOTATION</p>
            </div>

            {/* ── Meta band ── */}
            <div className="bg-[#148f8b] px-7 py-3 grid grid-cols-4 gap-4">
              {[
                { label: "QUOTATION #", value: order.orderNumber },
                { label: "DATE", value: new Date(order.createdAt).toLocaleDateString() },
                ...(order.deliveryDate ? [{ label: "DELIVERY DATE", value: new Date(order.deliveryDate).toLocaleDateString() }] : []),
                { label: "PREPARED BY", value: order.createdBy || "—" },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-white/60 text-[9px] font-bold uppercase tracking-widest">{label}</p>
                  <p className="text-white text-xs font-semibold mt-0.5">{value}</p>
                </div>
              ))}
            </div>

            {/* ── Body ── */}
            <div className="px-7 py-6 space-y-6">

              {/* TO */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#1a9f9a] border-b border-[#1a9f9a]/30 pb-1 mb-2">To</p>
                <p className="text-sm font-bold text-gray-800">{order.clientName}</p>
                {order.deliveryAddress && (
                  <p className="text-xs text-gray-500 mt-0.5 whitespace-pre-wrap">{order.deliveryAddress}</p>
                )}
              </div>

              {/* Items table */}
              <div>
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-[#1a9f9a] text-white">
                      <th className="px-3 py-2.5 text-left text-xs font-semibold">Description</th>
                      <th className="px-3 py-2.5 text-center text-xs font-semibold w-12">Qty</th>
                      <th className="px-3 py-2.5 text-center text-xs font-semibold w-12">Unit</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold w-28">Unit Price</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold w-28">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items.map((item, i) => (
                      <tr key={item.id} className={i % 2 === 0 ? "bg-white" : "bg-[#f0fafa]"}>
                        <td className="px-3 py-2.5 text-gray-800 text-xs">{item.description}</td>
                        <td className="px-3 py-2.5 text-center text-gray-700 text-xs">{item.qty}</td>
                        <td className="px-3 py-2.5 text-center text-gray-700 text-xs">{item.unit}</td>
                        <td className="px-3 py-2.5 text-right text-gray-700 text-xs">PKR {item.unitPrice.toLocaleString()}</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-gray-800 text-xs">
                          PKR {(item.unitPrice * item.qty).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="flex justify-end">
                <div className="w-64 space-y-1.5">
                  <div className="flex justify-between text-xs text-gray-600 border-t pt-2">
                    <span>Subtotal</span>
                    <span>{fmt(subtotal)}</span>
                  </div>
                  {tax > 0 && (
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Tax ({order.taxPercent || 0}%)</span>
                      <span>{fmt(tax)}</span>
                    </div>
                  )}
                  {transport > 0 && (
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>{order.transportLabel || "Transport"}</span>
                      <span>{fmt(transport)}</span>
                    </div>
                  )}
                  {otherCost > 0 && (
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>{order.otherCostLabel || "Other cost"}</span>
                      <span>{fmt(otherCost)}</span>
                    </div>
                  )}
                  {discount > 0 && (
                    <div className="flex justify-between text-xs text-green-600">
                      <span>Discount</span>
                      <span>- {fmt(discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center bg-[#1a9f9a] text-white rounded px-3 py-2 mt-1">
                    <span className="text-xs font-bold">TOTAL</span>
                    <span className="text-sm font-bold">{fmt(total)}</span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {order.notes && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#1a9f9a] border-b border-[#1a9f9a]/30 pb-1 mb-2">Notes</p>
                  <p className="text-xs text-gray-600 whitespace-pre-wrap">{order.notes}</p>
                </div>
              )}

              {/* Payments */}
              {order.payments && order.payments.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#1a9f9a] border-b border-[#1a9f9a]/30 pb-1 mb-2">Payments Received</p>
                  <div className="space-y-1.5">
                    {order.payments.map(p => (
                      <div key={p.id} className="flex justify-between text-xs text-gray-700">
                        <span>{p.method} · {new Date(p.date).toLocaleDateString()}{p.notes ? ` · ${p.notes}` : ""}</span>
                        <span className="font-semibold">PKR {p.amount.toLocaleString()}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-xs font-bold text-gray-800 border-t pt-1.5">
                      <span>Total Paid</span>
                      <span>{fmt(totalPaid)}</span>
                    </div>
                    {remaining > 0 && (
                      <div className="flex justify-between text-xs font-bold text-orange-600">
                        <span>Remaining</span>
                        <span>{fmt(remaining)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ── Footer band ── */}
            <div className="bg-[#1a9f9a] px-7 py-3 text-center">
              <p className="text-white font-semibold text-xs">Thank you for your business!</p>
              <p className="text-white/60 text-[10px] mt-0.5">
                Prepared by {order.createdBy} · {new Date(order.createdAt).toLocaleDateString()}
              </p>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
