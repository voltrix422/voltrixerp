"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { getInventorySerialUnits, type InventorySerialUnit } from "@/lib/inventory-serial-units"
import { downloadSerialUnitsExcel } from "@/lib/inventory-excel-export"
import { InventoryQrScanPanel } from "@/components/inventory/inventory-qr-scan-panel"
import { CrmExcelExportButton } from "@/components/crm/crm-excel-export-button"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/toast"
import {
  Package,
  Search,
  X,
  QrCode,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react"

function formatDate(iso?: string) {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleDateString("en-PK")
  } catch {
    return iso
  }
}

export function InventorySerialView() {
  const { toast } = useToast()
  const [units, setUnits] = useState<InventorySerialUnit[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [exportingExcel, setExportingExcel] = useState(false)
  const [showQrModal, setShowQrModal] = useState(false)
  const [expandedModels, setExpandedModels] = useState<Record<string, boolean>>({})

  const loadUnits = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await getInventorySerialUnits()
      setUnits(rows)
    } catch {
      toast({ title: "Error", message: "Could not load inventory.", type: "error" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void loadUnits()
  }, [loadUnits])

  const filteredUnits = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return units
    return units.filter(
      (u) =>
        u.serialNumber.toLowerCase().includes(q) ||
        (u.model || "").toLowerCase().includes(q) ||
        (u.productName || "").toLowerCase().includes(q) ||
        (u.specs || "").toLowerCase().includes(q) ||
        (u.notes || "").toLowerCase().includes(q),
    )
  }, [units, search])

  const groupedByModel = useMemo(() => {
    const map = new Map<string, InventorySerialUnit[]>()
    for (const unit of filteredUnits) {
      const key = unit.model?.trim() || "Unknown model"
      const list = map.get(key) ?? []
      list.push(unit)
      map.set(key, list)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [filteredUnits])

  const totalBoxes = filteredUnits.length
  const inStockCount = filteredUnits.filter((u) => u.status === "in_stock").length

  function exportExcel() {
    setExportingExcel(true)
    try {
      downloadSerialUnitsExcel(filteredUnits)
      toast({
        title: "Download started",
        message: `${filteredUnits.length} unit(s) exported.`,
        type: "success",
      })
    } catch {
      toast({ title: "Error", message: "Could not export.", type: "error" })
    } finally {
      setExportingExcel(false)
    }
  }

  function handleScanSaved() {
    void loadUnits()
    setShowQrModal(false)
  }

  if (loading && units.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-[hsl(var(--muted-foreground))]">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading inventory…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 -mx-6 px-6">
        <div className="flex flex-wrap items-center gap-3 text-xs text-[hsl(var(--muted-foreground))]">
          <span>
            <strong className="text-[hsl(var(--foreground))]">{totalBoxes}</strong> box
            {totalBoxes !== 1 ? "es" : ""}
          </span>
          <span>·</span>
          <span>
            <strong className="text-[hsl(var(--foreground))]">{groupedByModel.length}</strong> model
            {groupedByModel.length !== 1 ? "s" : ""}
          </span>
          <span>·</span>
          <span>
            <strong className="text-[hsl(var(--foreground))]">{inStockCount}</strong> in stock
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search model, SN…"
              className="w-full h-8 rounded-md border bg-[hsl(var(--background))] pl-9 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
            />
          </div>
          <CrmExcelExportButton
            onExport={exportExcel}
            exporting={exportingExcel}
            disabled={filteredUnits.length === 0}
          />
          <Button
            size="sm"
            className="h-8 text-xs bg-[#1faca6] hover:bg-[#17857f] text-white gap-1.5"
            onClick={() => setShowQrModal(true)}
          >
            <QrCode className="h-3.5 w-3.5" />
            Scan QR
          </Button>
        </div>
      </div>

      {totalBoxes === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-[hsl(var(--muted-foreground))] border border-dashed rounded-lg">
          <Package className="h-10 w-10 opacity-30 mb-3" />
          <p className="text-sm font-medium text-[hsl(var(--foreground))]">No inventory yet</p>
          <p className="text-xs mt-1 max-w-sm">Tap Scan QR to receive boxes into the warehouse.</p>
          <Button
            size="sm"
            className="mt-4 h-8 text-xs bg-[#1faca6] hover:bg-[#17857f] text-white"
            onClick={() => setShowQrModal(true)}
          >
            <QrCode className="h-3.5 w-3.5 mr-1.5" />
            Scan QR
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {groupedByModel.map(([modelKey, modelUnits]) => {
            const expanded = expandedModels[modelKey] !== false
            return (
              <div key={modelKey} className="rounded-lg border overflow-hidden">
                <button
                  type="button"
                  className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-[hsl(var(--muted))]/30 hover:bg-[hsl(var(--muted))]/50 text-left"
                  onClick={() => setExpandedModels((prev) => ({ ...prev, [modelKey]: !expanded }))}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{modelKey}</p>
                    {modelUnits[0]?.productName && modelUnits[0].productName !== modelKey && (
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))] truncate mt-0.5">
                        {modelUnits[0].productName}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge className="bg-[#1faca6] text-white text-[10px]">{modelUnits.length} pcs</Badge>
                    {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </button>
                {expanded && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-t bg-[hsl(var(--muted))]/20">
                          <th className="px-4 py-2 text-left font-semibold text-[hsl(var(--muted-foreground))]">SN</th>
                          <th className="px-4 py-2 text-left font-semibold text-[hsl(var(--muted-foreground))]">Item ref</th>
                          <th className="px-4 py-2 text-left font-semibold text-[hsl(var(--muted-foreground))]">Received</th>
                          <th className="px-4 py-2 text-left font-semibold text-[hsl(var(--muted-foreground))]">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {modelUnits.map((unit) => (
                          <tr key={unit.id} className="hover:bg-[hsl(var(--muted))]/20">
                            <td className="px-4 py-2 font-medium break-all">{unit.serialNumber}</td>
                            <td className="px-4 py-2 text-[hsl(var(--muted-foreground))]">{unit.specs || "—"}</td>
                            <td className="px-4 py-2 text-[hsl(var(--muted-foreground))]">{formatDate(unit.scannedAt)}</td>
                            <td className="px-4 py-2">
                              <Badge variant="secondary" className="text-[10px] capitalize">
                                {unit.status.replace(/_/g, " ")}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showQrModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setShowQrModal(false)}
        >
          <div
            className="w-full max-w-2xl max-h-[92vh] rounded-xl border bg-[hsl(var(--card))] shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
              <div>
                <p className="text-sm font-semibold flex items-center gap-2">
                  <QrCode className="h-4 w-4 text-[#1faca6]" />
                  Bulk QR receiving
                </p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                  Scan each box, then complete scan to save.
                </p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowQrModal(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <InventoryQrScanPanel
                existingSerialNumbers={units.map((u) => u.serialNumber)}
                onSaved={handleScanSaved}
                compact
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

