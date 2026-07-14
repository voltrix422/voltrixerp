"use client"

import { resolveOrderItemModel } from "@/lib/orders"

export type CrmLineItemDisplay = {
  id: string
  description: string
  qty: number
  unit: string
  unitPrice: number
  companyPrice?: number
  model?: string
  inventoryItemId?: string
}

function resolveCompanyPrice(item: CrmLineItemDisplay) {
  const c = Number(item.companyPrice)
  if (Number.isFinite(c) && c >= 0) return c
  return Number(item.unitPrice) || 0
}

export function CrmLineItemsDisplay({
  items,
  size = "sm",
  showCompanyPrice = false,
}: {
  items: CrmLineItemDisplay[]
  size?: "sm" | "md"
  /** Branch POS: show company vs customer unit prices */
  showCompanyPrice?: boolean
}) {
  const labelClass =
    "text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]"
  const cellClass = size === "md" ? "px-4 py-3 text-sm" : "px-3 py-2 text-xs"
  const headClass =
    size === "md"
      ? "px-4 py-3 text-xs font-semibold text-[hsl(var(--muted-foreground))]"
      : "h-8 px-3 text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]"

  const rows = items.map((item) => {
    const company = resolveCompanyPrice(item)
    return {
      item,
      model: resolveOrderItemModel(item),
      company,
      lineTotal: item.qty * item.unitPrice,
      lineProfit: (item.unitPrice - company) * item.qty,
    }
  })
  const showModel = rows.some((r) => r.model)

  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="sm:hidden divide-y divide-[hsl(var(--border))]">
        {rows.map(({ item, model, lineTotal, company, lineProfit }) => (
          <div key={item.id} className="p-3 space-y-2 bg-[hsl(var(--background))]">
            {showModel && (
              <div>
                <p className={labelClass}>Model</p>
                <p className={`${size === "md" ? "text-sm" : "text-xs"} font-medium tabular-nums`}>
                  {model || "—"}
                </p>
              </div>
            )}
            <div>
              <p className={labelClass}>Description</p>
              <p className={`${size === "md" ? "text-sm" : "text-xs"} font-medium break-words`}>
                {item.description}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className={labelClass}>Qty</p>
                <p className={size === "md" ? "text-sm" : "text-xs"}>{item.qty}</p>
              </div>
              <div>
                <p className={labelClass}>Unit</p>
                <p className={size === "md" ? "text-sm" : "text-xs"}>{item.unit}</p>
              </div>
            </div>
            {showCompanyPrice ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className={labelClass}>Company</p>
                  <p className={`${size === "md" ? "text-sm" : "text-xs"} tabular-nums`}>
                    PKR {company.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className={labelClass}>Customer</p>
                  <p className={`${size === "md" ? "text-sm" : "text-xs"} tabular-nums`}>
                    PKR {item.unitPrice.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className={labelClass}>Profit</p>
                  <p
                    className={`${size === "md" ? "text-sm" : "text-xs"} tabular-nums font-medium ${
                      lineProfit >= 0 ? "text-emerald-700" : "text-red-600"
                    }`}
                  >
                    PKR {lineProfit.toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className={labelClass}>Total</p>
                  <p className={`${size === "md" ? "text-sm" : "text-xs"} font-medium text-[#1faca6] tabular-nums`}>
                    PKR {lineTotal.toLocaleString()}
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className={labelClass}>Unit price</p>
                  <p className={`${size === "md" ? "text-sm" : "text-xs"} tabular-nums`}>
                    PKR {item.unitPrice.toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className={labelClass}>Total</p>
                  <p className={`${size === "md" ? "text-sm" : "text-xs"} font-medium text-[#1faca6] tabular-nums`}>
                    PKR {lineTotal.toLocaleString()}
                  </p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full min-w-[32rem]">
          <thead>
            <tr className="border-b bg-[hsl(var(--muted))]/40">
              {showModel && <th className={`${headClass} text-left w-36`}>Model</th>}
              <th className={`${headClass} text-left`}>Description</th>
              <th className={`${headClass} text-center w-20`}>Qty</th>
              <th className={`${headClass} text-center w-16`}>Unit</th>
              {showCompanyPrice ? (
                <>
                  <th className={`${headClass} text-right w-28`}>Company</th>
                  <th className={`${headClass} text-right w-28`}>Customer</th>
                  <th className={`${headClass} text-right w-24`}>Profit</th>
                </>
              ) : (
                <th className={`${headClass} text-right w-28`}>Unit Price</th>
              )}
              <th className={`${headClass} text-right w-28`}>Total</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map(({ item, model, lineTotal, company, lineProfit }) => (
              <tr key={item.id} className="hover:bg-[hsl(var(--muted))]/20">
                {showModel && (
                  <td className={`${cellClass} font-medium tabular-nums`}>{model || "—"}</td>
                )}
                <td className={cellClass}>{item.description}</td>
                <td className={`${cellClass} text-center`}>{item.qty}</td>
                <td className={`${cellClass} text-center`}>{item.unit}</td>
                {showCompanyPrice ? (
                  <>
                    <td className={`${cellClass} text-right tabular-nums`}>PKR {company.toLocaleString()}</td>
                    <td className={`${cellClass} text-right tabular-nums`}>
                      PKR {item.unitPrice.toLocaleString()}
                    </td>
                    <td
                      className={`${cellClass} text-right tabular-nums font-medium ${
                        lineProfit >= 0 ? "text-emerald-700" : "text-red-600"
                      }`}
                    >
                      PKR {lineProfit.toLocaleString()}
                    </td>
                  </>
                ) : (
                  <td className={`${cellClass} text-right tabular-nums`}>
                    PKR {item.unitPrice.toLocaleString()}
                  </td>
                )}
                <td className={`${cellClass} text-right font-medium tabular-nums`}>
                  PKR {lineTotal.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
