"use client"
import { useEffect, useState } from "react"
import { Package, Loader2 } from "lucide-react"

interface StockItem {
  itemId: string
  description: string
  availableQty: number
  unit: string
}

export function InventoryStockTab() {
  const [items, setItems] = useState<StockItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/db/inventory-stock")
        if (res.ok) {
          const data = await res.json()
          setItems(data.map((r: Record<string, unknown>) => ({
            itemId: (r.itemId || r.item_id) as string,
            description: r.description as string,
            availableQty: (r.availableQty || r.available_qty) as number,
            unit: r.unit as string,
          })))
        }
      } catch {}
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading inventory...
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
        <Package className="h-8 w-8 opacity-30" />
        <p className="text-sm">No inventory items found</p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Item</th>
              <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Qty</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Unit</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={item.itemId} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                <td className="px-4 py-2.5">{item.description || item.itemId}</td>
                <td className="px-4 py-2.5 text-right font-medium">{item.availableQty}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{item.unit || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground mt-3">{items.length} item{items.length !== 1 ? "s" : ""} in inventory</p>
    </div>
  )
}
