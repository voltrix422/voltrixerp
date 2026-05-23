"use client"

import { useCallback, useEffect, useMemo, useState, type MouseEvent, type ReactNode } from "react"
import {
  deleteInventorySerialUnit,
  getInventorySerialUnits,
  serialNumberKey,
  type InventorySerialUnit,
} from "@/lib/inventory-serial-units"
import { getInventoryModelLabels, saveInventoryModelLabel } from "@/lib/inventory-model-labels"
import { downloadSerialUnitsExcel } from "@/lib/inventory-excel-export"
import { InventoryModelGroup } from "@/components/inventory/inventory-model-group"
import { InventoryQrScanPanel } from "@/components/inventory/inventory-qr-scan-panel"
import { CrmExcelExportButton } from "@/components/crm/crm-excel-export-button"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import {
  Package,
  Search,
  X,
  QrCode,
  Loader2,
  Boxes,
  Layers3,
  CircleCheck,
} from "lucide-react"

type InventorySerialViewProps = {
  /** Renders after Export Excel / Scan QR (e.g. Send multiple on branch detail). */
  toolbarEnd?: ReactNode
  /** Parent refresh when units are scanned or deleted. */
  onUnitsChanged?: () => void
  /** Tighter layout inside branch detail (no negative horizontal margin). */
  embedded?: boolean
}

