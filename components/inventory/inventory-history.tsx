"use client"
import { useState, useEffect } from "react"
import { getInventoryHistory, type InventoryTransaction } from "@/lib/inventory-history"
import { supabase } from "@/lib/supabase"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Search, TrendingUp, TrendingDown, Package, ShoppingCart, X } from "lucide-react"

export function InventoryHistory() {
  const [history, setHistory] = useState<InventoryTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filterType, setFilterType] = useState<"all" | "in" | "out">("all")

  useEffect(() => {
    loadHistory()
    const channel = supabase
      .channel("inventory_history")
      .on("postgres_changes", { event: "*", schema: "public", table: "erp_inventory_history" }, () => {
        loadHistory()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function loadHistory() {
    const data = await getInventoryHistory()
    setHistory(data)
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
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              filterType === "all" 
                ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]" 
                : "hover:bg-[hsl(var(--muted))]/50"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterType("in")}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              filterType === "in" 
                ? "bg-green-600 text-white" 
                : "hover:bg-[hsl(var(--muted))]/50"
            }`}
          >
            In
          </button>
          <button
            onClick={() => setFilterType("out")}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
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
    </div>
  )
}
