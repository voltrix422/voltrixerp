"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useAuth } from "@/components/auth-provider"
import { isErpAdmin, roleHasAllModules } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/toast"
import {
  completePosSale,
  deletePosStockProduct,
  deletePosTerminal,
  formatCurrency,
  getPosSales,
  getPosStockProducts,
  getPosTerminals,
  savePosTerminal,
  type PosCartItem,
  type PosSale,
  type PosStockProduct,
  type PosTerminal,
} from "@/lib/pos"
import { PosInventoryPanel } from "@/components/pos/pos-inventory-panel"
import { BranchPosDocsPanel } from "@/components/pos/branch-pos-docs"
import {
  CreditCard,
  Loader2,
  Minus,
  Plus,
  Search,
  ShoppingCart,
  Store,
  Trash2,
} from "lucide-react"

type Tab = "register" | "inventory" | "terminals" | "sales" | "stock" | "quotation" | "order"

export function PosManager() {
  const { user } = useAuth()
  const { toast } = useToast()
  const branchId = user?.branchId ?? undefined
  const isBranchPos = !!branchId
  const branchName = user?.location || "Branch"
  const [tab, setTab] = useState<Tab>("register")
  const [loading, setLoading] = useState(true)
  const [terminals, setTerminals] = useState<PosTerminal[]>([])
  const [allTerminals, setAllTerminals] = useState<PosTerminal[]>([])
  const [products, setProducts] = useState<PosStockProduct[]>([])
  const [sales, setSales] = useState<PosSale[]>([])
  const [selectedTerminalId, setSelectedTerminalId] = useState("")
  const [productSearch, setProductSearch] = useState("")
  const [cart, setCart] = useState<PosCartItem[]>([])
  const [discount, setDiscount] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState("cash")
  const [customerName, setCustomerName] = useState("")
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [terminalForm, setTerminalForm] = useState({ name: "", code: "", location: "" })
  const [savingTerminal, setSavingTerminal] = useState(false)
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null)

  const selectedTerminal = terminals.find((t) => t.id === selectedTerminalId) ?? null
  const canManageTerminals = roleHasAllModules(user?.role) || user?.modules.includes("pos")

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [t, p, s] = await Promise.all([
        getPosTerminals(branchId),
        getPosStockProducts(false, branchId),
        getPosSales(undefined, branchId),
      ])
      setAllTerminals(t)
      setTerminals(t.filter((x) => x.isActive))
      setProducts(p)
      setSales(s)
      if (!selectedTerminalId && t.length > 0) {
        setSelectedTerminalId(t.find((x) => x.isActive)?.id ?? t[0].id)
      }
    } finally {
      setLoading(false)
    }
  }, [selectedTerminalId, branchId])

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
          toast({ type: "error", title: "Not enough stock" })
          return prev
        }
        return prev.map((l) =>
          l.stockId === product.id
            ? { ...l, qty, lineTotal: qty * l.unitPrice }
            : l,
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
    if (!selectedTerminal) {
      toast({ type: "error", title: "Select a POS terminal first" })
      return
    }
    if (cart.length === 0) {
      toast({ type: "error", title: "Cart is empty" })
      return
    }
    setCheckoutLoading(true)
    try {
      const sale = await completePosSale({
        terminalId: selectedTerminal.id,
        terminalName: selectedTerminal.name,
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
        toast({ type: "error", title: "Checkout failed — check stock" })
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

  async function handleCreateTerminal(e: React.FormEvent) {
    e.preventDefault()
    if (!terminalForm.name.trim() || !terminalForm.code.trim()) return
    setSavingTerminal(true)
    try {
      const saved = await savePosTerminal({
        name: terminalForm.name.trim(),
        code: terminalForm.code.trim(),
        location: terminalForm.location.trim(),
      })
      if (!saved) {
        toast({ type: "error", title: "Could not save terminal (code may already exist)" })
        return
      }
      toast({ type: "success", title: "POS created" })
      setTerminalForm({ name: "", code: "", location: "" })
      await loadAll()
      setSelectedTerminalId(saved.id)
    } finally {
      setSavingTerminal(false)
    }
  }

  async function handleDeleteProduct(product: PosStockProduct) {
    if (
      !confirm(
        `Remove "${product.description}" from POS?\n\n${product.availableQty} unit(s) will be removed from the register.`,
      )
    ) {
      return
    }
    setDeletingProductId(product.id)
    try {
      const result = await deletePosStockProduct(product.id)
      if (!result.ok) {
        toast({ type: "error", title: result.error || "Could not delete" })
        return
      }
      setCart((prev) => prev.filter((l) => l.stockId !== product.id))
      toast({ type: "success", title: `Removed ${product.description}` })
      await loadAll()
    } finally {
      setDeletingProductId(null)
    }
  }

  async function handleDeleteTerminal(id: string) {
    if (!confirm("Delete this POS terminal?")) return
    await deletePosTerminal(id)
    toast({ type: "success", title: "Terminal removed" })
    await loadAll()
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-[#1a9f9a]" />
      </div>
    )
  }

  const tabItems = isBranchPos
    ? ([
        { id: "register" as Tab, label: "Sell" },
        { id: "stock" as Tab, label: "My stock" },
        { id: "sales" as Tab, label: "Sales" },
        { id: "quotation" as Tab, label: "Quotation" },
        { id: "order" as Tab, label: "Order" },
      ] as const)
    : ([
        { id: "register" as Tab, label: "Register" },
        { id: "inventory" as Tab, label: "Inventory" },
        { id: "terminals" as Tab, label: "POS terminals" },
        { id: "sales" as Tab, label: "Sales" },
      ] as const)

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
        {isBranchPos && (
          <div className="rounded-lg border bg-[#1faca6]/5 px-4 py-3">
            <p className="text-sm font-semibold">{branchName}</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Branch POS — sell, quote, and order from this location&apos;s stock only.
            </p>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1 border-b border-[hsl(var(--border))]">
            {tabItems.map((t) => (
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

          {tab === "register" && terminals.length > 0 && (
            <select
              value={selectedTerminalId}
              onChange={(e) => setSelectedTerminalId(e.target.value)}
              className="h-9 rounded-lg border px-3 text-sm bg-[hsl(var(--background))]"
            >
              {terminals.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.code})
                </option>
              ))}
            </select>
          )}
        </div>

        {tab === "register" && (
          <>
            {terminals.length === 0 ? (
              <div className="rounded-lg border p-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
                <Store className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>No POS terminal yet. Create one under <strong>POS terminals</strong>.</p>
                <Button size="sm" className="mt-4" onClick={() => setTab("terminals")}>
                  Create POS
                </Button>
              </div>
            ) : (
              <div className="grid lg:grid-cols-5 gap-4">
                <div className="lg:col-span-3 space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                    <input
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      placeholder="Search products..."
                      className="w-full h-10 pl-9 pr-3 rounded-lg border text-sm"
                    />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-2 max-h-[calc(100vh-280px)] overflow-y-auto">
                    {filteredProducts.map((p) => (
                      <div
                        key={p.id}
                        className="relative rounded-lg border p-3 hover:border-[#1a9f9a] hover:bg-[#1a9f9a]/5 transition-colors"
                      >
                        <button
                          type="button"
                          title="Remove product"
                          disabled={deletingProductId === p.id || isBranchPos}
                          onClick={(e) => {
                            e.stopPropagation()
                            void handleDeleteProduct(p)
                          }}
                          className={`absolute top-2 right-2 p-1 rounded-md text-[hsl(var(--muted-foreground))] hover:text-red-600 hover:bg-red-50 cursor-pointer disabled:opacity-50 ${isBranchPos ? "hidden" : ""}`}
                        >
                          {deletingProductId === p.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => addToCart(p)}
                          className="w-full text-left pr-8 cursor-pointer"
                        >
                          <p className="text-sm font-medium line-clamp-2">{p.description}</p>
                          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                            Stock: {p.availableQty} {p.unit}
                          </p>
                          <p className="text-sm font-semibold text-[#17857f] mt-1">
                            {formatCurrency(p.costPrice)}
                          </p>
                        </button>
                      </div>
                    ))}
                    {filteredProducts.length === 0 && (
                      <div className="col-span-2 text-sm text-[hsl(var(--muted-foreground))] py-8 text-center space-y-2">
                        <p>{isBranchPos ? "No stock at this branch." : "No products in stock."}</p>
                        {!isBranchPos && (
                          <Button size="sm" variant="outline" onClick={() => setTab("inventory")}>
                            Add products with QR
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="lg:col-span-2 rounded-lg border bg-[hsl(var(--card))] flex flex-col min-h-[400px]">
                  <div className="px-4 py-3 border-b flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4" />
                    <span className="font-medium text-sm">Cart</span>
                    <Badge variant="secondary" className="ml-auto text-xs">
                      {cart.length}
                    </Badge>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {cart.map((line) => (
                      <div key={line.stockId} className="rounded-md border p-2 text-xs space-y-1">
                        <p className="font-medium line-clamp-2">{line.description}</p>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              className="h-7 w-7 rounded border flex items-center justify-center cursor-pointer"
                              onClick={() => updateQty(line.stockId, -1)}
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="w-6 text-center">{line.qty}</span>
                            <button
                              type="button"
                              className="h-7 w-7 rounded border flex items-center justify-center cursor-pointer"
                              onClick={() => updateQty(line.stockId, 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                          <span className="font-semibold">{formatCurrency(line.lineTotal)}</span>
                        </div>
                      </div>
                    ))}
                    {cart.length === 0 && (
                      <p className="text-center text-[hsl(var(--muted-foreground))] py-12 text-sm">
                        Tap products to add
                      </p>
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
                            paymentMethod === m
                              ? "bg-[#1a9f9a] text-white border-[#1a9f9a]"
                              : ""
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
                    <Button
                      className="w-full h-10"
                      disabled={checkoutLoading || cart.length === 0}
                      onClick={() => void handleCheckout()}
                    >
                      {checkoutLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <CreditCard className="h-4 w-4 mr-2" />
                          Complete sale
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {tab === "inventory" && !isBranchPos && <PosInventoryPanel onStockUpdated={() => void loadAll()} />}

        {tab === "stock" && isBranchPos && (
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
                    <td className="px-3 py-2 text-right tabular-nums">
                      {p.availableQty} {p.unit}
                    </td>
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

        {tab === "quotation" && isBranchPos && (
          <BranchPosDocsPanel
            kind="quotation"
            products={products}
            branchName={branchName}
            userName={user?.name || "POS"}
          />
        )}

        {tab === "order" && isBranchPos && (
          <BranchPosDocsPanel
            kind="order"
            products={products}
            branchName={branchName}
            userName={user?.name || "POS"}
          />
        )}

        {tab === "terminals" && canManageTerminals && !isBranchPos && (
          <div className="grid md:grid-cols-2 gap-6">
            <form onSubmit={handleCreateTerminal} className="rounded-lg border p-4 space-y-3">
              <h3 className="font-medium text-sm">Create new POS</h3>
              <input
                required
                value={terminalForm.name}
                onChange={(e) => setTerminalForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Name e.g. Branch Counter"
                className="w-full h-10 rounded-lg border px-3 text-sm"
              />
              <input
                required
                value={terminalForm.code}
                onChange={(e) => setTerminalForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="Code e.g. BR01"
                className="w-full h-10 rounded-lg border px-3 text-sm font-mono"
              />
              <input
                value={terminalForm.location}
                onChange={(e) => setTerminalForm((f) => ({ ...f, location: e.target.value }))}
                placeholder="Location"
                className="w-full h-10 rounded-lg border px-3 text-sm"
              />
              <Button type="submit" disabled={savingTerminal} className="w-full">
                {savingTerminal ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create POS"}
              </Button>
            </form>
            <div className="space-y-2">
              <h3 className="font-medium text-sm mb-2">Active terminals</h3>
              {allTerminals.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium">{t.name}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      {t.code} · {t.location || "—"}
                    </p>
                  </div>
                  {isErpAdmin(user?.role) && (
                    <button
                      type="button"
                      onClick={() => void handleDeleteTerminal(t.id)}
                      className="text-red-500 p-1 cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "sales" && (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[hsl(var(--muted))]/30 text-xs">
                <tr>
                  <th className="text-left px-3 py-2">Receipt</th>
                  <th className="text-left px-3 py-2">Terminal</th>
                  <th className="text-left px-3 py-2">Cashier</th>
                  <th className="text-right px-3 py-2">Total</th>
                  <th className="text-left px-3 py-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => (
                  <tr key={s.id} className="border-t">
                    <td className="px-3 py-2 font-mono text-xs">{s.receiptNumber}</td>
                    <td className="px-3 py-2">{s.terminalName}</td>
                    <td className="px-3 py-2">{s.cashierName}</td>
                    <td className="px-3 py-2 text-right font-medium">{formatCurrency(s.total)}</td>
                    <td className="px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">
                      {new Date(s.createdAt).toLocaleString("en-PK")}
                    </td>
                  </tr>
                ))}
                {sales.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-[hsl(var(--muted-foreground))]">
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