export function InventorySerialView({ toolbarEnd, onUnitsChanged, embedded }: InventorySerialViewProps = {}) {
  const { toast } = useToast()
  const [units, setUnits] = useState<InventorySerialUnit[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [exportingExcel, setExportingExcel] = useState(false)
  const [showQrModal, setShowQrModal] = useState(false)
  const [expandedModels, setExpandedModels] = useState<Record<string, boolean>>({})
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [modelLabels, setModelLabels] = useState<Record<string, string>>({})
  const [editingModel, setEditingModel] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")
  const [savingModelLabel, setSavingModelLabel] = useState(false)

  const loadUnits = useCallback(async () => {
    setLoading(true)
    try {
      const [rows, labels] = await Promise.all([
        getInventorySerialUnits(),
        getInventoryModelLabels().catch(() => []),
      ])
      setUnits(rows)
      const map: Record<string, string> = {}
      for (const label of labels) {
        if (label.model && label.displayName) map[label.model] = label.displayName
      }
      for (const unit of rows) {
        const m = unit.model?.trim()
        if (!m || map[m]) continue
        const name = unit.productName?.trim()
        if (name && name !== m) map[m] = name
      }
      setModelLabels(map)
    } catch {
      toast({ title: "Error", message: "Could not load inventory.", type: "error" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void loadUnits()
  }, [loadUnits])

  function getDisplayName(modelKey: string) {
    return modelLabels[modelKey]?.trim() || ""
  }

  function startEditModelName(modelKey: string, e: MouseEvent) {
    e.stopPropagation()
    setEditingModel(modelKey)
    setEditingName(getDisplayName(modelKey))
  }

  async function saveModelName(modelKey: string) {
    setSavingModelLabel(true)
    try {
      const name = editingName.trim()
      await saveInventoryModelLabel(modelKey, name)
      setModelLabels((prev) => {
        const next = { ...prev }
        if (name) next[modelKey] = name
        else delete next[modelKey]
        return next
      })
      if (name) {
        setUnits((prev) =>
          prev.map((u) => (u.model === modelKey ? { ...u, productName: name } : u)),
        )
      }
      setEditingModel(null)
      toast({
        title: "Saved",
        message: name ? `Name set for ${modelKey}` : `Name cleared for ${modelKey}`,
        type: "success",
      })
    } catch (err) {
      toast({
        title: "Error",
        message: err instanceof Error ? err.message : "Could not save name.",
        type: "error",
      })
    } finally {
      setSavingModelLabel(false)
    }
  }

  const uniqueUnits = useMemo(() => {
    const byKey = new Map<string, InventorySerialUnit>()
    for (const unit of units) {
      const key = serialNumberKey(unit.serialNumber)
      if (!key) continue
      if (!byKey.has(key)) byKey.set(key, unit)
    }
    return Array.from(byKey.values())
  }, [units])

  const filteredUnits = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return uniqueUnits
    return uniqueUnits.filter(
      (u) =>
        u.serialNumber.toLowerCase().includes(q) ||
        (u.model || "").toLowerCase().includes(q) ||
        (u.productName || "").toLowerCase().includes(q) ||
        (u.specs || "").toLowerCase().includes(q) ||
        (u.notes || "").toLowerCase().includes(q),
    )
  }, [uniqueUnits, search])

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

  useEffect(() => {
    const q = search.trim()
    if (!q) return
    setExpandedModels((prev) => {
      const next = { ...prev }
      for (const [key] of groupedByModel) next[key] = true
      return next
    })
  }, [search, groupedByModel])

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
    void loadUnits().then(() => onUnitsChanged?.())
    setShowQrModal(false)
  }

  async function handleDeleteUnit(unit: InventorySerialUnit) {
    const label = unit.serialNumber || unit.model || "this unit"
    if (!confirm(`Remove SN ${label} from inventory? This cannot be undone.`)) return

    setDeletingId(unit.id)
    try {
      await deleteInventorySerialUnit(unit.id)
      setUnits((prev) => prev.filter((u) => u.id !== unit.id))
      onUnitsChanged?.()
      toast({
        title: "Removed",
        message: `SN ${unit.serialNumber} deleted from inventory.`,
        type: "success",
      })
    } catch (err) {
      toast({
        title: "Error",
        message: err instanceof Error ? err.message : "Could not delete unit.",
        type: "error",
      })
    } finally {
      setDeletingId(null)
    }
  }

  if (loading && units.length === 0) {
    return (
      <div className="flex items-center justify-center h-56 text-base text-[hsl(var(--muted-foreground))]">
        <Loader2 className="h-6 w-6 animate-spin mr-2.5" />
        Loading inventory…
      </div>
    )
  }

  const statItems = [
    { label: "Boxes", value: totalBoxes, icon: Boxes },
    { label: "Models", value: groupedByModel.length, icon: Layers3 },
    { label: "In stock", value: inStockCount, icon: CircleCheck },
  ]

  return (
    <div className={embedded ? "space-y-4" : "space-y-5"}>
      <div
        className={`rounded-xl border bg-[hsl(var(--card))] p-4 sm:p-5 ${embedded ? "" : "shadow-sm"}`}
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          {statItems.map((s) => {
            const Icon = s.icon
            return (
              <div
                key={s.label}
                className="flex items-center gap-3 rounded-lg border bg-[hsl(var(--background))] px-4 py-3.5"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#1faca6]/10 text-[#1faca6]">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-semibold tabular-nums text-[#1faca6] leading-none">{s.value}</p>
                  <p className="text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))] mt-1">
                    {s.label}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-lg">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search model, SN…"
              className="w-full h-10 rounded-lg border bg-[hsl(var(--background))] pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#1faca6]/40"
            />
          </div>
          <CrmExcelExportButton
            onExport={exportExcel}
            exporting={exportingExcel}
            disabled={filteredUnits.length === 0}
            className="h-10 px-4 text-sm gap-2 cursor-pointer shrink-0"
          />
          <Button
            className="h-10 px-4 text-sm bg-[#1faca6] hover:bg-[#17857f] text-white gap-2 shrink-0"
            onClick={() => setShowQrModal(true)}
          >
            <QrCode className="h-4 w-4" />
            Scan QR
          </Button>
          {toolbarEnd}
        </div>
      </div>

      {totalBoxes === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center text-[hsl(var(--muted-foreground))] rounded-xl border border-dashed bg-[hsl(var(--card))]/50">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[hsl(var(--muted))]/30 mb-3">
            <Package className="h-7 w-7 opacity-40" />
          </div>
          <p className="text-base font-medium text-[hsl(var(--foreground))]">No inventory yet</p>
          <p className="text-sm mt-1.5 max-w-sm">Scan QR to add boxes to the warehouse.</p>
          <Button
            className="mt-5 h-10 px-5 text-sm bg-[#1faca6] hover:bg-[#17857f] text-white gap-2"
            onClick={() => setShowQrModal(true)}
          >
            <QrCode className="h-4 w-4" />
            Scan QR
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden bg-[hsl(var(--card))] shadow-sm">
          <div className="hidden sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_88px_88px_64px] gap-3 px-4 py-3 border-b bg-[hsl(var(--muted))]/20 text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
            <span>Model / product</span>
            <span>Model code</span>
            <span className="text-right">Stock</span>
            <span className="text-right">Units</span>
            <span />
          </div>
          <div className="divide-y">
          {groupedByModel.map(([modelKey, modelUnits]) => (
            <InventoryModelGroup
              key={modelKey}
              modelKey={modelKey}
              modelUnits={modelUnits}
              expanded={expandedModels[modelKey] === true}
              onToggle={() => setExpandedModels((prev) => ({ ...prev, [modelKey]: !prev[modelKey] }))}
              customName={getDisplayName(modelKey)}
              isEditing={editingModel === modelKey}
              editingName={editingName}
              savingModelLabel={savingModelLabel}
              deletingId={deletingId}
              onEditingNameChange={setEditingName}
              onStartEdit={(e) => startEditModelName(modelKey, e)}
              onSaveName={() => void saveModelName(modelKey)}
              onCancelEdit={() => setEditingModel(null)}
              onDeleteUnit={(unit) => void handleDeleteUnit(unit)}
            />
          ))}
          </div>
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
