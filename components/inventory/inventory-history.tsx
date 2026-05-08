"use client"
import { useState, useEffect } from "react"
import { getInventoryHistory, type InventoryTransaction } from "@/lib/inventory-history"
import { getOrderFulfillmentHistory, type OrderFulfillmentHistoryEntry } from "@/lib/order-fulfillment-history"
// DB access via /api/db routes (Prisma)
import { Badge } from "@/components/ui/badge"
import { Search, TrendingUp, TrendingDown, Package, ShoppingCart, X } from "lucide-react"

export function InventoryHistory() {
  const [history, setHistory] = useState<InventoryTransaction[]>([])
  const [fulfillmentHistory, setFulfillmentHistory] = useState<OrderFulfillmentHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filterType, setFilterType] = useState<"all" | "in" | "out">("all")

  useEffect(() => {
    loadHistory()
    const interval = setInterval(loadHistory, 30000)
    return () => clearInterval(interval)
  }, [])

  async function loadHistory() {
    const [inventoryData, fulfillmentData] = await Promise.all([
      getInventoryHistory(),
      getOrderFulfillmentHistory(),
    ])
    setHistory(inventoryData)
    setFulfillmentHistory(fulfillmentData)
    setLoading(false)
  }

  const filtered = history.filter(t => {
    const matchesSearch = t.item_description.toLowerCase().includes(search.toLowerCase()) ||
                         t.reference_number.toLowerCase().includes(search.toLowerCase())
    const matchesType = filterType === "all" || t.transaction_type === filterType
    return matchesSearch && matchesType
  })

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold">Inventory History</h3>
        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
          Track all inventory movements and transactions
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by item or reference..."
            className="w-full h-9 pl-9 pr-3 rounded-lg border bg-[hsl(var(--background))] text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
          />
        </div>
        <div className="flex items-center gap-2 rounded-lg border bg-[hsl(var(--muted))]/20 p-1">
          <button
            onClick={() => setFilterType("all")}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer ${
              filterType === "all" 
                ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]" 
                : "hover:bg-[hsl(var(--muted))]/50"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterType("in")}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer ${
              filterType === "in" 
                ? "bg-green-600 text-white" 
                : "hover:bg-[hsl(var(--muted))]/50"
            }`}
          >
            In
          </button>
          <button
            onClick={() => setFilterType("out")}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer ${
              filterType === "out" 
                ? "bg-red-600 text-white" 
                : "hover:bg-[hsl(var(--muted))]/50"
            }`}
          >
            Out
          </button>
        </div>
      </div>

      <p className="text-xs text-[hsl(var(--muted-foreground))]">
        {filtered.length} transaction{filtered.length !== 1 ? "s" : ""}
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading history...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Package className="h-12 w-12 text-[hsl(var(--muted-foreground))] opacity-30 mb-3" />
          <p className="text-sm font-medium">No transactions found</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
            {history.length === 0 ? "Inventory movements will appear here" : "Try a different search or filter"}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-[hsl(var(--muted))]/40">
                <th className="h-9 px-4 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Date</th>
                <th className="h-9 px-4 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Type</th>
                <th className="h-9 px-4 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Item</th>
                <th className="h-9 px-4 text-center text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Quantity</th>
                <th className="h-9 px-4 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Reference</th>
                <th className="h-9 px-4 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Notes</th>
                <th className="h-9 px-4 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">By</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(transaction => (
                <tr key={transaction.id} className="hover:bg-[hsl(var(--muted))]/30 transition-colors">
                  <td className="px-4 py-2.5 text-xs">
                    {new Date(transaction.created_at).toLocaleDateString()}
                    <br />
                    <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                      {new Date(transaction.created_at).toLocaleTimeString()}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    {transaction.transaction_type === "in" ? (
                      <Badge variant="success" className="text-[10px] px-1.5 py-0">
                        <TrendingUp className="h-3 w-3 mr-1" /> IN
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                        <TrendingDown className="h-3 w-3 mr-1" /> OUT
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs font-medium">{transaction.item_description}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`text-xs font-bold ${
                      transaction.transaction_type === "in" 
                        ? "text-green-600 dark:text-green-400" 
                        : "text-red-600 dark:text-red-400"
                    }`}>
                      {transaction.transaction_type === "in" ? "+" : "-"}{transaction.quantity} {transaction.unit}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      {transaction.reference_type === "po" ? (
                        <Package className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                      ) : (
                        <ShoppingCart className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                      )}
                      <span className="text-xs font-semibold text-[hsl(var(--primary))]">
                        {transaction.reference_number}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-[hsl(var(--muted-foreground))]">
                    {transaction.notes || "—"}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-[hsl(var(--muted-foreground))]">
                    {transaction.created_by}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="pt-4">
        <h4 className="text-sm font-semibold">Fulfillment History</h4>
        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
          Dispatcher/receiver details and proof images for fulfilled orders
        </p>
      </div>

      {loading ? null : fulfillmentHistory.length === 0 ? (
        <div className="rounded-lg border p-6 text-center">
          <p className="text-xs text-[hsl(var(--muted-foreground))]">No fulfillment records found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {fulfillmentHistory
            .filter((entry) => {
              const q = search.toLowerCase()
              if (!q) return true
              return (
                entry.orderNumber.toLowerCase().includes(q) ||
                entry.clientName.toLowerCase().includes(q) ||
                entry.dispatcherName.toLowerCase().includes(q) ||
                entry.receiverName.toLowerCase().includes(q) ||
                entry.vehicleNumber.toLowerCase().includes(q)
              )
            })
            .map((entry) => {
              const imageUrls = [
                entry.receiverImageUrl,
                entry.receiverCnicImageUrl,
                entry.vehicleImageUrl,
                ...(entry.productImageUrls || []),
              ].filter(Boolean) as string[]

              return (
                <div key={entry.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-[hsl(var(--primary))]">{entry.orderNumber}</p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">{entry.clientName}</p>
                    </div>
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                      {new Date(entry.fulfilledAt).toLocaleString()}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mt-2 text-xs">
                    <div><span className="text-[hsl(var(--muted-foreground))]">Dispatcher:</span> {entry.dispatcherName}</div>
                    <div><span className="text-[hsl(var(--muted-foreground))]">Receiver:</span> {entry.receiverName}</div>
                    <div><span className="text-[hsl(var(--muted-foreground))]">CNIC:</span> {entry.receiverCnic}</div>
                    <div><span className="text-[hsl(var(--muted-foreground))]">Vehicle:</span> {entry.vehicleNumber}</div>
                  </div>

                  {imageUrls.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-3">
                      {imageUrls.map((url, i) => (
                        <a key={`${entry.id}-${i}`} href={url} target="_blank" rel="noreferrer">
                          <img
                            src={url}
                            alt={`Fulfillment ${i + 1}`}
                            className="w-full h-20 rounded-md object-cover border hover:opacity-90 transition-opacity"
                          />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}
