"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/toast"
import {
  completePosSale,
  formatCurrency,
  getPosSales,
  getPosStockProducts,
  getPosTerminals,
  type PosCartItem,
  type PosStockProduct,
} from "@/lib/pos"
import { BranchPosClientDocForm } from "@/components/pos/branch-pos-client-doc-form"
import {
  CreditCard,
  Loader2,
  Minus,
  Plus,
  Search,
  ShoppingCart,
} from "lucide-react"

type Tab = "sell" | "stock" | "order" | "quotation" | "sales"

export function BranchPosApp() {
  const { user } = useAuth()
  const { toast } = useToast()
  const branchId = user?.branchId!
  const branchName = user?.location || "Branch"

  const [tab, setTab] = useState<Tab>("sell")
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<PosStockProduct[]>([])
  const [sales, setSales] = useState<Awaited<ReturnType<typeof getPosSales>>>([])
  const [terminalId, setTerminalId] = useState("")
  const [terminalName, setTerminalName] = useState("")
  const [productSearch, setProductSearch] = useState("")
  const [cart, setCart] = useState<PosCartItem[]>([])
  const [discount, setDiscount] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState("cash")
  const [customerName, setCustomerName] = useState("")
  const [checkoutLoading, setCheckoutLoading] = useState(false)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [terminals, stock, saleRows] = await Promise.all([
        getPosTerminals(branchId),
        getPosStockProducts(false, branchId),
        getPosSales(undefined, branchId),
      ])
      const active = terminals.find((t) => t.isActive) || terminals[0]
      if (active) {
        setTerminalId(active.id)
        setTerminalName(active.name)
      }
      setProducts(stock)
      setSales(saleRows)
    } finally {
      setLoading(false)
    }
  }, [branchId])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase()
    if (!q) return products
    return products.filter(
      (p) =>
        p.description.toLowerCase().includes(q) ||
        (p.name || "").toLowerCase().includes(q),
    )
  }, [products, productSearch])

  const subtotal = cart.reduce((sum, line) => sum + line.lineTotal, 0)
  const total = Math.max(0, subtotal - discount)

  function addToCart(product: PosStockProduct) {
    const price = product.costPrice > 0 ? product.costPrice : 0
    setCart((prev) => {
      const existing = prev.find((l) => l.stockId === product.id)
      if (existing) {
        const qty = existing.qty + 1
        if (qty > product.availableQty) {
          toast({ type: "error", title: "Not enough stock at this branch" })
          return prev
        }
        return prev.map((l) =>
          l.stockId === product.id ? { ...l, qty, lineTotal: qty * l.unitPrice } : l,
        )
      }
      return [
        ...prev,
        {
          stockId: product.id,
          description: product.description,
          unit: product.unit,
          unitPrice: price,
          qty: 1,
          lineTotal: price,
        },
      ]
    })
  }

  function updateQty(stockId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) => {
          if (l.stockId !== stockId) return l
          const product = products.find((p) => p.id === stockId)
          const max = product?.availableQty ?? l.qty
          const qty = Math.max(0, Math.min(max, l.qty + delta))
          return { ...l, qty, lineTotal: qty * l.unitPrice }
        })
        .filter((l) => l.qty > 0),
    )
  }

  async function handleCheckout() {
    if (!terminalId) {
      toast({ type: "error", title: "POS terminal not set up for this branch" })
      return
    }
    if (cart.length === 0) {
      toast({ type: "error", title: "Cart is empty" })
      return
    }
    setCheckoutLoading(true)
    try {
      const sale = await completePosSale({
        terminalId,
        terminalName,
        items: cart,
        subtotal,
        discount,
        tax: 0,
        total,
        paymentMethod,
        cashierId: user?.id ?? "",
        cashierName: user?.name ?? "POS",
        customerName: customerName.trim(),
        notes: "",
        branchId,
      })
      if (!sale) {
        toast({ type: "error", title: "Sale failed — check branch stock" })
        return
      }
      toast({ type: "success", title: `Sale complete · ${sale.receiptNumber}` })
      setCart([])
      setDiscount(0)
      setCustomerName("")
      await loadAll()
    } catch (e) {
      toast({ type: "error", title: e instanceof Error ? e.message : "Checkout failed" })
    } finally {
      setCheckoutLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-[#1a9f9a]" />
      </div>
    )
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "sell", label: "Sell" },
    { id: "stock", label: "My stock" },
    { id: "order", label: "Create order" },
    { id: "quotation", label: "Create quotation" },
    { id: "sales", label: "Sales" },
  ]

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
        <div className="rounded-lg border bg-[#1faca6]/5 px-4 py-3">
          <p className="text-sm font-semibold">{branchName}</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Branch POS — only stock assigned to this location is shown below.
          </p>
        </div>

        <div className="flex flex-wrap gap-1 border-b border-[hsl(var(--border))]">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-3 py-2 text-xs font-medium relative cursor-pointer ${
                tab === t.id
                  ? "text-[hsl(var(--foreground))]"
                  : "text-[hsl(var(--muted-foreground))]"
              }`}
            >
              {t.label}
              {tab === t.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1faca6]" />
              )}
            </button>
          ))}
        </div>

        {tab === "sell" && (
          <div className="grid lg:grid-cols-5 gap-4">
            <div className="lg:col-span-3 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                <input
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Search branch stock…"
                  className="w-full h-10 pl-9 pr-3 rounded-lg border text-sm"
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-2 max-h-[calc(100vh-280px)] overflow-y-auto">
                {filteredProducts.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addToCart(p)}
                    className="rounded-lg border p-3 text-left hover:border-[#1a9f9a] hover:bg-[#1a9f9a]/5 transition-colors cursor-pointer"
                  >
                    <p className="text-sm font-medium line-clamp-2">{p.description}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                      Stock: {p.availableQty} {p.unit}
                    </p>
                    <p className="text-sm font-semibold text-[#17857f] mt-1">
                      {formatCurrency(p.costPrice)}
                    </p>
                  </button>
                ))}
                {filteredProducts.length === 0 && (
                  <div className="col-span-2 text-sm text-[hsl(var(--muted-foreground))] py-8 text-center">
                    No stock at this branch. Ask admin to transfer inventory here.
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-2 rounded-lg border bg-[hsl(var(--card))] flex flex-col min-h-[400px]">
              <div className="px-4 py-3 border-b flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                <span className="font-medium text-sm">Cart</span>
                <Badge variant="secondary" className="ml-auto text-xs">{cart.length}</Badge>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {cart.map((line) => (
                  <div key={line.stockId} className="rounded-md border p-2 text-xs space-y-1">
                    <p className="font-medium line-clamp-2">{line.description}</p>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        <button type="button" className="h-7 w-7 rounded border flex items-center justify-center cursor-pointer" onClick={() => updateQty(line.stockId, -1)}>
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-6 text-center">{line.qty}</span>
                        <button type="button" className="h-7 w-7 rounded border flex items-center justify-center cursor-pointer" onClick={() => updateQty(line.stockId, 1)}>
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <span className="font-semibold">{formatCurrency(line.lineTotal)}</span>
                    </div>
                  </div>
                ))}
                {cart.length === 0 && (
                  <p className="text-center text-[hsl(var(--muted-foreground))] py-12 text-sm">Tap products to add</p>
                )}
              </div>
              <div className="p-4 border-t space-y-3">
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Customer name (optional)"
                  className="w-full h-9 rounded-lg border px-3 text-xs"
                />
                <div className="flex gap-2">
                  {(["cash", "card", "bank"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPaymentMethod(m)}
                      className={`flex-1 h-8 rounded-md text-xs font-medium border cursor-pointer capitalize ${
                        paymentMethod === m ? "bg-[#1a9f9a] text-white border-[#1a9f9a]" : ""
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-[hsl(var(--muted-foreground))]">Discount</span>
                  <input
                    type="number"
                    min={0}
                    value={discount || ""}
                    onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                    className="flex-1 h-8 rounded border px-2"
                  />
                </div>
                <div className="flex justify-between text-sm font-semibold">
                  <span>Total</span>
                  <span>{formatCurrency(total)}</span>
                </div>
                <Button className="w-full h-10" disabled={checkoutLoading || cart.length === 0} onClick={() => void handleCheckout()}>
                  {checkoutLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CreditCard className="h-4 w-4 mr-2" />Complete sale</>}
                </Button>
              </div>
            </div>
          </div>
        )}

        {tab === "stock" && (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[hsl(var(--muted))]/30 text-xs">
                <tr>
                  <th className="text-left px-3 py-2">Item</th>
                  <th className="text-right px-3 py-2">Qty</th>
                  <th className="text-right px-3 py-2">Price</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="px-3 py-2">{p.description}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{p.availableQty} {p.unit}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(p.costPrice)}</td>
                  </tr>
                ))}
                {products.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-8 text-center text-[hsl(var(--muted-foreground))]">
                      No stock at this branch
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {tab === "order" && (
          <BranchPosClientDocForm
            kind="order"
            products={products}
            branchName={branchName}
            userName={user?.name || "POS"}
          />
        )}

        {tab === "quotation" && (
          <BranchPosClientDocForm
            kind="quotation"
            products={products}
            branchName={branchName}
            userName={user?.name || "POS"}
          />
        )}

        {tab === "sales" && (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[hsl(var(--muted))]/30 text-xs">
                <tr>
                  <th className="text-left px-3 py-2">Receipt</th>
                  <th className="text-left px-3 py-2">Customer</th>
                  <th className="text-right px-3 py-2">Total</th>
                  <th className="text-left px-3 py-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => (
                  <tr key={s.id} className="border-t">
                    <td className="px-3 py-2 font-mono text-xs">{s.receiptNumber}</td>
                    <td className="px-3 py-2">{s.customerName || "—"}</td>
                    <td className="px-3 py-2 text-right font-medium">{formatCurrency(s.total)}</td>
                    <td className="px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">
                      {new Date(s.createdAt).toLocaleString("en-PK")}
                    </td>
                  </tr>
                ))}
                {sales.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-[hsl(var(--muted-foreground))]">
                      No sales yet at this branch
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
