"use client"

import { Trash2, X } from "lucide-react"
import { splitGstInclusiveAmount } from "@/lib/gst-inclusive-pricing"

export type CrmLineItem = {
  id: string
  description: string
  qty: number
  unit: string
  unitPrice: number
  isCustom: boolean
  availableQty?: number
  costPrice?: number
}

type CrmLineItemField = "description" | "qty" | "unit" | "unitPrice"

const inputSm =
  "w-full rounded border bg-[hsl(var(--background))] px-2 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
const inputMd =
  "w-full rounded border bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"

function formatPkr(value: number) {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function CrmLineItemsEditor({
  items,
  onUpdate,
  onRemove,
  size = "sm",
  removeIcon = "x",
  gstPercent,
  lockUnitPrice = false,
}: {
  items: CrmLineItem[]
  onUpdate: (id: string, key: CrmLineItemField, value: string | number) => void
  onRemove: (id: string) => void
  size?: "sm" | "md"
  removeIcon?: "x" | "trash"
  /** When set, unit prices are treated as GST-inclusive and breakdown is shown per line. */
  gstPercent?: number
  /** When true, unit price is read-only (set from CRM price list). */
  lockUnitPrice?: boolean
}) {
  const inputClass = size === "md" ? inputMd : inputSm
  const inputH = size === "md" ? "h-9" : "h-8"
  const thClass =
    size === "md"
      ? "px-4 py-3 text-left font-semibold text-[hsl(var(--muted-foreground))]"
      : "px-3 py-2 text-left text-xs font-semibold text-[hsl(var(--muted-foreground))]"
  const tdClass = size === "md" ? "px-3 py-2" : "px-2 py-1.5"

  const RemoveIcon = removeIcon === "trash" ? Trash2 : X
  const removeBtnClass =
    removeIcon === "trash"
      ? "p-1 text-[hsl(var(--muted-foreground))] hover:text-red-500 shrink-0"
      : "p-1 text-red-400 hover:text-red-600 shrink-0"

  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="sm:hidden divide-y divide-[hsl(var(--border))]">
        {items.map((item) => {
          const lineTotal = item.qty * item.unitPrice
          const gstBreakdown =
            gstPercent != null && gstPercent > 0 && lineTotal > 0
              ? splitGstInclusiveAmount(lineTotal, gstPercent)
              : null
          return (
            <div key={item.id} className="p-3 space-y-2.5 bg-[hsl(var(--background))]">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1 space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                    Description
                  </label>
                  <input
                    value={item.description}
                    onChange={(e) => onUpdate(item.id, "description", e.target.value)}
                    disabled={!item.isCustom}
                    placeholder="Product description"
                    className={`${inputClass} ${inputH} disabled:opacity-60`}
                  />
                  {item.availableQty !== undefined && (
                    <p className="text-[10px] text-green-600 font-medium">
                      Stock: {item.availableQty} {item.unit}
                    </p>
                  )}
                </div>
                <button type="button" onClick={() => onRemove(item.id)} className={removeBtnClass} aria-label="Remove item">
                  <RemoveIcon className={size === "md" ? "h-4 w-4" : "h-3.5 w-3.5"} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                    Qty
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={item.availableQty}
                    value={item.qty}
                    onChange={(e) => onUpdate(item.id, "qty", Number(e.target.value))}
                    className={`${inputClass} ${inputH} text-center`}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                    Unit
                  </label>
                  <input
                    value={item.unit}
                    onChange={(e) => onUpdate(item.id, "unit", e.target.value)}
                    disabled={!item.isCustom}
                    className={`${inputClass} ${inputH} text-center disabled:opacity-60`}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                  Unit price
                </label>
                <input
                  type="number"
                  min={0}
                  step={size === "md" ? "0.01" : undefined}
                  value={item.unitPrice}
                  readOnly={lockUnitPrice}
                  onChange={(e) => onUpdate(item.id, "unitPrice", Number(e.target.value))}
                  className={`${inputClass} ${inputH} ${lockUnitPrice ? "opacity-70 cursor-not-allowed bg-[hsl(var(--muted))]/20" : ""}`}
                />
                {gstPercent != null && gstPercent > 0 && (
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                    GST-inclusive price
                  </p>
                )}
                {item.costPrice !== undefined && (
                  <p className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                    Cost: PKR {item.costPrice.toLocaleString()}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-[hsl(var(--border))]/60">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                  Line total
                </span>
                <div className="text-right">
                  <span className={`font-medium text-[#1faca6] ${size === "md" ? "text-sm" : "text-xs"}`}>
                    PKR {lineTotal.toLocaleString()}
                  </span>
                  {gstBreakdown && (
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">
                      Base PKR {formatPkr(gstBreakdown.base)} · GST ({gstPercent}%) PKR {formatPkr(gstBreakdown.gst)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="hidden sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[hsl(var(--muted))]/40 border-b">
              <th className={thClass}>Description</th>
              <th className={`${thClass} text-center w-24`}>Qty</th>
              <th className={`${thClass} text-center w-20`}>Unit</th>
              <th className={`${thClass} text-right w-32`}>Unit Price</th>
              <th className={`${thClass} text-right w-28`}>Total</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((item) => {
              const lineTotal = item.qty * item.unitPrice
              const gstBreakdown =
                gstPercent != null && gstPercent > 0 && lineTotal > 0
                  ? splitGstInclusiveAmount(lineTotal, gstPercent)
                  : null
              return (
              <tr key={item.id}>
                <td className={tdClass}>
                  <input
                    value={item.description}
                    onChange={(e) => onUpdate(item.id, "description", e.target.value)}
                    disabled={!item.isCustom}
                    placeholder="Product description"
                    className={`${inputClass} ${inputH} disabled:opacity-60`}
                  />
                  {item.availableQty !== undefined && (
                    <p className={`text-green-600 mt-0.5 px-1 ${size === "md" ? "text-xs font-medium" : "text-[10px]"}`}>
                      Stock: {item.availableQty} {item.unit}
                    </p>
                  )}
                </td>
                <td className={tdClass}>
                  <input
                    type="number"
                    min={1}
                    max={item.availableQty}
                    value={item.qty}
                    onChange={(e) => onUpdate(item.id, "qty", Number(e.target.value))}
                    className={`${inputClass} ${inputH} text-center`}
                  />
                </td>
                <td className={tdClass}>
                  <input
                    value={item.unit}
                    onChange={(e) => onUpdate(item.id, "unit", e.target.value)}
                    disabled={!item.isCustom}
                    className={`${inputClass} ${inputH} text-center disabled:opacity-60`}
                  />
                </td>
                <td className={tdClass}>
                  <input
                    type="number"
                    min={0}
                    step={size === "md" ? "0.01" : undefined}
                    value={item.unitPrice}
                    readOnly={lockUnitPrice}
                    onChange={(e) => onUpdate(item.id, "unitPrice", Number(e.target.value))}
                    className={`${inputClass} ${inputH} text-right ${lockUnitPrice ? "opacity-70 cursor-not-allowed bg-[hsl(var(--muted))]/20" : ""}`}
                  />
                  {gstPercent != null && gstPercent > 0 && (
                    <p className={`text-[hsl(var(--muted-foreground))] mt-1 px-1 ${size === "md" ? "text-[10px]" : "text-[9px]"}`}>
                      GST-inclusive
                    </p>
                  )}
                  {item.costPrice !== undefined && (
                    <p className={`text-blue-600 dark:text-blue-400 font-medium mt-1 px-1 ${size === "md" ? "text-xs" : "text-[10px]"}`}>
                      Cost: PKR {item.costPrice.toLocaleString()}
                    </p>
                  )}
                </td>
                <td className={`${tdClass} text-right font-medium ${size === "md" ? "" : "text-xs"}`}>
                  <div>PKR {(item.qty * item.unitPrice).toLocaleString()}</div>
                  {gstBreakdown && (
                    <p className={`text-[hsl(var(--muted-foreground))] font-normal mt-1 ${size === "md" ? "text-[10px]" : "text-[9px]"}`}>
                      Base {formatPkr(gstBreakdown.base)}
                      <br />
                      GST ({gstPercent}%) {formatPkr(gstBreakdown.gst)}
                    </p>
                  )}
                </td>
                <td className={tdClass}>
                  <button type="button" onClick={() => onRemove(item.id)} className={removeBtnClass}>
                    <RemoveIcon className={size === "md" ? "h-4 w-4" : "h-3.5 w-3.5"} />
                  </button>
                </td>
              </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
