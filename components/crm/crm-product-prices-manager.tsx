"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2, Save, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { loadCrmWarehouseProducts } from "@/lib/warehouse-inventory-picker"
import {
  getCrmProductPrices,
  saveCrmProductPrice,
  type CrmProductPrice,
} from "@/lib/crm-product-prices"
import { useToast } from "@/components/ui/toast"

type PriceRow = {
  model: string
  displayName: string
  retailPrice: string
  wholesalePrice: string
  dealershipPrice: string
  dirty: boolean
  saving: boolean
}

function toRow(
  model: string,
  displayName: string,
  saved?: CrmProductPrice,
): PriceRow {
  return {
    model,
    displayName: saved?.displayName || displayName,
    retailPrice: saved ? String(saved.retailPrice || "") : "",
    wholesalePrice: saved ? String(saved.wholesalePrice || "") : "",
    dealershipPrice: saved ? String(saved.dealershipPrice || "") : "",
    dirty: false,
    saving: false,
  }
}

export function CrmProductPricesManager({
  currentUser,
  currentUserId,
  readOnly = false,
}: {
  currentUser: string
  currentUserId?: string
  readOnly?: boolean
}) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [rows, setRows] = useState<PriceRow[]>([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const [products, prices] = await Promise.all([
          loadCrmWarehouseProducts(),
          getCrmProductPrices().catch(() => []),
        ])
        if (cancelled) return

        const priceByModel = new Map(prices.map((p) => [p.model.trim().toLowerCase(), p]))
        const byModel = new Map<string, string>()

        for (const p of products) {
          const key = p.model.trim().toLowerCase()
          if (!key) continue
          if (!byModel.has(key)) {
            byModel.set(key, p.displayName || p.model)
          }
        }
        for (const p of prices) {
          const key = p.model.trim().toLowerCase()
          if (!key) continue
          if (!byModel.has(key)) {
            byModel.set(key, p.displayName || p.model)
          }
        }

        const merged = [...byModel.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, displayName]) => {
            const model = prices.find((p) => p.model.trim().toLowerCase() === key)?.model
              || products.find((p) => p.model.trim().toLowerCase() === key)?.model
              || displayName
            return toRow(model, displayName, priceByModel.get(key))
          })

        setRows(merged)
      } catch {
        if (!cancelled) toast({ title: "Error", message: "Failed to load product prices", type: "error" })
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [toast])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) =>
        r.model.toLowerCase().includes(q) ||
        r.displayName.toLowerCase().includes(q),
    )
  }, [rows, search])

  function updateRow(model: string, patch: Partial<PriceRow>) {
    setRows((prev) =>
      prev.map((r) =>
        r.model === model ? { ...r, ...patch, dirty: patch.dirty ?? true } : r,
      ),
    )
  }

  async function saveRow(row: PriceRow) {
    if (readOnly || !currentUserId) return
    updateRow(row.model, { saving: true })
    try {
      await saveCrmProductPrice({
        model: row.model,
        displayName: row.displayName,
        retailPrice: Number(row.retailPrice) || 0,
        wholesalePrice: Number(row.wholesalePrice) || 0,
        dealershipPrice: Number(row.dealershipPrice) || 0,
        updatedBy: currentUser,
        updatedById: currentUserId,
      })
      updateRow(row.model, { dirty: false, saving: false })
      toast({ title: "Saved", message: "Prices saved", type: "success" })
    } catch (err) {
      updateRow(row.model, { saving: false })
      toast({
        title: "Error",
        message: err instanceof Error ? err.message : "Save failed",
        type: "error",
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-[hsl(var(--muted-foreground))]">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading products…
      </div>
    )
  }

  return (
    <div className="space-y-4 rounded-[18px] bg-[#f5f5f7] dark:bg-transparent p-3 sm:p-4 -m-3 sm:-m-4">
      <div className="rounded-[16px] border border-black/[0.04] dark:border-[hsl(var(--border))] bg-white dark:bg-[hsl(var(--card))] p-4 space-y-1.5 shadow-sm">
        <h2 className="text-[15px] font-semibold tracking-tight text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">CRM product prices</h2>
        <p className="text-[12px] leading-relaxed text-[#86868b] dark:text-[hsl(var(--muted-foreground))] max-w-2xl">
          Set retail, wholesale, and dealership prices per product model. Only administrators can
          edit prices. Quotations and orders use the selected price list automatically — no manual
          unit price entry.
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#86868b]" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search model or name…"
          className="w-full h-9 pl-9 pr-3 rounded-[10px] border-0 bg-[#f2f2f7] dark:bg-[hsl(var(--background))] text-[13px] tracking-tight focus:outline-none focus:ring-2 focus:ring-[#0071e3]/25"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-[16px] border border-dashed border-black/[0.12] dark:border-[hsl(var(--border))] p-10 text-center text-[13px] text-[#86868b] dark:text-[hsl(var(--muted-foreground))] bg-white/60 dark:bg-[hsl(var(--card))]/40">
          No products found. Add inventory stock first, then set prices here.
        </div>
      ) : (
        <div className="rounded-[16px] border border-black/[0.04] dark:border-[hsl(var(--border))] bg-white dark:bg-[hsl(var(--card))] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] min-w-[720px]">
              <thead>
                <tr className="bg-[#fafafa] dark:bg-[hsl(var(--muted))]/30 border-b border-black/[0.04] dark:border-[hsl(var(--border))]">
                  <th className="px-3 py-2 text-left font-medium text-[11px] text-[#86868b]">Product</th>
                  <th className="px-3 py-2 text-right font-medium text-[11px] text-[#86868b] w-28">Retail</th>
                  <th className="px-3 py-2 text-right font-medium text-[11px] text-[#86868b] w-28">Wholesale</th>
                  <th className="px-3 py-2 text-right font-medium text-[11px] text-[#86868b] w-28">Dealership</th>
                  {!readOnly && <th className="px-3 py-2 w-20" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04] dark:divide-[hsl(var(--border))]">
                {filtered.map((row) => (
                  <tr key={row.model} className="bg-white dark:bg-[hsl(var(--card))]">
                    <td className="px-3 py-2">
                      <p className="font-medium text-[#1d1d1f] dark:text-[hsl(var(--foreground))]">{row.displayName}</p>
                      <p className="text-[11px] font-mono text-[#86868b]">
                        {row.model}
                      </p>
                    </td>
                    {(["retailPrice", "wholesalePrice", "dealershipPrice"] as const).map((field) => (
                      <td key={field} className="px-3 py-2">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          disabled={readOnly}
                          value={row[field]}
                          onChange={(e) =>
                            updateRow(row.model, { [field]: e.target.value, dirty: true })
                          }
                          className="w-full h-8 rounded-[10px] border-0 bg-[#f2f2f7] dark:bg-[hsl(var(--background))] px-2 text-right text-[13px] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/25 disabled:opacity-60"
                          placeholder="0"
                        />
                      </td>
                    ))}
                    {!readOnly && (
                      <td className="px-3 py-2 text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant={row.dirty ? "default" : "outline"}
                          className={`h-8 min-w-[4.25rem] px-3 justify-center text-[12px] font-semibold rounded-full ${row.dirty ? "bg-[#1d1d1f] hover:bg-black text-white dark:bg-white dark:text-[#1d1d1f]" : "border-black/[0.1]"}`}
                          disabled={row.saving}
                          onClick={() => saveRow(row)}
                        >
                          {row.saving ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <>
                              <Save className="h-3.5 w-3.5 mr-1" />
                              Save
                            </>
                          )}
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
