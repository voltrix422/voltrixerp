"use client"

import { useEffect, useMemo, useState } from "react"
import { Package, Search } from "lucide-react"
import { getOrderFulfillmentHistory, type OrderFulfillmentHistoryEntry } from "@/lib/order-fulfillment-history"

export function FulfillmentHistory() {
  const [rows, setRows] = useState<OrderFulfillmentHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  useEffect(() => {
    let mounted = true

    async function load() {
      const data = await getOrderFulfillmentHistory()
      if (!mounted) return
      setRows(data)
      setLoading(false)
    }

    load()
    const interval = setInterval(load, 30000)
    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return rows
    return rows.filter((r) =>
      r.orderNumber.toLowerCase().includes(q) ||
      r.clientName.toLowerCase().includes(q) ||
      r.dispatcherName.toLowerCase().includes(q) ||
      r.receiverName.toLowerCase().includes(q) ||
      r.vehicleNumber.toLowerCase().includes(q)
    )
  }, [rows, search])

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold">Fulfillment History</h3>
        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
          Complete record of order fulfillment details and uploaded proof images
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by order, client, dispatcher, receiver, vehicle..."
          className="w-full h-9 pl-9 pr-3 rounded-lg border bg-[hsl(var(--background))] text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-[hsl(var(--muted-foreground))]">
          Loading fulfillment history...
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Package className="h-12 w-12 text-[hsl(var(--muted-foreground))] opacity-30 mb-3" />
          <p className="text-sm font-medium">No fulfillment history found</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
            Fulfilled orders with images will appear here
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((entry) => {
            const imageUrls = [
              entry.receiverImageUrl,
              entry.receiverCnicImageUrl,
              entry.vehicleImageUrl,
              ...(entry.productImageUrls || []),
            ].filter(Boolean) as string[]

            return (
              <div key={entry.id} className="rounded-xl border p-4 bg-[hsl(var(--card))]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[hsl(var(--primary))]">{entry.orderNumber}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{entry.clientName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium">Fulfilled At</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      {new Date(entry.fulfilledAt).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
                  <div className="rounded-lg border p-2.5">
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase">Dispatcher</p>
                    <p className="text-sm font-medium mt-0.5">{entry.dispatcherName}</p>
                  </div>
                  <div className="rounded-lg border p-2.5">
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase">Receiver</p>
                    <p className="text-sm font-medium mt-0.5">{entry.receiverName}</p>
                  </div>
                  <div className="rounded-lg border p-2.5">
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase">Receiver CNIC</p>
                    <p className="text-sm font-medium mt-0.5">{entry.receiverCnic}</p>
                  </div>
                  <div className="rounded-lg border p-2.5">
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase">Vehicle</p>
                    <p className="text-sm font-medium mt-0.5">{entry.vehicleNumber}</p>
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-xs font-medium mb-2">Proof Images ({imageUrls.length})</p>
                  {imageUrls.length === 0 ? (
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">No images uploaded.</p>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {imageUrls.map((url, index) => (
                        <a key={`${entry.id}-${index}`} href={url} target="_blank" rel="noreferrer">
                          <img
                            src={url}
                            alt={`Fulfillment proof ${index + 1}`}
                            className="w-full h-28 object-cover rounded-lg border hover:opacity-90 transition-opacity cursor-pointer"
                          />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
