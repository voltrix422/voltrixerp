"use client"
import { useState } from "react"
import { X, Download, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { downloadInvoicePDF } from "@/lib/generate-invoice-pdf"
import type { Order } from "@/lib/orders"
import { getOrderSourcePdfLabel, resolveOrderItemModel } from "@/lib/orders"
import Image from "next/image"

interface InvoicePreviewModalProps {
  order: Order
  onClose: () => void
}

export function InvoicePreviewModal({ order, onClose }: InvoicePreviewModalProps) {
  const [downloading, setDownloading] = useState(false)
  const subtotal = order.subtotal ?? 0
  const tax = order.tax ?? (subtotal * (order.taxPercent || 0)) / 100
  const transport = order.transportCostValue ?? order.transportCost ?? 0
  const otherCost = order.otherCostValue ?? order.otherCost ?? 0

  const rawDiscount = order.discount || 0
  let discountValue: number
  if (order.discountValue !== undefined && order.discountValue !== null) {
    discountValue = order.discountValue
  } else if (order.discountIsPercentage === true) {
    discountValue = subtotal * rawDiscount / 100
  } else if (order.discountIsPercentage === false) {
    discountValue = rawDiscount
  } else {
    discountValue = rawDiscount <= 100 ? subtotal * rawDiscount / 100 : rawDiscount
  }

  const total = order.total ?? 0
  const totalPaid = (order.payments || []).reduce((s, p) => s + p.amount, 0)
  const remaining = total - totalPaid

  const fmt = (n: number) => `PKR ${n.toLocaleString("en-PK", { minimumFractionDigits: 2 })}`

  const itemRows = order.items.map((item, i) => ({
    item,
    index: i + 1,
    model: resolveOrderItemModel(item),
    lineTotal: item.qty * item.unitPrice,
  }))
  const showModelCol = itemRows.some((r) => r.model)

  const metaItems = [
    { label: "CLIENT", value: order.clientName },
    { label: "INVOICE DATE", value: new Date(order.createdAt).toLocaleDateString("en-PK") },
    ...(order.deliveryDate
      ? [{ label: "DELIVERY DATE", value: new Date(order.deliveryDate).toLocaleDateString("en-PK") }]
      : []),
    { label: "ORDER SOURCE", value: getOrderSourcePdfLabel(order) },
    { label: "PREPARED BY", value: order.createdBy || "—" },
  ]

  async function handleDownload() {
    if (downloading) return
    setDownloading(true)
    try {
      await downloadInvoicePDF(order)
    } catch {
      alert("Failed to generate PDF. Please try again.")
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-2xl rounded-t-2xl sm:rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[90vh] bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-3 sm:px-4 py-2.5 border-b bg-gray-50 shrink-0">
          <p className="text-sm font-semibold text-gray-700">Invoice Preview</p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-9 flex-1 sm:flex-none text-xs gap-1.5 cursor-pointer sm:min-w-[7.5rem]"
              onClick={() => void handleDownload()}
              disabled={downloading}
            >
              {downloading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                  Generating…
                </>
              ) : (
                <>
                  <Download className="h-3.5 w-3.5 shrink-0" />
                  Download PDF
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 cursor-pointer"
              onClick={onClose}
              disabled={downloading}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain bg-gray-100 p-2 sm:p-5">
          <div className="bg-white rounded-lg shadow-sm overflow-hidden min-w-0">
            <div className="bg-[#1a9f9a] px-3 sm:px-7 py-4 sm:py-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3 min-w-0">
                <div className="relative h-10 w-10 sm:h-12 sm:w-12 shrink-0 bg-white rounded-lg p-1">
                  <Image src="/logo.png" alt="Voltrix" fill className="object-contain" />
                </div>
                <div className="min-w-0">
                  <p className="text-white font-bold text-sm sm:text-base leading-tight">VOLTRIX BATTERIES</p>
                  <p className="text-white/80 text-[9px] sm:text-[10px] mt-0.5 leading-snug">
                    Head Office: Plot # 73, Street 14, Industrial Area I-9/2, Islamabad
                  </p>
                  <p className="text-white/80 text-[9px] sm:text-[10px]">Phone: 051-8731661 · Mobile: +92 303 4927779</p>
                  <p className="text-white/80 text-[9px] sm:text-[10px] break-all">
                    info@voltrixbatteries.com · voltrixbatteries.com
                  </p>
                </div>
              </div>
              <div className="sm:text-right shrink-0 border-t border-white/20 pt-2 sm:border-0 sm:pt-0">
                <p className="text-white font-bold text-xl sm:text-2xl tracking-wide">INVOICE</p>
                <p className="text-white/90 text-xs sm:text-sm mt-0.5 font-medium">{order.orderNumber}</p>
              </div>
            </div>

            <div className="bg-[#148f8b] px-3 sm:px-7 py-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
              {metaItems.map(({ label, value }) => (
                <div key={label} className="min-w-0">
                  <p className="text-white/60 text-[8px] sm:text-[9px] font-bold uppercase tracking-widest">{label}</p>
                  <p className="text-white text-[11px] sm:text-xs font-semibold mt-0.5 break-words">{value}</p>
                </div>
              ))}
            </div>

            <div className="px-3 sm:px-7 py-4 sm:py-6 space-y-4 sm:space-y-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#1a9f9a] border-b border-[#1a9f9a]/30 pb-1 mb-2">
                  Bill To
                </p>
                <p className="text-sm font-bold text-gray-800">{order.clientName}</p>
                {order.deliveryAddress && (
                  <p className="text-xs text-gray-500 mt-0.5 whitespace-pre-wrap">{order.deliveryAddress}</p>
                )}
              </div>

              <div>
                <div className="sm:hidden space-y-2">
                  {itemRows.map(({ item, index, model, lineTotal }) => (
                    <div
                      key={item.id}
                      className="rounded-lg border border-gray-200 p-3 space-y-2 text-xs bg-white"
                    >
                      <div className="flex justify-between gap-2">
                        <span className="text-gray-500 font-medium">#{index}</span>
                        <span className="font-semibold text-[#1a9f9a] tabular-nums">
                          PKR {lineTotal.toLocaleString("en-PK")}
                        </span>
                      </div>
                      {showModelCol && model && (
                        <div>
                          <p className="text-[10px] font-semibold uppercase text-gray-400">Model</p>
                          <p className="font-medium tabular-nums break-all">{model}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-[10px] font-semibold uppercase text-gray-400">Description</p>
                        <p className="break-words">{item.description}</p>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <p className="text-[10px] font-semibold uppercase text-gray-400">Qty</p>
                          <p>{item.qty}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase text-gray-400">Unit</p>
                          <p>{item.unit}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase text-gray-400">Unit price</p>
                          <p className="tabular-nums">PKR {item.unitPrice.toLocaleString("en-PK")}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-sm border-collapse min-w-[32rem]">
                    <thead>
                      <tr className="bg-[#1a9f9a] text-white">
                        <th className="px-3 py-2.5 text-left text-xs font-semibold w-6">#</th>
                        {showModelCol && (
                          <th className="px-3 py-2.5 text-left text-xs font-semibold w-28">Model</th>
                        )}
                        <th className="px-3 py-2.5 text-left text-xs font-semibold">Description</th>
                        <th className="px-3 py-2.5 text-center text-xs font-semibold w-12">Qty</th>
                        <th className="px-3 py-2.5 text-center text-xs font-semibold w-12">Unit</th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold w-28">Unit Price</th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold w-28">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itemRows.map(({ item, index, model, lineTotal }) => (
                        <tr key={item.id} className={index % 2 === 1 ? "bg-[#f0fafa]" : "bg-white"}>
                          <td className="px-3 py-2.5 text-gray-500 text-xs">{index}</td>
                          {showModelCol && (
                            <td className="px-3 py-2.5 text-gray-800 text-xs font-medium tabular-nums">
                              {model || "—"}
                            </td>
                          )}
                          <td className="px-3 py-2.5 text-gray-800 text-xs">{item.description}</td>
                          <td className="px-3 py-2.5 text-center text-gray-700 text-xs">{item.qty}</td>
                          <td className="px-3 py-2.5 text-center text-gray-700 text-xs">{item.unit}</td>
                          <td className="px-3 py-2.5 text-right text-gray-700 text-xs tabular-nums">
                            PKR {item.unitPrice.toLocaleString("en-PK")}
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold text-gray-800 text-xs tabular-nums">
                            PKR {lineTotal.toLocaleString("en-PK")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-stretch sm:justify-end">
                <div className="w-full sm:w-72 space-y-1.5">
                  <div className="flex justify-between text-xs text-gray-600 border-t pt-2 gap-2">
                    <span>Subtotal</span>
                    <span className="font-medium tabular-nums">{fmt(subtotal)}</span>
                  </div>
                  {discountValue > 0 && (
                    <div className="flex justify-between text-xs text-red-600 gap-2">
                      <span className="min-w-0">
                        Discount
                        {order.discountIsPercentage && rawDiscount
                          ? ` (${rawDiscount}%)`
                          : rawDiscount <= 100 && rawDiscount > 0
                            ? ` (${rawDiscount}%)`
                            : ""}
                      </span>
                      <span className="font-medium tabular-nums shrink-0">-{fmt(discountValue)}</span>
                    </div>
                  )}
                  {tax > 0 && (
                    <div className="flex justify-between text-xs text-gray-600 gap-2">
                      <span>Tax ({order.taxPercent || 0}%)</span>
                      <span className="font-medium tabular-nums">{fmt(tax)}</span>
                    </div>
                  )}
                  {transport > 0 && (
                    <div className="flex justify-between text-xs text-gray-600 gap-2">
                      <span className="min-w-0">{order.transportLabel || "Transport"}</span>
                      <span className="font-medium tabular-nums shrink-0">{fmt(transport)}</span>
                    </div>
                  )}
                  {otherCost > 0 && (
                    <div className="flex justify-between text-xs text-gray-600 gap-2">
                      <span className="min-w-0">{order.otherCostLabel || "Other"}</span>
                      <span className="font-medium tabular-nums shrink-0">{fmt(otherCost)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center bg-[#1a9f9a] text-white rounded px-3 py-2 mt-2 gap-2">
                    <span className="text-xs font-bold">TOTAL</span>
                    <span className="text-sm font-bold tabular-nums">{fmt(total)}</span>
                  </div>
                </div>
              </div>

              {totalPaid > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#1a9f9a] border-b border-[#1a9f9a]/30 pb-1 mb-2">
                    Payments Received
                  </p>
                  <div className="space-y-1.5">
                    {order.payments?.map((p) => (
                      <div key={p.id} className="flex justify-between gap-2 text-xs text-gray-700">
                        <span className="min-w-0 break-words">
                          {p.method} · {new Date(p.date).toLocaleDateString("en-PK")}
                          {p.notes ? ` · ${p.notes}` : ""}
                        </span>
                        <span className="font-semibold tabular-nums shrink-0">
                          PKR {p.amount.toLocaleString("en-PK")}
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between text-xs font-bold text-gray-800 border-t pt-1.5 gap-2">
                      <span>Total Paid</span>
                      <span className="tabular-nums">{fmt(totalPaid)}</span>
                    </div>
                    {remaining > 0 && (
                      <div className="flex justify-between text-xs font-bold text-orange-600 gap-2">
                        <span>Balance Due</span>
                        <span className="tabular-nums">{fmt(remaining)}</span>
                      </div>
                    )}
                    {remaining <= 0 && (
                      <div className="flex items-center gap-1.5 text-xs font-bold text-green-600 mt-1">
                        <div className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
                        <span>Paid in Full</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {order.notes && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#1a9f9a] border-b border-[#1a9f9a]/30 pb-1 mb-2">
                    Notes
                  </p>
                  <p className="text-xs text-gray-600 whitespace-pre-wrap">{order.notes}</p>
                </div>
              )}
            </div>

            <div className="bg-[#1a9f9a] px-3 sm:px-7 py-3 sm:py-4 text-center">
              <p className="text-white font-semibold text-sm">Thank you for your business!</p>
              <p className="text-white/60 text-[10px] mt-1">
                This is a computer-generated invoice. No signature required.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
