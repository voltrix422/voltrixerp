"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useAuth } from "@/components/auth-provider"
import {
  buildCrmPriceMap,
  CRM_PRICE_TIER_LABELS,
  getCrmProductPrices,
  lookupCrmUnitPrice,
  type CrmProductPrice,
} from "@/lib/crm-product-prices"
import { getOrders, type Order } from "@/lib/orders"
import { getQuotations, type Quotation } from "@/lib/quotations"
import { isBranchPosDoc } from "@/lib/branch-pos"
import { getPosSales, getPosStockProducts, type PosStockProduct } from "@/lib/pos"
import { BranchPosSaleForm } from "@/components/pos/branch-pos-sale-form"
import { BranchPosDocsList } from "@/components/pos/branch-pos-docs-list"
import { BranchPosStockHistory } from "@/components/pos/branch-pos-stock-history"
import { Loader2 } from "lucide-react"

type Tab = "order" | "orders" | "quotation" | "quotations" | "stock" | "history" | "sales"

export function BranchPosApp() {
  const { user } = useAuth()
  const branchId = user?.branchId!
  const branchName = user?.location || "Branch"
  const userName = user?.name || "POS"

  const [tab, setTab] = useState<Tab>("order")
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<PosStockProduct[]>([])
  const [sales, setSales] = useState<Awaited<ReturnType<typeof getPosSales>>>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [priceMap, setPriceMap] = useState<Map<string, CrmProductPrice>>(() => new Map())

  const branchOrders = useMemo(
    () => orders.filter((o) => isBranchPosDoc(o, branchName, userName, branchId)),
    [orders, branchName, userName, branchId],
  )
  const branchQuotations = useMemo(
    () => quotations.filter((q) => isBranchPosDoc(q, branchName, userName, branchId)),
    [quotations, branchName, userName, branchId],
  )

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [stock, saleRows, prices, orderRows, quotationRows] = await Promise.all([
        getPosStockProducts(false, branchId),
        getPosSales(undefined, branchId),
        getCrmProductPrices().catch(() => []),
        getOrders().catch(() => []),
        getQuotations().catch(() => []),
      ])
      setProducts(stock)
      setSales(saleRows)
      setPriceMap(buildCrmPriceMap(prices))
      setOrders(orderRows)
      setQuotations(quotationRows)
    } finally {
      setLoading(false)
    }
  }, [branchId])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-[#1a9f9a]" />
      </div>
    )
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "order", label: "Create order" },
    { id: "orders", label: "My orders" },
    { id: "quotation", label: "Create quotation" },
    { id: "quotations", label: "My quotations" },
    { id: "stock", label: "My stock" },
    { id: "history", label: "Stock history" },
    { id: "sales", label: "Sales" },
  ]

  function formatPkr(n: number) {
    return `PKR ${n.toLocaleString("en-PK", { maximumFractionDigits: 0 })}`
  }

  return (
    <div className="flex-1 overflow-auto bg-[hsl(var(--muted))]/5">
      <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
        <div className="rounded-lg border bg-[hsl(var(--card))] px-4 py-3">
          <p className="text-base font-bold">{branchName}</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Branch POS — orders use this branch&apos;s stock only (main warehouse is not reduced).
          </p>
        </div>

        <div className="flex flex-wrap gap-1 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] rounded-t-lg px-2 pt-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium relative cursor-pointer rounded-t-md ${
                tab === t.id
                  ? "text-[hsl(var(--foreground))] bg-[hsl(var(--background))] border border-b-0 border-[hsl(var(--border))]"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "order" && (
          <BranchPosSaleForm
            kind="order"
            products={products}
            branchName={branchName}
            branchId={branchId}
            userName={userName}
            onSaved={() => {
              void loadAll()
              setTab("orders")
            }}
          />
        )}

        {tab === "orders" && <BranchPosDocsList kind="order" orders={branchOrders} />}

        {tab === "quotation" && (
          <BranchPosSaleForm
            kind="quotation"
            products={products}
            branchName={branchName}
            branchId={branchId}
            userName={userName}
            onSaved={() => {
              void loadAll()
              setTab("quotations")
            }}
          />
        )}

        {tab === "quotations" && <BranchPosDocsList kind="quotation" quotations={branchQuotations} />}

        {tab === "stock" && (
          <div className="rounded-xl border bg-[hsl(var(--card))] overflow-hidden">
            <div className="px-4 py-3 border-b">
              <p className="text-sm font-semibold">Branch inventory</p>
              <p className="text-[11px] text-[hsl(var(--muted-foreground))]">Stock and price lists at this location</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[hsl(var(--muted))]/30 text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                  <tr>
                    <th className="text-left px-3 py-2.5">Product</th>
                    <th className="text-left px-3 py-2.5">Model</th>
                    <th className="text-right px-3 py-2.5">Qty</th>
                    <th className="text-right px-3 py-2.5">{CRM_PRICE_TIER_LABELS.retail}</th>
                    <th className="text-right px-3 py-2.5">{CRM_PRICE_TIER_LABELS.wholesale}</th>
                    <th className="text-right px-3 py-2.5">{CRM_PRICE_TIER_LABELS.dealership}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {products.map((p) => (
                      <tr key={p.id} className="hover:bg-[hsl(var(--muted))]/10">
                        <td className="px-3 py-2.5 font-medium">{p.description}</td>
                        <td className="px-3 py-2.5 font-mono text-xs text-[hsl(var(--muted-foreground))]">{p.model}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-[#1faca6]">
                          {p.availableQty} {p.unit}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{formatPkr(lookupCrmUnitPrice(priceMap, p.model, "retail"))}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{formatPkr(lookupCrmUnitPrice(priceMap, p.model, "wholesale"))}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{formatPkr(lookupCrmUnitPrice(priceMap, p.model, "dealership"))}</td>
                      </tr>
                    ))}
                  {products.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-10 text-center text-[hsl(var(--muted-foreground))]">
                        No stock at this branch
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "history" && (
          <BranchPosStockHistory
            branchId={branchId}
            branchName={branchName}
            userName={userName}
          />
        )}

        {tab === "sales" && (
          <div className="rounded-xl border bg-[hsl(var(--card))] overflow-hidden">
            <div className="px-4 py-3 border-b">
              <p className="text-sm font-semibold">Branch sales receipts</p>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-[hsl(var(--muted))]/30 text-xs">
                <tr>
                  <th className="text-left px-3 py-2">Receipt</th>
                  <th className="text-left px-3 py-2">Customer</th>
                  <th className="text-right px-3 py-2">Total</th>
                  <th className="text-left px-3 py-2">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sales.map((s) => (
                  <tr key={s.id}>
                    <td className="px-3 py-2 font-mono text-xs">{s.receiptNumber}</td>
                    <td className="px-3 py-2">{s.customerName || "—"}</td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">
                      PKR {s.total.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">
                      {new Date(s.createdAt).toLocaleString("en-PK")}
                    </td>
                  </tr>
                ))}
                {sales.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-10 text-center text-[hsl(var(--muted-foreground))]">
                      No sales yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
