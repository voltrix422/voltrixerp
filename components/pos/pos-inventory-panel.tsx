"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { InventoryQrScanPanel } from "@/components/inventory/inventory-qr-scan-panel"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/components/auth-provider"
import { useToast } from "@/components/ui/toast"
import {
  formatCurrency,
  getPosStockProducts,
  receivePosManualLine,
  type PosStockProduct,
} from "@/lib/pos"
import { getInventorySerialUnits } from "@/lib/inventory-serial-units"
import { Loader2, Package, Plus } from "lucide-react"

type Props = {
  onStockUpdated?: () => void
}

export function PosInventoryPanel({ onStockUpdated }: Props) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [stock, setStock] = useState<PosStockProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [existingSerials, setExistingSerials] = useState<string[]>([])
  const [manualModel, setManualModel] = useState("")
  const [manualQty, setManualQty] = useState(1)
  const [manualPrice, setManualPrice] = useState(0)
  const [manualSaving, setManualSaving] = useState(false)

  const loadStock = useCallback(async () => {
    setLoading(true)
    try {
      const [products, units] = await Promise.all([
        getPosStockProducts(true),
        getInventorySerialUnits(),
      ])
      setStock(products)
      setExistingSerials(units.map((u) => u.serialNumber))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadStock()
  }, [loadStock])

  const totalUnits = useMemo(
    () => stock.reduce((sum, row) => sum + row.availableQty, 0),
    [stock],
  )

  function handleSaved() {
    void loadStock()
    onStockUpdated?.()
  }

  async function handleManualAdd(e: React.FormEvent) {
    e.preventDefault()
    const model = manualModel.trim()
    if (!model) {
      toast({ type: "error", title: "Enter model or product name" })
      return
    }
    if (manualQty < 1) {
      toast({ type: "error", title: "Quantity must be at least 1" })
      return
    }
    setManualSaving(true)
    try {
      const result = await receivePosManualLine({
        model,
        qty: manualQty,
        unitPrice: manualPrice,
        scannedBy: user?.name || "POS",
      })
      if (!result.ok) {
        toast({ type: "error", title: result.error || "Could not add stock" })
        return
      }
      toast({
        type: "success",
        title: `Added ${manualQty} × ${model} to POS inventory`,
      })
      setManualModel("")
      setManualQty(1)
      setManualPrice(0)
      handleSaved()
    } finally {
      setManualSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-[hsl(var(--card))] p-4">
        <p className="text-sm font-semibold flex items-center gap-2 mb-1">
          <Package className="h-4 w-4 text-[#1faca6]" />
          Add products with QR
        </p>
        <p className="text-xs text-[hsl(var(--muted-foreground))] mb-4">
          Scan each box QR or upload a label photo — same as inventory receiving. Quantities are grouped by model and appear in the Register tab.
        </p>
        <InventoryQrScanPanel
          compact
          receiveTarget="pos"
          existingSerialNumbers={existingSerials}
          onSaved={handleSaved}
        />
      </div>

      <form
        onSubmit={handleManualAdd}
        className="rounded-lg border bg-[hsl(var(--card))] p-4 space-y-3"
      >
        <p className="text-sm font-semibold">Quick add (no QR)</p>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          Add quantity by model name when you do not have serial numbers to scan.
        </p>
        <div className="grid sm:grid-cols-4 gap-2">
          <input
            required
            value={manualModel}
            onChange={(e) => setManualModel(e.target.value)}
            placeholder="Model / product name"
            className="sm:col-span-2 h-10 rounded-lg border px-3 text-sm"
          />
          <input
            type="number"
            min={1}
            value={manualQty}
            onChange={(e) => setManualQty(Number(e.target.value) || 1)}
            placeholder="Qty"
            className="h-10 rounded-lg border px-3 text-sm"
          />
          <input
            type="number"
            min={0}
            value={manualPrice || ""}
            onChange={(e) => setManualPrice(Number(e.target.value) || 0)}
            placeholder="Price (Rs)"
            className="h-10 rounded-lg border px-3 text-sm"
          />
        </div>
        <Button type="submit" size="sm" disabled={manualSaving} className="gap-1">
          {manualSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add to POS stock
        </Button>
      </form>

      <div className="rounded-lg border overflow-hidden">
        <div className="px-4 py-3 border-b flex flex-wrap items-center justify-between gap-2 bg-[hsl(var(--muted))]/20">
          <p className="text-sm font-medium">POS inventory ({stock.length} products)</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            {totalUnits} unit{totalUnits !== 1 ? "s" : ""} available to sell
          </p>
        </div>
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-[#1a9f9a]" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[hsl(var(--muted))]/30 text-xs">
              <tr>
                <th className="text-left px-3 py-2">Product</th>
                <th className="text-right px-3 py-2">Qty</th>
                <th className="text-right px-3 py-2">Price</th>
              </tr>
            </thead>
            <tbody>
              {stock.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="px-3 py-2 font-medium">{row.description}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {row.availableQty} {row.unit}
                  </td>
                  <td className="px-3 py-2 text-right">{formatCurrency(row.costPrice)}</td>
                </tr>
              ))}
              {stock.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-10 text-center text-[hsl(var(--muted-foreground))] text-xs">
                    No products yet. Scan QR labels above or use quick add.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
